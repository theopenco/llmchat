import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import AccountSettingsPage from "./page";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
	toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}));

// Only the transport is mocked; describeApiError stays real.
vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: vi.fn(),
}));

let calls: { path: string; method: string; body?: unknown }[];
let profile: { name: string; email: string };

function setupApi() {
	calls = [];
	profile = { name: "Ada Lovelace", email: "ada@example.io" };
	vi.mocked(api).mockImplementation(
		async (path: string, opts: { method?: string; body?: unknown } = {}) => {
			const method = opts.method ?? "GET";
			calls.push({ path, method, body: opts.body });
			if (path === "/api/account" && method === "PATCH") {
				profile = { ...profile, name: (opts.body as { name: string }).name };
			}
			return profile;
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
	toastSuccess.mockClear();
	setupApi();
});

describe("AccountSettingsPage", () => {
	it("shows the name (editable) and the email (read-only) with the support note", async () => {
		renderPage();
		const nameInput = await screen.findByLabelText("Name");
		expect(nameInput).toHaveValue("Ada Lovelace");
		expect(nameInput).not.toHaveAttribute("readonly");

		const emailInput = screen.getByLabelText("Email (read-only)");
		expect(emailInput).toHaveValue("ada@example.io");
		expect(emailInput).toHaveAttribute("readonly");
		expect(
			screen.getByText(/contact support to change your email/i),
		).toBeInTheDocument();
	});

	it("has a Billing link to the billing page", async () => {
		renderPage();
		await screen.findByLabelText("Name");
		const link = screen.getByRole("link", { name: /billing/i });
		expect(link).toHaveAttribute("href", "/settings/billing");
	});

	it("disables Save until the name changes, then PATCHes and toasts", async () => {
		const user = userEvent.setup();
		renderPage();
		const nameInput = await screen.findByLabelText("Name");

		// Unchanged → Save is disabled.
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

		await user.clear(nameInput);
		await user.type(nameInput, "Grace Hopper");
		const saveBtn = screen.getByRole("button", { name: "Save" });
		expect(saveBtn).toBeEnabled();
		await user.click(saveBtn);

		await waitFor(() => {
			const patch = calls.find((c) => c.method === "PATCH");
			expect(patch).toBeTruthy();
			expect(patch!.path).toBe("/api/account");
			expect(patch!.body).toEqual({ name: "Grace Hopper" });
		});
		await waitFor(() =>
			expect(toastSuccess).toHaveBeenCalledWith("Name updated"),
		);
		// The field reflects the saved value and Save goes disabled again.
		expect(nameInput).toHaveValue("Grace Hopper");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
		);
	});

	it("does not save a whitespace-only name (Save stays disabled)", async () => {
		const user = userEvent.setup();
		renderPage();
		const nameInput = await screen.findByLabelText("Name");
		await user.clear(nameInput);
		await user.type(nameInput, "   ");
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	});
});
