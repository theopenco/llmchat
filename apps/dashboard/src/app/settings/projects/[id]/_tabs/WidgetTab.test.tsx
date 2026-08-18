import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api";

import type { ProjectDraft } from "../types";
import { WidgetTab } from "./WidgetTab";

vi.mock("@/lib/api", () => ({
	api: vi.fn(),
	describeApiError: (_e: unknown, fallback: string) => fallback,
}));

function draft(o: Partial<ProjectDraft> = {}): ProjectDraft {
	return {
		name: "Acme",
		welcomeMessage: "Hi",
		brandColor: "#4f46e5",
		model: "gpt-5.4-mini",
		systemPrompt: "",
		escalationThreshold: 3,
		notifyEmail: null,
		slackWebhookUrl: null,
		privacyPolicyUrl: null,
		suggestedQuestions: [],
		collectIdentity: false,
		avatarUrl: null,
		...o,
	};
}

let set: ReturnType<typeof vi.fn>;

/** Upload-meta state the avatar query resolves to (null = nothing uploaded). */
function mockAvatarMeta(
	avatar: { contentType: string; updatedAt: string } | null,
) {
	vi.mocked(api).mockImplementation(async (path: string) => {
		if (path.endsWith("/avatar")) {
			return { avatar };
		}
		throw new Error(`unexpected api call: ${path}`);
	});
}

function renderTab(d: ProjectDraft = draft()) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<WidgetTab
				draft={d}
				set={set}
				projectId="p1"
				workspaceId="ws1"
				publicKey="pk_x"
			/>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	set = vi.fn();
	mockAvatarMeta(null);
});

describe("WidgetTab", () => {
	it("edits the brand color via the hex input", async () => {
		renderTab();
		await userEvent
			.setup()
			.type(screen.getByLabelText(/brand color hex value/i), "a");
		expect(set).toHaveBeenCalledWith("brandColor", expect.any(String));
	});

	it("edits the welcome message", async () => {
		renderTab();
		await userEvent
			.setup()
			.type(screen.getByLabelText(/welcome message/i), "!");
		expect(set).toHaveBeenCalledWith("welcomeMessage", expect.any(String));
	});

	it("edits the agent photo URL and previews it", async () => {
		renderTab();
		await userEvent
			.setup()
			.type(screen.getByLabelText(/agent photo url/i), "x");
		expect(set).toHaveBeenCalledWith("avatarUrl", expect.any(String));
	});

	it("clears the agent photo back to null when the field is emptied", async () => {
		renderTab(draft({ avatarUrl: "https://acme.example/a.jpg" }));
		await userEvent.setup().clear(screen.getByLabelText(/agent photo url/i));
		expect(set).toHaveBeenCalledWith("avatarUrl", null);
	});

	it("offers an Upload photo button (no Remove before an upload exists)", async () => {
		renderTab();
		expect(
			screen.getByRole("button", { name: /upload photo/i }),
		).toBeInTheDocument();
		await waitFor(() => expect(api).toHaveBeenCalled());
		expect(
			screen.queryByRole("button", { name: /^remove$/i }),
		).not.toBeInTheDocument();
	});

	it("shows Replace + Remove once a photo is uploaded, and removes via DELETE", async () => {
		mockAvatarMeta({
			contentType: "image/png",
			updatedAt: "2026-08-18T12:00:00.000Z",
		});
		renderTab();
		const remove = await screen.findByRole("button", { name: /^remove$/i });
		expect(
			screen.getByRole("button", { name: /replace photo/i }),
		).toBeInTheDocument();
		await userEvent.setup().click(remove);
		await waitFor(() =>
			expect(api).toHaveBeenCalledWith(
				"/api/projects/p1/avatar",
				expect.objectContaining({ method: "DELETE" }),
			),
		);
	});

	it("rejects an unsupported file locally — readable error, no api call", async () => {
		renderTab();
		const file = new File(["gif"], "a.gif", { type: "image/gif" });
		// applyAccept off: the input's accept= filters in real browsers too, but
		// the component's own validation is the layer under test here.
		await userEvent
			.setup({ applyAccept: false })
			.upload(screen.getByLabelText(/agent photo file/i), file);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/PNG, JPEG, or WebP/,
		);
		expect(api).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("preserves the full install experience (Floating/Inline toggle + copy + embed URL)", () => {
		renderTab();
		// Both embed modes survive the restyle — not reduced to a bare snippet.
		expect(
			screen.getByRole("radio", { name: /floating bubble/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("radio", { name: /inline embed/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Recommended")).toBeInTheDocument();
		expect(screen.getByText(/copy script/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/embed url/i)).toBeInTheDocument();
	});

	it("shows launcher position as a dimmed roadmap item, not a live control", () => {
		renderTab();
		expect(screen.getByText("Bottom right")).toBeInTheDocument();
		expect(
			screen.getByText(/position options are coming/i),
		).toBeInTheDocument();
	});

	it("adds a suggested-question row", async () => {
		renderTab();
		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /add question/i }));
		expect(set).toHaveBeenCalledWith("suggestedQuestions", [""]);
	});

	it("edits and removes an existing suggested question", async () => {
		const user = userEvent.setup();
		renderTab(draft({ suggestedQuestions: ["Pricing?", "Refunds?"] }));
		await user.type(
			screen.getByRole("textbox", { name: /^suggested question 1$/i }),
			"!",
		);
		expect(set).toHaveBeenCalledWith("suggestedQuestions", [
			"Pricing?!",
			"Refunds?",
		]);
		await user.click(
			screen.getByRole("button", { name: /remove suggested question 2/i }),
		);
		expect(set).toHaveBeenCalledWith("suggestedQuestions", ["Pricing?"]);
	});

	it("caps the list at 6 questions (no Add button at the cap)", () => {
		renderTab(draft({ suggestedQuestions: ["a", "b", "c", "d", "e", "f"] }));
		expect(
			screen.queryByRole("button", { name: /add question/i }),
		).not.toBeInTheDocument();
	});
});
