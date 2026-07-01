import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PrivacyNotice } from "./PrivacyNotice";

describe("PrivacyNotice", () => {
	it("shows the consent line and links to the default privacy policy", () => {
		render(<PrivacyNotice />);
		expect(screen.getByText(/by chatting, you agree to our/i)).toBeVisible();
		const link = screen.getByRole("link", { name: /privacy policy/i });
		expect(link).toHaveAttribute(
			"href",
			"https://clankersupport.com/privacy-policy",
		);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("links to the project's configured privacy policy when provided", () => {
		render(<PrivacyNotice privacyPolicyUrl="https://acme.test/privacy" />);
		expect(
			screen.getByRole("link", { name: /privacy policy/i }),
		).toHaveAttribute("href", "https://acme.test/privacy");
	});

	it("hides the notice when the dismiss × is clicked (visual-only)", async () => {
		render(<PrivacyNotice />);
		await userEvent.click(
			screen.getByRole("button", { name: /dismiss privacy notice/i }),
		);
		// The reminder is gone from the DOM entirely so the composer regains its
		// own top border — nothing about consent changed, only the visual notice.
		expect(
			screen.queryByText(/by chatting, you agree to our/i),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /privacy policy/i }),
		).not.toBeInTheDocument();
	});
});
