import { Label } from "@/components/ui/label";

/** Label + control + inline error, so forms stay consistent and a11y-correct. */
export function FormField({
	id,
	label,
	error,
	children,
}: {
	id: string;
	label: string;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id}>{label}</Label>
			{children}
			{error ? (
				<p id={`${id}-error`} role="alert" className="text-xs text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
