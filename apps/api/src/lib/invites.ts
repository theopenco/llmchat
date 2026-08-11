// Member-invite primitives (docs/goals/invites.md). The token is a bearer
// credential: 256 bits from the CSPRNG, delivered ONLY inside the emailed
// link, stored ONLY as a SHA-256 hash (the order-verification.ts discipline).
// Possession of the link is the authorization proof — the R2 decision: with
// email verification unshipped (#80), password accounts stay unverified
// forever, and an unverified email match proves nothing (lib/admin.ts states
// the same rule for admin grants).

import { escapeHtml } from "./email";

/** How long an invite link stays redeemable (locked: 7 days). */
export const INVITE_TTL_SECONDS = 7 * 86400;

/** 32 CSPRNG bytes as base64url — the bearer token that rides the link. */
export function generateInviteToken(): string {
	const buf = new Uint8Array(32);
	crypto.getRandomValues(buf);
	let bin = "";
	for (const b of buf) {
		bin += String.fromCharCode(b);
	}
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** SHA-256 hex — the only form of the token that ever touches the database. */
export async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export function buildInviteEmail(args: {
	workspaceName: string;
	inviterName: string | null;
	role: "admin" | "agent";
	link: string;
}) {
	const ws = escapeHtml(args.workspaceName);
	const inviter = args.inviterName
		? escapeHtml(args.inviterName)
		: "A teammate";
	const role = args.role === "admin" ? "an admin" : "an agent";
	const subject = `You've been invited to ${args.workspaceName} on Clanker Support`;
	const html = [
		`<p>${inviter} invited you to join <strong>${ws}</strong> on Clanker Support as ${role}.</p>`,
		`<p><a href="${args.link}">Accept the invitation</a></p>`,
		`<p>This link is personal and expires in 7 days. If you weren't expecting it, you can ignore this email.</p>`,
	].join("\n");
	const text = `${inviter} invited you to join ${args.workspaceName} on Clanker Support as ${role}.\n\nAccept: ${args.link}\n\nThis link is personal and expires in 7 days. If you weren't expecting it, you can ignore this email.`;
	return { subject, html, text };
}
