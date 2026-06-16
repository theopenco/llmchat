import { CheckCircle2, XCircle } from "lucide-react";

/** Post-Checkout banner driven by the ?status= query param. */
export function StatusBanner({ status }: { status: "success" | "cancel" }) {
	const success = status === "success";
	return (
		<div
			role="status"
			className={
				success
					? "flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success"
					: "flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
			}
		>
			{success ? (
				<CheckCircle2 className="size-4" />
			) : (
				<XCircle className="size-4" />
			)}
			{success
				? "Payment received — your plan will update momentarily."
				: "Checkout canceled — no changes were made."}
		</div>
	);
}
