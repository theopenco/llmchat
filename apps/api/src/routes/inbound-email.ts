import { Hono } from "hono";

import { db } from "@/lib/db";
import { insertMessage } from "@/lib/messages";
import { escapeHtml, sendEmail } from "@/lib/email";
import { captureInBackground } from "@/lib/posthog";
import { verifySvixSignature } from "@/lib/svix";

import { message } from "@llmchat/db";
import { ANALYTICS_EVENTS } from "@llmchat/shared";

import type { AppContext, Env } from "@/env";

// Stopgap shared inbox: until a real team mailbox exists, mail the inbound
// domain receives for ANY team address — every local part that is not a
// reply+ conversation address (contact@, support@, hello@, …) — is copied to
// these personal addresses, always, before and regardless of conversation
// threading. Once forwarded, the delivery is acknowledged with a 200 even
// when threading fails: a non-2xx makes Resend retry, and every retry would
// re-forward a duplicate copy.
const FORWARD_INBOUND_DOMAIN = "clankersupport.com";
const FORWARD_INBOUND_TO = [
	"haythamchhilif@gmail.com",
	"contact@luca-steeb.com",
];

/**
 * Every bare address the email was delivered to. `to` alone is not enough:
 * Resend puts the actual envelope recipient in `received_for` (the only
 * reliable field when the address was BCC'd), and `cc` can carry it too.
 */
function recipientAddresses(email: InboundEmail): string[] {
	return [
		...(email.to ?? []),
		...(email.cc ?? []),
		...(email.received_for ?? []),
	]
		.map(parseFromAddress)
		.filter((a): a is string => a !== null);
}

/** True when any recipient is a team address on the inbound domain. */
function isForwardTrigger(email: InboundEmail): boolean {
	return recipientAddresses(email).some((addr) => {
		const lower = addr.toLowerCase();
		return (
			lower.endsWith(`@${FORWARD_INBOUND_DOMAIN}`) &&
			!lower.startsWith("reply+")
		);
	});
}

// Resend wraps inbound mail in an `{ type, data }` envelope; the parsed email
// lives under `data`. `from` is an RFC-5322 string ("Name <a@b>" or "a@b"),
// `to` an array of such strings. The webhook carries METADATA ONLY — the body
// (text/html/headers) must be fetched from `/emails/receiving/:email_id`.
interface InboundEvent {
	type?: string;
	data?: InboundEmail;
}

interface InboundEmail {
	email_id?: string;
	from?: string;
	to?: string[];
	cc?: string[];
	received_for?: string[];
	subject?: string;
	text?: string;
	html?: string;
	headers?: Record<string, string> | Array<{ name: string; value: string }>;
}

function parseInboundLocal(toAddress: string): string | null {
	const m = toAddress.match(/^reply\+([^@]+)@/);
	return m ? m[1]! : null;
}

/** Extract the bare address from an RFC-5322 string ("Name <a@b>" → "a@b"). */
function parseFromAddress(from: string | undefined): string | null {
	if (!from) {
		return null;
	}
	// Keep the original casing: conversation.email is stored as the visitor
	// entered it, and the fallback match compares it exactly.
	const angle = from.match(/<([^>]+)>/);
	return (angle ? angle[1]! : from).trim() || null;
}

/** Read a header case-insensitively from either a record or a name/value array. */
function getHeader(
	headers: InboundEmail["headers"],
	name: string,
): string | undefined {
	if (!headers) {
		return undefined;
	}
	const lower = name.toLowerCase();
	if (Array.isArray(headers)) {
		return headers.find((h) => h.name?.toLowerCase() === lower)?.value;
	}
	const hit = Object.entries(headers).find(([k]) => k.toLowerCase() === lower);
	return hit?.[1];
}

/**
 * Copy a received email to the stopgap team addresses. Best-effort: a forward
 * failure must never break conversation threading, so failures are only
 * logged. Reply-To is set to the original sender so replying from a personal
 * inbox goes to the visitor, not back at the webhook.
 */
async function forwardInboundCopy(env: Env, email: InboundEmail) {
	const meta = `From: ${email.from ?? "unknown"}\nTo: ${(email.to ?? []).join(", ") || "unknown"}`;
	const text = `${meta}\n\n${email.text ?? "(no text body)"}`;
	const metaHtml = `<p style="color:#666;font-size:12px;margin:0 0 8px">${escapeHtml(meta).replace(/\n/g, "<br>")}</p><hr>`;
	const html =
		metaHtml +
		(email.html ?? `<pre>${escapeHtml(email.text ?? "(no text body)")}</pre>`);
	const results = await Promise.allSettled(
		FORWARD_INBOUND_TO.map((to) =>
			sendEmail(env, {
				to,
				subject: `Fwd: ${email.subject ?? "(no subject)"}`,
				html,
				text,
				replyTo: parseFromAddress(email.from) ?? undefined,
			}),
		),
	);
	for (const [i, r] of results.entries()) {
		if (r.status === "rejected") {
			console.error(
				`[inbound-email] forward to ${FORWARD_INBOUND_TO[i]} failed`,
				r.reason,
			);
		}
	}
}

/**
 * Fetch the full received email (body + headers) by id. The webhook payload is
 * metadata-only, so this is required to get text/html and the In-Reply-To
 * header used for threading. Best-effort: returns null on any failure.
 */
async function fetchReceivedEmail(
	apiKey: string,
	emailId: string,
): Promise<InboundEmail | null> {
	try {
		const res = await fetch(
			`https://api.resend.com/emails/receiving/${emailId}`,
			{ headers: { authorization: `Bearer ${apiKey}` } },
		);
		if (!res.ok) {
			console.error(
				`inbound-email: fetch body failed ${res.status}: ${await res.text()}`,
			);
			return null;
		}
		const body = (await res.json()) as InboundEmail & { data?: InboundEmail };
		// The REST response returns the email object directly; tolerate a `data`
		// envelope just in case.
		return body.data ?? body;
	} catch (err) {
		console.error("inbound-email: fetch body errored", err);
		return null;
	}
}

export const inboundEmail = new Hono<AppContext>().post(
	"/webhooks/inbound-email",
	async (c) => {
		// This webhook is mounted at the root and is otherwise unauthenticated, so a
		// forged POST could inject a reply into ANY conversation. Verify Resend's
		// Svix signature over the RAW body before trusting it. Fails closed:
		// unsigned/invalid — or no signing secret configured — ⇒ 401, nothing read.
		const rawBody = await c.req.text();
		const signed = await verifySvixSignature(
			rawBody,
			{
				id: c.req.header("svix-id") ?? null,
				timestamp: c.req.header("svix-timestamp") ?? null,
				signature: c.req.header("svix-signature") ?? null,
			},
			c.env.vars.RESEND_INBOUND_WEBHOOK_SECRET,
		);
		if (!signed) {
			return c.json({ error: "invalid signature" }, 401);
		}
		let event: InboundEvent;
		try {
			event = JSON.parse(rawBody) as InboundEvent;
		} catch {
			return c.json({ error: "invalid payload" }, 400);
		}
		// The parsed email lives under `data`; tolerate a flat payload too so we
		// don't crash on shape drift.
		const email = event.data ?? (event as InboundEmail);

		// The webhook is metadata-only — fetch the full email for body + headers
		// when they're absent (and we have an id + key to do so). Fetched before
		// any matching so the forwarded copy below carries the body too.
		let full = email;
		if (
			(email.text == null || email.headers == null) &&
			email.email_id &&
			c.env.vars.RESEND_API_KEY
		) {
			const fetched = await fetchReceivedEmail(
				c.env.vars.RESEND_API_KEY,
				email.email_id,
			);
			if (fetched) {
				full = { ...email, ...fetched };
			}
		}

		// Copy team-address mail to the team's personal inboxes (stopgap until a
		// shared mailbox exists). This runs unconditionally, before any
		// project/conversation matching — team mail must always redirect.
		const forwarded = isForwardTrigger(full);
		if (forwarded) {
			await forwardInboundCopy(c.env, full);
		}
		// Once forwarded, the delivery is fully handled no matter what the
		// threading below decides — a non-2xx would make Resend retry, and every
		// retry re-forwards a duplicate copy to the team.
		const fail = (error: string, status: 400 | 404) =>
			forwarded
				? c.json({ ok: true, forwarded: true, skipped: error })
				: c.json({ error }, status);

		const localPart = recipientAddresses(full)
			.map(parseInboundLocal)
			.find((v): v is string => v !== null);
		if (!localPart) {
			if (!forwarded) {
				console.warn("[inbound-email] no matching local part; to=", full.to);
			}
			return fail("no matching local part", 400);
		}
		const fromAddress = parseFromAddress(full.from);
		if (!fromAddress) {
			console.warn("[inbound-email] no sender address; from=", full.from);
			return fail("no sender address", 400);
		}
		const proj = await db(c.env).query.project.findFirst({
			where: (pt, { eq: e }) => e(pt.inboundEmailLocal, localPart),
		});
		if (!proj) {
			return fail("project not found", 404);
		}

		const inReplyTo = getHeader(full.headers, "In-Reply-To")?.replace(
			/[<>]/g,
			"",
		);
		let conv = inReplyTo
			? await db(c.env).query.conversation.findFirst({
					where: (ct, { and, eq: e, exists }) =>
						and(
							e(ct.projectId, proj.id),
							exists(
								db(c.env)
									.select()
									.from(message)
									.where(
										and(
											e(message.conversationId, ct.id),
											e(message.emailMessageId, inReplyTo),
										),
									),
							),
						),
				})
			: undefined;

		const matchedByThread = !!conv;
		if (!conv) {
			conv = await db(c.env).query.conversation.findFirst({
				where: (ct, { and, eq: e }) =>
					and(e(ct.projectId, proj.id), e(ct.email, fromAddress)),
				orderBy: (ct, { desc }) => desc(ct.updatedAt),
			});
		}

		if (!conv) {
			return fail("conversation not found", 404);
		}

		const content = (full.text ?? full.html ?? "").trim();
		if (!content) {
			console.warn(
				"[inbound-email] empty body; has text/html keys=",
				Object.keys(full),
			);
			return fail("empty body", 400);
		}
		await insertMessage(c.env, {
			conversationId: conv.id,
			role: "user",
			content,
		});

		// `matched` says whether In-Reply-To threading worked or the sender
		// fallback caught it — a rising fallback share means clients are dropping
		// our Message-ID and threading needs attention.
		captureInBackground(c, {
			event: ANALYTICS_EVENTS.inboundEmailReceived,
			distinctId: conv.clientId,
			properties: {
				project_id: proj.id,
				workspace_id: proj.workspaceId,
				matched: matchedByThread ? "in_reply_to" : "sender_fallback",
			},
		});

		return c.json({ ok: true });
	},
);
