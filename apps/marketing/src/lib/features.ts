// Single source of truth for the product's headline features. Powers both the
// home page grid (`/#features`) and the standalone `/features/[slug]` pages, so
// the marketing copy never drifts between the two. Copy follows the copywriting
// skill (benefit-led headlines, a problem hook, outcome-focused highlights) and
// every claim stays faithful to what the product actually does (see AGENTS.md).

import { RSC_PACKAGE } from "./site-urls";

export type Feature = {
	/** URL slug — `/features/<slug>`. */
	slug: string;
	/** Two-digit index used as the mono eyebrow + ghost numeral ("01"). */
	num: string;
	/** Short display name — nav, cards, eyebrow, page title. */
	name: string;
	/** One-line summary — the home grid copy. */
	tagline: string;
	/** Benefit-led page H1. */
	headline: string;
	/** Hero subtext on the feature page (1–2 sentences). */
	lead: string;
	/** One-sentence problem hook — the pain this feature removes. */
	problem: string;
	/** Intro paragraphs for the feature page. */
	body: string[];
	/** Three outcome-focused highlights rendered as a 3-up grid. */
	points: { heading: string; body: string }[];
	/** "What it means in practice" use-case bullets. */
	inPractice: string[];
	/** Query-shaped FAQs — render as a visible block + `FAQPage` schema. */
	faqs: { question: string; answer: string }[];
};

export const FEATURES: Feature[] = [
	{
		slug: "drop-in-widget",
		num: "01",
		name: "Drop-in widget",
		tagline:
			"One script tag. Loads in a shadow DOM so your styles never leak — and theirs never leak into you.",
		headline: "Add AI support in one line — without touching your CSS.",
		lead: "Drop a single script tag on any site and the widget mounts in an isolated shadow DOM. It never fights your styles, and your styles never bleed into it.",
		problem:
			"Most chat widgets fight your CSS, bloat the page, and need a developer to wire them in.",
		body: [
			"Most support widgets inject a tag soup of global styles and scripts that collide with your design system. Clanker Support takes the opposite approach: one script tag before the closing body, and everything renders inside a shadow DOM sealed off from the host page.",
			"It inherits your brand color out of the box and stays out of the way everywhere else — no layout shifts, no leaked fonts, no specificity wars.",
		],
		points: [
			{
				heading: "Install in one line",
				body: `Drop a single script tag on any page or framework — no build step, nothing to wire up. Prefer a package? The official ${RSC_PACKAGE} npm SDK covers React 19 and Next.js.`,
			},
			{
				heading: "Never breaks your design",
				body: "Styles are encapsulated in both directions — the widget can't break your site, and your site can't break the widget.",
			},
			{
				heading: "Stays fast",
				body: "The widget bundle stays small and isn't weighed down with client-side analytics, so it won't drag your page speed.",
			},
		],
		inPractice: [
			"Paste the snippet once; it behaves the same on Webflow, Shopify, Next.js, or plain HTML — and WordPress sites can skip it entirely with the official plugin.",
			"Set your brand color in the dashboard and the widget matches automatically.",
			"Nothing to maintain — the widget updates server-side without you touching the tag.",
		],
		faqs: [
			{
				question: "How do I add the Clanker Support widget to my site?",
				answer: `Paste one script tag before the closing </body> tag. It works the same on Webflow, Shopify, Next.js, or plain HTML — no build step and nothing to wire up. WordPress sites can install the official plugin from the WordPress.org directory instead, and React 19 / Next.js teams can use the official npm package, ${RSC_PACKAGE}. Most teams are live in about five minutes.`,
			},
			{
				question: "Will the widget conflict with my site's styles?",
				answer:
					"No. The widget mounts in an isolated shadow DOM, so its styles can't leak into your page and your styles can't leak into it. It inherits your brand color automatically and otherwise stays out of the way — no layout shifts or specificity wars.",
			},
			{
				question: "Does the widget slow down my page?",
				answer:
					"It's built to stay light. The bundle is small and isn't weighed down with client-side analytics, so it won't drag your page speed. The widget also updates server-side, so you never have to ship a new tag to stay current.",
			},
		],
	},
	{
		slug: "answers-from-your-docs",
		num: "02",
		name: "Answers from your docs",
		tagline:
			"Paste your knowledge base or system prompt. The bot stays on-topic and admits when it doesn't know.",
		headline: "Turn your docs into accurate, on-brand answers.",
		lead: "Paste your knowledge base or a system prompt and the bot answers from it — staying on topic, and saying so when it doesn't know.",
		problem:
			"Generic chatbots guess, ramble, and confidently invent answers — then your team cleans up the mess.",
		body: [
			"Your documentation already holds the answers to most support questions. Clanker Support grounds every reply in the knowledge you give it, so customers get accurate, on-brand answers instead of generic AI filler.",
			"Just as important: it admits the limits of what it knows. Rather than inventing a confident wrong answer, it defers — and hands off to a human when it should.",
		],
		points: [
			{
				heading: "Grounded in your content",
				body: "Paste a knowledge base or write a system prompt. The bot answers from that source of truth, not the open internet.",
			},
			{
				heading: "Stays on topic",
				body: "It sticks to what you've told it about your product and politely declines to wander into unrelated territory.",
			},
			{
				heading: "Knows when to stop",
				body: "When the docs don't cover a question, it says so and escalates — no confident hallucinations.",
			},
		],
		inPractice: [
			"Update your knowledge base in the dashboard and answers change immediately — no retraining.",
			"Tune tone and boundaries with a plain-language system prompt, per project.",
			"Pair it with the escalation threshold so uncertain answers become human hand-offs.",
		],
		faqs: [
			{
				question: "How does the bot know about my product?",
				answer:
					"You give it the knowledge. Paste your knowledge base or write a system prompt in project settings, and the bot answers from that source of truth — not the open internet. Update the content in the dashboard and answers change immediately, with no retraining.",
			},
			{
				question: "What happens when the bot doesn't know an answer?",
				answer:
					"It admits the limit instead of inventing one. When your docs don't cover a question, the bot says so and escalates to a human rather than producing a confident wrong answer — so customers aren't misled and your team isn't cleaning up after it.",
			},
			{
				question: "Can I control the bot's tone and boundaries?",
				answer:
					"Yes. A plain-language system prompt sets the bot's tone and what it should and shouldn't talk about, per project. It keeps replies on-brand and on-topic, and politely declines to wander into unrelated territory.",
			},
		],
	},
	{
		slug: "escalates-to-humans",
		num: "03",
		name: "Escalates to humans",
		tagline:
			"When the bot can't help, the conversation lands in your inbox with full context — no lost threads.",
		headline: "When the bot can't help, a human picks up — with full context.",
		lead: "The moment a conversation needs a person, the whole thread lands in your team inbox — so no customer is left talking to a wall.",
		problem:
			"A bot that can't escalate just traps customers in a loop with no way out.",
		body: [
			"AI support is only as good as its exit hatch. Clanker Support is built around the hand-off: the moment a conversation needs a person, it routes the whole thread — every message, not a summary — into a shared inbox.",
			"You set how eager it is to escalate with a per-project threshold, so the bot handles the routine questions and your team gets the ones that matter.",
		],
		points: [
			{
				heading: "Full context, every time",
				body: "The complete conversation moves to your inbox — your team picks up mid-thread without asking the customer to repeat themselves.",
			},
			{
				heading: "A threshold you control",
				body: "Dial how readily the bot hands off, per project, so escalations match your team's capacity and risk tolerance.",
			},
			{
				heading: "No lost threads",
				body: "Every hand-off is captured and tracked — nothing falls into a black hole between bot and human.",
			},
		],
		inPractice: [
			"Escalated conversations land in a single team inbox, not scattered across tools.",
			"Reply from the inbox and the customer gets it by email (see Email threading).",
			"Adjust the escalation threshold any time as you learn what the bot should handle.",
		],
		faqs: [
			{
				question: "When does Clanker Support escalate to a human?",
				answer:
					"When a conversation needs a person. You set a per-project threshold for how readily the bot hands off, so it handles the routine questions and routes the ones that matter to your team — matching escalations to your capacity and risk tolerance.",
			},
			{
				question: "Does my team see the full conversation when it's escalated?",
				answer:
					"Yes. The complete thread moves to your inbox — every message, not a summary — so your team can pick up mid-conversation without asking the customer to repeat themselves. Every hand-off is captured and tracked, so nothing falls into a black hole.",
			},
			{
				question: "Where do escalated conversations go?",
				answer:
					"Into a single shared team inbox rather than scattered across tools. Your team replies from there, and the customer gets that reply by email through email threading — keeping one conversation intact from first chat to resolution.",
			},
		],
	},
	{
		slug: "email-threading",
		num: "04",
		name: "Email threading",
		tagline:
			"Replies go out as email and customer responses thread back into the same conversation automatically.",
		headline: "One conversation, from first chat to final email.",
		lead: "Team replies leave as normal email, and customer responses thread back into the same conversation — automatically.",
		problem:
			"Hand a customer off to email and the thread usually splinters into disconnected tickets.",
		body: [
			"Support doesn't end when the customer closes the chat widget. With email threading, a team reply leaves your inbox as a normal email, and when the customer responds it lands back in the very same conversation — no new ticket, no broken context.",
			"It works through a per-conversation reply address, so threading is automatic and invisible to the customer.",
		],
		points: [
			{
				heading: "Reply by email",
				body: "Answer escalated conversations and the customer receives a normal email — no need to sit in a chat window waiting.",
			},
			{
				heading: "Responses thread back",
				body: "Customer replies route straight back into the original conversation instead of starting a fresh, contextless thread.",
			},
			{
				heading: "No ticket juggling",
				body: "No manual matching, no duplicate threads — the conversation stays whole from first message to resolution.",
			},
		],
		inPractice: [
			"Works hand-in-hand with escalation: hand off in-app, continue over email.",
			"Customers reply from their own inbox; your team works from yours.",
			"Each conversation gets its own reply address, so threading just works.",
		],
		faqs: [
			{
				question: "How does email threading work?",
				answer:
					"A team reply leaves your inbox as a normal email. When the customer responds, it routes straight back into the original conversation through a per-conversation reply address — no new ticket and no broken context. The threading is automatic and invisible to the customer.",
			},
			{
				question: "Do customers have to stay in the chat widget?",
				answer:
					"No. After a hand-off, customers reply from their own email inbox and your team works from yours. The conversation continues over email while staying linked to the original chat — so nobody has to sit in a chat window waiting.",
			},
			{
				question: "Will replies create duplicate tickets?",
				answer:
					"No. There's no manual matching and no duplicate threads. Each conversation keeps its own reply address, so customer responses always land back in the same thread — the conversation stays whole from the first message to resolution.",
			},
		],
	},
	{
		slug: "any-model-any-time",
		num: "05",
		name: "Any model, any time",
		tagline:
			"Built on LLM Gateway. Swap GPT, Claude, or a custom model per project — a config change, not a rewrite.",
		headline: "Run any model. Switch the moment a better one ships.",
		lead: "Built on LLM Gateway, the model behind your bot is a setting — pick one per project and change it whenever you like.",
		problem:
			"Hard-wire one model and you're stuck with it — every upgrade becomes a migration.",
		body: [
			"You shouldn't have to re-architect your support stack every time a better model ships. Clanker Support runs on LLM Gateway, so the model behind your bot is a setting you control, not a dependency baked into your code.",
			"Use a frontier model for complex products, a cheaper one for simple FAQs, or bring your own — without touching a line of integration code.",
		],
		points: [
			{
				heading: "Model-agnostic",
				body: "GPT, Claude, or a custom model — they're interchangeable behind the same support experience.",
			},
			{
				heading: "Per-project choice",
				body: "Different bots can run different models, so each project gets the right cost-to-quality trade-off.",
			},
			{
				heading: "Swap without a rewrite",
				body: "Changing models is a config update in the dashboard — no redeploy, no code change, no migration.",
			},
		],
		inPractice: [
			"Start on one model and upgrade the moment a better one lands.",
			"Match model cost to each project's complexity.",
			"Avoid lock-in — your support layer outlives any single provider.",
		],
		faqs: [
			{
				question: "Which AI models can I use with Clanker Support?",
				answer:
					"Any model available through LLM Gateway — GPT, Claude, or a custom model. The model behind your bot is a setting you control, not a dependency baked into your code, so you're never tied to one provider's roadmap.",
			},
			{
				question: "How do I switch models?",
				answer:
					"Change a setting in the dashboard. Swapping models is a config update — no redeploy, no code change, and no migration. You can upgrade to a better model the moment it ships instead of re-architecting your support stack.",
			},
			{
				question: "Can different projects run different models?",
				answer:
					"Yes. Each project picks its own model, so you can run a frontier model for a complex product and a cheaper one for simple FAQs — giving every project the right cost-to-quality trade-off.",
			},
		],
	},
	{
		slug: "self-hostable",
		num: "06",
		name: "Self-hostable",
		tagline:
			"Open architecture on serverless edge infra. Run the whole stack on your own account. No surprise vendors.",
		headline: "Your support stack, on infrastructure you own.",
		lead: "Open architecture on serverless edge infrastructure means you can run the whole stack on your own account — no surprise vendors.",
		problem:
			"Most support tools are black boxes you rent, with data and pricing you don't control.",
		body: [
			"Clanker Support is built to run on serverless edge infrastructure you can own. The architecture is open, so instead of renting a black box you can deploy the whole stack on your own account and keep your data and your bill under your control.",
			"No surprise middlemen, no opaque per-seat pricing — just components you can see, running where you choose.",
		],
		points: [
			{
				heading: "Own the stack",
				body: "Deploy the full system on your own infrastructure account rather than depending on a single hosted vendor.",
			},
			{
				heading: "Serverless edge",
				body: "Runs on edge infrastructure that scales down to zero and up automatically — no servers to babysit.",
			},
			{
				heading: "No surprise vendors",
				body: "Open architecture means no hidden dependencies and no lock-in you only discover at renewal.",
			},
		],
		inPractice: [
			"Keep customer conversations on infrastructure you control.",
			"Scale with usage on serverless edge — pay for what you use.",
			"Audit and extend the stack, because the architecture is open.",
		],
		faqs: [
			{
				question: "Can I self-host Clanker Support?",
				answer:
					"Yes. The architecture is open and runs on serverless edge infrastructure, so instead of renting a black box you can deploy the whole stack on your own account. You bring your own keys and a database, and get the full feature set.",
			},
			{
				question: "Where does my data live when I self-host?",
				answer:
					"On infrastructure you own. Customer conversations stay in your own database, on your own account, rather than in a vendor's cloud — which is what makes Clanker Support a fit for teams with data-residency requirements.",
			},
			{
				question: "Is there any vendor lock-in?",
				answer:
					"No. The open architecture means no hidden dependencies and no surprise vendors you only discover at renewal. You can audit and extend the stack, run it where you choose, and keep both your data and your bill under your control.",
			},
		],
	},
];

/** Look up a feature by slug. */
export function getFeature(slug: string): Feature | undefined {
	return FEATURES.find((f) => f.slug === slug);
}
