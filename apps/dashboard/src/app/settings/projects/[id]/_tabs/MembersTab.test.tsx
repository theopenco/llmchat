import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MembersTab } from "./MembersTab";

const { workspaceState, apiMock } = vi.hoisted(() => ({
	workspaceState: {
		workspaceId: "ws_1",
		role: "owner" as string | null,
		canManage: true,
	},
	apiMock: vi.fn(),
}));

vi.mock("@/lib/workspace", () => ({
	useWorkspace: () => workspaceState,
}));
vi.mock("@/lib/api", async (orig) => ({
	...(await orig<typeof import("@/lib/api")>()),
	api: apiMock,
}));
vi.mock("@/lib/analytics", () => ({
	ANALYTICS_EVENTS: { inviteSent: "invite_sent" },
	track: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MEMBERS = {
	members: [
		{
			userId: "u_owner",
			role: "owner",
			createdAt: 1,
			name: "Olive Owner",
			email: "owner@acme.com",
		},
		{
			userId: "u_agent",
			role: "agent",
			createdAt: 2,
			name: "Aki Agent",
			email: "agent@acme.com",
		},
	],
	seats: { used: 2, max: 10 },
};

const PENDING = {
	invites: [
		{
			id: "inv1",
			email: "new@fresh.com",
			role: "agent",
			createdAt: 3,
			expiresAt: 9,
			inviterName: "Olive Owner",
		},
	],
};

function routeApi(over: Record<string, unknown> = {}) {
	apiMock.mockImplementation((path: string, opts?: { method?: string }) => {
		if (path === "/api/members" && !opts?.method) {
			return Promise.resolve(over.members ?? MEMBERS);
		}
		if (path === "/api/invites" && !opts?.method) {
			return Promise.resolve(over.invites ?? PENDING);
		}
		if (path === "/api/invites" && opts?.method === "POST") {
			return Promise.resolve(
				over.created ?? {
					invite: {
						id: "inv2",
						email: "new@fresh.com",
						role: "agent",
						createdAt: 4,
						expiresAt: 9,
					},
					link: "https://app.example.com/invite/TOKEN_VALUE_123",
					emailSent: true,
				},
			);
		}
		return Promise.resolve({ ok: true });
	});
}

function renderTab(email: string | null = "owner@acme.com") {
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={qc}>
			<MembersTab currentUserEmail={email} />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	workspaceState.role = "owner";
	workspaceState.canManage = true;
	routeApi();
});

describe("MembersTab — the real roster", () => {
	it("shows real members with roles and seat usage, and the A3 heading", async () => {
		renderTab();
		expect(screen.getByText("Members of this workspace")).toBeInTheDocument();
		expect(await screen.findByText("Olive Owner")).toBeInTheDocument();
		expect(screen.getByText("Aki Agent")).toBeInTheDocument();
		expect(screen.getByText("2 of 10 seats used")).toBeInTheDocument();
	});

	it("the roadmap placeholder is gone — no 'not wired yet', and Invite really works", async () => {
		const user = userEvent.setup();
		renderTab();
		await screen.findByText("Olive Owner");
		expect(screen.queryByText(/aren.t wired yet/i)).toBeNull();
		// The old scaffold's button was disabled unconditionally. This one is
		// disabled only while there's nothing to send.
		const send = screen.getByRole("button", { name: /send invitation/i });
		expect(send).toBeDisabled();
		await user.type(screen.getByLabelText("Email address"), "new@fresh.com");
		expect(send).not.toBeDisabled();
	});

	it("renders unlimited seats without a bogus number", async () => {
		routeApi({ members: { ...MEMBERS, seats: { used: 7, max: null } } });
		renderTab();
		expect(
			await screen.findByText("7 members · unlimited seats"),
		).toBeInTheDocument();
	});
});

describe("MembersTab — role controls follow the server's rules", () => {
	it("an owner gets a role select for others but never for an owner row", async () => {
		renderTab();
		expect(
			await screen.findByLabelText("Role for agent@acme.com"),
		).toBeInTheDocument();
		// The owner's own row is a badge, not an editable control.
		expect(screen.queryByLabelText("Role for owner@acme.com")).toBeNull();
		expect(screen.getByText("Owner")).toBeInTheDocument();
	});

	it("an agent sees no role selects and no invite form", async () => {
		workspaceState.role = "agent";
		workspaceState.canManage = false;
		renderTab("agent@acme.com");
		await screen.findByText("Aki Agent");
		expect(screen.queryByLabelText(/^Role for/)).toBeNull();
		expect(
			screen.queryByRole("button", { name: /send invitation/i }),
		).toBeNull();
	});

	it("only an owner is offered the Admin role when inviting", async () => {
		// Scoped to the invite form's Role select — the per-member role select
		// also carries an Admin option, which is a different control.
		renderTab();
		await screen.findByText("Olive Owner");
		const asOwner = screen.getByLabelText("Role") as HTMLSelectElement;
		expect([...asOwner.options].map((o) => o.value)).toEqual([
			"agent",
			"admin",
		]);

		workspaceState.role = "admin";
		renderTab();
		await screen.findAllByText("Olive Owner");
		const selects = screen.getAllByLabelText("Role") as HTMLSelectElement[];
		const asAdmin = selects[selects.length - 1]!;
		expect([...asAdmin.options].map((o) => o.value)).toEqual(["agent"]);
	});
});

describe("MemberRow — identity never collapses next to the role select", () => {
	// jsdom does no layout, so pin the CLASSES that caused the width-0 row:
	// dsInputClass's w-full beat the appended w-28 (equal specificity,
	// stylesheet order), the select ate the row, and the flex-1 min-w-0
	// identity block collapsed to zero width.
	it("the role select carries w-28 with the conflicting w-full merged away", async () => {
		renderTab();
		const select = await screen.findByLabelText("Role for agent@acme.com");
		expect(select.className).toContain("w-28");
		expect(select.className).not.toContain("w-full");
	});

	it("the identity block keeps a min-width floor instead of min-w-0", async () => {
		renderTab();
		const identity = (await screen.findByText("Aki Agent")).parentElement!;
		expect(identity.className).toContain("flex-1");
		expect(identity.className).toContain("min-w-24");
		expect(identity.className).not.toContain("min-w-0");
	});
});

describe("MembersTab — the one-time invite link (k1)", () => {
	it("shows the link once after creation, with a copy control", async () => {
		const user = userEvent.setup();
		const writeText = vi.fn();
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		renderTab();
		await screen.findByText("Olive Owner");

		await user.type(screen.getByLabelText("Email address"), "new@fresh.com");
		await user.click(screen.getByRole("button", { name: /send invitation/i }));

		const link = await screen.findByText(
			"https://app.example.com/invite/TOKEN_VALUE_123",
		);
		expect(link).toBeInTheDocument();
		expect(screen.getByText(/shown once/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /^copy$/i }));
		expect(writeText).toHaveBeenCalledWith(
			"https://app.example.com/invite/TOKEN_VALUE_123",
		);
	});

	it("never renders a token for invites that merely came back from the LIST", async () => {
		// The list response carries no link (the API can't reproduce it), so no
		// pending row may display anything token-shaped.
		renderTab();
		expect(await screen.findByText("new@fresh.com")).toBeInTheDocument();
		expect(document.body.textContent).not.toContain("/invite/");
	});

	it("tells the operator to copy the link when the email didn't send", async () => {
		routeApi({
			created: {
				invite: {
					id: "inv2",
					email: "new@fresh.com",
					role: "agent",
					createdAt: 4,
					expiresAt: 9,
				},
				link: "https://app.example.com/invite/TOKEN_VALUE_123",
				emailSent: false,
			},
		});
		const user = userEvent.setup();
		renderTab();
		await screen.findByText("Olive Owner");
		await user.type(screen.getByLabelText("Email address"), "new@fresh.com");
		await user.click(screen.getByRole("button", { name: /send invitation/i }));
		const { toast } = await import("sonner");
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith(
				expect.stringContaining("copy the link"),
			),
		);
	});
});

describe("MembersTab — seats", () => {
	it("blocks the invite button and explains when every seat is taken", async () => {
		routeApi({ members: { ...MEMBERS, seats: { used: 10, max: 10 } } });
		renderTab();
		await screen.findByText("Olive Owner");
		expect(
			screen.getByRole("button", { name: /send invitation/i }),
		).toBeDisabled();
		expect(screen.getByText(/upgrade in billing/i)).toBeInTheDocument();
	});
});
