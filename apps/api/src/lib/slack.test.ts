import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildEscalationSlackText, sendEscalationSlack } from "./slack";

import type { Env } from "@/env";

const env = {
	vars: { DASHBOARD_URL: "https://dash.example.com" },
} as unknown as Env;

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("buildEscalationSlackText", () => {
	it("includes the project name, conversation id, and inbox link", () => {
		const text = buildEscalationSlackText({
			projectName: "Acme",
			conversationId: "conv_1",
			dashboardUrl: "https://dash.example.com/",
		});
		expect(text).toContain("*Acme*");
		expect(text).toContain("conv_1");
		expect(text).toContain("https://dash.example.com/inbox");
	});

	it("omits the inbox line when no dashboard url is given", () => {
		const text = buildEscalationSlackText({
			projectName: "Acme",
			conversationId: "conv_1",
		});
		expect(text).not.toContain("Inbox:");
	});
});

describe("sendEscalationSlack", () => {
	it("POSTs to the webhook when one is set", async () => {
		await sendEscalationSlack(
			env,
			{ name: "Acme", slackWebhookUrl: "https://hooks.slack.com/xyz" },
			"conv_1",
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0]!;
		expect(url).toBe("https://hooks.slack.com/xyz");
		expect(init?.method).toBe("POST");
		const body = JSON.parse(String(init?.body));
		expect(body.text).toContain("*Acme*");
		expect(body.text).toContain("conv_1");
	});

	it("skips the POST when the webhook is unset or blank", async () => {
		await sendEscalationSlack(
			env,
			{ name: "Acme", slackWebhookUrl: null },
			"c",
		);
		await sendEscalationSlack(
			env,
			{ name: "Acme", slackWebhookUrl: "  " },
			"c",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("never throws when the webhook POST fails", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
		await expect(
			sendEscalationSlack(
				env,
				{ name: "Acme", slackWebhookUrl: "https://hooks.slack.com/xyz" },
				"conv_1",
			),
		).resolves.toBeUndefined();

		fetchMock.mockRejectedValueOnce(new Error("network down"));
		await expect(
			sendEscalationSlack(
				env,
				{ name: "Acme", slackWebhookUrl: "https://hooks.slack.com/xyz" },
				"conv_1",
			),
		).resolves.toBeUndefined();

		expect(errorSpy).toHaveBeenCalledTimes(2);
		errorSpy.mockRestore();
	});
});
