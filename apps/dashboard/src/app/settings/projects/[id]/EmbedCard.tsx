"use client";

import { EmbedSnippet } from "@/components/embed-snippet";

import { SectionCard } from "./SectionCard";

export function EmbedCard({
	publicKey,
	brandColor,
}: {
	publicKey: string;
	brandColor: string;
}) {
	return (
		<SectionCard
			id="install"
			step={5}
			title="Install widget"
			description="Choose how the chatbot appears, then copy the code into your site."
		>
			<EmbedSnippet publicKey={publicKey} brandColor={brandColor} />
		</SectionCard>
	);
}
