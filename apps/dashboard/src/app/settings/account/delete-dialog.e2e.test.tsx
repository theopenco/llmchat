// Through-the-dialog test: the REAL AccountSettingsPage + REAL DeleteAccountDialog
// + REAL api()/fetch (only window.fetch is stubbed). This exercises the
// button → fetch path end to end — the gap that let a dead "Delete account"
// button ship past the earlier mocked-`api` test. It asserts a DELETE actually
// fires AND that clicking confirm does NOT close the dialog (the old
// AlertDialogAction auto-close was the root cause).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));
// NOTE: @/lib/api is NOT mocked — real api()/fetch path is exercised.

function account(over: Partial<Account> = {}): Account {
	return {
		name: "Ada",
		email: "ada@example.io",
		hasPassword: false,
		impact: {
			workspaces: 1,
			projects: 1,
			conversations: 0,
			sources: 0,
			members: 1,
		},
		blockers: { activeSubscription: false, drift: false, coOwner: false },
		...over,
	};
}

let fetchMock: ReturnType<typeof vi.fn>;
/** Resolve the pending DELETE response on demand so we can observe the in-flight
 * (dialog-stays-open) state. */
let resolveDelete: (v: unknown) => void;

function jsonRes(body: unknown) {
	return {
		ok: true,
		status: 200,
		json: async () => body,
		text: async () => JSON.stringify(body),
	};
}

function stubFetch(acct: Account) {
	fetchMock = vi.fn((url: string, init: { method?: string } = {}) => {
		const method = init.method ?? "GET";
		if (url.includes("/api/account") && method === "DELETE") {
			return new Promise((res) => {
				resolveDelete = () => res(jsonRes({ ok: true }));
			});
		}
		// GET /api/account
		return Promise.resolve(jsonRes(acct));
	});
	vi.stubGlobal("fetch", fetchMock);
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

const deleteCalls = () =>
	fetchMock.mock.calls.filter(
		([url, init]) =>
			String(url).includes("/api/account") &&
			(init?.method ?? "GET") === "DELETE",
	);

beforeEach(() => {
	replace.mockClear();
	signOut.mockClear();
});

describe("DeleteAccount — real button → fetch path", () => {
	it("OAuth-only: clicking confirm issues DELETE /api/account, keeps the dialog open while pending, then signs out + redirects", async () => {
		const user = userEvent.setup();
		stubFetch(account({ hasPassword: false }));
		renderPage();
		await screen.findByLabelText("Name");

		await user.click(screen.getByRole("button", { name: "Delete account" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.type(
			within(dialog).getByLabelText("Confirm email"),
			"ada@example.io",
		);
		await user.click(
			within(dialog).getByRole("button", { name: /delete account/i }),
		);

		// A real DELETE fired with the confirm body…
		await waitFor(() => expect(deleteCalls().length).toBe(1));
		const init = deleteCalls()[0]![1] as { method: string; body: string };
		expect(init.method).toBe("DELETE");
		expect(JSON.parse(init.body)).toEqual({ confirmEmail: "ada@example.io" });

		// …and the dialog did NOT close on click — it stays open showing "Deleting…"
		// while the request is in flight (the regression the old AlertDialogAction
		// caused: it closed the dialog before the request fired).
		expect(screen.getByRole("alertdialog")).toBeInTheDocument();
		expect(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: /deleting/i,
			}),
		).toBeInTheDocument();

		// Resolve the delete → success handling runs.
		resolveDelete(undefined);
		await waitFor(() => expect(signOut).toHaveBeenCalled());
		await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
	});

	it("credential user: the password is required and sent in the DELETE body", async () => {
		const user = userEvent.setup();
		stubFetch(account({ hasPassword: true }));
		renderPage();
		await screen.findByLabelText("Name");

		await user.click(screen.getByRole("button", { name: "Delete account" }));
		const dialog = await screen.findByRole("alertdialog");
		await user.type(
			within(dialog).getByLabelText("Confirm email"),
			"ada@example.io",
		);
		// Email matches but no password yet → confirm stays disabled (no fetch).
		expect(
			within(dialog).getByRole("button", { name: /delete account/i }),
		).toBeDisabled();
		await user.type(within(dialog).getByLabelText("Password"), "hunter2");
		await user.click(
			within(dialog).getByRole("button", { name: /delete account/i }),
		);

		await waitFor(() => expect(deleteCalls().length).toBe(1));
		expect(JSON.parse(deleteCalls()[0]![1].body)).toEqual({
			confirmEmail: "ada@example.io",
			password: "hunter2",
		});
	});
});
