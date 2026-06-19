import "./globals.css";

import type { Metadata } from "next";
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from "next/font/google";
import { ConsentProvider } from "@/components/ConsentProvider";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CANONICAL_SITE_URL } from "@/lib/site-urls";

// Google Search Console ownership verification token (the value from the
// "HTML tag" method). Hardcoded so it ships in every build's <head> with no
// deploy-env setup; NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION overrides it if you
// ever rotate the token. It's public (it lives in page source), so committing
// it is fine. Rendered by Next as the <meta name="google-site-verification">.
const GOOGLE_SITE_VERIFICATION =
	process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ??
	"Z-Xg-V6yXzYD8GD77wrhsV05ppS78u9NE25JXM_6l50";

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
	...(GOOGLE_SITE_VERIFICATION
		? { verification: { google: GOOGLE_SITE_VERIFICATION } }
		: {}),
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
					<ConsentProvider>
						<PostHogProvider>{children}</PostHogProvider>
						<GoogleAnalytics />
					</ConsentProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
