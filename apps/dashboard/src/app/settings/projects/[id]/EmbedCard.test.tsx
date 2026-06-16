import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EmbedCard } from "./EmbedCard";

/** The single visible code block's text (only the selected snippet renders). */
function snippetText(): string {
	const blocks = document.querySelectorAll("pre");
	expect(blocks).toHaveLength(1); // never show both snippets at once
	return blocks[0]?.textContent ?? "";
}

function setup() {
	render(<EmbedCard publicKey="pk_test123" brandColor="#4f46e5" />);
}

describe("EmbedCard", () => {
	it("defaults to the floating script embed, marked Recommended", () => {
		setup();
		expect(screen.getByText("Recommended")).toBeInTheDocument();
		const code = snippetText();
		expect(code).toContain("<script");
		expect(code).toContain("/widget.js");
		expect(code).not.toContain("<iframe");
		expect(
			screen.getByRole("button", { name: /copy script/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /copy iframe/i }),
		).not.toBeInTheDocument();
	});

	it("switches to the inline iframe snippet and copy label when selected", async () => {
		setup();
		await userEvent.click(screen.getByText("Inline embed"));

		const code = snippetText();
		expect(code).toContain("<iframe");
		expect(code).toContain("/embed/pk_test123");
		expect(code).not.toContain("<script");
		expect(
			screen.getByRole("button", { name: /copy iframe/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /copy script/i }),
		).not.toBeInTheDocument();
	});

	it("switches back to the floating snippet", async () => {
		setup();
		await userEvent.click(screen.getByText("Inline embed"));
		await userEvent.click(screen.getByText("Floating bubble"));
		expect(snippetText()).toContain("<script");
	});

	it("exposes the embed URL with its own copy control and a matching preview link", () => {
		setup();
		const urlField = screen.getByLabelText("Embed URL") as HTMLInputElement;
		expect(urlField.value).toContain("/embed/pk_test123");
		expect(
			screen.getByRole("button", { name: /copy url/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /open preview/i })).toHaveAttribute(
			"href",
			urlField.value,
		);
	});
});
