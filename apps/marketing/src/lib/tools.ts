// Single source of truth for the free tools (engineering-as-marketing pages
// under /tools). Powers the hub grid, the per-tool pages, the sitemap, the
// llms.txt section, and the footer links, so names and copy never drift.
// Copy follows the free-tools + copywriting skills: keyword-led titles
// ("[thing] calculator/generator"), benefit-led H1s, query-shaped FAQs that are
// self-contained for answer engines. Positioning: "support agent", never
// "chatbot" (see llms-txt.test.ts).

import type { Faq } from "@/lib/seo";

export type Tool = {
	/** URL slug — `/tools/<slug>`. */
	slug: string;
	/** Two-digit index used as the mono eyebrow + ghost numeral ("01"). */
	num: string;
	/** Short display name — nav, cards, breadcrumbs. */
	name: string;
	/** One-line summary — hub cards, footer, cross-links, llms.txt. */
	tagline: string;
	/** Keyword-led <title> (the " — Clanker Support" suffix is added on-page). */
	seoTitle: string;
	/** Meta description (~150 chars, includes the query keyword). */
	seoDescription: string;
	/** Benefit-led page H1. */
	headline: string;
	/** Hero subtext under the H1 (1–2 sentences). */
	lead: string;
	/** Editorial sections rendered below the interactive tool. */
	body: { heading: string; paragraphs: string[] }[];
	/** Query-shaped FAQs — visible block + `FAQPage` schema. */
	faqs: Faq[];
};

export const TOOLS: Tool[] = [
	{
		slug: "support-roi-calculator",
		num: "01",
		name: "AI support savings calculator",
		tagline:
			"See how many hours and dollars AI support would save your team each month.",
		seoTitle: "AI Customer Support Savings Calculator (Free)",
		seoDescription:
			"Free AI customer support ROI calculator. Enter your ticket volume, handle time, and hourly cost to see how much an AI support agent saves per month.",
		headline: "How much would AI support save you?",
		lead: "Enter your ticket volume, average handle time, and what an hour of support costs you. The calculator shows the hours and dollars an AI support agent gives back every month.",
		body: [
			{
				heading: "How the math works",
				paragraphs: [
					"The calculator multiplies your monthly conversations by your average handle time to get the hours your team spends on support today. It then applies your deflection rate — the share of conversations an AI support agent resolves without a human — and prices those recovered hours at your fully-loaded hourly cost.",
					"Saved dollars = conversations × deflection × (minutes ÷ 60) × hourly cost. Every input is editable, so you can model a cautious launch (40% deflection) or a mature knowledge base (70%+) and see the range instead of a single rosy number.",
				],
			},
			{
				heading: "What's a realistic deflection rate?",
				paragraphs: [
					"Teams that connect a decent knowledge base typically see an AI agent fully resolve 40–70% of inbound conversations. Products with repetitive, documented questions (billing, setup, shipping) sit at the top of that range; products with novel, account-specific issues sit lower.",
					"Deflection compounds with content: every escalation that gets a documented answer becomes a conversation the AI resolves next time. That's why the honest way to model ROI is to start conservative and revisit after a month of real transcripts.",
				],
			},
		],
		faqs: [
			{
				question: "How do I calculate the ROI of AI customer support?",
				answer:
					"Multiply your monthly conversations by the share an AI agent resolves (deflection rate), then by your average handle time and your hourly support cost. That product is your monthly saving; compare it against the tool's subscription price to get ROI.",
			},
			{
				question: "What deflection rate should I assume for an AI agent?",
				answer:
					"Assume 40–50% if you're just starting and your docs are thin, 60–70% if your common questions are well documented. Measure real resolution rates after a few weeks and re-run the numbers — deflection usually climbs as your knowledge base fills gaps.",
			},
			{
				question: "Does AI support replace human agents?",
				answer:
					"No — it absorbs the repetitive majority of tickets so humans handle the conversations that actually need judgment. Good AI support tools escalate to email or Slack with full context when they can't help, which keeps quality up while cutting queue time.",
			},
			{
				question: "How much does Clanker Support cost per AI response?",
				answer:
					"Hosted plans start at $19/month with a bundle of AI responses included and no per-seat fees; you can also self-host the open-source version for free with your own model keys. That makes payback simple: one deflected ticket often covers a day of the subscription.",
			},
		],
	},
	{
		slug: "csat-calculator",
		num: "02",
		name: "CSAT calculator",
		tagline:
			"Turn survey responses into a CSAT score and see how you rank against benchmarks.",
		seoTitle: "CSAT Calculator — Free Customer Satisfaction Score Tool",
		seoDescription:
			"Free CSAT calculator. Enter satisfied responses and total survey responses to get your customer satisfaction score, plus industry benchmarks to compare against.",
		headline: "Calculate your CSAT score in seconds.",
		lead: "Enter how many customers rated you 4 or 5, and how many answered the survey. You get your CSAT percentage instantly — and how it stacks up against industry benchmarks.",
		body: [
			{
				heading: "The CSAT formula",
				paragraphs: [
					"CSAT (customer satisfaction score) is the percentage of survey respondents who are satisfied: the number of 4 and 5 ratings on a 5-point scale, divided by total responses, multiplied by 100. A survey with 83 positive answers out of 100 responses is an 83% CSAT.",
					"Only the top two ratings count as satisfied — a 3 (\"neutral\") doesn't. That's deliberate: CSAT measures how many customers you clearly delighted, not how many you failed to annoy.",
				],
			},
			{
				heading: "What's a good CSAT score?",
				paragraphs: [
					"Across industries, average CSAT lands between 75% and 85%. Software and SaaS teams typically report high-70s to low-80s; ecommerce and retail skew slightly higher; telecoms and utilities skew lower. Above 90% is exceptional, and below 70% usually signals a process problem — slow first response is the most common culprit.",
					"Treat the benchmark as a floor, not a target. The more useful practice is tracking your own trend weekly and reading the verbatim comments on every low rating: three angry comments about the same issue are worth more than a point of aggregate movement.",
				],
			},
			{
				heading: "How to improve CSAT",
				paragraphs: [
					"The strongest levers are speed and resolution: answer fast, resolve on first contact, and close the loop when you promised a follow-up. Instant, accurate first response is exactly what an AI support agent is good at — teams that deflect their repetitive tickets typically see CSAT rise because humans get time back for the hard conversations.",
				],
			},
		],
		faqs: [
			{
				question: "How is CSAT calculated?",
				answer:
					"CSAT = (number of satisfied responses ÷ total survey responses) × 100. On the standard 5-point scale, ratings of 4 and 5 count as satisfied. So if 83 of 100 respondents rated you 4 or 5, your CSAT score is 83%.",
			},
			{
				question: "What is a good CSAT score for SaaS?",
				answer:
					"For software and SaaS, a CSAT between 78% and 85% is solid, and anything above 90% is exceptional. Below 70% usually points to a fixable process issue — most often slow first response or unresolved first contacts rather than product quality itself.",
			},
			{
				question: "How many survey responses do I need for a reliable CSAT?",
				answer:
					"Treat CSAT from fewer than 30 responses as directional, not definitive — one grumpy customer swings a 10-response sample by 10 points. From roughly 100 responses per period the score stabilizes enough to compare month over month and act on trends.",
			},
			{
				question: "What's the difference between CSAT, NPS, and CES?",
				answer:
					'CSAT measures satisfaction with a specific interaction ("how did we do?"). NPS measures long-term loyalty ("would you recommend us?"). CES measures effort ("how easy was that?"). CSAT is the standard for rating individual support conversations, which is why support tools survey it after each chat.',
			},
		],
	},
	{
		slug: "canned-response-generator",
		num: "03",
		name: "Canned response generator",
		tagline:
			"Build polished, personal support replies for refunds, bugs, outages, and more.",
		seoTitle: "Canned Response Generator — Free Support Reply Templates",
		seoDescription:
			"Free canned response generator for customer service. Pick a scenario, set the tone, add your details, and copy a polished support reply in seconds.",
		headline: "Canned responses that don't sound canned.",
		lead: "Pick a scenario, choose a tone, drop in your customer's name — and copy a support reply that reads like a human wrote it. Eight scenarios, three tones, zero sign-up.",
		body: [
			{
				heading: "What makes a good canned response",
				paragraphs: [
					"A good canned response solves the 80% that repeats — the greeting, the empathy, the policy, the next step — while leaving obvious slots for the 20% that's personal. The templates here follow the same structure support teams converge on: acknowledge specifically, state what happens next with a real timeframe, and end with an opening for follow-up.",
					"The fastest way to make a template sound canned is to skip the customer's actual problem. Always keep one sentence that names their specific situation — the generator marks where.",
				],
			},
			{
				heading: "From templates to automation",
				paragraphs: [
					"Canned responses are the manual version of what an AI support agent does automatically: it drafts the reply from your docs and policies, personalized to the question, and hands off to a human when your customer asks for one. If your team pastes the same ten templates all day, that's the signal the first tier of your support can be automated.",
				],
			},
		],
		faqs: [
			{
				question: "What is a canned response in customer service?",
				answer:
					"A canned response is a pre-written reply template for a recurring support scenario — refund requests, bug reports, outage updates — that agents personalize before sending. Good ones cut handle time dramatically while keeping replies consistent and on-policy.",
			},
			{
				question: "How do I make canned responses sound personal?",
				answer:
					"Keep three things variable in every template: the customer's name, one sentence that restates their specific situation, and a concrete next step with a real timeframe. Skipping the middle one is what makes replies feel robotic, no matter how friendly the wording is.",
			},
			{
				question: "Can I use these templates in any help desk?",
				answer:
					"Yes — the generator outputs plain text you can paste into saved replies, macros, or snippets in any tool: Zendesk, Intercom, Front, Help Scout, Gorgias, or plain email. Nothing is gated and there's no sign-up; the copy button gives you the finished reply.",
			},
			{
				question: "Can AI write support replies automatically instead?",
				answer:
					"Yes. An AI support agent like Clanker Support answers from your docs and knowledge base automatically, so the repetitive scenarios canned responses cover get resolved without an agent pasting anything — and conversations that need a human escalate with full context.",
			},
		],
	},
	{
		slug: "llms-txt-generator",
		num: "04",
		name: "llms.txt generator",
		tagline:
			"Generate a spec-correct llms.txt so AI assistants can navigate your site.",
		seoTitle: "llms.txt Generator — Create a Spec-Correct llms.txt File",
		seoDescription:
			"Free llms.txt generator. Describe your site, add your key pages, and download a spec-correct llms.txt file that helps AI assistants find and cite your content.",
		headline: "Give AI assistants a map of your site.",
		lead: "llms.txt is a plain-markdown index that tells AI systems what your site is and which pages matter. Fill in the form, watch the file build itself, and download a spec-correct llms.txt.",
		body: [
			{
				heading: "What is llms.txt?",
				paragraphs: [
					"llms.txt (llmstxt.org) is a proposed convention: a markdown file at your site root that gives language models a curated map of your content — one H1 with the site name, a one-line blockquote summary, then H2 sections of annotated links. Where robots.txt tells crawlers what they may not read, llms.txt tells AI systems what they should read.",
					"Context windows are finite, so an AI assistant answering a question about your product does far better with a 40-line curated index than with your raw HTML navigation. That's the whole idea — you choose the pages that represent you.",
				],
			},
			{
				heading: "The format, explained",
				paragraphs: [
					"The spec is deliberately minimal. Required: an H1 with the project or site name. Strongly recommended: a blockquote summary right under it. Then any number of H2 sections — Docs, Product, Pricing, Blog — each a markdown list of links in the form [title](url): description. The description after the colon is what lets a model pick the right link without fetching everything.",
					"This generator enforces that shape as you type, so the output validates against the convention — and it serves as a live example: this site publishes its own llms.txt at clankersupport.com/llms.txt.",
				],
			},
			{
				heading: "Where to serve it",
				paragraphs: [
					"Serve the file at /llms.txt from your site root with a text/plain or text/markdown content type. Static hosts just need the file in the public directory; Next.js apps can add a route handler; docs platforms like Mintlify generate one automatically. Keep it under a few hundred lines — it's a curated index, not a sitemap dump.",
				],
			},
		],
		faqs: [
			{
				question: "What is an llms.txt file?",
				answer:
					"llms.txt is a markdown file served at your site root that gives AI systems a curated index of your most important pages: an H1 site name, a one-line blockquote summary, then H2 sections of annotated links. It's a proposed convention from llmstxt.org, designed for finite context windows.",
			},
			{
				question: "Where do I put my llms.txt file?",
				answer:
					"Serve it at the root of your domain — https://yoursite.com/llms.txt — as plain text or markdown. On static hosts, drop the file in your public folder; in Next.js, add an app/llms.txt/route.ts handler; most docs platforms can emit one automatically.",
			},
			{
				question: "What's the difference between llms.txt and robots.txt?",
				answer:
					"robots.txt is restrictive — it tells crawlers which paths they may not fetch. llms.txt is curatorial — it tells AI systems which pages best represent your site and what each one covers. They complement each other: one sets boundaries, the other provides a reading list.",
			},
			{
				question: "Does llms.txt actually improve AI visibility?",
				answer:
					"It's an emerging convention, not a ranking guarantee: some AI crawlers and answer engines fetch it, others don't yet. It costs one small text file, makes your site easier for any agent to summarize correctly, and adopters treat it like early sitemap.xml — cheap insurance that compounds if the convention wins.",
			},
			{
				question: "Should I also create an llms-full.txt?",
				answer:
					"llms-full.txt is an optional companion that inlines the full text of your key pages instead of linking to them. It suits documentation sites where agents benefit from one big file. Start with llms.txt — it's the part of the convention with the widest support.",
			},
		],
	},
];

export function getTool(slug: string): Tool | undefined {
	return TOOLS.find((t) => t.slug === slug);
}
