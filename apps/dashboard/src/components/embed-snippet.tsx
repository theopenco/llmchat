"use client";

import { ExternalLink, Lightbulb } from "lucide-react";
import { useState } from "react";

import { Badge, Button, CopyButton } from "@/components/ds";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { apiBaseUrl } from "@/lib/api-base";
import {
	embedUrl,
	widgetIframeSnippet,
	widgetScriptSnippet,
} from "@/lib/embed-snippets";

function CodeBlock({ code }: { code: string }) {
	return (
		<pre className="max-w-full overflow-x-auto whitespace-pre rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
			<code>{code}</code>
		</pre>
	);
}

type EmbedMode = "floating" | "inline";

/**
 * The install-snippet UI: floating-vs-inline chooser, copyable snippet, embed
 * URL, and tip. Presentational and route-agnostic. Full install experience —
 * restyled to ck/ds with ds/CopyButton; copy is "support agent", never "chatbot".
 */
export function EmbedSnippet({
	publicKey,
	brandColor,
}: {
	publicKey: string;
	brandColor: string;
}) {
	const [mode, setMode] = useState<EmbedMode>("floating");
	const config = { apiUrl: apiBaseUrl(), publicKey, brandColor };
	const url = embedUrl(config);

	const options: Record<
		EmbedMode,
		{ code: string; copyLabel: string; when: React.ReactNode }
	> = {
		floating: {
			code: widgetScriptSnippet(config),
			copyLabel: "Copy script",
			when: (
				<>
					Adds a chat button in the bottom-right of every page — best for
					site-wide support. Paste before{" "}
					<code className="rounded bg-ck-chip px-1 py-0.5 font-mono text-xs">
						&lt;/body&gt;
					</code>
					.
				</>
			),
		},
		inline: {
			code: widgetIframeSnippet(config),
			copyLabel: "Copy iframe",
			when: "Drops the chat into a specific spot on a page (e.g. a contact page).",
		},
	};
	const selected = options[mode];

	return (
		<div className="flex min-w-0 flex-col gap-5">
			<ToggleGroup
				type="single"
				value={mode}
				onValueChange={(value) => value && setMode(value as EmbedMode)}
				className="w-full max-w-md"
				aria-label="Embed type"
			>
				<ToggleGroupItem
					value="floating"
					aria-label="Floating bubble (recommended)"
					className="flex-1 gap-2"
				>
					Floating bubble
					<Badge tone="accent">Recommended</Badge>
				</ToggleGroupItem>
				<ToggleGroupItem value="inline" className="flex-1">
					Inline embed
				</ToggleGroupItem>
			</ToggleGroup>

			<div className="grid min-w-0 gap-6 lg:grid-cols-2">
				{/* Selected embed snippet */}
				<div className="flex min-w-0 flex-col gap-3">
					<p className="text-sm text-ck-muted">{selected.when}</p>
					<CodeBlock code={selected.code} />
					<div className="flex flex-wrap items-center gap-2">
						<CopyButton
							value={selected.code}
							label={selected.copyLabel}
							variant="primary"
							size="sm"
						/>
						<Button variant="outline" size="sm" asChild>
							<a href={url} target="_blank" rel="noreferrer">
								Open preview
								<ExternalLink className="size-4" />
							</a>
						</Button>
					</div>
				</div>

				{/* Embed URL */}
				<div className="flex min-w-0 flex-col gap-3">
					<div className="space-y-0.5">
						<h3 className="text-sm font-semibold text-ck-text">Embed URL</h3>
						<p className="text-sm text-ck-muted">
							Use this link to preview your support agent or for advanced
							integrations.
						</p>
					</div>
					<div className="flex min-w-0 items-center gap-2">
						<input
							readOnly
							value={url}
							aria-label="Embed URL"
							onFocus={(e) => e.currentTarget.select()}
							className="h-9 min-w-0 flex-1 truncate rounded-[10px] border border-ck-border bg-ck-card px-3 font-mono text-xs text-ck-text outline-none"
						/>
						<CopyButton
							value={url}
							label="Copy URL"
							variant="outline"
							size="sm"
							className="shrink-0"
						/>
					</div>
					<div className="flex items-start gap-3 rounded-xl border border-ck-accent/20 bg-ck-accent/5 p-4">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ck-accent/10 text-ck-accent">
							<Lightbulb className="size-4" />
						</span>
						<p className="text-sm text-ck-muted">
							<span className="font-semibold text-ck-text">Tip:</span> The
							floating bubble is recommended for most sites — one paste adds
							support to every page. Use the inline embed only when you want the
							chat fixed in a specific spot.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
