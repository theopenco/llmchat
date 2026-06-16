import "./globals.css";

import { QueryProvider } from "@/lib/query";
import { WorkspaceProvider } from "@/lib/workspace";

import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PostHogProvider } from "@/components/PostHogProvider";

export const metadata: Metadata = {
	title: "llmchat — dashboard",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<PostHogProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
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
