// ─── Types ───────────────────────────────────────────────────────────────────

export type Rating = "yes" | "no" | "partial" | string;

export type CompetitorKey =
	| "chatbase"
	| "fin"
	| "intercom"
	| "chatwoot"
	| "crisp";

export type ColKey = "llmchat" | CompetitorKey;

// Used by the /compare hub page (generic ✓/—/~ values)
export type FeatureRow = {
	label: string;
	note?: string;
} & Record<ColKey, Rating>;

export type FeatureGroup = {
	heading: string;
	rows: FeatureRow[];
};

// Used by individual /vs/[slug] pages (specific descriptive values)
export type VsRow = {
	label: string;
	llmchat: string;
	competitor: string;
};

export type VsCategory = {
	heading: string;
	rows: VsRow[];
};

export type TableSummary = {
	llmchat: string;
	competitor: string;
};

export type KeyDifference = {
	heading: string;
	llmchat: string;
	competitor: string;
	bottomLine: string;
};

export type Competitor = {
	id: CompetitorKey;
	name: string;
	url: string;
	tagline: string;
	// /compare hub page
	description: string;
	bestFor: string;
	notFor: string;
	pricing: string;
	// /vs/[slug] page — hero
	heroSubtext: string;
	heroBadges: string[];
	tableSummary: TableSummary;
	// /vs/[slug] page — table
	vsCategories: VsCategory[];
	// /vs/[slug] page — narrative
	tldr: string;
	llmchatWins: string[];
	competitorWins: string[];
	llmchatBestFor: string[];
	competitorBestFor: string[];
	keyDifferences: KeyDifference[];
	migrationNote: string;
};

// ─── Hub page data ────────────────────────────────────────────────────────────

export const colOrder: ColKey[] = [
	"llmchat",
	"chatbase",
	"fin",
	"intercom",
	"chatwoot",
	"crisp",
];

export const colLabels: Record<ColKey, string> = {
	llmchat: "llmchat",
	chatbase: "Chatbase",
	fin: "Fin",
	intercom: "Intercom",
	chatwoot: "Chatwoot",
	crisp: "Crisp",
};

export const featureGroups: FeatureGroup[] = [
	{
		heading: "Setup & integration",
		rows: [
			{
				label: "Setup method",
				llmchat: "One script tag",
				chatbase: "Embed code / SDK",
				fin: "Via Intercom platform",
				intercom: "Platform setup",
				chatwoot: "Platform setup",
				crisp: "Platform setup",
			},
			{
				label: "Shadow DOM (no style bleed)",
				llmchat: "yes",
				chatbase: "no",
				fin: "no",
				intercom: "no",
				chatwoot: "no",
				crisp: "no",
				note: "llmchat loads in a shadow DOM so your page styles never affect the widget and vice versa.",
			},
			{
				label: "Self-hostable",
				llmchat: "yes",
				chatbase: "no",
				fin: "no",
				intercom: "no",
				chatwoot: "yes",
				crisp: "no",
			},
			{
				label: "Open architecture",
				llmchat: "yes",
				chatbase: "no",
				fin: "no",
				intercom: "no",
				chatwoot: "yes",
				crisp: "no",
			},
		],
	},
	{
		heading: "AI capabilities",
		rows: [
			{
				label: "Train on your docs / knowledge base",
				llmchat: "yes",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
			},
			{
				label: "Model-agnostic (swap LLMs)",
				llmchat: "yes",
				chatbase: "no",
				fin: "no",
				intercom: "no",
				chatwoot: "no",
				crisp: "no",
				note: "llmchat is built on LLM Gateway — change the underlying model per project without any code changes.",
			},
			{
				label: "Custom system prompt",
				llmchat: "yes",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
			},
		],
	},
	{
		heading: "Escalation & inbox",
		rows: [
			{
				label: "Smart escalation to humans",
				llmchat: "yes",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
			},
			{
				label: "Unified team inbox",
				llmchat: "yes",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
			},
			{
				label: "Email replies thread back into widget",
				llmchat: "yes",
				chatbase: "no",
				fin: "partial",
				intercom: "partial",
				chatwoot: "partial",
				crisp: "partial",
				note: "llmchat threads inbound email replies directly back into the widget conversation.",
			},
			{
				label: "Configurable escalation threshold",
				llmchat: "yes",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "partial",
				crisp: "partial",
			},
		],
	},
	{
		heading: "Channels",
		rows: [
			{
				label: "Web chat widget",
				llmchat: "yes",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
			},
			{
				label: "Email channel",
				llmchat: "partial",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
				note: "llmchat handles email for escalation threading, not yet as a standalone inbox channel.",
			},
			{
				label: "WhatsApp / social media",
				llmchat: "no",
				chatbase: "yes",
				fin: "yes",
				intercom: "yes",
				chatwoot: "yes",
				crisp: "yes",
			},
			{
				label: "Voice",
				llmchat: "no",
				chatbase: "no",
				fin: "yes",
				intercom: "no",
				chatwoot: "no",
				crisp: "no",
			},
		],
	},
	{
		heading: "Pricing & transparency",
		rows: [
			{
				label: "Free tier",
				llmchat: "yes",
				chatbase: "partial",
				fin: "no",
				intercom: "no",
				chatwoot: "yes",
				crisp: "no",
				note: "Chatwoot's free tier is self-hosted only.",
			},
			{
				label: "Pricing model",
				llmchat: "Usage-based",
				chatbase: "Seat + usage",
				fin: "$0.99/outcome",
				intercom: "Per seat",
				chatwoot: "Per seat",
				crisp: "Flat rate",
			},
			{
				label: "Publicly listed pricing",
				llmchat: "yes",
				chatbase: "no",
				fin: "yes",
				intercom: "no",
				chatwoot: "yes",
				crisp: "yes",
			},
		],
	},
];

// ─── Competitor profiles ──────────────────────────────────────────────────────

export const competitors: Competitor[] = [
	{
		id: "chatbase",
		name: "Chatbase",
		url: "https://chatbase.co",
		tagline: "AI agents for customer experiences",
		description:
			"Full platform for building and deploying AI support agents across web, WhatsApp, Slack, and Messenger. Enterprise-focused with SOC 2 compliance and 10,000+ business customers.",
		bestFor:
			"Teams that need multi-channel AI support and have enterprise security requirements.",
		notFor:
			"Teams wanting a simple drop-in widget or the ability to swap LLMs.",
		pricing: "Paid plans — pricing not publicly listed",

		heroSubtext:
			"llmchat is a single script tag that goes live in minutes — no platform onboarding, no SDK. Unlike Chatbase, you choose your AI model and can self-host on your own infrastructure.",
		heroBadges: ["One script tag", "Model-agnostic", "Self-hostable", "Free tier"],
		tableSummary: {
			llmchat: "Open & self-hostable — from $0",
			competitor: "Managed SaaS — pricing not public",
		},
		vsCategories: [
			{
				heading: "Setup & integration",
				rows: [
					{
						label: "Embed method",
						llmchat: "One <script> tag",
						competitor: "SDK integration + platform onboarding",
					},
					{
						label: "Style isolation",
						llmchat: "Shadow DOM — widget styles fully isolated",
						competitor: "Standard embed — styles may conflict",
					},
					{
						label: "Time to first live chat",
						llmchat: "Under 5 minutes",
						competitor: "30+ minutes",
					},
					{
						label: "Data location",
						llmchat: "Your Cloudflare account",
						competitor: "Chatbase SaaS infrastructure",
					},
				],
			},
			{
				heading: "AI & knowledge",
				rows: [
					{
						label: "AI model",
						llmchat: "Any model via LLM Gateway",
						competitor: "Chatbase managed AI stack",
					},
					{
						label: "Swap models",
						llmchat: "Per-project config change — no code",
						competitor: "Locked to Chatbase's models",
					},
					{
						label: "Knowledge base",
						llmchat: "Paste text into project settings",
						competitor: "Upload via platform UI",
					},
				],
			},
			{
				heading: "Channels",
				rows: [
					{
						label: "Web chat widget",
						llmchat: "Yes",
						competitor: "Yes",
					},
					{
						label: "Email reply threading",
						llmchat: "Replies thread back into widget",
						competitor: "Not available",
					},
					{
						label: "WhatsApp / Slack / Messenger",
						llmchat: "Not yet",
						competitor: "All three included",
					},
				],
			},
			{
				heading: "Pricing & hosting",
				rows: [
					{
						label: "Free tier",
						llmchat: "Yes — usage-based",
						competitor: "Limited trial",
					},
					{
						label: "Pricing model",
						llmchat: "Pay for LLM usage only",
						competitor: "Seat + usage (not publicly listed)",
					},
					{
						label: "Self-hostable",
						llmchat: "Yes — Cloudflare D1, KV, workerd",
						competitor: "SaaS only",
					},
					{
						label: "Security",
						llmchat: "Open architecture — fully auditable",
						competitor: "SOC 2 Type II certified",
					},
				],
			},
		],

		tldr:
			"llmchat is a single script tag that goes live in minutes and lets you swap underlying AI models without touching your code. Chatbase is a full platform with stronger multi-channel support. Choose llmchat if you want simplicity and model flexibility. Choose Chatbase if you need WhatsApp, Slack, or Messenger support today.",
		llmchatWins: [
			"One script tag setup — live in under 5 minutes",
			"Shadow DOM isolation — widget styles never bleed into your page",
			"Model-agnostic — swap GPT-4o, Claude, or a custom model per project",
			"Self-hostable on your own Cloudflare infrastructure",
			"Open architecture — no black-box AI stack",
			"Free tier with usage-based pricing",
		],
		competitorWins: [
			"Multi-channel: web, WhatsApp, Slack, and Messenger",
			"Enterprise-grade security — SOC 2 Type II certified",
			"More integrations and a larger customer ecosystem",
			"Workflow automation (update subscriptions, change addresses, etc.)",
			"Established track record with 10,000+ businesses",
		],
		llmchatBestFor: [
			"Developer teams who want a drop-in widget, not a platform to configure",
			"Teams with data residency or self-hosting requirements",
			"Teams who want model flexibility across different projects",
			"Early-stage products that want support live fast",
			"Teams who want transparent, usage-based pricing",
		],
		competitorBestFor: [
			"Teams whose customers need support across WhatsApp, Slack, or Messenger",
			"Organizations with enterprise security requirements (SOC 2, GDPR)",
			"Teams that want AI workflow automation (update records, take actions)",
			"Companies that want a proven platform with a large existing customer base",
		],
		keyDifferences: [
			{
				heading: "Setup and integration",
				llmchat:
					"A single script tag. The widget loads in a shadow DOM so your styles and the widget's styles never interfere with each other. Most teams are live in under 5 minutes with no engineering review required.",
				competitor:
					"A platform you onboard into — create an account, configure agents, integrate the SDK. This gives you access to a full feature set including multi-channel deployment, but the upfront setup is more involved.",
				bottomLine:
					"Choose llmchat if fast setup on your website is the priority. Choose Chatbase if you need multi-channel from the start and are willing to invest in platform onboarding.",
			},
			{
				heading: "Multi-channel support",
				llmchat:
					"Web chat only today. The widget embeds on your site and handles text conversations. There's no WhatsApp, Slack, or Messenger channel support yet.",
				competitor:
					"Supports web chat, WhatsApp, Slack, email, and Messenger out of the box. If your customers need support across multiple channels, Chatbase has a clear advantage today.",
				bottomLine:
					"This is the most significant difference. If multi-channel is a current requirement, Chatbase is the better fit. If web-only support covers your use case, llmchat is simpler.",
			},
			{
				heading: "Model flexibility",
				llmchat:
					"Built on LLM Gateway — you choose the AI model per project and switch it with a config change, not a code change. Run a smaller, cheaper model for routine questions and a more capable one for complex queries.",
				competitor:
					"Runs on their own managed AI stack. You're on their models, with their updates, at their pace. The upside is they handle model optimization; the downside is you can't route to a specific provider.",
				bottomLine:
					"Choose llmchat if you care about model choice, cost optimization across tiers, or vendor diversity. Choose Chatbase if you'd rather not think about the model layer.",
			},
			{
				heading: "Ownership and self-hosting",
				llmchat:
					"Fully self-hostable on Cloudflare infrastructure — D1, KV, and workerd. Your conversations live in your database, on your account. The architecture is open and auditable.",
				competitor:
					"SaaS-only. Your data lives in Chatbase's infrastructure. They are SOC 2 certified and GDPR compliant, which satisfies most compliance requirements — but you can't run it on your own infrastructure.",
				bottomLine:
					"Choose llmchat if data residency or infrastructure ownership is a requirement. Choose Chatbase if managed SaaS with compliance certifications is sufficient.",
			},
		],
		migrationNote:
			"Switching from Chatbase to llmchat primarily involves re-pasting your knowledge base content into your llmchat project and replacing the Chatbase embed code with the llmchat script tag. Conversation history stored in Chatbase can be exported but won't automatically transfer to llmchat's inbox. For teams on multiple channels, note that llmchat is web-only — you'd need a separate solution for WhatsApp or Slack.",
	},

	{
		id: "fin",
		name: "Fin",
		url: "https://fin.ai",
		tagline: "The #1 AI agent for customer service",
		description:
			"Intercom's standalone AI agent with outcome-based pricing, proprietary ML models, and voice support. Deep integrations with Zendesk, Salesforce, and HubSpot.",
		bestFor:
			"Enterprise teams who want outcome-based pricing and already use Zendesk or Salesforce.",
		notFor: "Small teams or those wanting predictable flat-rate pricing.",
		pricing: "$0.99 per resolved outcome (50/month minimum)",

		heroSubtext:
			"Fin charges $0.99 per resolved outcome with a 50-outcome monthly minimum — there's a floor even when things are quiet. llmchat uses LLM usage-based pricing with no minimums and a free tier.",
		heroBadges: ["No per-outcome fees", "Model-agnostic", "Self-hostable", "Free tier"],
		tableSummary: {
			llmchat: "Usage-based — from $0, no minimums",
			competitor: "$0.99/outcome — 50/mo minimum ($49.50 floor)",
		},
		vsCategories: [
			{
				heading: "Pricing",
				rows: [
					{
						label: "Pricing model",
						llmchat: "LLM usage-based — pay for tokens consumed",
						competitor: "$0.99 per resolved outcome",
					},
					{
						label: "Monthly minimum",
						llmchat: "None",
						competitor: "50 outcomes ($49.50/mo floor)",
					},
					{
						label: "Free tier",
						llmchat: "Yes",
						competitor: "14-day trial only",
					},
					{
						label: "Where it runs",
						llmchat: "Standalone widget on your site",
						competitor: "Via Intercom platform",
					},
				],
			},
			{
				heading: "AI & model",
				rows: [
					{
						label: "AI stack",
						llmchat: "Any LLM via LLM Gateway",
						competitor: "Fin AI Engine™ (proprietary models)",
					},
					{
						label: "Model flexibility",
						llmchat: "Swap per project, any provider",
						competitor: "Locked to Fin's engine",
					},
					{
						label: "Voice support",
						llmchat: "Not yet",
						competitor: "Yes — included",
					},
				],
			},
			{
				heading: "Integrations & actions",
				rows: [
					{
						label: "Zendesk / Salesforce / HubSpot",
						llmchat: "Not yet",
						competitor: "Deep native integration",
					},
					{
						label: "Actions in external systems",
						llmchat: "No",
						competitor: "Yes — update records, look up orders",
					},
					{
						label: "Channels beyond web chat",
						llmchat: "Not yet",
						competitor: "Chat, email, voice, social",
					},
				],
			},
			{
				heading: "Infrastructure",
				rows: [
					{
						label: "Self-hosting",
						llmchat: "Cloudflare D1, KV, workerd",
						competitor: "SaaS only",
					},
					{
						label: "Data ownership",
						llmchat: "Your infrastructure",
						competitor: "Intercom infrastructure",
					},
					{
						label: "Compliance",
						llmchat: "Open architecture — fully auditable",
						competitor: "ISO, GDPR/CCPA certified",
					},
				],
			},
		],

		tldr:
			"Fin charges per resolved outcome and runs on proprietary AI models with deep enterprise integrations. llmchat uses usage-based pricing, is model-agnostic, and is self-hostable. Choose Fin if you have high resolution volume and need deep helpdesk integrations. Choose llmchat if you want predictable pricing and model flexibility.",
		llmchatWins: [
			"Predictable usage-based pricing — no per-outcome minimums",
			"Model-agnostic — not tied to any single AI vendor",
			"Self-hostable on your own infrastructure",
			"Free tier available",
			"Open architecture — auditable by design",
			"Simpler setup — one script tag vs. platform onboarding",
		],
		competitorWins: [
			"Outcome-based pricing scales well for high-volume resolution teams",
			"Proprietary AI Engine™ with specialized customer service models",
			"Voice channel support",
			"Deep integrations with Zendesk, Salesforce, Freshdesk, HubSpot",
			"Can take actions in external systems (update records, look up orders)",
			"Enterprise compliance — ISO, GDPR/CCPA certified",
		],
		llmchatBestFor: [
			"Teams wanting predictable pricing that scales with actual LLM usage",
			"Teams who want to choose and swap AI models without vendor lock-in",
			"Developer teams who want a lightweight, self-hostable setup",
			"Teams without existing Zendesk/Salesforce infrastructure",
			"Early-stage products that want support running before they scale",
		],
		competitorBestFor: [
			"Enterprise teams with high monthly resolution volume (100s–1000s of outcomes)",
			"Teams already running Zendesk, Salesforce, or HubSpot workflows",
			"Support operations that include voice or phone channels",
			"Teams who want AI that can take actions in external systems",
			"Organizations that need ISO/GDPR/CCPA compliance certifications",
		],
		keyDifferences: [
			{
				heading: "Pricing model and predictability",
				llmchat:
					"Usage-based pricing tied to LLM token consumption. Costs scale linearly with actual usage and there's a free tier with no minimums. You know what you're spending before the month ends.",
				competitor:
					"$0.99 per resolved outcome with a 50-outcome minimum per month. Powerful if your AI resolves thousands of tickets — you only pay when it works. But there's a floor even in quiet months, and costs can be harder to predict.",
				bottomLine:
					"Choose Fin if you have high, consistent resolution volume and want to pay per success. Choose llmchat if predictable flat costs or low-volume usage matters more.",
			},
			{
				heading: "AI model approach",
				llmchat:
					"Model-agnostic through LLM Gateway. You pick the model per project and change it with a config update — no code change required. As the model landscape evolves, you can adopt improvements immediately.",
				competitor:
					"Runs on the Fin AI Engine™ — proprietary models built for customer service benchmarks, plus specialized retrieval and reranking layers. Produces strong accuracy scores, but you're locked into their model roadmap.",
				bottomLine:
					"Choose Fin if you want purpose-built AI optimized specifically for support resolution benchmarks. Choose llmchat if model choice and the ability to switch vendors matters to your team.",
			},
			{
				heading: "Helpdesk integrations",
				llmchat:
					"No integrations with Zendesk, Salesforce, or HubSpot today. llmchat is a focused widget + inbox, not a layer on top of an existing helpdesk.",
				competitor:
					"Deep integrations with Zendesk, Salesforce, Freshdesk, and HubSpot. Fin can look up order status, update subscriptions, and take actions in those systems during a conversation.",
				bottomLine:
					"If your support workflows run through Zendesk or Salesforce, Fin's integrations are a genuine advantage that llmchat doesn't match today.",
			},
			{
				heading: "Voice and channel support",
				llmchat:
					"Web chat only. The widget embeds on your site, handles text conversations, and escalates to email when needed. No voice support.",
				competitor:
					"Supports voice channels in addition to chat, email, and text. If your support team handles phone calls, Fin is the only option in this comparison with voice AI.",
				bottomLine:
					"If your operation includes voice or phone support, Fin is the clear choice. If web chat with email escalation covers your use case, llmchat works.",
			},
		],
		migrationNote:
			"Fin runs inside Intercom or your existing helpdesk — switching to llmchat means adopting a separate widget and inbox rather than replacing just the AI layer. Your conversation history stays in your existing helpdesk. Re-configure your knowledge base in llmchat, replace the chat embed on your site, and you're live. Teams moving off outcome-based pricing typically find usage-based costs predictable by comparison once volume is consistent.",
	},

	{
		id: "intercom",
		name: "Intercom",
		url: "https://intercom.com",
		tagline: "AI-enhanced live chat software",
		description:
			"Full customer communication platform covering support, sales, and marketing. Includes the Fin AI agent and a unified omnichannel inbox. 25,000+ customers including Amazon and Microsoft.",
		bestFor:
			"Mid-market and enterprise teams wanting a single platform for support, sales, and marketing.",
		notFor:
			"Teams that only need a support widget — full platform pricing applies regardless.",
		pricing: "From ~$74/month, enterprise by quote",

		heroSubtext:
			"Intercom is a full customer communication platform — support, sales, and marketing. If you only need a support widget, you're paying for a lot you won't use, starting at $74/month. llmchat is purpose-built for support and starts free.",
		heroBadges: ["Support-only focus", "Model-agnostic", "Self-hostable", "Free tier"],
		tableSummary: {
			llmchat: "Support widget — from $0",
			competitor: "Full platform — from ~$74/month",
		},
		vsCategories: [
			{
				heading: "Product scope",
				rows: [
					{
						label: "What it is",
						llmchat: "Support widget + inbox",
						competitor: "Support + Sales + Marketing platform",
					},
					{
						label: "CRM",
						llmchat: "Not included",
						competitor: "Built-in CRM",
					},
					{
						label: "Outbound campaigns",
						llmchat: "Not included",
						competitor: "Yes — email + in-app messaging",
					},
					{
						label: "Product tours",
						llmchat: "Not included",
						competitor: "Yes",
					},
				],
			},
			{
				heading: "AI & model",
				rows: [
					{
						label: "AI model",
						llmchat: "Any LLM via LLM Gateway",
						competitor: "Fin AI (proprietary)",
					},
					{
						label: "Model flexibility",
						llmchat: "Per-project config, any provider",
						competitor: "Fixed to Intercom's AI stack",
					},
				],
			},
			{
				heading: "Pricing",
				rows: [
					{
						label: "Free tier",
						llmchat: "Yes",
						competitor: "Trial only",
					},
					{
						label: "Starting price",
						llmchat: "Free",
						competitor: "~$74/month",
					},
					{
						label: "Pricing model",
						llmchat: "LLM usage-based",
						competitor: "Per seat",
					},
				],
			},
			{
				heading: "Setup & infrastructure",
				rows: [
					{
						label: "Embed method",
						llmchat: "One <script> tag",
						competitor: "Full platform onboarding",
					},
					{
						label: "Self-hosting",
						llmchat: "Cloudflare D1, KV, workerd",
						competitor: "SaaS only",
					},
					{
						label: "Ecosystem maturity",
						llmchat: "Newer product",
						competitor: "25,000+ customers, large marketplace",
					},
				],
			},
		],

		tldr:
			"Intercom is a full customer communication platform — support, sales, and marketing in one. If you need all three, it's a powerful investment. If you only need a support widget, you're paying for a lot you won't use. llmchat is purpose-built for support and costs significantly less.",
		llmchatWins: [
			"Purpose-built for support — no unused platform surface",
			"Free tier, then usage-based pricing vs. Intercom's per-seat model",
			"Model-agnostic — swap underlying LLMs without code changes",
			"Self-hostable on your own infrastructure",
			"One script tag setup vs. full platform onboarding",
			"Open architecture — auditable with no black-box components",
		],
		competitorWins: [
			"Full platform: support, sales, and marketing in one product",
			"Fin AI agent with proprietary models, deeply integrated",
			"25,000+ customers and a large ecosystem of integrations",
			"Product tours, outbound campaigns, and proactive messaging",
			"Advanced reporting and analytics",
			"Enterprise features: SSO, audit logs, SLA management",
		],
		llmchatBestFor: [
			"Teams that need support only — not a full communication platform",
			"Developer-led teams who want minimal setup and infrastructure control",
			"Companies where the Intercom pricing floor is too high",
			"Teams who want model flexibility without vendor lock-in",
			"Products that want to move fast without a lengthy platform evaluation",
		],
		competitorBestFor: [
			"Teams wanting support, sales, and marketing communications in one platform",
			"Mid-market and enterprise companies with multiple customer-facing teams",
			"Teams needing product tours, proactive outbound messaging, or a full CRM",
			"Organizations that need enterprise features: SSO, audit logs, SLA tiers",
			"Companies where ecosystem depth and integrations are a priority",
		],
		keyDifferences: [
			{
				heading: "Scope: widget vs. platform",
				llmchat:
					"A focused support widget with an inbox, AI, escalation, and email threading. Nothing more. Every feature is in service of the support use case. Simpler to set up, simpler to reason about, and priced accordingly.",
				competitor:
					"A full customer communication platform: live chat, AI support, email campaigns, product tours, a built-in CRM, and outbound messaging. Powerful if you need all of it. The breadth means there's always more to configure.",
				bottomLine:
					"Choose Intercom if you're consolidating support, sales, and marketing into one tool. Choose llmchat if support is the only use case — you'll ship faster and spend less.",
			},
			{
				heading: "Pricing",
				llmchat:
					"Free tier available, then usage-based pricing. Costs scale with actual LLM consumption. A team with modest volume can run for well under $50/month. No seats to buy, no minimum commitments.",
				competitor:
					"Starts around $74/month and scales with seat count, usage, and add-ons. The per-seat model means costs grow with your team size. Enterprise plans require a sales conversation.",
				bottomLine:
					"The cost difference is most meaningful at smaller team sizes. At enterprise scale, the calculus changes — Intercom's platform breadth often justifies the investment when you're using more of it.",
			},
			{
				heading: "Model and infrastructure flexibility",
				llmchat:
					"Model-agnostic — choose any LLM per project and switch it with a config change. Self-hostable on Cloudflare infrastructure for teams with data residency requirements. Open architecture throughout.",
				competitor:
					"Runs on Intercom's proprietary Fin AI infrastructure. SaaS-only — no self-hosting option. Strong compliance posture (GDPR, SOC 2) for teams that need certifications but not infrastructure ownership.",
				bottomLine:
					"Choose llmchat if you want model flexibility or self-hosting. Choose Intercom if managed SaaS with compliance certifications is the right posture for your team.",
			},
			{
				heading: "Ecosystem and integrations",
				llmchat:
					"Newer product with a smaller integration footprint. Connects to LLM Gateway for models, Resend for email, and Stripe for billing. No native CRM or helpdesk integrations today.",
				competitor:
					"Extensive marketplace with hundreds of integrations. 25,000+ customers means a large body of shared knowledge, templates, and third-party tooling built specifically for Intercom.",
				bottomLine:
					"If ecosystem depth, community resources, and third-party integrations are a priority, Intercom has the clear advantage. llmchat is the better choice when you want something that works without needing a large ecosystem.",
			},
		],
		migrationNote:
			"Migrating from Intercom primarily means replacing the Intercom widget embed with the llmchat script tag, re-creating your knowledge base content in llmchat's project settings, and pointing your team to the llmchat inbox. Conversation history and customer data from Intercom can be exported but won't carry over automatically. Teams that depend on Intercom's CRM, campaigns, or product tours will need separate tools for those use cases — llmchat doesn't cover them.",
	},

	{
		id: "chatwoot",
		name: "Chatwoot",
		url: "https://chatwoot.com",
		tagline: "Open-source customer support platform",
		description:
			"Open-source, self-hostable support platform with an AI assistant, omnichannel inbox, and knowledge base. Y Combinator-backed with 25,000+ GitHub stars.",
		bestFor:
			"Teams wanting open-source ownership and multi-channel support who are comfortable running infrastructure.",
		notFor:
			"Teams wanting a minimal drop-in widget — Chatwoot is a full platform.",
		pricing: "Free self-hosted; cloud from ~$19/month",

		heroSubtext:
			"Both self-hostable — but different stacks. Chatwoot runs on Ruby on Rails with PostgreSQL and Redis. llmchat runs serverless on Cloudflare's edge: no database to provision, no app server to maintain.",
		heroBadges: ["Serverless self-hosting", "Model-agnostic", "Managed free cloud", "Shadow DOM widget"],
		tableSummary: {
			llmchat: "Serverless edge — from $0 managed cloud",
			competitor: "Rails + PostgreSQL — $0 self-hosted / ~$19/mo cloud",
		},
		vsCategories: [
			{
				heading: "Self-hosting",
				rows: [
					{
						label: "Self-hosting stack",
						llmchat: "Cloudflare serverless (D1, KV, workerd)",
						competitor: "Ruby on Rails + PostgreSQL + Redis",
					},
					{
						label: "Infrastructure to manage",
						llmchat: "None — fully serverless",
						competitor: "Database + cache + app servers",
					},
					{
						label: "Open source license",
						llmchat: "Open architecture",
						competitor: "MIT licensed — fork and contribute",
					},
				],
			},
			{
				heading: "AI & widget",
				rows: [
					{
						label: "AI model flexibility",
						llmchat: "Any LLM via LLM Gateway",
						competitor: "Fixed AI stack (Captain AI)",
					},
					{
						label: "Shadow DOM widget",
						llmchat: "Yes — no style bleed",
						competitor: "No",
					},
					{
						label: "Embed method",
						llmchat: "One <script> tag",
						competitor: "Platform setup",
					},
				],
			},
			{
				heading: "Channels",
				rows: [
					{
						label: "Web chat widget",
						llmchat: "Yes",
						competitor: "Yes",
					},
					{
						label: "WhatsApp / Telegram / Instagram",
						llmchat: "Not yet",
						competitor: "All included",
					},
					{
						label: "Email as standalone channel",
						llmchat: "Not yet",
						competitor: "Yes",
					},
				],
			},
			{
				heading: "Pricing",
				rows: [
					{
						label: "Managed cloud free tier",
						llmchat: "Yes",
						competitor: "Self-hosted only (free)",
					},
					{
						label: "Cloud starting price",
						llmchat: "Free",
						competitor: "~$19/month",
					},
					{
						label: "Pricing model",
						llmchat: "LLM usage-based",
						competitor: "Per seat / agent",
					},
				],
			},
		],

		tldr:
			"Both llmchat and Chatwoot are self-hostable. The difference is scope and stack: Chatwoot is a full multi-channel platform running on Rails + PostgreSQL; llmchat is a focused widget running serverless on Cloudflare's edge. Choose Chatwoot for open-source, multi-channel coverage. Choose llmchat for a lighter setup and model-agnostic AI.",
		llmchatWins: [
			"Lighter self-hosting — serverless on Cloudflare, no database to manage",
			"Model-agnostic AI — swap LLMs per project without code changes",
			"One script tag setup vs. full platform deployment",
			"Shadow DOM widget with no style bleed",
			"Free managed cloud tier with usage-based pricing",
		],
		competitorWins: [
			"Fully open-source (MIT license) — read, fork, and contribute",
			"Multi-channel: WhatsApp, Instagram, email, Telegram, and more",
			"25,000+ GitHub stars and active community",
			"Full agent management: roles, canned responses, labels, reports",
			"Knowledge base with AI-powered search",
			"Y Combinator-backed with longer track record",
		],
		llmchatBestFor: [
			"Teams who want a drop-in AI support widget without deploying a platform",
			"Teams who want managed cloud without maintaining infrastructure",
			"Teams who need model flexibility across different projects",
			"Developers who want edge-native, serverless architecture",
			"Products where a focused widget is enough",
		],
		competitorBestFor: [
			"Teams who specifically need open-source licensing (MIT)",
			"Teams requiring multi-channel support: WhatsApp, Instagram, Telegram",
			"Organizations that want full agent management and reporting",
			"Teams comfortable running and maintaining a Rails/PostgreSQL stack",
			"Companies who want to contribute to a large OSS codebase",
		],
		keyDifferences: [
			{
				heading: "Self-hosting: same goal, different stacks",
				llmchat:
					"Self-hosted on Cloudflare infrastructure — D1 for the database, KV for cache and rate limiting, workerd for compute. Serverless and edge-native. No database server to provision or maintain.",
				competitor:
					"Self-hosted on a Ruby on Rails application with PostgreSQL and Redis. A production-grade traditional web application stack. More operational surface to manage, but also more mature and battle-tested.",
				bottomLine:
					"Choose llmchat if you want self-hosting without managing a database server. Choose Chatwoot if you're comfortable with Rails/PostgreSQL and want the full platform that stack enables.",
			},
			{
				heading: "Scope: widget vs. full platform",
				llmchat:
					"A focused support widget with an inbox, AI, escalation, and email threading. Fast to set up, easy to reason about. No multi-channel inbox, no agent reporting, no knowledge base UI.",
				competitor:
					"A full customer support platform: multi-channel inbox, knowledge base with AI search, agent management with roles and teams, canned responses, reports, and conversation labels.",
				bottomLine:
					"Choose Chatwoot if you need WhatsApp, Instagram, or email as channels and want full agent management. Choose llmchat if a web widget with an inbox is all you need.",
			},
			{
				heading: "Open source licensing",
				llmchat:
					"Open architecture — the code is readable and the stack is transparent — but not MIT-licensed open source in the contribution sense. You can audit and fork the concepts, but it's not a community-governed project.",
				competitor:
					"Fully open-source under the MIT License. 25,000+ GitHub stars, active contributors, and a long history of community-driven development. If OSS community and contribution rights matter, Chatwoot is the clear choice.",
				bottomLine:
					"Choose Chatwoot if open-source licensing, community contributions, or forking rights are important. Choose llmchat if open architecture (readable, auditable) is sufficient.",
			},
			{
				heading: "AI model flexibility",
				llmchat:
					"Built on LLM Gateway — you pick the AI model per project and change it with a configuration update. Run a cost-efficient model for routine questions and a more capable one for complex queries.",
				competitor:
					"The Captain AI assistant runs on a fixed stack. You configure it with your knowledge base and FAQs, but you don't choose the underlying model.",
				bottomLine:
					"Choose llmchat if model choice or the ability to optimize cost vs. capability per project matters. Choose Chatwoot if you don't need that flexibility and want a larger-scope platform.",
			},
		],
		migrationNote:
			"Migrating from Chatwoot to llmchat is primarily a widget swap and knowledge base re-import. Replace the Chatwoot widget script with the llmchat script tag, copy your knowledge base content into llmchat's project settings, and update your escalation email address. Conversation history from Chatwoot can be exported but won't migrate automatically. Note that llmchat doesn't currently replace Chatwoot's multi-channel inbox — if you're using WhatsApp or Instagram, you'll need to handle those separately.",
	},

	{
		id: "crisp",
		name: "Crisp",
		url: "https://crisp.chat",
		tagline: "AI customer support for every business",
		description:
			"All-in-one platform with AI agents (Hugo), omnichannel inbox, knowledge base, and CRM. Made in Europe with flat pricing and 10,000+ customers.",
		bestFor:
			"Small to mid-sized teams wanting an all-in-one support + CRM platform with European data hosting.",
		notFor:
			"Teams wanting model flexibility or a lightweight website integration.",
		pricing: "From ~$25/month",

		heroSubtext:
			"Crisp is all-in-one: chat, email, CRM, knowledge base, and push notifications. llmchat is focused: support widget with model-agnostic AI. If you need CRM, use Crisp. If you want a drop-in widget with full model flexibility and self-hosting, use llmchat.",
		heroBadges: ["Model-agnostic", "Self-hostable", "Open architecture", "Free tier"],
		tableSummary: {
			llmchat: "Focused widget — from $0, any AI model",
			competitor: "All-in-one platform — from ~$25/month",
		},
		vsCategories: [
			{
				heading: "Product scope",
				rows: [
					{
						label: "What it is",
						llmchat: "Support widget + inbox",
						competitor: "Chat + Email + CRM + Knowledge base",
					},
					{
						label: "CRM",
						llmchat: "Not included",
						competitor: "Built-in",
					},
					{
						label: "Email marketing",
						llmchat: "Not included",
						competitor: "Yes",
					},
					{
						label: "No-code AI builder",
						llmchat: "No",
						competitor: "Yes — Hugo AI workflows",
					},
				],
			},
			{
				heading: "AI & model",
				rows: [
					{
						label: "AI model",
						llmchat: "Any LLM via LLM Gateway",
						competitor: "Hugo AI (Crisp's engine)",
					},
					{
						label: "Model flexibility",
						llmchat: "Per-project, any provider",
						competitor: "Fixed to Crisp's AI stack",
					},
				],
			},
			{
				heading: "Hosting & compliance",
				rows: [
					{
						label: "Self-hosting",
						llmchat: "Cloudflare D1, KV, workerd",
						competitor: "SaaS only",
					},
					{
						label: "Data region",
						llmchat: "Your choice (self-hosted)",
						competitor: "European hosting",
					},
					{
						label: "Open architecture",
						llmchat: "Yes — fully auditable",
						competitor: "No",
					},
				],
			},
			{
				heading: "Pricing",
				rows: [
					{
						label: "Free tier",
						llmchat: "Yes",
						competitor: "14-day trial only",
					},
					{
						label: "Pricing model",
						llmchat: "LLM usage-based",
						competitor: "Flat rate monthly",
					},
					{
						label: "Starting price",
						llmchat: "Free",
						competitor: "~$25/month",
					},
				],
			},
		],

		tldr:
			"Crisp is an all-in-one support + CRM platform with flat pricing and European hosting. llmchat is a focused drop-in widget with model-agnostic AI and self-hosting. Choose Crisp if you need CRM features, omnichannel, or EU data residency. Choose llmchat if you want the simplest possible setup and model flexibility.",
		llmchatWins: [
			"One script tag setup — no platform to configure",
			"Model-agnostic — swap AI models per project without code changes",
			"Self-hostable on your own Cloudflare infrastructure",
			"Shadow DOM widget with zero style interference",
			"Open architecture — fully auditable stack",
			"Free tier with usage-based pricing",
		],
		competitorWins: [
			"All-in-one: chat, email, CRM, knowledge base, and push notifications",
			"Omnichannel inbox: WhatsApp, Messenger, Instagram, email",
			"European hosting and infrastructure — strong GDPR posture",
			"Flat-rate pricing — easy to budget at high volume",
			"10,000+ customers including enterprise brands",
			"Hugo AI agent with no-code workflow builder",
		],
		llmchatBestFor: [
			"Teams who want a drop-in widget with AI, not a full platform",
			"Teams with model flexibility requirements — different LLMs per project",
			"Teams with self-hosting or data residency needs beyond EU",
			"Developer teams who want minimal setup and open architecture",
			"Products where support is the only use case and CRM isn't needed",
		],
		competitorBestFor: [
			"Small to mid-sized teams wanting support, CRM, and email in one place",
			"European businesses with strict GDPR or EU data residency requirements",
			"Teams who prefer flat-rate pricing for predictable budgeting",
			"Teams needing WhatsApp, Messenger, or Instagram support channels",
			"Non-technical teams who want a no-code AI workflow builder",
		],
		keyDifferences: [
			{
				heading: "All-in-one vs. focused widget",
				llmchat:
					"A focused support widget with inbox, AI, escalation, and email threading. The entire product is one use case: handle support conversations on your site, hand off to your team when needed.",
				competitor:
					"A complete customer platform: live chat, email inbox, CRM, knowledge base, product tours, push notifications, and omnichannel messaging. Genuinely all-in-one for customer communication.",
				bottomLine:
					"Choose Crisp if you're replacing multiple tools (support + CRM + email marketing) with one. Choose llmchat if support is the only use case and you want something to set up in minutes.",
			},
			{
				heading: "Pricing model",
				llmchat:
					"Usage-based — you pay for actual LLM token consumption. Costs scale down when things are quiet. Free tier available. Better for low-to-medium volume teams or those with variable traffic.",
				competitor:
					"Flat-rate monthly pricing starting around $25/month. Predictable and easy to budget. Better for high-volume teams where a fixed cost is lower than per-usage costs.",
				bottomLine:
					"Choose Crisp for flat-rate predictability at consistent volume. Choose llmchat for usage-based costs that scale down when things are quiet.",
			},
			{
				heading: "AI model flexibility",
				llmchat:
					"Built on LLM Gateway — model-agnostic by design. Choose GPT-4o, Claude, or a custom endpoint per project. Change the model with a config update, not a code change.",
				competitor:
					"Runs Hugo, their own AI agent product, on a fixed model stack. The AI is configured with your knowledge base, but the underlying model choice is theirs.",
				bottomLine:
					"Choose llmchat if picking the model provider or optimizing model cost per project matters. Choose Crisp if you'd rather not think about the model layer and want a no-code AI setup.",
			},
			{
				heading: "European hosting and compliance",
				llmchat:
					"Self-hosted deployment gives you full control over where data lives — any region you choose. The managed cloud version doesn't specifically guarantee European hosting today.",
				competitor:
					"Built and hosted in Europe. Strong default GDPR posture without extra configuration. If EU data residency is a requirement and you're on managed cloud, Crisp handles it natively.",
				bottomLine:
					"Choose Crisp if EU data residency is a requirement and you want it handled for you. Choose llmchat's self-hosted deployment if you need full control over data location.",
			},
		],
		migrationNote:
			"Switching from Crisp to llmchat means replacing the Crisp widget script tag with llmchat's, re-entering your knowledge base content in project settings, and routing your escalation notifications to your team. Crisp's CRM data (contacts, conversation history) can be exported but won't transfer to llmchat — llmchat doesn't have a CRM component. If you're using Crisp for email campaigns or product tours, those use cases aren't covered by llmchat.",
	},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getCompetitor(slug: string): Competitor | undefined {
	return competitors.find((c) => c.id === slug);
}
