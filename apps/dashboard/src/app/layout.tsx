import "./globals.css";

import { QueryProvider } from "@/lib/query";
import { WorkspaceProvider } from "@/lib/workspace";

import type { Metadata } from "next";
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
		<html lang="en">
			<body>
				<PostHogProvider>
					<QueryProvider>
						<WorkspaceProvider>{children}</WorkspaceProvider>
						<Toaster richColors closeButton position="bottom-right" />
					</QueryProvider>
				</PostHogProvider>
			</body>
		</html>
	);
}
