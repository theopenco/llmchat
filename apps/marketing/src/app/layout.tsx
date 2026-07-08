import "./globals.css";

import type { Metadata } from "next";
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from "next/font/google";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CANONICAL_SITE_URL, X_HANDLE } from "@/lib/site-urls";

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
	"One script tag. Any model. An AI-powered support agent that answers from your docs and escalates to your team — with no lost threads.";

export const metadata: Metadata = {
	// Resolves relative canonical/OG URLs (set per page via pageMeta) to absolute.
	metadataBase: new URL(CANONICAL_SITE_URL),
	title: TITLE,
	description: DESCRIPTION,
	applicationName: "Clanker Support",
	icons: {
		icon: [
			{ url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [{ url: "/favicon-180.png", sizes: "180x180", type: "image/png" }],
	},
	alternates: {
		canonical: "/",
		types: { "application/rss+xml": "/feed.xml" },
	},
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
		site: X_HANDLE,
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
				{/*
				 * Defensive shim for the esbuild `__name` (keepNames) helper. Ploy's
				 * deploy pipeline runs esbuild over the Next output and bakes
				 * `__name(fn, "fn")` into next-themes' inlined theme <script> without
				 * defining `__name` in that inline scope — so the script throws
				 * "__name is not defined" before paint, the `.dark` class is never
				 * applied pre-hydration, and the page flashes light then snaps to dark.
				 * The local Next build doesn't emit it, so it can't be caught in dev;
				 * defining `__name` here (before the theme script runs) restores the
				 * anti-FOUC behavior. Faithful to esbuild's real helper so any `.name`
				 * reliance is preserved. (Same fix as the dashboard layout.)
				 */}
				<script
					// eslint-disable-next-line react/no-danger
					dangerouslySetInnerHTML={{
						__html:
							'self.__name||(self.__name=function(t,n){try{Object.defineProperty(t,"name",{value:n,configurable:true})}catch(e){}return t});',
					}}
				/>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					<PostHogProvider>{children}</PostHogProvider>
				</ThemeProvider>
				{/*
				 * Plain <script> (React 19 hoists/dedupes async scripts) rather than
				 * next/script: Ploy's deploy runs its own esbuild pass over the Next
				 * output, and that pass has mangled Next-emitted scripts before (see
				 * the __name shim in the dashboard layout). A bare async tag keeps
				 * Next's client script-loader module out of that pass entirely.
				 */}
				<script
					src="https://api.clankersupport.com/widget.js"
					data-project="pk_adadae5c42fbc58d2e4927cac84a2131ae3bf042d8032187"
					data-api="https://api.clankersupport.com"
					data-brand="#2E6BFF"
					async
				/>
			</body>
		</html>
	);
}
