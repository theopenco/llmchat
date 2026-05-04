import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "llmchat — AI-first support widget",
	description:
		"Drop-in chat widget that answers from your docs and escalates to humans. Built on LLM Gateway.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
