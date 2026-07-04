import "./global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const sans = Hanken_Grotesk({
	subsets: ["latin"],
});

const mono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	metadataBase: new URL("https://docs.clankersupport.com"),
	title: {
		template: "%s — Clanker Support Docs",
		default: "Clanker Support Docs",
	},
	description:
		"Learn how to embed the Clanker Support widget, train your support agent, and run your team's inbox — escalations, knowledge sources, workspaces, and billing.",
};

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<html
			lang="en"
			className={`${sans.className} ${mono.variable}`}
			suppressHydrationWarning
		>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
