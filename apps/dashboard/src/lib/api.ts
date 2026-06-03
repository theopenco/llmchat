const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export interface ApiOptions {
	method?: string;
	body?: unknown;
	workspaceId?: string;
}

export async function api<T>(
	path: string,
	{ method = "GET", body, workspaceId }: ApiOptions = {},
): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		method,
		credentials: "include",
		headers: {
			"content-type": "application/json",
			...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		throw new Error(`API ${res.status}: ${await res.text()}`);
	}
	return (await res.json()) as T;
}
