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
	// 800 added for the restyle's extrabold headings (still self-hosted by
	// next/font — no CDN, no layout shift).
	weight: ["400", "500", "600", "700", "800"],
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
	title: "Clanker Support — dashboard",
	// The dashboard is an authenticated app, not a marketing surface — keep
	// sign-in/sign-up (and everything else) out of search results so they never
	// compete with clankersupport.com for brand queries.
	robots: { index: false, follow: false },
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
					{/*
					 * Light stays the default (Chatbase-style), but the theme is a
					 * PREFERENCE again: enableSystem + the account-menu Appearance
					 * switcher (Light/Dark/System) — both .dark token sets (shadcn +
					 * --ck-*) shipped with the restyle and stay maintained.
					 */}
					<ThemeProvider
						attribute="class"
						defaultTheme="light"
						enableSystem
						disableTransitionOnChange
					>
						<QueryProvider>
							<WorkspaceProvider>{children}</WorkspaceProvider>
							<Toaster richColors closeButton position="bottom-right" />
						</QueryProvider>
					</ThemeProvider>
				</PostHogProvider>
				{/*
				 * Plain <script> (React 19 hoists/dedupes async scripts) rather than
				 * next/script: Ploy's deploy esbuild pass re-processes Next output and
				 * has broken Next-emitted scripts before (see the __name shim above).
				 * A bare async tag keeps Next's script-loader module out of that pass.
				 */}
				<script
					src="https://api.clankersupport.com/widget.js"
					data-project="pk_adadae5c42fbc58d2e4927cac84a2131ae3bf042d8032187"
					data-api="https://api.clankersupport.com"
					data-brand="#6366F1"
					async
				/>
			</body>
		</html>
	);
}
