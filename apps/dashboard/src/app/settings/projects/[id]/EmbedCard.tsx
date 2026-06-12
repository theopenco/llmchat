"use client";

import { CopySnippet } from "@/components/copy-snippet";
import { widgetIframeSnippet, widgetScriptSnippet } from "@/lib/embed-snippets";

import { SectionCard } from "./SectionCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export function EmbedCard({
	publicKey,
	brandColor,
}: {
	publicKey: string;
	brandColor: string;
}) {
	const config = { apiUrl: API_URL, publicKey, brandColor };
	return (
		<SectionCard
			step={5}
			title="Embed on your site"
			description="Add the chat to your website with either snippet."
		>
			<div className="flex flex-col gap-6">
				<CopySnippet label="Script tag" code={widgetScriptSnippet(config)}>
					Floating chat bubble in the corner of every page. Recommended.
				</CopySnippet>
				<CopySnippet label="iframe" code={widgetIframeSnippet(config)}>
					Inline chat panel you can place anywhere — size it however you like.
				</CopySnippet>
			</div>
		</SectionCard>
	);
}
