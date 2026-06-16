import "./globals.css";

import { QueryProvider } from "@/lib/query";
import { WorkspaceProvider } from "@/lib/workspace";

import type { Metadata } from "next";
import {
	Bricolage_Grotesque,
	Hanken_Grotesk,
	JetBrains_Mono,
} from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/components/PostHogProvider";

const display = Bricolage_Grotesque({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
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
	title: "llmchat — dashboard",
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
				<PostHogProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="dark"
						enableSystem
						disableTransitionOnChange
					>
						<QueryProvider>
							<WorkspaceProvider>{children}</WorkspaceProvider>
							<Toaster richColors closeButton position="bottom-right" />
						</QueryProvider>
					</ThemeProvider>
				</PostHogProvider>
			</body>
		</html>
	);
}
