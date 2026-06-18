import "./globals.css";

import type { Metadata } from "next";
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from "next/font/google";

const display = Bricolage_Grotesque({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
	variable: "--font-display",
	display: "swap",
});
const sans = Hanken_Grotesk({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-sans",
	display: "swap",
});
const mono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-mono",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Clanker Support — live demo",
	description:
		"Try the Clanker Support widget live. Chat with the bubble, send a few messages, and watch it escalate to a human.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			className={`dark ${display.variable} ${sans.variable} ${mono.variable}`}
		>
			<body>{children}</body>
		</html>
	);
}
