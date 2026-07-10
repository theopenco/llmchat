import { afterEach, describe, expect, it, vi } from "vitest";

import type { Env } from "@/env";

import type { SendArgs } from "./email";
import {
	confirmReturnVerification,
	generateVerificationCode,
	isReturnVerified,
	normalizeOrderKey,
	startReturnVerification,
} from "./order-verification";

function fakeEnv() {
	const store = new Map<string, string>();
	const env = {
		STATE: {
			get: vi.fn(async (k: string) => store.get(k) ?? null),
			set: vi.fn(async (k: string, v: string) => {
				store.set(k, v);
			}),
		},
		vars: {},
	} as unknown as Env;
	return { env, store };
}

const OPTS = {
	conversationId: "conv1",
	orderKey: "1001",
	email: "ada@example.com",
	projectName: "Acme Tools",
};

/** Start a verification and capture the emailed code. */
async function startAndCapture(env: Env) {
	const send = vi.fn(async (_env: Env, _args: SendArgs) => ({ id: "test" }));
	const outcome = await startReturnVerification(env, OPTS, send);
	const args = send.mock.calls[0]?.[1];
	const code = args?.text?.match(/(\d{6})/)?.[1];
	return { outcome, send, code };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("normalizeOrderKey", () => {
	it("strips the #, trims, and lowercases", () => {
		expect(normalizeOrderKey("#1001")).toBe("1001");
		expect(normalizeOrderKey("  #AB-12 ")).toBe("ab-12");
		expect(normalizeOrderKey("1001")).toBe("1001");
	});
});

describe("generateVerificationCode", () => {
	it("always yields exactly six digits", () => {
		for (let i = 0; i < 50; i++) {
			expect(generateVerificationCode()).toMatch(/^\d{6}$/);
		}
	});
});

describe("startReturnVerification", () => {
	it("emails the code and stores only its hash", async () => {
		const { env, store } = fakeEnv();
		const { outcome, send, code } = await startAndCapture(env);
		expect(outcome).toBe("sent");
		expect(code).toMatch(/^\d{6}$/);
		expect(send).toHaveBeenCalledOnce();
		const sendArgs = send.mock.calls[0]![1];
		expect(sendArgs.to).toBe("ada@example.com");
		expect(sendArgs.subject).toContain("Acme Tools");
		const stored = store.get("overif:conv1:1001")!;
		expect(stored).toBeTruthy();
		expect(stored).not.toContain(code); // hash only, never the plaintext
		expect(JSON.parse(stored)).toMatchObject({
			email: "ada@example.com",
			attempts: 0,
		});
	});

	it("caps code sends per conversation (limited, no email)", async () => {
		const { env } = fakeEnv();
		const send = vi.fn(async () => ({ id: "t" }));
		for (let i = 0; i < 3; i++) {
			expect(await startReturnVerification(env, OPTS, send)).toBe("sent");
		}
		expect(await startReturnVerification(env, OPTS, send)).toBe("limited");
		expect(send).toHaveBeenCalledTimes(3);
	});

	it("a failed email does NOT consume the send budget (Resend outage)", async () => {
		const { env } = fakeEnv();
		const throwing = vi.fn(
			async (_env: Env, _args: SendArgs): Promise<{ id: string }> => {
				throw new Error("resend 503");
			},
		);
		// Three failed sends during an outage...
		for (let i = 0; i < 3; i++) {
			expect(await startReturnVerification(env, OPTS, throwing)).toBe(
				"unavailable",
			);
		}
		// ...leave the budget intact, so recovery still lets a real code through.
		const ok = vi.fn(async () => ({ id: "t" }));
		expect(await startReturnVerification(env, OPTS, ok)).toBe("sent");
	});

	it("fails closed as unavailable on a STATE outage", async () => {
		const { env } = fakeEnv();
		(env.STATE.get as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("down"),
		);
		const send = vi.fn(async () => ({ id: "t" }));
		expect(await startReturnVerification(env, OPTS, send)).toBe("unavailable");
		expect(send).not.toHaveBeenCalled();
	});

	it("re-issuing replaces the old code", async () => {
		const { env } = fakeEnv();
		const first = await startAndCapture(env);
		const second = await startAndCapture(env);
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: first.code!,
			}),
		).toBe("invalid");
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: second.code!,
			}),
		).toBe("verified");
	});
});

describe("confirmReturnVerification", () => {
	it("verifies the right code, binds the email, and burns the code", async () => {
		const { env } = fakeEnv();
		const { code } = await startAndCapture(env);
		const outcome = await confirmReturnVerification(env, {
			conversationId: "conv1",
			orderKey: "1001",
			code: ` ${code} `, // visitor whitespace tolerated
		});
		expect(outcome).toBe("verified");
		await expect(
			isReturnVerified(env, {
				conversationId: "conv1",
				orderKey: "1001",
				email: "ADA@example.com", // case-insensitive match
			}),
		).resolves.toBe(true);
		// The verified flag never authorizes a different address.
		await expect(
			isReturnVerified(env, {
				conversationId: "conv1",
				orderKey: "1001",
				email: "mallory@example.com",
			}),
		).resolves.toBe(false);
		// A redeemed code is burned.
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: code!,
			}),
		).toBe("expired");
	});

	it("counts wrong attempts and locks after five", async () => {
		const { env } = fakeEnv();
		const { code } = await startAndCapture(env);
		for (let i = 0; i < 5; i++) {
			expect(
				await confirmReturnVerification(env, {
					conversationId: "conv1",
					orderKey: "1001",
					code: "000000",
				}),
			).toBe(i < 4 ? "invalid" : "locked");
		}
		// Even the RIGHT code is refused once locked.
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: code!,
			}),
		).toBe("locked");
		await expect(
			isReturnVerified(env, {
				conversationId: "conv1",
				orderKey: "1001",
				email: "ada@example.com",
			}),
		).resolves.toBe(false);
	});

	it("reports expired for missing and stale codes", async () => {
		const { env, store } = fakeEnv();
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: "123456",
			}),
		).toBe("expired");
		const { code } = await startAndCapture(env);
		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + 11 * 60_000); // past the 10-min TTL
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: code!,
			}),
		).toBe("expired");
		expect(store.has("overif-ok:conv1:1001")).toBe(false);
	});

	it("fails closed as unavailable on a STATE outage", async () => {
		const { env } = fakeEnv();
		const { code } = await startAndCapture(env);
		(env.STATE.get as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("down"),
		);
		expect(
			await confirmReturnVerification(env, {
				conversationId: "conv1",
				orderKey: "1001",
				code: code!,
			}),
		).toBe("unavailable");
	});
});

describe("isReturnVerified", () => {
	it("expires the verified flag after its TTL", async () => {
		const { env } = fakeEnv();
		const { code } = await startAndCapture(env);
		await confirmReturnVerification(env, {
			conversationId: "conv1",
			orderKey: "1001",
			code: code!,
		});
		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + 31 * 60_000); // past the 30-min TTL
		await expect(
			isReturnVerified(env, {
				conversationId: "conv1",
				orderKey: "1001",
				email: "ada@example.com",
			}),
		).resolves.toBe(false);
	});

	it("fails closed on a STATE outage", async () => {
		const { env } = fakeEnv();
		(env.STATE.get as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("down"),
		);
		await expect(
			isReturnVerified(env, {
				conversationId: "conv1",
				orderKey: "1001",
				email: "ada@example.com",
			}),
		).resolves.toBe(false);
	});
});
