import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WidgetFrame } from "./WidgetFrame";

function renderFrame(props: Partial<React.ComponentProps<typeof WidgetFrame>>) {
	const onOpenChange = vi.fn();
	render(
		<WidgetFrame
			inline={false}
			brandColor="#4f46e5"
			open={false}
			onOpenChange={onOpenChange}
			{...props}
		>
			<p>panel body</p>
		</WidgetFrame>,
	);
	return { onOpenChange };
}

describe("WidgetFrame — floating bubble layout", () => {
	it("is collapsed by default: shows only the launcher, hides the panel", () => {
		renderFrame({ open: false });
		expect(
			screen.getByRole("button", { name: /open chat/i }),
		).toBeInTheDocument();
		expect(screen.queryByText("panel body")).not.toBeInTheDocument();
	});

	it("opens the panel when the launcher is clicked", async () => {
		const { onOpenChange } = renderFrame({ open: false });
		await userEvent.click(screen.getByRole("button", { name: /open chat/i }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
	});

	it("reveals the panel content once open", () => {
		renderFrame({ open: true });
		expect(screen.getByText("panel body")).toBeInTheDocument();
	});
});

describe("WidgetFrame — expand toggle", () => {
	it("expands the panel and toggles back", async () => {
		renderFrame({ open: true });
		const panel = screen.getByRole("dialog", { name: /support chat/i });
		expect(panel.className).not.toContain("llmchat-panel--expanded");
		await userEvent.click(screen.getByRole("button", { name: /expand chat/i }));
		expect(panel.className).toContain("llmchat-panel--expanded");
		await userEvent.click(
			screen.getByRole("button", { name: /collapse chat/i }),
		);
		expect(panel.className).not.toContain("llmchat-panel--expanded");
	});

	it("renders header actions passed by the conversation variant", () => {
		renderFrame({ open: true, actions: <button type="button">act</button> });
		expect(screen.getByRole("button", { name: "act" })).toBeInTheDocument();
	});
});

describe("WidgetFrame — inline layout", () => {
	it("has no launcher and always shows the panel", () => {
		renderFrame({ inline: true, open: true });
		expect(
			screen.queryByRole("button", { name: /open chat/i }),
		).not.toBeInTheDocument();
		expect(screen.getByText("panel body")).toBeInTheDocument();
		// Inline fills its host — no expand toggle.
		expect(
			screen.queryByRole("button", { name: /expand chat/i }),
		).not.toBeInTheDocument();
	});
});

describe("WidgetFrame — theme", () => {
	it("defaults to light: no dark class on the root", () => {
		renderFrame({ open: true });
		const root = screen.getByText("panel body").closest(".llmchat");
		expect(root).not.toHaveClass("llmchat--dark");
	});

	it("applies the dark palette class when theme=dark", () => {
		renderFrame({ open: true, theme: "dark" });
		const root = screen.getByText("panel body").closest(".llmchat");
		expect(root).toHaveClass("llmchat--dark");
	});
});
