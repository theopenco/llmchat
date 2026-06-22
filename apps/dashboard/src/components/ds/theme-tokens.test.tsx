import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";

import { Card } from "./card";

/**
 * The ds primitives are token-driven: every color comes from a `--ck-*` var that
 * lives under `:root` (light) and `.dark` (dark). next-themes — the same switcher
 * the app ships — toggles that `.dark` class on <html>, which is exactly what
 * swaps the whole token set. So this verifies BOTH "both themes render" and "the
 * switcher toggles the tokens" by asserting the class the tokens hang off of
 * flips, while a token-driven Card stays mounted across the switch.
 */
function Harness() {
	const { setTheme } = useTheme();
	return (
		<div>
			<button onClick={() => setTheme("light")}>go light</button>
			<button onClick={() => setTheme("dark")}>go dark</button>
			<Card data-testid="surface">
				<span>surface</span>
			</Card>
		</div>
	);
}

describe("ds tokens follow the theme switcher", () => {
	it("toggles the .dark class (which swaps --ck-* tokens) while the Card stays mounted", async () => {
		const user = userEvent.setup();
		render(
			<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
				<Harness />
			</ThemeProvider>,
		);

		const root = document.documentElement;
		// The token-driven surface uses the ck card token, not a hardcoded color.
		const surface = screen.getByTestId("surface");
		expect(surface.className).toContain("bg-ck-card");

		// Dark theme is active → tokens resolve to their dark values.
		await waitFor(() => expect(root).toHaveClass("dark"));

		// Switch to light → .dark drops (light token set), surface still rendered.
		await user.click(screen.getByText("go light"));
		await waitFor(() => expect(root).not.toHaveClass("dark"));
		expect(screen.getByTestId("surface")).toBeInTheDocument();

		// Back to dark → token set swaps again.
		await user.click(screen.getByText("go dark"));
		await waitFor(() => expect(root).toHaveClass("dark"));
		expect(screen.getByTestId("surface")).toBeInTheDocument();
	});
});
