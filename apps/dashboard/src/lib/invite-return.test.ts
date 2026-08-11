import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	consumePendingInvite,
	inviteTokenFrom,
	peekPendingInvite,
	PENDING_INVITE_KEY,
	postAuthDestination,
	stashPendingInvite,
	withInvite,
} from "./invite-return";

// The invitee's path through auth is the one place the default destination is
// wrong: a brand-new invitee sent to /onboarding hits the paywall before a
// first project, for a workspace someone else already pays for.
describe("invite-return", () => {
	it("sends an authenticating invitee back to their invitation", () => {
		expect(postAuthDestination("invite=TOK123", "/onboarding")).toBe(
			"/invite/TOK123",
		);
		expect(postAuthDestination("invite=TOK123", "/inbox")).toBe(
			"/invite/TOK123",
		);
	});

	it("leaves the normal destinations alone when there's no invitation", () => {
		expect(postAuthDestination("", "/onboarding")).toBe("/onboarding");
		expect(postAuthDestination(null, "/inbox")).toBe("/inbox");
		expect(postAuthDestination("foo=bar", "/inbox")).toBe("/inbox");
		expect(postAuthDestination("invite=", "/inbox")).toBe("/inbox");
	});

	it("preserves the invitation across the sign-in ⇄ sign-up links", () => {
		expect(withInvite("/sign-in", "invite=TOK123")).toBe(
			"/sign-in?invite=TOK123",
		);
		expect(withInvite("/sign-up", "")).toBe("/sign-up");
	});

	it("encodes tokens so URL-special characters survive the round trip", () => {
		const token = "a+b/c=d";
		const dest = postAuthDestination(
			new URLSearchParams({ invite: token }),
			"/inbox",
		);
		expect(dest).toBe(`/invite/${encodeURIComponent(token)}`);
		expect(decodeURIComponent(dest.replace("/invite/", ""))).toBe(token);
	});

	it("reads the token from either a string or URLSearchParams", () => {
		expect(inviteTokenFrom("invite=TOK")).toBe("TOK");
		expect(inviteTokenFrom(new URLSearchParams("invite=TOK"))).toBe("TOK");
		expect(inviteTokenFrom(undefined)).toBeNull();
	});
});

// The OAuth round-trip drops the query param (the hosted flow returns to a
// fixed callbackURL), so the token crosses it via a sessionStorage stash that
// the /onboarding boot check consumes.
describe("pending-invite stash (the OAuth round-trip)", () => {
	beforeEach(() => {
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	it("stashes, peeks without consuming, then consumes exactly once", () => {
		stashPendingInvite("TOK123");
		expect(peekPendingInvite()).toBe("TOK123");
		expect(peekPendingInvite()).toBe("TOK123"); // peek is not destructive
		expect(consumePendingInvite()).toBe("TOK123");
		expect(peekPendingInvite()).toBeNull(); // single-use: gone after consume
		expect(consumePendingInvite()).toBeNull();
	});

	it("stashing null clears a stale token — a plain sign-in can't be hijacked", () => {
		stashPendingInvite("TOK_STALE");
		stashPendingInvite(null);
		expect(peekPendingInvite()).toBeNull();
		expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
	});

	it("treats a whitespace-only stash as absent", () => {
		sessionStorage.setItem(PENDING_INVITE_KEY, "   ");
		expect(peekPendingInvite()).toBeNull();
	});

	it("degrades to no-stash when storage is unavailable (never throws)", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError");
		});
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});
		expect(() => stashPendingInvite("TOK")).not.toThrow();
		expect(peekPendingInvite()).toBeNull();
		expect(consumePendingInvite()).toBeNull();
	});
});
