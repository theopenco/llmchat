import { describe, expect, it } from "vitest";
import { createWidgetHost } from "./mount-host";

describe("createWidgetHost", () => {
	it("creates the well-known root element", () => {
		const host = createWidgetHost(document);
		expect(host.tagName).toBe("DIV");
		expect(host.id).toBe("llmchat-widget-root");
	});

	it("forces display with an important inline declaration — Dawn's div:empty{display:none} must not hide the shadow host", () => {
		const host = createWidgetHost(document);
		expect(host.style.getPropertyValue("display")).toBe("block");
		expect(host.style.getPropertyPriority("display")).toBe("important");
	});
});
