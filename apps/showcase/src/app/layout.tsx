import "./globals.css";

import type { Metadata } from "next";
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from "next/font/google";
import { PostHogProvider } from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";

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
	metadataBase: new URL(
		process.env.NEXT_PUBLIC_SHOWCASE_URL ??
			"https://showcase.clankersupport.com",
	),
	title: "Clanker Support — live demo",
	description:
		"Try the Clanker Support widget live. Chat with the bubble, send a few messages, and watch it escalate to a human.",
	alternates: { canonical: "/" },
	icons: {
		icon: [
			{ url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [{ url: "/favicon-180.png", sizes: "180x180", type: "image/png" }],
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
