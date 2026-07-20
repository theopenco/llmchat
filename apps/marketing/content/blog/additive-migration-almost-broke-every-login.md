---
title: "'Additive columns are always safe' is wrong on Drizzle, Prisma, and preview deploys"
description: "Everyone agrees an additive column is the one schema change that can't hurt you. Then a one-line ALTER TABLE on our user table turned out to be capable of 500ing every authenticated request — because Drizzle projects every mapped column, Better Auth reads the user table on every session check, and preview deploys skip migrations. Here is the two-PR discipline we ship our riskiest schema changes with, and the one column we keep out of the ORM entirely."
seoDescription: "Why 'additive nullable columns are safe' fails with Drizzle/Prisma and preview deploys, and the two-PR migration pattern that keeps auth from 500ing."
date: "2026-07-20"
category: "Engineering"
featured: false
cover: "/blog/additive-migration-almost-broke-every-login.jpg"
coverAlt: "Dark code window on a violet gradient showing the 0017_user_role.sql migration comment explaining why the role column stays out of the Drizzle schema"
---

Migration `0017_user_role.sql` in our repo is one line of SQL under eighteen lines of comment, and the comment is the interesting part: it explains why the column it adds must never appear in our ORM schema. Declared the way every tutorial shows, that one additive column would have 500'd every authenticated request on any database that hadn't run the migration yet. "Additive nullable columns are always safe" is received wisdom, and on a modern stack it is false: ORMs like Drizzle and Prisma enumerate every mapped column on every SELECT, preview deploys run new code against old schemas, and auth libraries query your user table on every request — so one unmigrated column can fail every query that touches its table.

To be precise about what actually happened, because this is easy to overclaim: no production outage. What we had was a string of preview deploys 500ing on columns that existed only in code, and one near-miss — that `role` column — where the same mechanism pointed straight at the auth hot path. This is the failure mode we kept almost shipping, and the discipline that stopped it. Clanker Support is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)), so every file, commit, and PR below is public.

## Why "additive columns are always safe" became folklore

The belief was earned, and it predates ORMs. Adding a nullable column — or a `NOT NULL` column with a default, the other blessed shape — rewrites nothing. In SQLite it's a metadata change; Postgres has done the same for defaulted columns since version 11. No lock, no backfill, no data risk. And the load-bearing clause: old code ignores columns it doesn't know about. `SELECT id, email FROM user` does not care what else the table grew this week.

That clause was true when column lists were handwritten. Then they started being generated from schema files that ship with the application code, and the clause quietly inverted: now the code can know about a column before the database does. Additive migrations are safe when the schema definition trails the database. They are dangerous when it leads — and on a modern deploy pipeline, it leads all the time.

## Your ORM selects every column you map

Drizzle does not emit `SELECT *`. An unprojected `select().from(user)` expands to an explicit list of every column mapped on the table object in `packages/db/src/schema.ts` — for our `user` table, all seven of them, by name. Map an eighth column that the database doesn't have yet and every one of those queries throws `no such column`, including queries whose calling code never reads the new field. The migration isn't what breaks. Reads that predate the feature are what break.

This is not a Drizzle quirk. Prisma's generated client selects every scalar field by default unless you pass `select`. Rails people know the mirror image of this rule from column _removal_ — you set `ignored_columns` before dropping, because the schema cache still names the column — but explicit-projection ORMs make column _addition_ just as directional. Any ORM that generates its column lists from a checked-in schema has the same property: the table's every reader is coupled to the schema file's most recent line.

## Preview deploys run new code against old schemas

For the mismatch to bite, some environment has to serve new code against an old database. Our platform hands us that environment on every branch: production deploys apply the migrations in `apps/api/migrations/`, preview deploys don't. A branch that adds a column and maps it in `schema.ts` gets a preview whose code names a column its database will never have. We watched exactly this — previews returning 500s for a column only prod would ever get — which is the cheap version of the lesson, paid in red preview checks instead of pages.

Previews are the guaranteed case, not the only one. A Vercel preview pointed at a shared staging database has the same gap, and so does a Neon branch-per-preview setup where the branch was snapshotted before your migration existed. So does every self-hosted install that pulls your code before running your migrations — and, potentially, production itself during the deploy window: our platform's docs don't specify whether migrations apply before the new worker starts serving traffic, so we defend against both orders rather than betting on one. The environments differ; the shape is identical: the schema file leads, the database trails, and the ORM faults on the gap.

## The auth library that reads your user table on every request

Here is the multiplier that turns a red preview into a near-catastrophe. We were adding a platform-admin `role` to `user` for our internal admin console — a column that gates three admin routes only our own team calls. Its natural blast radius is approximately zero. Its actual blast radius, had we mapped it in Drizzle, is documented in a comment we now keep on the table itself:

```ts
// packages/db/src/schema.ts
// NOTE: the PLATFORM-admin role column (migration 0017_user_role.sql) is
// deliberately NOT modeled on this Drizzle table. Better Auth's Drizzle
// adapter loads the session user with an UNPROJECTED `select().from(user)`
// (every column of this table object) on every getSession, so declaring
// `role` here would make that auth hot-path query reference a column a preview
// DB — which skips migrations — does not have, 500-ing ALL authenticated
// requests.
```

Better Auth's adapter hydrates the full user object on every session check. That is not a bug, and we want to be fair about it: the adapter can't know which subset of columns your application needs, so returning the whole row is a reasonable contract, and Better Auth core has otherwise been solid for us. But it means the `user` table's column list is load-bearing for 100% of authenticated traffic, and any column you add to the mapping joins the hottest path in the system the moment you commit it. A column nobody reads would have taken down the inbox, the settings pages, sign-in — everything behind a session — on any lagging database.

The transferable lesson is not "audit your auth library". It's that your dependencies' query shapes are production behavior you own. You can read every line of your own code and still not know which of your tables gets an unprojected read per request.

## Two PRs per schema change: migrate before you serve

The fix is old — the expand/contract pattern, in miniature. Every schema change on the tables our hottest paths read — `message`, `conversation`, `user` — ships as two pull requests. Phase 1 is the `ALTER TABLE`, its comment, and a seed-contract test; `schema.ts` is deliberately untouched, so no deployable code can name the column under any deploy ordering, in any environment. Phase 2 — the Drizzle mapping, the endpoints, the UI — merges only after phase 1 is live in production. We should admit the discipline is risk-scoped, not universal: lower-stakes columns on `project` — settings fields read by a handful of routes — still went out as single PRs (`0016`, `0020`, `0021`), which is a bet that nobody needs that table's preview to work that week. The hot tables don't get the bet. The migration files carry the reasoning in full, and they've become the best documentation in the repo:

```sql
-- apps/api/migrations/0022_message_reply_to.sql
-- PHASE 1 of 2 (deliberate migrate-before-serve split, mirroring 0014/0015).
-- Ploy's deploy ordering between "apply migrations" and "new Worker serves
-- traffic" is undocumented, so this PR ships ONLY the column — schema.ts is
-- intentionally NOT changed, so the live Worker never SELECTs a column that might
-- not exist yet (drizzle projects every column of `message`, and /v1/chat +
-- /v1/messages read it on the hottest paths; no read can 500 under any ordering).
ALTER TABLE `message` ADD COLUMN `reply_to_message_id` text;
```

We've run the split three times so far:

- **`0014` conversation summaries** — migration in PR #76, feature in PR #77, merged 24 minutes apart on June 22.
- **`0015` resolve attribution** — migration in PR #91, feature in PR #92, 41 minutes apart on June 29.
- **`0022` quote-reply** — migration in PR #142 on July 12, feature in PR #143 two hours later that night, once the column was confirmed live (the phase-2 commit message records that "migration 0022 is already live in prod").

That's the honest cost accounting: two PRs instead of one, and between 24 minutes and a couple of hours of waiting. Against that, for the changes we split, there is no deployable commit where code names the column before its migration is live in prod — the class of 500 becomes unrepresentable. The long comments are part of the discipline, not decoration: a one-line `ALTER TABLE` in its own PR looks like pointless ceremony six months later, and the comment is what stops the next person from helpfully collapsing it back into one.

## The column we keep out of the ORM entirely

`user.role` is the extreme case: phase 2 never came, on purpose. Because the `user` table's mapping is read unprojected on every request, the column stays out of `schema.ts` indefinitely, and the admin gate reads it with a raw SQL projection wrapped in a fallback (the `/admin/users` listing uses the same guarded shape):

```ts
// apps/api/src/middleware/admin.ts
try {
	const rows = await db(c.env)
		.select({ role: sql<string>`role` })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	role = rows[0]?.role ?? null;
} catch {
	role = null;
}
```

On a database without the `0017` migration, the read throws, `role` degrades to `null`, and the requester is a non-admin — a 403, never a 500. Failing toward least privilege is the correct direction for an admin gate anyway, so the defensive shape costs nothing.

One loose end remained: Drizzle's `query.user.findFirst` without a `columns` option is also a select-everything of the row. Commit `e287d58` swept the last two of those — billing checkout and project creation, each of which only ever read `.email` — down to explicit projections:

```ts
// apps/api/src/routes/billing.ts
const owner = await db(c.env).query.user.findFirst({
	where: (u, { eq: e }) => e(u.id, userId),
	columns: { email: true },
});
```

The invariant that fell out is easy to state and easy to check in review: exactly two queries in the codebase name `role` — the admin gate and the `/admin/users` listing — and both are wrapped in a try/catch that degrades to least privilege. Everything else touching `user` says which columns it wants. Once production and every preview convention has settled, the column can be folded into the schema like any other — the comment on the table says as much — but there is no hurry, because the current shape cannot break.

## When a schema change needs the two-PR split

| Change                                                                | Blast radius if code ships first                            | What to do                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| New table                                                             | None — no deployed code queries it                          | One PR is fine                                                              |
| New column, mapped in the ORM                                         | Every ORM read of that table, via the generated column list | Two PRs: migration alone, then mapping + feature                            |
| New column on a table a dependency reads unprojected (auth, sessions) | Every authenticated request                                 | Two PRs — or keep the column out of the ORM behind a guarded raw projection |
| Dropping a column                                                     | Deployed code still projects it during the rollout window   | Two PRs in reverse: remove the mapping first, drop later                    |
| Self-hosted installs exist                                            | You never control when they migrate                         | Treat every schema change as two-phase, always                              |

The first question to ask about any table is the one we didn't know to ask: who reads it that you didn't write? For `message` it was our own hot paths, which we could see. For `user` it was our auth library, which we couldn't — until we looked at the queries it actually emits.

This is the second time that habit has paid for itself. When we [moved the backend to workerd](/blog/cloudflare-workers-every-node-sdk-broke), the lesson was to audit transitive dependencies, not imports — the package that broke your deploy wasn't the one you installed. This one is the same lesson at the database layer: audit your dependencies' query shapes, not just your own reads. The code you didn't write is still your production behavior. The migration comments in `apps/api/migrations/` are all public if you want the long-form version; they're better reading than most of our docs.

## FAQ

### Is adding a nullable column a safe migration?

Only if no deployed code selects it before it exists. The database operation is safe; the hazard is your ORM. Drizzle and Prisma generate explicit column lists from the schema definition, so a mapped-but-unmigrated column fails every read of that table — in previews that skip migrations, in self-hosted installs, and during the deploy window itself.

### Why does my preview deploy fail with "no such column"?

Your branch maps a new column in the ORM schema, but the preview database never ran the branch's migration. The ORM names the column on every SELECT of that table, and the database rejects it. Ship the migration in its own PR first, and add the ORM mapping only after the column is live everywhere that serves traffic.

### What is the expand/contract migration pattern?

Splitting a schema change so that every deployed version of the code works against both the old and new schema: add the column first (expand), deploy, then ship the code that uses it; for removals, delete the code references first, then drop the column (contract). Our two-PR split is the smallest useful version of it.
