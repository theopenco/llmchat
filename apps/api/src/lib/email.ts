import type { Env } from "@/env";

export interface SendArgs {
	to: string;
	subject: string;
	html: string;
	text?: string;
	replyTo?: string;
	headers?: Record<string, string>;
}

export async function sendEmail(env: Env, args: SendArgs) {
	if (!env.vars.RESEND_API_KEY) {
		console.log("[email] RESEND_API_KEY not set — logging instead of sending");
		console.log(`[email] to: ${args.to}`);
		console.log(`[email] subject: ${args.subject}`);
		if (args.replyTo) console.log(`[email] reply-to: ${args.replyTo}`);
		console.log(`[email] body: ${args.html}`);
		return { id: "dev-noop" };
	}
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.vars.RESEND_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from: env.vars.RESEND_FROM_EMAIL,
			to: args.to,
			subject: args.subject,
			html: args.html,
			text: args.text,
			reply_to: args.replyTo,
			headers: args.headers,
		}),
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Resend error ${res.status}: ${body}`);
	}
	return (await res.json()) as { id: string };
}

// Permissive single-address check: a non-empty local part, "@", and a dotted
// domain with no whitespace or stray "$" (catches unexpanded `$VAR` env refs).
const EMAIL_RE = /^[^\s@$]+@[^\s@$]+\.[^\s@$]+$/;

export function buildReplyToAddress(
	env: Env,
	inboundEmailLocal: string | null | undefined,
): string | undefined {
	const domain = env.vars.INBOUND_EMAIL_DOMAIN?.trim();
	const local = inboundEmailLocal?.trim();
	// Without a configured inbound domain (and a project local part) we can't
	// build a deliverable address — omit reply_to rather than send Resend an
	// invalid value (e.g. `reply+@undefined` or an unexpanded `$VAR`), which it
	// rejects with a 422 and which would fail the whole send.
	if (!domain || !local) {
		return undefined;
	}
	const address = `reply+${local}@${domain}`;
	return EMAIL_RE.test(address) ? address : undefined;
}

export function escapeHtml(text: string) {
	const map: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#x27;",
	};
	return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}
