export type Category =
	| "Announcements"
	| "Guides"
	| "Engineering"
	| "Changelog";

export type Post = {
	slug: string;
	title: string;
	description: string;
	date: string; // YYYY-MM-DD
	category: Category;
	content: string; // Paragraphs separated by \n\n, **bold** supported
};

export const posts: Post[] = [
	{
		slug: "introducing-llmchat",
		title: "Introducing llmchat: AI support that actually escalates",
		description:
			"Today we're launching llmchat — a drop-in widget that answers from your docs and hands off to your team when the bot can't help.",
		date: "2026-05-20",
		category: "Announcements",
		content: `We built llmchat because we kept running into the same problem: AI chatbots that confidently hallucinate rather than admit they don't know something. Your customers deserve better, and so does your team.

llmchat is a single script tag you drop on your site. The widget loads in a shadow DOM so your styles never leak, and you paste in your knowledge base or system prompt to keep the bot on-topic.

When the bot genuinely can't help — after a configurable number of exchanges — it escalates. The full conversation lands in your inbox with context intact. Your team picks it up, replies by email, and the customer sees it threaded back into the same chat window.

We've built it on LLM Gateway so you can swap underlying models without touching your integration. The whole stack is self-hostable on Ploy, D1, and KV. No surprise vendor lock-in.

Get started free today. We'd love to hear how it goes.`,
	},
	{
		slug: "reducing-support-tickets-with-ai-first-response",
		title: "How to reduce support tickets by 60% with an AI first-response layer",
		description:
			"A practical guide to deploying an AI first-responder that handles the repetitive stuff so your team can focus on the conversations that matter.",
		date: "2026-05-15",
		category: "Guides",
		content: `Most support tickets fall into a small set of categories: password resets, pricing questions, integration how-tos, and status page checks. These are table-stakes questions your docs already answer — they just require someone to read them on behalf of the customer.

An AI first-response layer handles these instantly, 24/7, without burnout. The key is scoping it correctly.

**Start with your knowledge base.** Export your top 20 FAQ answers, your docs navigation, and your pricing page copy. Paste this into your system prompt. This is your bot's working memory — keep it focused and current.

**Set an escalation threshold that makes sense.** We default to 3 exchanges. If after three back-and-forths the customer still hasn't found their answer, they probably have a nuanced problem. Hand it off before frustration sets in.

**Don't try to automate everything.** Billing disputes, angry customers, and enterprise deals should go straight to a human. Use the bot as a filter, not a replacement. Customers who get escalated quickly trust you more than customers who feel trapped in a bot loop.

**Measure what matters.** Track escalation rate (% of conversations that reach a human), resolution rate (% of bot-only conversations where the user stopped asking), and customer satisfaction on both legs of the conversation.

Teams that deploy this kind of layer consistently report 50–70% reduction in ticket volume within 30 days. The bot handles the easy stuff; your team handles the stuff that actually needs them.`,
	},
	{
		slug: "why-we-built-on-llm-gateway",
		title: "Why we built on LLM Gateway instead of calling OpenAI directly",
		description:
			"Our reasoning for using a model abstraction layer from day one — and why it's already paid off twice.",
		date: "2026-05-10",
		category: "Engineering",
		content: `When we started llmchat, the obvious path was to call OpenAI's API directly. Every tutorial does it, the SDK is excellent, and it's what you know. We chose not to, and it's already paid off twice.

The first time: GPT-4o pricing changed. We were able to re-evaluate and switch models for lower-cost use cases without touching our integration code. One config change.

The second time: a customer needed to run on a self-hosted model for data residency reasons. We added their endpoint as a custom provider in LLM Gateway, pointed the project at it, and nothing else changed.

LLM Gateway gives us a single interface — the OpenAI-compatible API — with routing, fallback, cost attribution, and usage metering on top. We use the Vercel AI SDK with their custom provider, which means our streaming code is the same regardless of what model is underneath.

The practical implication for llmchat users: every project can run a different model. You might use Claude 3.5 Haiku for your high-volume support widget and GPT-4o for your enterprise tier. You get cost and usage per project without building that instrumentation yourself.

We're believers in the principle that the model layer should be a runtime concern, not a compile-time one. LLM Gateway makes that real.`,
	},
	{
		slug: "setting-up-email-threading",
		title: "Setting up email threading for your support widget",
		description:
			"A step-by-step guide to configuring inbound email so customer replies thread back into the same conversation.",
		date: "2026-05-05",
		category: "Guides",
		content: `When a conversation escalates in llmchat, we send an email to your configured notify address. What makes it useful rather than just a notification is what happens next: the customer can reply to that email, and their reply threads back into the conversation in your inbox.

**Step 1: Configure your notify email.** In your project settings, set the "Notify email" field to wherever you want escalation alerts to land. This is your team inbox or a shared support address.

**Step 2: Set up your inbound email domain.** llmchat uses Resend for both outbound and inbound email. You'll need to configure a receiving domain (e.g., inbound.yourdomain.com) and add the MX records Resend provides. This is a one-time DNS change.

**Step 3: Set your inbound email local.** In project settings, set the "Inbound email local" field to a short identifier (e.g., "support" for support@inbound.yourdomain.com). This is the address customers reply to.

**Step 4: Test it.** Create a test conversation, escalate it manually, and reply to the notification email from a different address. The reply should appear in your inbox within seconds.

Once set up, the thread works both ways: you can reply from your inbox and the customer sees it in the widget. No separate helpdesk required for the basic case.`,
	},
	{
		slug: "llmchat-changelog-may-2026",
		title: "Changelog: May 2026 — knowledge base improvements and new model options",
		description:
			"Longer knowledge base support, model selection per project, and a handful of inbox quality-of-life improvements.",
		date: "2026-05-01",
		category: "Changelog",
		content: `Here's what shipped in May.

**Longer knowledge base support.** We've increased the knowledge base character limit from 8k to 32k characters. Customers running large doc sets can now paste in significantly more content without hitting the cap.

**Model selection per project.** You can now choose which LLM Gateway model to use on a per-project basis from the project settings page. We've pre-populated the dropdown with the models we've tested and recommend, but you can also enter a custom model ID.

**Inbox: unread badge.** The conversation list now shows an unread badge on conversations with messages your team hasn't seen. Badge counts reset when you open the conversation.

**Inbox: archive bulk action.** You can now select multiple conversations and archive them in one action. Useful for cleaning up resolved conversations at the end of a shift.

**Widget: branded color inheritance.** The widget now picks up your brand color for the header and primary button. Set it once in project settings and it applies automatically.

**Bug fix: email threading on reply.** Fixed an issue where customer email replies were occasionally creating duplicate messages in the conversation. Inbound email parsing is now more robust against non-standard reply formatting.

Next up: Slack webhook notifications, conversation search, and a public API for pulling usage data.`,
	},
	{
		slug: "the-case-for-self-hostable-ai-support",
		title: "The case for self-hostable AI support",
		description:
			"Why open architecture matters for tools that sit between you and your customers.",
		date: "2026-04-28",
		category: "Engineering",
		content: `Support tooling sits at a sensitive intersection: it handles customer PII, it's in the critical path of your customer relationships, and it's the first thing customers blame when something goes wrong. Locking that into a SaaS black box is a meaningful risk.

We built llmchat to be self-hostable from day one. Here's what that means in practice.

The stack is Ploy for deployment, D1 for the SQLite-compatible database, and KV for rate limiting and cache. All three run on Cloudflare's infrastructure. You can run the entire thing on your own Cloudflare account with your own domain, your own data residency, and your own billing.

The code is open architecture — meaning you can read it, audit it, and understand exactly what's happening with your customers' conversations. There are no hidden webhooks, no data sold to third parties, no opaque enrichment pipelines.

Self-hosting isn't for everyone. The managed version on llmchat.io handles infrastructure for you, and that's the right choice for most teams. But the option to take full control should exist, especially for regulated industries or companies with strict data handling requirements.

We think AI tools that handle sensitive customer interactions should be auditable by default. Self-hostability is one way to make that real.`,
	},
];

export const categories = [
	"All",
	"Announcements",
	"Guides",
	"Engineering",
	"Changelog",
] as const;

export type CategoryFilter = (typeof categories)[number];

export function formatDate(date: string): string {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}
