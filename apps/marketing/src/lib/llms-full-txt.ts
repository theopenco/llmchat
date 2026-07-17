// Builds the /llms-full.txt body — the llmstxt.org companion to /llms.txt:
// instead of a link map, the full text of every long-form page on this site
// (the blog) in one plain-markdown file, so AI systems can ingest the content
// without crawling each page. The product docs publish their own equivalent at
// docs.clankersupport.com/llms-full.txt. Pure (data in, string out) so it's
// unit-tested without the content-collections build or Next.

import { SUMMARY } from "./llms-txt";
import { DOCS_URL } from "./site-urls";

export interface LlmsFullTxtInput {
	posts: {
		slug: string;
		title: string;
		description: string;
		date: string;
		updated?: string;
		author?: string;
		category: string;
		/** Raw markdown body of the post. */
		content: string;
	}[];
}

export function buildLlmsFullTxt(
	siteUrl: string,
	input: LlmsFullTxtInput,
): string {
	// Newest first, like the /blog hub.
	const posts = input.posts.toSorted(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	const sections = posts.map((p) => {
		const meta = [
			`URL: ${siteUrl}/blog/${p.slug}`,
			`Published: ${p.date}`,
			...(p.updated ? [`Updated: ${p.updated}`] : []),
			...(p.author ? [`Author: ${p.author}`] : []),
			`Category: ${p.category}`,
		].join("\n");
		// Root-relative markdown links would be resolved against whatever
		// domain serves this text, so make them absolute site URLs.
		const absolute = p.content.replace(/\]\((\/[^)\s]*)\)/g, `](${siteUrl}$1)`);
		return `# ${p.title}\n\n${meta}\n\n${p.description}\n\n${absolute.trim()}`;
	});

	const header = `# Clanker Support — full blog content

> ${SUMMARY}

This file concatenates the full text of every clankersupport.com blog post below, newest first. For a short link map of the whole site, see ${siteUrl}/llms.txt. For the full product documentation in the same format, see ${DOCS_URL}/llms-full.txt.`;

	return `${[header, ...sections].join("\n\n").trimEnd()}\n`;
}
