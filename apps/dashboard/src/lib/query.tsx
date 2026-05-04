"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { staleTime: 5_000 },
				},
			}),
	);
	return (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
}
