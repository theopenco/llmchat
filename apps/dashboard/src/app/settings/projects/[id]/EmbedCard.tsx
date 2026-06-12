"use client";

import { ExternalLink, Lightbulb } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiBaseUrl } from "@/lib/api-base";
import {
	embedUrl,
	widgetIframeSnippet,
	widgetScriptSnippet,
} from "@/lib/embed-snippets";

import { SectionCard } from "./SectionCard";

function CodeBlock({ code }: { code: string }) {
	return (
		<pre className="max-w-full overflow-x-auto whitespace-pre rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
			<code>{code}</code>
		</pre>
	);
}

export function EmbedCard({
	publicKey,
	brandColor,
}: {
	publicKey: string;
	brandColor: string;
}) {
	const config = { apiUrl: apiBaseUrl(), publicKey, brandColor };
	const url = embedUrl(config);
	const iframeCode = widgetIframeSnippet(config);
	const scriptCode = widgetScriptSnippet(config);

	return (
		<SectionCard
			id="install"
			step={5}
			title="Install widget"
			description="Copy this code and paste it into your website to add the chatbot."
		>
			<div className="grid min-w-0 gap-6 lg:grid-cols-2">
				{/* Embed code */}
				<div className="flex min-w-0 flex-col gap-3">
					<div className="space-y-0.5">
						<h3 className="text-sm font-medium text-foreground">Embed code</h3>
						<p className="text-sm text-muted-foreground">
							Paste this iframe into your website HTML where you want the
							chatbot to appear.
						</p>
					</div>
					<CodeBlock code={iframeCode} />
					<div className="flex flex-wrap items-center gap-2">
						<CopyButton value={iframeCode}>Copy iframe code</CopyButton>
						<Button type="button" variant="outline" size="sm" asChild>
							<a href={url} target="_blank" rel="noreferrer">
								Open preview
								<ExternalLink />
							</a>
						</Button>
					</div>
					<details className="group">
						<summary className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
							Alternative script tag
						</summary>
						<div className="mt-3 flex min-w-0 flex-col gap-3">
							<p className="text-sm text-muted-foreground">
								Floating chat bubble on every page — paste before{" "}
								<code className="font-mono text-xs">&lt;/body&gt;</code>.
							</p>
							<CodeBlock code={scriptCode} />
							<CopyButton value={scriptCode} className="self-start">
								Copy script tag
							</CopyButton>
						</div>
					</details>
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
							<span className="font-semibold">Tip:</span> For most websites,
							paste this iframe where you want the chatbot to appear. Later, you
							can replace it with a floating widget script.
						</p>
					</div>
				</div>
			</div>
		</SectionCard>
	);
}
