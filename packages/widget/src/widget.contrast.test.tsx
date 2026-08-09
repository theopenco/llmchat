import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WidgetFrame } from "./components/WidgetFrame";
import { ON_BRAND_INK, ON_BRAND_WHITE } from "./contrast";

/** Render the frame closed (launcher + badge visible) and hand back the
 * element carrying the brand custom properties. */
function frame(brandColor: string, unreadCount = 3) {
	const { container } = render(
		<WidgetFrame
			inline={false}
			brandColor={brandColor}
			open={false}
			onOpenChange={() => {}}
			unreadCount={unreadCount}
		>
			<div />
		</WidgetFrame>,
	);
	return container.querySelector(".llmchat") as HTMLElement;
}

describe("on-brand chrome derives its foreground (#145)", () => {
	it("hands the launcher dark ink for a pale brand white can't carry", () => {
		const el = frame("#fef08a");
		expect(el.style.getPropertyValue("--brand")).toBe("#fef08a");
		expect(el.style.getPropertyValue("--brand-fg")).toBe(ON_BRAND_INK);
	});

	it("keeps white for a dark brand, so existing embeds render unchanged", () => {
		const el = frame("#111827");
		expect(el.style.getPropertyValue("--brand-fg")).toBe(ON_BRAND_WHITE);
	});

	it("sets the token even with nothing unread — the launcher glyph needs it too", () => {
		const el = frame("#fef08a", 0);
		expect(el.style.getPropertyValue("--brand-fg")).toBe(ON_BRAND_INK);
	});

	it("falls back to white for a brand string it can't parse", () => {
		const el = frame("rebeccapurple");
		expect(el.style.getPropertyValue("--brand-fg")).toBe(ON_BRAND_WHITE);
	});
});
