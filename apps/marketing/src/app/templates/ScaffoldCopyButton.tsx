"use client";

import { CopyButton } from "@/components/tools/CopyButton";

/**
 * Client wrapper so the server-rendered /templates page can offer the shared
 * CopyButton (whose `text` prop is a function) without passing a function
 * across the RSC boundary — the command comes in as a plain string and the
 * closure is created here, on the client.
 */
export function ScaffoldCopyButton({ command }: { command: string }) {
	return (
		<CopyButton
			text={() => command}
			tool="templates_scaffold_cli"
			label="Copy command"
		/>
	);
}
