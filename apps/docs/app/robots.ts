import { DOCS_URL } from "@/lib/site";

import type { MetadataRoute } from "next";

// Search and answer-engine crawlers, named explicitly so the intent is
// unambiguous: the site wants to be indexed AND cited by AI assistants.
const AI_CRAWLERS = [
	"GPTBot",
	"OAI-SearchBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Claude-SearchBot",
	"Claude-User",
	"PerplexityBot",
	"Perplexity-User",
	"Google-Extended",
	"Applebot-Extended",
	"Bingbot",
	"DuckAssistBot",
	"meta-externalagent",
	"MistralAI-User",
];

// Public, indexable docs. An explicit robots.txt (instead of the 404 the app
// served before) is unambiguous for crawlers and is the only place the docs
// sitemap gets advertised — this host isn't registered in Search Console the
// way the marketing site is.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{ userAgent: "*", allow: "/" },
			{ userAgent: AI_CRAWLERS, allow: "/" },
		],
		sitemap: `${DOCS_URL}/sitemap.xml`,
	};
}
