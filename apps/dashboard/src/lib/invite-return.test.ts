import { describe, expect, it } from "vitest";

import {
	inviteTokenFrom,
	postAuthDestination,
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
