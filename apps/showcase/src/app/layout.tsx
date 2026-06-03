import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Acme Tools — llmchat widget showcase",
	description:
		"Fake customer site that embeds the llmchat widget for local dev.",
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
