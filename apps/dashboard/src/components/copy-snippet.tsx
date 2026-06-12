"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** A labelled code block with a copy-to-clipboard button. */
export function CopySnippet({
	label,
	code,
	children,
}: {
	label: string;
	code: string;
	/** Optional hint rendered under the label. */
	children?: React.ReactNode;
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
			await navigator.clipboard.writeText(code);
			setCopied(true);
			if (resetTimer.current) clearTimeout(resetTimer.current);
			resetTimer.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Could not copy to clipboard");
		}
	}

	return (
		<div className="space-y-2">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-0.5">
					<p className="text-sm font-medium text-foreground">{label}</p>
					{children && (
						<div className="text-sm text-muted-foreground">{children}</div>
					)}
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={copy}
					aria-label={`Copy ${label}`}
				>
					{copied ? (
						<Check className="size-3.5 text-emerald-600" />
					) : (
						<Copy className="size-3.5" />
					)}
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
			<pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs leading-relaxed">
				<code>{code}</code>
			</pre>
		</div>
	);
}
