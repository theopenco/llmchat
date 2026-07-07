import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

// cached forever
export const revalidate = false;

const HEADER = `# Clanker Support — Full Documentation

> An AI-powered support agent for your site — install it with one script tag or one React Server Component (@clankersupport/widget-rsc on npm). It answers from your docs and sources, then escalates to your team. Open source (MIT) and self-hostable (bring your own keys).

Site: https://clankersupport.com · Docs: https://docs.clankersupport.com · Dashboard: https://app.clankersupport.com

This file concatenates the full text of every documentation page below.`;

export async function GET() {
	const scan = source.getPages().map(getLLMText);
	const scanned = await Promise.all(scan);

	return new Response([HEADER, ...scanned].join("\n\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
