import "./globals.css";

import { QueryProvider } from "@/lib/query";
import { WorkspaceProvider } from "@/lib/workspace";

import type { Metadata } from "next";

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
				<QueryProvider>
					<WorkspaceProvider>{children}</WorkspaceProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
