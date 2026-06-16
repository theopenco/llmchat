"use client";

import { ExternalLink, Lightbulb } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * URL, and tip. Presentational and route-agnostic so it's shared by the project
 * settings card and the onboarding finish screen (one source of truth for the
 * embed markup).
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
					<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
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
					<Badge
						variant="secondary"
						className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					>
						Recommended
					</Badge>
				</ToggleGroupItem>
				<ToggleGroupItem value="inline" className="flex-1">
					Inline embed
				</ToggleGroupItem>
			</ToggleGroup>

			<div className="grid min-w-0 gap-6 lg:grid-cols-2">
				{/* Selected embed snippet */}
				<div className="flex min-w-0 flex-col gap-3">
					<p className="text-sm text-muted-foreground">{selected.when}</p>
					<CodeBlock code={selected.code} />
					<div className="flex flex-wrap items-center gap-2">
						<CopyButton value={selected.code}>{selected.copyLabel}</CopyButton>
						<Button type="button" variant="outline" size="sm" asChild>
							<a href={url} target="_blank" rel="noreferrer">
								Open preview
								<ExternalLink />
							</a>
						</Button>
					</div>
				</div>

				{/* Embed URL */}
				<div className="flex min-w-0 flex-col gap-3">
					<div className="space-y-0.5">
						<h3 className="text-sm font-medium text-foreground">Embed URL</h3>
						<p className="text-sm text-muted-foreground">
							Use this link to preview your chatbot or for advanced
							integrations.
						</p>
					</div>
					<div className="flex min-w-0 items-center gap-2">
						<Input
							readOnly
							value={url}
							aria-label="Embed URL"
							className="min-w-0 truncate font-mono text-xs"
							onFocus={(e) => e.currentTarget.select()}
						/>
						<CopyButton value={url} size="default" className="shrink-0">
							Copy URL
						</CopyButton>
					</div>
					<div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 dark:bg-indigo-500/10">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
							<Lightbulb className="size-4" />
						</span>
						<p className="text-sm text-indigo-950/80 dark:text-indigo-200/90">
							<span className="font-semibold">Tip:</span> The floating bubble is
							recommended for most sites — one paste adds support to every page.
							Use the inline embed only when you want the chat fixed in a
							specific spot.
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
