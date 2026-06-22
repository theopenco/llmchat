import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./copy-button";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
	vi.clearAllMocks();
	// Set the stub directly (not via userEvent, which installs its own clipboard).
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
});

describe("CopyButton", () => {
	it("writes the value to the clipboard on click", async () => {
		render(
			<CopyButton value="pk_local-dev-key" aria-label="Copy public key" />,
		);
		fireEvent.click(screen.getByRole("button", { name: /copy public key/i }));
		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith("pk_local-dev-key"),
		);
	});

	it("does not throw when the clipboard API is unavailable", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});
		render(<CopyButton value="x" />);
		// Clicking must be a no-op, never an unhandled rejection.
		fireEvent.click(screen.getByRole("button"));
		await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
	});
});
