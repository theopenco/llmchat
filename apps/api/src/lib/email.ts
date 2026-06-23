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

export function buildReplyToAddress(env: Env, inboundEmailLocal: string) {
	return `reply+${inboundEmailLocal}@${env.vars.INBOUND_EMAIL_DOMAIN}`;
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

/** Subject/html/text for the email-verification message. The link is escaped for
 * the href (the `&` between token & callbackURL must become `&amp;`). Kept brand-
 * plain — this is the account email, not customer-facing support agent copy. */
export function buildVerificationEmail(verifyUrl: string): {
	subject: string;
	html: string;
	text: string;
} {
	const href = escapeHtml(verifyUrl);
	return {
		subject: "Verify your email for Clanker Support",
		text: `Confirm your email to finish setting up your Clanker Support account:\n\n${verifyUrl}\n\nThis link expires shortly. If you didn't create an account, you can ignore this email.`,
		html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
<h1 style="font-size:20px;margin:0 0 12px">Verify your email</h1>
<p style="margin:0 0 20px;line-height:1.5">Confirm your email to finish setting up your Clanker Support account.</p>
<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Verify email</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#666">Or paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="${href}" style="color:#4f46e5">${href}</a></p>
<p style="margin:0;font-size:12px;color:#999">This link expires shortly. If you didn't create an account, you can ignore this email.</p>
</div>`,
	};
}
