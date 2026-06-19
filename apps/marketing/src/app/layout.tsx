import "./globals.css";

import type { Metadata } from "next";
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from "next/font/google";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

// Distinctive modern grotesque for display headlines.
const display = Bricolage_Grotesque({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
	variable: "--font-display",
	display: "swap",
});

// Clean, warm grotesque for body + UI.
const sans = Hanken_Grotesk({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-sans",
	display: "swap",
});

// Mono for code, tags, metadata, labels.
const mono = JetBrains_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-mono",
	display: "swap",
});

const TITLE = "Clanker Support — AI support, dropped in";
const DESCRIPTION =
	"One script tag. Any model. An AI-powered support agent that answers from your docs and escalates to your team. Built on LLM Gateway.";

export const metadata: Metadata = {
	// Resolves relative canonical/OG URLs (set per page via pageMeta) to absolute.
	metadataBase: new URL(CANONICAL_SITE_URL),
	title: TITLE,
	description: DESCRIPTION,
	applicationName: "Clanker Support",
	alternates: { canonical: "/" },
	openGraph: {
		type: "website",
		url: "/",
		siteName: "Clanker Support",
		title: TITLE,
		description: DESCRIPTION,
		locale: "en_US",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			"max-image-preview": "large",
			"max-snippet": -1,
			"max-video-preview": -1,
		},
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${display.variable} ${sans.variable} ${mono.variable}`}
		>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					<PostHogProvider>{children}</PostHogProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
