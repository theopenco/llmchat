---
title: "Two messages, one sequence number: the concurrency bug that never threw"
description: "An escalation marker and the AI reply it interrupted landed in the same conversation with the same sequence number. No exception, no log line, both inserts succeeded, and the thread quietly rendered out of order. This is the read-then-write bug that passes every test, the three-part fix whose deploy order is the point, and the five-second code search that tells you whether your codebase has it too."
seoDescription: "A silent SQLite race gave two support messages the same sequence number. The atomic INSERT fix, the deploy order that matters, and the 5-second audit."
date: "2026-07-26"
category: "Engineering"
featured: false
cover: "/blog/two-messages-same-sequence-number.jpg"
coverAlt: "Dark code window on a violet gradient showing the INSERT statement that lets the database allocate a message's sequence number atomically"
---

One day, two messages in the same support conversation both had `sequence = 2`. Both inserts succeeded and nothing was logged; everything downstream simply picked an order. The colliding pair says it all: the "Visitor requested a human operator" marker and the AI answer the visitor was escalating away from, and depending on which order a client picked, the request for a human rendered before or after the answer that prompted it. That `sequence` integer is load-bearing in Clanker Support: the widget orders the thread by it, the dashboard inbox orders by it, unread tracking uses it as a high-water mark. For a support product, that is close to the worst available failure. The conversation thread is the artifact your customer trusts, and a garbled support thread fails the way a garbled bank statement does: the customer stops believing the record.

The expensive property of this bug class is who finds it. It never appears in tests, never appears in logs, and the corruption compounds quietly, so the first person positioned to notice is a customer reading a thread that makes no sense — long after the writes that caused it. We caught it in our own testing before it cost anyone anything; we're early, and that's the cheapest possible place to catch it. Nothing about the race changes at scale except how much data it quietly ruins first. The product is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)), so everything below links to real diffs.

## Two sins, one write path

Every writer in the system did some version of this: read the conversation, do work, then write a message whose sequence was computed from the earlier read. Simplified:

```ts
// BEFORE: read early, write late
const convo = await db.query.conversation.findFirst({
	where: eq(conversation.id, conversationId),
});

// ... 5–20 seconds of LLM streaming happens here ...

await db.insert(message).values({
	conversationId,
	content,
	sequence: convo.messageCount + 1, // computed from a read made earlier
});
await db.update(conversation).set({ messageCount: convo.messageCount + 1 }); // absolute assignment
```

Sin one: `sequence` is computed from `messageCount` as it stood when this request read it. If any other writer inserts between the read and the insert, both writers saw `messageCount = 3` and both write `sequence = 4`. SQLite takes both rows without complaint.

Sin two: the count update is an absolute assignment. Writer A sets `messageCount = 4`; writer B, working from the same stale read, also sets it to 4. Two messages arrived and the count moved by one. The damage compounds from there, because the next writer derives its sequence from a count that's already wrong, so one race seeds the next.

We had no shortage of concurrent writers, either. The chat handler persists the assistant's reply after the stream finishes, inside `waitUntil`, seconds after it read the conversation. An operator can reply from the dashboard inbox at any moment. Internal notes land. An escalation writes a system message. An inbound email reply arrives through a webhook. Five independent writers, all doing read-then-write against the same counter.

## Why every test passed

Our tests exercised each writer in isolation: insert a user message, assert sequence 1; insert a reply, assert sequence 2. Green across the board.

The race needs two writers interleaved inside the same window, and the widest window in the whole system is the one no unit test reproduces: the assistant-persist that runs after an LLM stream completes. In tests the "stream" resolves instantly with nothing else running. In production it takes 5 to 20 seconds, and the true trigger is mundane: the visitor hits "Talk to a human" mid-stream (the exact collision we found), or an operator replies from the inbox while the agent is still streaming. Either one lands a write inside the gap every single time it happens.

So tests pass because they're sequential, and production fails because it isn't. No quantity of extra tests fixes that cleanly. The gap itself has to go.

## The fix shipped in three steps, and the order is the point

You can't just add a unique index: the old writers are still running while you deploy, and the index build fails outright if duplicates exist. You can't just fix the writers either: existing duplicate rows stay corrupted, and any future regression goes back to being silent. So the fix went out as three deploys, strictly ordered.

### Clean the data first

The backfill ([the public pull request](https://github.com/theopenco/llmchat/pull/161)) finds every conversation with at least one duplicated `(conversation_id, sequence)` pair, renumbers all of that conversation's messages with `ROW_NUMBER()`, then trues up the drifted `message_count`. Lightly trimmed:

```sql
CREATE TABLE _seq_backfill AS
	SELECT id AS mid,
		ROW_NUMBER() OVER (PARTITION BY conversation_id
			ORDER BY sequence, created_at, id) AS new_seq
	FROM message
	WHERE conversation_id IN (
		SELECT conversation_id FROM message
		GROUP BY conversation_id, sequence HAVING COUNT(*) > 1);

UPDATE message
SET sequence = (SELECT new_seq FROM _seq_backfill WHERE mid = message.id)
WHERE id IN (SELECT mid FROM _seq_backfill);

DROP TABLE _seq_backfill;

UPDATE conversation
SET message_count = (SELECT COUNT(*) FROM message m WHERE m.conversation_id = conversation.id)
WHERE message_count <> (SELECT COUNT(*) FROM message m WHERE m.conversation_id = conversation.id);
```

Two details worth stealing. The `ORDER BY sequence, created_at, id` makes the renumbering deterministic: ties on the duplicated sequence break by creation time, and ties on creation time break by id. That last tiebreaker matters more than it looks — our timestamps are unix seconds, so same-second writes are common, which is the whole bug. Run the backfill twice and you get the same answer. And it stages through a temp table rather than a correlated self-update, because renumbering a partition while you're reading it is how you end up with a backfill you can't reason about.

### One writer, and the database allocates the key

[The writer refactor](https://github.com/theopenco/llmchat/pull/162) replaces every inline insert-and-bump in every route with one function: `insertMessage()` in `apps/api/src/lib/messages.ts`. Chat persist, operator reply, notes, escalation markers, inbound email replies: all of them now go through it.

The core move is that the sequence is allocated by a scalar subquery inside the INSERT itself:

```ts
db(env)
	.insert(message)
	.values({
		conversationId: input.conversationId,
		role: input.role,
		content: input.content,
		// ...
		sequence: sql`(SELECT COALESCE(MAX(${message.sequence}), 0) + 1 FROM ${message} WHERE ${message.conversationId} = ${input.conversationId})`,
	})
	.returning();
```

That's the entire trick. SQLite (and D1, which is SQLite at the edge) serialize writers per statement, so `MAX(sequence) + 1` and the insert are atomic. There is no gap between reading the current max and writing the next value, because they're the same statement. The database allocates the ordering key, and the application never holds it in a variable where it can go stale.

The counter fix rides along:

```ts
const bumped = await db(env)
	.update(conversation)
	.set({
		messageCount: sql`${conversation.messageCount} + 1`,
		updatedAt: new Date(),
	})
	.where(eq(conversation.id, input.conversationId))
	.returning({ messageCount: conversation.messageCount });
```

`message_count = message_count + 1` is commutative: two concurrent bumps produce +2 no matter how they interleave, where two absolute assignments produced +1. The `RETURNING` clause hands the post-bump count back to callers so nobody is tempted to re-derive it from a sequence number.

### The unique index that makes any regression loud

The last deploy adds [the unique index](https://github.com/theopenco/llmchat/pull/163) that makes any regression loud:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS message_conv_seq_uidx
	ON message (conversation_id, sequence);
```

And the part we'd get wrong if we did this again without notes: that migration re-runs the exact same dedupe backfill, immediately before creating the index, in the same migration. Between the backfill deploy and the writer deploy, the old racy writers were still live in production. Any duplicate they minted in that window would make the index build fail and take the whole deploy down with it. The re-dedupe costs nothing when the data is already clean and saves the deploy when it isn't. (We're rigid about deploy ordering around risky schema changes in general — it's the same discipline that kept [an "always safe" additive column from breaking every login](/blog/additive-migration-almost-broke-every-login).)

Once the new writer is live, the index should never fire. It exists so that if someone adds an inline insert with a precomputed sequence eight months from now, the result is a constraint error in the logs instead of six more weeks of silently shuffled threads. Downgrading a bug from silent corruption to loud error is most of the value of the whole exercise.

## Drizzle buries the error your retry path needs on `.cause`

`insertMessage()` has a retry path: if an insert ever trips the unique index, it retries once, and the re-run subquery naturally picks the next free slot. To do that it has to detect a unique-constraint violation, and our first attempt was the obvious one:

```ts
// looks right, never matches in prod
if (err instanceof Error && /unique constraint failed/i.test(err.message)) {
```

It never matches. Drizzle 0.45 wraps every driver error in a `DrizzleQueryError` whose message reads `"Failed query: insert into message ..."`. The actual `UNIQUE constraint failed: message.conversation_id, message.sequence` text lives on `err.cause`, one level down. A message-only check compiles, passes any test that fakes the error, and silently classifies every real violation as an unknown error to rethrow. The retry path becomes dead code, and you find out the day the tripwire fires and nothing retries.

The version that works walks the cause chain, with a cycle guard because `cause` can technically point anywhere:

```ts
function isUniqueViolation(err: unknown): boolean {
	const seen = new Set<unknown>();
	for (let e: unknown = err; e && !seen.has(e); ) {
		seen.add(e);
		const msg = e instanceof Error ? e.message : String(e);
		if (/unique constraint failed/i.test(msg)) {
			return true;
		}
		e = (e as { cause?: unknown }).cause;
	}
	return false;
}
```

If you classify database errors through any ORM, check whether the string you match lives on `.message` or on `.cause.message`. `Error.cause` chains have been standard since ES2022, and most error-classification code we've read predates them.

## The five-second audit

The rule underneath all of this: never derive an ordering key from state you read earlier in the request. Not a sequence number, and not a version counter either. The moment the value leaves the database and sits in a variable it's a snapshot, and every millisecond between read and write is a window some other writer will eventually hit. Streams, webhooks, and background jobs stretch those windows to seconds.

You don't need to write code to check your own product for this today. Ask whoever owns the backend to search the codebase for `count + 1` or `position + 1` computed in application code and written back later. The search takes about five seconds, and each hit is this bug wearing different clothes. Then ask two follow-ups: is there one writer function for that key, and is there a database constraint that would make a violation loud? If either answer is no, you have this bug on a timer.

The repair, when you need it, is the same recipe in the same order:

1. **Backfill first**, deterministically and idempotently, so the data is clean.
2. **Let the database allocate the key atomically**, in the same statement as the write, through one writer function with no exceptions.
3. **Add the constraint last**, re-cleaning immediately before you build it, so the bug class becomes impossible rather than unlikely, and any regression is a loud error instead of quiet drift.

All three diffs are small enough to read in one sitting, and every one of them is public on [our repo](https://github.com/theopenco/llmchat).

## FAQ

### How do you safely generate a per-group sequence number in SQLite or D1?

Allocate it inside the INSERT itself with a scalar subquery: `sequence = (SELECT COALESCE(MAX(sequence), 0) + 1 FROM message WHERE conversation_id = ?)`. SQLite serializes writers per statement, so reading the current max and writing the next value happen atomically. Any pattern that reads a counter into application code first has a race window, and streaming or background work stretches that window to seconds.

### Why isn't a unique index alone enough to fix a sequence race?

Deploys aren't instantaneous. While the index migration runs, older application code with the racy writer is still serving traffic, and any existing duplicates make the index build fail outright. Clean the data first, route every write through one atomic writer, then create the index, re-running the dedupe immediately before it to absorb duplicates minted between deploys.

### Why doesn't err.message contain "UNIQUE constraint failed" with Drizzle?

Drizzle 0.45 wraps driver errors in a `DrizzleQueryError` whose message describes the failed query; the constraint text lives on `err.cause`. Walk the cause chain (with a cycle guard) when classifying database errors, or your retry and fallback paths will silently never run.
