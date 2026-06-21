import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import AccountSettingsPage from "./page";

import type { Account } from "@/lib/account";

beforeAll(() => {
	Element.prototype.scrollIntoView = vi.fn();
	Element.prototype.hasPointerCapture ??= () => false;
});

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const signOut = vi.fn(async () => {});
vi.mock("@/lib/auth-client", () => ({ signOut: () => signOut() }));
vi.mock("@/lib/analytics", () => ({ resetAnalytics: vi.fn() }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
	toast: {
		success: (m: string) => toastSuccess(m),
		error: (m: string) => toastError(m),
	},
}));

vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

let calls: { path: string; method: string; body?: unknown }[];

function baseAccount(over: Partial<Account> = {}): Account {
	return {
		name: "Ada Lovelace",
		email: "ada@example.io",
		hasPassword: false,
		impact: {
			workspaces: 1,
			projects: 2,
			conversations: 9,
			sources: 3,
			members: 1,
		},
		blockers: { activeSubscription: false, drift: false, coOwner: false },
		...over,
	};
}

function setupApi(account: Account) {
	calls = [];
	let current = account;
	vi.mocked(api).mockImplementation(
		async (path: string, opts: { method?: string; body?: unknown } = {}) => {
			const method = opts.method ?? "GET";
			calls.push({ path, method, body: opts.body });
			if (path === "/api/account" && method === "PATCH") {
				current = { ...current, name: (opts.body as { name: string }).name };
			}
			if (path === "/api/account" && method === "DELETE") return { ok: true };
			return current;
		},
	);
}

function renderPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<AccountSettingsPage />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	replace.mockClear();
	signOut.mockClear();
	toastSuccess.mockClear();
	toastError.mockClear();
	setupApi(baseAccount());
});

describe("AccountSettingsPage — profile (PR1)", () => {
	it("shows the name (editable) and the read-only email + support note", async () => {
		renderPage();
		const nameInput = await screen.findByLabelText("Name");
		expect(nameInput).toHaveValue("Ada Lovelace");
		const emailInput = screen.getByLabelText("Email (read-only)");
		expect(emailInput).toHaveValue("ada@example.io");
		expect(emailInput).toHaveAttribute("readonly");
		expect(
			screen.getByText(/contact support to change your email/i),
		).toBeInTheDocument();
	});

	it("saves the name (PATCH + toast)", async () => {
		const user = userEvent.setup();
		renderPage();
		const nameInput = await screen.findByLabelText("Name");
		await user.clear(nameInput);
		await user.type(nameInput, "Grace Hopper");
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
				name: "Grace Hopper",
			}),
		);
		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith("Name updated"),
		);
	});
});

describe("AccountSettingsPage — danger zone", () => {
	it("states the deletion impact with the real counts", async () => {
		renderPage();
		await screen.findByLabelText("Name");
		expect(
			screen.getByText(
				/permanently removes 1 workspace, 2 projects, 9 conversations, 3 sources, and 1 team member/i,
			),
		).toBeInTheDocument();
	});

	it("active subscription → disables delete, shows a Billing link", async () => {
		setupApi(
			baseAccount({
				blockers: { activeSubscription: true, drift: false, coOwner: false },
			}),
		);
		renderPage();
		await screen.findByLabelText("Name");
		expect(screen.getByText(/cancel your subscription/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete account" }),
		).toBeDisabled();
		// A Billing link exists in the danger zone (in addition to the Billing card).
		expect(
			screen.getAllByRole("link", { name: /billing/i }).length,
		).toBeGreaterThanOrEqual(2);
	});

	it("co-owner → guard message + disabled delete", async () => {
		setupApi(
			baseAccount({
				blockers: { activeSubscription: false, drift: false, coOwner: true },
			}),
		);
		renderPage();
		await screen.findByLabelText("Name");
		expect(
			screen.getByText(/share ownership of a workspace/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete account" }),
		).toBeDisabled();
	});

	it("drift → contact-support message + disabled delete", async () => {
		setupApi(
			baseAccount({
				blockers: { activeSubscription: false, drift: true, coOwner: false },
			}),
		);
		renderPage();
		await screen.findByLabelText("Name");
		expect(
			screen.getByText(/couldn't confirm your billing status/i),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Delete account" }),
		).toBeDisabled();
	});
});

describe("AccountSettingsPage — delete flow", () => {
	it("OAuth-only: type-email → confirm → DELETE, signOut, redirect to sign-in", async () => {
		const user = userEvent.setup();
		setupApi(baseAccount({ hasPassword: false }));
		renderPage();
		await screen.findByLabelText("Name");

		await user.click(screen.getByRole("button", { name: "Delete account" }));
		const dialog = await screen.findByRole("alertdialog");
		// No password field for an OAuth-only user.
		expect(within(dialog).queryByLabelText("Password")).not.toBeInTheDocument();

		const confirmBtn = within(dialog).getByRole("button", {
			name: /delete account/i,
		});
		expect(confirmBtn).toBeDisabled(); // until the email matches
		await user.type(
			within(dialog).getByLabelText("Confirm email"),
			"ada@example.io",
		);
		expect(confirmBtn).toBeEnabled();
		await user.click(confirmBtn);

		await waitFor(() => {
			const d = calls.find((c) => c.method === "DELETE");
			expect(d).toBeTruthy();
			expect(d!.body).toEqual({ confirmEmail: "ada@example.io" });
		});
		await waitFor(() => expect(signOut).toHaveBeenCalled());
		await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
	});

	it("credential user: requires the password field before confirm arms", async () => {
		const user = userEvent.setup();
		setupApi(baseAccount({ hasPassword: true }));
		renderPage();
		await screen.findByLabelText("Name");

		await user.click(screen.getByRole("button", { name: "Delete account" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.type(
			within(dialog).getByLabelText("Confirm email"),
			"ada@example.io",
		);
		// Email matches but password is still empty → confirm stays disabled.
		const confirmBtn = within(dialog).getByRole("button", {
			name: /delete account/i,
		});
		expect(confirmBtn).toBeDisabled();
		await user.type(within(dialog).getByLabelText("Password"), "hunter2");
		expect(confirmBtn).toBeEnabled();
		await user.click(confirmBtn);
		await waitFor(() => {
			const d = calls.find((c) => c.method === "DELETE");
			expect(d!.body).toEqual({
				confirmEmail: "ada@example.io",
				password: "hunter2",
			});
		});
	});
});
