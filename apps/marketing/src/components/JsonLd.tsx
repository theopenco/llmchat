/**
 * Server-rendered JSON-LD. Because this is a server component, the script is in
 * the initial HTML (crawlers and the Rich Results Test see it) — not injected
 * client-side. Pass a schema.org object as `data`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}
