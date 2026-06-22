"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button, type ButtonProps } from "./button";

export interface CopyButtonProps extends Omit<
	ButtonProps,
	"onClick" | "children"
> {
	/** The text written to the clipboard. */
	value: string;
	/** Optional visible label; icon-only when omitted. */
	label?: string;
	/** Accessible label (defaults to "Copy"). */
	"aria-label"?: string;
}

/**
 * Design-system copy-to-clipboard button. Generic + shared — the projects grid's
 * public-key copy, the install snippet, and future Settings/Widget copies all use
 * it. Shows a transient check on success; falls back silently if the clipboard
 * API is unavailable (never throws at the user).
 */
export function CopyButton({
	value,
	label,
	variant = "ghost",
	size = label ? "sm" : "icon",
	"aria-label": ariaLabel = "Copy",
	...props
}: CopyButtonProps) {
	const [copied, setCopied] = React.useState(false);
	const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

	React.useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard blocked (insecure context / denied) — no-op, no error UI.
		}
	}

	return (
		<Button
			variant={variant}
			size={size}
			aria-label={ariaLabel}
			onClick={copy}
			{...props}
		>
			{copied ? (
				<Check className="size-3.5 text-ck-accent" />
			) : (
				<Copy className="size-3.5" />
			)}
			{label}
		</Button>
	);
}
