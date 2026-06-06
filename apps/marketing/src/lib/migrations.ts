import type { CompetitorKey } from "@/lib/competitors";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MigrationStep = {
	title: string;
	body: string;
	code?: string; // optional snippet rendered in a code block
	codeLabel?: string;
};

export type MappingRow = {
	from: string; // competitor concept
	to: string; // llmchat equivalent
	note?: string;
};

export type MigrationGuide = {
	slug: CompetitorKey;
	name: string;
	tagline: string;
	estimatedTime: string;
	intro: string;
	// "Quick migration" — before/after embed snippet
	quickSummary: string;
	oldEmbed: string;
	oldEmbedLabel: string;
	// Detailed steps
	steps: MigrationStep[];
	// Concept mapping table
	mapping: MappingRow[];
	// What carries over cleanly vs. needs a separate solution
	transfers: string[];
	doesntTransfer: string[];
};

// The llmchat embed snippet every migration lands on.
export const llmchatEmbed = `<script
  src="https://api.llmchat.io/widget.js"
  data-project="pk_live_xxxxxxxxxxxx"
  data-brand="#111827"
  defer
></script>`;

// Steps shared by every migration (referenced inside each guide's `steps`).
const commonTail: MigrationStep[] = [
	{
		title: "Configure escalation and your notify email",
		body: "In project settings, set the escalation threshold (how many exchanges before the bot hands off) and the notify email where escalations should land. This is your team inbox or a shared support address. When the bot can't help, the full conversation arrives there with context intact.",
	},
	{
		title: "Set up email threading (optional)",
		body: "If you want customer email replies to thread back into the widget conversation, point an inbound domain at llmchat and set your inbound email local in project settings. Replies then flow both ways — your team answers from the inbox, the customer sees it in the widget. No separate helpdesk required.",
	},
	{
		title: "Test, then go live",
		body: "Open your site, start a test conversation, and trigger an escalation to confirm it reaches your inbox. Once it looks right, you're done — the widget is already live for every visitor.",
	},
];

// ─── Guides ──────────────────────────────────────────────────────────────────

export const migrations: MigrationGuide[] = [
	{
		slug: "chatbase",
		name: "Chatbase",
		tagline: "From the Chatbase embed to a single llmchat script tag",
		estimatedTime: "~20 minutes",
		intro:
			"Migrating from Chatbase to llmchat is mostly a knowledge-base re-import and a one-line embed swap. Your bot's brain lives in text you already have, and the llmchat widget drops in with a single script tag — no SDK, no platform onboarding.",
		quickSummary:
			"Replace the Chatbase embed snippet with the llmchat script tag, then paste your knowledge base into your llmchat project. Everything else is configuration in the dashboard.",
		oldEmbedLabel: "Remove the Chatbase embed",
		oldEmbed: `<script>
  window.embeddedChatbotConfig = {
    chatbotId: "XXXXXXXX",
    domain: "www.chatbase.co",
  };
</script>
<script
  src="https://www.chatbase.co/embed.min.js"
  chatbotId="XXXXXXXX"
  domain="www.chatbase.co"
  defer
></script>`,
		steps: [
			{
				title: "Create your llmchat project",
				body: "Sign up, create a workspace, and add a project. Your project gets a public key (pk_live_…) used to bootstrap the widget. Set your brand color while you're here — the widget inherits it automatically.",
			},
			{
				title: "Import your knowledge base",
				body: "In Chatbase, your bot is trained on uploaded files and text sources. Export or copy that content and paste it into your llmchat project's knowledge base / system prompt field. Keep it focused and current — this is your bot's working memory.",
			},
			{
				title: "Swap the embed snippet",
				body: "Delete the Chatbase embed from your site and drop in the llmchat script tag. Replace the public key with your project's. The widget loads in a shadow DOM, so your page styles and the widget never interfere.",
				code: llmchatEmbed,
				codeLabel: "Add the llmchat widget",
			},
			...commonTail,
		],
		mapping: [
			{ from: "Chatbot (chatbotId)", to: "Project (publicKey)", note: "One project per bot." },
			{ from: "Training sources / files", to: "Knowledge base / system prompt" },
			{ from: "embed.min.js + embeddedChatbotConfig", to: "Single widget.js script tag" },
			{ from: "Custom AI model (Chatbase-managed)", to: "Any model via LLM Gateway", note: "Swap per project, no code change." },
			{ from: "Lead forms / handoff", to: "Smart escalation to your inbox" },
		],
		transfers: [
			"Knowledge base content (paste it in)",
			"Your brand color and basic widget styling",
			"System prompt / bot persona",
		],
		doesntTransfer: [
			"Past conversation history (export from Chatbase for your records)",
			"WhatsApp, Slack, and Messenger channels — llmchat is web-only today",
			"Chatbase-specific integrations and actions",
		],
	},

	{
		slug: "fin",
		name: "Fin",
		tagline: "From Fin (inside Intercom) to a standalone llmchat widget",
		estimatedTime: "~30 minutes",
		intro:
			"Fin runs inside Intercom or your existing helpdesk, so moving to llmchat means adopting a standalone widget and inbox rather than swapping just the AI layer. The upside: predictable usage-based pricing with no per-outcome minimums, and a model you control.",
		quickSummary:
			"Stand up an llmchat project, recreate your answer content, and replace the Intercom/Fin messenger embed with the llmchat script tag. Your existing helpdesk data stays where it is.",
		oldEmbedLabel: "Remove the Intercom / Fin messenger",
		oldEmbed: `<script>
  window.intercomSettings = {
    api_base: "https://api-iam.intercom.io",
    app_id: "XXXXXXXX",
  };
</script>
<script>
  // Intercom messenger loader (Fin runs inside this)
  (function(){ /* … intercom snippet … */ })();
</script>`,
		steps: [
			{
				title: "Create your llmchat project",
				body: "Sign up and create a project. You'll get a public key for the widget. Because llmchat is a standalone widget + inbox, you don't need to keep paying for the surrounding Intercom platform unless you use it for other things.",
			},
			{
				title: "Recreate your answer content",
				body: "Fin draws on your help center and configured content. Copy your core help-center articles and FAQs into your llmchat knowledge base. You don't need to migrate everything — start with the topics that drive the most conversations.",
			},
			{
				title: "Replace the messenger embed",
				body: "Remove the Intercom messenger loader (Fin lives inside it) and add the llmchat script tag. If you're keeping Intercom for other workflows, you can run them side by side during a transition and remove the messenger once you're confident.",
				code: llmchatEmbed,
				codeLabel: "Add the llmchat widget",
			},
			...commonTail,
		],
		mapping: [
			{ from: "Fin AI Engine (proprietary)", to: "Any model via LLM Gateway", note: "You pick the provider." },
			{ from: "Help center content", to: "Knowledge base / system prompt" },
			{ from: "Per-outcome billing ($0.99 + minimum)", to: "Usage-based — pay for tokens, no minimum" },
			{ from: "Intercom Inbox", to: "llmchat inbox" },
			{ from: "Resolution workflows", to: "Smart escalation + email threading" },
		],
		transfers: [
			"Help-center answer content (paste it in)",
			"Bot tone and instructions via the system prompt",
		],
		doesntTransfer: [
			"Voice channel — llmchat is web chat + email today",
			"Zendesk / Salesforce / HubSpot actions and lookups",
			"Intercom CRM, campaigns, and conversation history",
		],
	},

	{
		slug: "intercom",
		name: "Intercom",
		tagline: "From the Intercom platform to a focused llmchat widget",
		estimatedTime: "~30 minutes",
		intro:
			"Intercom is a full platform — support, sales, and marketing. If you only use it for the support widget, llmchat replaces that piece at a fraction of the cost. If you rely on Intercom's CRM, campaigns, or product tours, plan to keep those or find replacements; llmchat is support-only by design.",
		quickSummary:
			"Create an llmchat project, recreate your help content, and swap the Intercom messenger embed for the llmchat script tag. Move your team to the llmchat inbox for support conversations.",
		oldEmbedLabel: "Remove the Intercom messenger",
		oldEmbed: `<script>
  window.intercomSettings = { app_id: "XXXXXXXX" };
</script>
<script>
  (function(){
    var w=window;var ic=w.Intercom;
    // … standard Intercom loader …
  })();
</script>`,
		steps: [
			{
				title: "Create your llmchat project",
				body: "Sign up, create a project, and grab your public key. Decide up front whether you're fully replacing Intercom or just the support widget — that determines what else you need to keep.",
			},
			{
				title: "Move your help content over",
				body: "Copy your Intercom Articles / help-center content into your llmchat knowledge base. Start with the highest-traffic topics so the bot is useful on day one, then expand.",
			},
			{
				title: "Swap the messenger embed",
				body: "Remove the Intercom messenger loader and add the llmchat script tag. The widget loads in a shadow DOM and inherits your brand color, so it fits your site without extra CSS work.",
				code: llmchatEmbed,
				codeLabel: "Add the llmchat widget",
			},
			...commonTail,
		],
		mapping: [
			{ from: "Messenger widget", to: "llmchat widget (shadow DOM)" },
			{ from: "Articles / help center", to: "Knowledge base / system prompt" },
			{ from: "Fin AI", to: "Any model via LLM Gateway" },
			{ from: "Intercom Inbox", to: "llmchat inbox" },
			{ from: "Per-seat pricing", to: "Usage-based — from $0" },
		],
		transfers: [
			"Help-center / Articles content (paste it in)",
			"Brand color and basic widget look",
			"Support conversation workflow (now in the llmchat inbox)",
		],
		doesntTransfer: [
			"CRM, contacts, and customer data",
			"Outbound campaigns, product tours, proactive messaging",
			"Conversation history and reporting",
		],
	},

	{
		slug: "chatwoot",
		name: "Chatwoot",
		tagline: "From a self-hosted Rails stack to serverless llmchat",
		estimatedTime: "~25 minutes",
		intro:
			"Both Chatwoot and llmchat can be self-hosted, but the stacks differ: Chatwoot is Ruby on Rails + PostgreSQL + Redis, while llmchat runs serverless on Cloudflare (D1, KV, workerd). Migrating means a widget swap plus a knowledge-base re-import — and, if you self-host, far less infrastructure to maintain afterward.",
		quickSummary:
			"Replace the Chatwoot SDK loader with the llmchat script tag and re-import your knowledge base. If you self-host, you can decommission the Rails/PostgreSQL stack once you're live on llmchat.",
		oldEmbedLabel: "Remove the Chatwoot SDK",
		oldEmbed: `<script>
  (function(d,t) {
    var BASE_URL = "https://app.chatwoot.com";
    var g = d.createElement(t),
        s = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + "/packs/js/sdk.js";
    g.defer = true; g.async = true;
    s.parentNode.insertBefore(g, s);
    g.onload = function() {
      window.chatwootSDK.run({
        websiteToken: "XXXXXXXX",
        baseUrl: BASE_URL,
      });
    };
  })(document, "script");
</script>`,
		steps: [
			{
				title: "Create your llmchat project",
				body: "Sign up for managed llmchat (or set up the self-hosted deployment on your Cloudflare account). Create a project and grab your public key.",
			},
			{
				title: "Re-import your knowledge base",
				body: "Copy your Chatwoot help-center / Captain AI content into your llmchat knowledge base. Chatwoot's articles export cleanly as text — paste the relevant parts into your system prompt.",
			},
			{
				title: "Swap the SDK loader",
				body: "Remove the Chatwoot websiteToken SDK loader and drop in the llmchat script tag. One line replaces the loader function. The widget loads in a shadow DOM, which Chatwoot's widget doesn't do.",
				code: llmchatEmbed,
				codeLabel: "Add the llmchat widget",
			},
			...commonTail,
		],
		mapping: [
			{ from: "websiteToken", to: "data-project (publicKey)" },
			{ from: "sdk.js loader function", to: "Single widget.js script tag" },
			{ from: "Captain AI (fixed stack)", to: "Any model via LLM Gateway" },
			{ from: "Rails + PostgreSQL + Redis", to: "Cloudflare D1 + KV + workerd", note: "No DB server to run." },
			{ from: "Chatwoot inbox", to: "llmchat inbox" },
		],
		transfers: [
			"Knowledge base / help-center content (paste it in)",
			"Self-hosting posture (now serverless, much lighter)",
			"Web chat support workflow",
		],
		doesntTransfer: [
			"WhatsApp, Instagram, Telegram, and email channels",
			"Full agent management: roles, teams, canned responses, labels, reports",
			"Conversation history (export from Chatwoot for your records)",
		],
	},

	{
		slug: "crisp",
		name: "Crisp",
		tagline: "From the all-in-one Crisp platform to a focused llmchat widget",
		estimatedTime: "~20 minutes",
		intro:
			"Crisp bundles chat, email, CRM, and a knowledge base. llmchat replaces the AI chat widget specifically. If you use Crisp's CRM or email marketing, keep those or find replacements — llmchat focuses on AI support with a model you control and optional self-hosting.",
		quickSummary:
			"Swap the Crisp loader for the llmchat script tag and re-enter your knowledge base. Route escalations to your team inbox and you're live.",
		oldEmbedLabel: "Remove the Crisp loader",
		oldEmbed: `<script type="text/javascript">
  window.$crisp = [];
  window.CRISP_WEBSITE_ID = "XXXXXXXX-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
  (function() {
    var d = document;
    var s = d.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = 1;
    d.getElementsByTagName("head")[0].appendChild(s);
  })();
</script>`,
		steps: [
			{
				title: "Create your llmchat project",
				body: "Sign up, create a project, and grab your public key. Set your brand color so the widget matches your site out of the box.",
			},
			{
				title: "Re-enter your knowledge base",
				body: "Copy your Crisp Helpdesk articles and any Hugo AI instructions into your llmchat knowledge base / system prompt. Start with the topics customers ask about most.",
			},
			{
				title: "Swap the loader script",
				body: "Remove the Crisp l.js loader and CRISP_WEBSITE_ID, then add the llmchat script tag. The widget loads in a shadow DOM so it won't pick up or leak page styles.",
				code: llmchatEmbed,
				codeLabel: "Add the llmchat widget",
			},
			...commonTail,
		],
		mapping: [
			{ from: "CRISP_WEBSITE_ID", to: "data-project (publicKey)" },
			{ from: "client.crisp.chat/l.js loader", to: "Single widget.js script tag" },
			{ from: "Hugo AI (fixed stack)", to: "Any model via LLM Gateway" },
			{ from: "Helpdesk articles", to: "Knowledge base / system prompt" },
			{ from: "Flat-rate plan", to: "Usage-based — from $0" },
		],
		transfers: [
			"Helpdesk / knowledge content (paste it in)",
			"Brand color and basic widget styling",
			"Web chat support workflow",
		],
		doesntTransfer: [
			"CRM, contacts, and customer profiles",
			"Email marketing, campaigns, and push notifications",
			"WhatsApp / Messenger / Instagram channels",
		],
	},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMigration(slug: string): MigrationGuide | undefined {
	return migrations.find((m) => m.slug === slug);
}
