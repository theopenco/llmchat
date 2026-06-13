"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * A button that copies `value` to the clipboard and flips to a green check +
 * `copiedLabel` for two seconds.
 */
export function CopyButton({
	value,
	children,
	copiedLabel = "Copied!",
	variant = "outline",
	size = "sm",
	className,
}: {
	value: string;
	children: React.ReactNode;
	copiedLabel?: string;
	variant?: React.ComponentProps<typeof Button>["variant"];
	size?: React.ComponentProps<typeof Button>["size"];
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (resetTimer.current) clearTimeout(resetTimer.current);
		};
	}, []);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			if (resetTimer.current) clearTimeout(resetTimer.current);
			resetTimer.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Could not copy to clipboard");
		}
	}

	return (
		<Button
			type="button"
			variant={variant}
			size={size}
			onClick={copy}
			className={className}
		>
			{copied ? (
				<>
					<Check className="text-emerald-600" />
					<span className="text-emerald-600">{copiedLabel}</span>
				</>
			) : (
				<>
					<Copy />
					{children}
				</>
			)}
		</Button>
	);
}
