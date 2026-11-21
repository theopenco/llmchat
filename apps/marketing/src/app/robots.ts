import type { MetadataRoute } from "next";

import { CANONICAL_SITE_URL } from "@/lib/site-urls";

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

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{ userAgent: "*", allow: "/" },
			{ userAgent: AI_CRAWLERS, allow: "/" },
		],
		sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
	};
}
