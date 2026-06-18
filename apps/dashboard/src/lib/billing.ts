import { ApiError, api } from "./api";

/** True when the api short-circuited because Stripe isn't configured yet (503
 * `billing_not_configured`). Lets the UI show "billing isn't enabled" copy
 * rather than a generic failure. */
export function isBillingNotConfigured(error: unknown): boolean {
	if (!(error instanceof ApiError)) return false;
	try {
		return (
			(JSON.parse(error.body) as { error?: string }).error ===
			"billing_not_configured"
		);
	} catch {
		return false;
	}
}

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
