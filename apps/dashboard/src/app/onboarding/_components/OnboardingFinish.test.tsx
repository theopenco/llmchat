import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnboardingFinish } from "./OnboardingFinish";

describe("OnboardingFinish", () => {
	it("confirms the project and embeds its public key in the snippet", () => {
		render(
			<OnboardingFinish
				projectName="Acme Tools"
				publicKey="pk_abc123"
				brandColor="#000000"
			/>,
		);

		expect(screen.getByText(/acme tools is ready/i)).toBeInTheDocument();
		// The default (floating) snippet wires the project's public key.
		const snippet = document.querySelector("pre")?.textContent ?? "";
		expect(snippet).toContain("pk_abc123");
		expect(snippet).toContain("data-project");
	});

	it("links into the dashboard", () => {
		render(
			<OnboardingFinish
				projectName="Acme"
				publicKey="pk_x"
				brandColor="#000000"
			/>,
		);
		expect(
			screen.getByRole("link", { name: /go to dashboard/i }),
		).toHaveAttribute("href", "/inbox");
	});
});
