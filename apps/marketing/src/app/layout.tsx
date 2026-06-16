import "./globals.css";

import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { PostHogProvider } from "@/components/PostHogProvider";

// Editorial display serif — characterful, optical, used for headlines.
const fraunces = Fraunces({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "900"],
	style: ["normal", "italic"],
	variable: "--font-display",
	display: "swap",
});

// Warm, readable grotesque for body + UI.
const hanken = Hanken_Grotesk({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-sans",
	display: "swap",
});

// Mono for tags, metadata, labels, and code.
const jetbrains = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-mono",
	display: "swap",
});

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
		<html
			lang="en"
			className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable}`}
		>
			<body>
				<PostHogProvider>{children}</PostHogProvider>
			</body>
		</html>
	);
}
