import { Resend } from "resend";

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
	const resend = new Resend(env.RESEND_API_KEY);
	const result = await resend.emails.send({
		from: env.RESEND_FROM_EMAIL,
		to: args.to,
		subject: args.subject,
		html: args.html,
		text: args.text,
		replyTo: args.replyTo,
		headers: args.headers,
	});
	if (result.error) {
		throw new Error(`Resend error: ${result.error.message}`);
	}
	return result.data;
}

export function buildReplyToAddress(env: Env, inboundEmailLocal: string) {
	return `reply+${inboundEmailLocal}@${env.INBOUND_EMAIL_DOMAIN}`;
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
