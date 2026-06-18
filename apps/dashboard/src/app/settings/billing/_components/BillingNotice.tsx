import { AlertCircle } from "lucide-react";

/** Inline error for a failed checkout/portal call — a friendly message in place
 * of a raw "API 500" toast. */
export function BillingNotice({ message }: { message: string }) {
	return (
		<div
			role="alert"
			className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
		>
			<AlertCircle className="size-4 shrink-0" />
			{message}
		</div>
	);
}
