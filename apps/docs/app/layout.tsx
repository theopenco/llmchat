import "./global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";

import { DOCS_URL, X_HANDLE } from "@/lib/site";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const sans = Hanken_Grotesk({
	subsets: ["latin"],
});

const mono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

const DESCRIPTION =
	"Learn how to embed the Clanker Support widget, train your support agent, and run your team's inbox — escalations, knowledge sources, workspaces, and billing.";

export const metadata: Metadata = {
	metadataBase: new URL(DOCS_URL),
	title: {
		template: "%s — Clanker Support Docs",
		default: "Clanker Support Docs",
	},
	description: DESCRIPTION,
	// Root-page canonical; each docs page overrides with its own path.
	alternates: { canonical: "/" },
	icons: {
		icon: [
			{ url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [{ url: "/favicon-180.png", sizes: "180x180", type: "image/png" }],
	},
	// Site-wide OG/Twitter defaults — og:image comes from app/opengraph-image.png
	// (the Next file convention), which every page inherits.
	openGraph: {
		type: "website",
		url: "/",
		siteName: "Clanker Support Docs",
		title: "Clanker Support Docs",
		description: DESCRIPTION,
		locale: "en_US",
	},
	twitter: {
		card: "summary_large_image",
		site: X_HANDLE,
		title: "Clanker Support Docs",
		description: DESCRIPTION,
	},
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
