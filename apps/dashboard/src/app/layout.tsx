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
				{/*
				 * Defensive shim for the esbuild `__name` (keepNames) helper. Ploy's
				 * build pipeline runs esbuild over the Next output and bakes
				 * `__name(fn, "fn")` into next-themes' inlined theme <script> without
				 * defining `__name` in that inline scope — crashing client init with
				 * "__name is not defined" (the #13 esbuild-helper class of bug). The
				 * local Next build doesn't emit it, so the chunk gate can't catch it;
				 * defining it here (before the theme script runs) makes the page robust
				 * no matter which build layer injects the call. Faithful to esbuild's
				 * real helper so any `.name` reliance is preserved.
				 */}
				<script
					// eslint-disable-next-line react/no-danger
					dangerouslySetInnerHTML={{
						__html:
							'self.__name||(self.__name=function(t,n){try{Object.defineProperty(t,"name",{value:n,configurable:true})}catch(e){}return t});',
					}}
				/>
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
