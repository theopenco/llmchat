import { api } from "./api";

/** Owner-only. Returns a Stripe Checkout URL to redirect the browser to. */
export async function startCheckout(workspaceId: string): Promise<string> {
	const { url } = await api<{ url: string }>("/billing/checkout", {
		method: "POST",
		workspaceId,
	});
	return url;
}

/** Owner-only. Returns a Stripe Billing Portal URL to redirect the browser to. */
export async function openPortal(workspaceId: string): Promise<string> {
	const { url } = await api<{ url: string }>("/billing/portal", {
		method: "POST",
		workspaceId,
	});
	return url;
}
