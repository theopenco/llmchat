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

describe("WidgetFrame — inline layout", () => {
	it("has no launcher and always shows the panel", () => {
		renderFrame({ inline: true, open: true });
		expect(
			screen.queryByRole("button", { name: /open chat/i }),
		).not.toBeInTheDocument();
		expect(screen.getByText("panel body")).toBeInTheDocument();
	});
});
