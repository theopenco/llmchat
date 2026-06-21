// Single source of truth for the "Use cases" resource — example businesses that
// benefit from a docs-grounded support agent that escalates to humans. Powers
// the /use-cases hub and each /use-cases/[slug] page. Copy follows the
// copywriting skill (benefit-led headlines, a problem hook, concrete examples)
// and stays faithful to what the product actually does: it answers from the
// knowledge you give it and hands off to a person — it does not plug into order,
// CRM, or booking systems, so nothing here implies live lookups (see AGENTS.md).

export type UseCase = {
	/** URL slug — `/use-cases/<slug>`. */
	slug: string;
	/** Two-digit index used as the mono eyebrow + ghost numeral ("01"). */
	num: string;
	/** Short display name — nav, cards, eyebrow, page title. */
	name: string;
	/** One-line summary — the hub grid copy. */
	tagline: string;
	/** Benefit-led page H1. */
	headline: string;
	/** Hero subtext (1–2 sentences). */
	lead: string;
	/** One-sentence problem hook — the pain this industry feels. */
	problem: string;
	/** Intro paragraphs. */
	body: string[];
	/** "What it handles" — concrete questions/tasks, framed honestly. */
	handles: string[];
	/** Three outcome-focused ways it helps, rendered as a 3-up grid. */
	points: { heading: string; body: string }[];
	/** Query-shaped FAQs — visible block + `FAQPage` schema. */
	faqs: { question: string; answer: string }[];
};

export const USE_CASES: UseCase[] = [
	{
		slug: "ecommerce",
		num: "01",
		name: "E-commerce stores",
		tagline:
			"Answer shipping, returns, and sizing questions instantly — and hand the tricky orders to your team.",
		headline: "Answer the questions that flood every store's inbox.",
		lead: "Shoppers ask the same things before and after they buy. Clanker Support answers them from your policies and product info around the clock, and escalates real order problems to your team.",
		problem:
			"Most store support is the same handful of questions — shipping, returns, sizing — arriving at all hours and drowning your inbox.",
		body: [
			"Online shoppers don't wait. A question about delivery time or fit that goes unanswered is an abandoned cart, and the same questions pile up every single day.",
			"Drop Clanker Support on your storefront and it answers from your shipping, returns, and product information in seconds — then routes anything it can't resolve, like a damaged item or a refund dispute, straight to a human with the full conversation attached.",
		],
		handles: [
			"Shipping timelines, delivery options, and how to track an order",
			"Returns, exchanges, and refund policy",
			"Sizing, materials, and product details",
			"Payment, discount codes, and checkout help",
			"A specific late or wrong order → escalated to your team",
		],
		points: [
			{
				heading: "Recover carts",
				body: "Answers pre-purchase questions on the spot, so hesitation doesn't turn into an abandoned cart.",
			},
			{
				heading: "Cut repetitive tickets",
				body: "Deflects the shipping and returns questions that flood your inbox, leaving your team the real exceptions.",
			},
			{
				heading: "Always on",
				body: "Covers nights, weekends, and peak-sale traffic without adding headcount.",
			},
		],
		faqs: [
			{
				question: "Can it look up a customer's specific order status?",
				answer:
					"It answers from the policies and information you give it — like delivery timelines and how to track an order — rather than plugging into your store's order system. For a specific order problem, it escalates the conversation to your team with full context so a person can resolve it.",
			},
			{
				question: "How does it know my shipping and returns policies?",
				answer:
					"You give it the knowledge: paste your policies and product information, or point it at your help pages. It answers from that source of truth and stays on-topic, and you can update the content any time without retraining.",
			},
		],
	},
	{
		slug: "saas-startups",
		num: "02",
		name: "SaaS & startups",
		tagline:
			"Deflect setup, billing, and how-to tickets from your docs so a small team can focus on shipping.",
		headline: "Deflect support tickets so your small team can ship.",
		lead: "Early-stage teams can't staff a 24/7 support desk. Let the agent answer setup, billing, and how-to questions from your docs, and escalate the rest to the founders.",
		problem:
			"A growing user base means growing support — but hiring a support team isn't on the roadmap yet.",
		body: [
			"For a lean team, every support question is a context switch away from building. The questions are answerable — they're in your docs — they just shouldn't all land on a founder.",
			"Clanker Support answers onboarding, billing, and how-to questions from your documentation, and escalates the genuine bugs and edge cases to your team so nothing important slips.",
		],
		handles: [
			"Onboarding and account setup",
			"“How do I…” feature and configuration questions",
			"Billing, plans, and upgrade questions",
			"Integration and API basics",
			"Bug reports and edge cases → escalated to your team",
		],
		points: [
			{
				heading: "Fewer tickets",
				body: "Answers the repetitive how-to and billing questions from your docs before they reach a person.",
			},
			{
				heading: "Faster onboarding",
				body: "Gives new users self-serve answers in the moment, right where they're stuck.",
			},
			{
				heading: "Founder focus",
				body: "Escalates only what truly needs a human, so the team stays on the product.",
			},
		],
		faqs: [
			{
				question: "Will it make things up about my product?",
				answer:
					"No. It answers from the docs and system prompt you give it, and when a question isn't covered it says so and escalates to a human instead of inventing a confident wrong answer.",
			},
			{
				question: "Can it match our product's voice?",
				answer:
					"Yes. A plain-language system prompt sets the tone and boundaries per project, so replies stay on-brand and on-topic.",
			},
		],
	},
	{
		slug: "documentation",
		num: "03",
		name: "Documentation & dev tools",
		tagline:
			"Turn your docs into a conversational assistant that answers technical questions in context.",
		headline: "Make your docs answer back.",
		lead: "Great documentation still leaves users hunting for one answer. Clanker Support turns your docs into an assistant that answers technical questions directly.",
		problem:
			"Even great docs leave users Ctrl+F-ing through pages to find the one line they need.",
		body: [
			"Documentation is where the answers live, but reading is not the same as getting an answer. Developers want to ask a question and keep moving.",
			"Embed Clanker Support in your docs or app and it answers configuration, usage, and troubleshooting questions from your content — and admits when something isn't documented instead of guessing.",
		],
		handles: [
			"“How do I configure…” setup questions",
			"API, SDK, and code usage questions",
			"Error messages and troubleshooting",
			"Versioning and migration questions",
			"Anything not in the docs → flagged and escalated",
		],
		points: [
			{
				heading: "Answers in context",
				body: "Resolves questions straight from your docs, so users don't bounce between pages and search.",
			},
			{
				heading: "Fewer doc tickets",
				body: "Cuts the “where is this in the docs” questions that reach your team or community.",
			},
			{
				heading: "Honest by design",
				body: "When the docs don't cover something, it says so and hands off — no confident hallucinations.",
			},
		],
		faqs: [
			{
				question: "How do I keep answers current with my docs?",
				answer:
					"Update your knowledge base in the dashboard and answers change immediately — there's no retraining step. The agent always answers from the content you've given it.",
			},
			{
				question: "What happens with questions the docs don't cover?",
				answer:
					"It tells the user it isn't sure rather than guessing, and escalates to a human so a real answer (and a future doc update) can follow.",
			},
		],
	},
	{
		slug: "car-rental",
		num: "04",
		name: "Car rental & mobility",
		tagline:
			"Answer rental requirements, insurance, and policy questions — and route real bookings to staff.",
		headline: "Handle the policy questions before they reach the counter.",
		lead: "Renters ask the same things — age limits, insurance, fuel policy, what to bring. The agent answers instantly and escalates real booking changes to your staff.",
		problem:
			"Rental questions arrive at all hours, and an unanswered policy question is a booking lost to the agency down the road.",
		body: [
			"Before someone books a car, they want to know they qualify and what it'll cost — age requirements, insurance, deposits, fuel rules. After they book, they want to know what to bring.",
			"Clanker Support answers those questions from your rental terms instantly, day or night, and routes specific booking changes or disputes to your staff with the conversation intact.",
		],
		handles: [
			"Rental requirements — age, license, and deposit",
			"Insurance and coverage options",
			"Fuel, mileage, and return policy",
			"“What do I need to pick up my car?”",
			"Booking changes and cancellations → escalated to staff",
		],
		points: [
			{
				heading: "More completed bookings",
				body: "Answers the pre-booking doubts that otherwise send a renter elsewhere.",
			},
			{
				heading: "Fewer counter disputes",
				body: "Sets expectations on fuel, mileage, and deposits up front, so there are fewer surprises at pickup.",
			},
			{
				heading: "Around the clock",
				body: "Covers evenings and weekends when the desk is closed but renters are still planning.",
			},
		],
		faqs: [
			{
				question: "Can it check car availability or change a booking?",
				answer:
					"It answers from your rental terms and FAQs rather than connecting to your reservation system. When someone needs to change or confirm an actual booking, it escalates to your staff with the full conversation so they can act on it.",
			},
			{
				question: "Can it handle questions in multiple languages?",
				answer:
					"The agent runs on the model you choose through LLM Gateway, so you can pick one that fits the languages your renters use. It answers from the same source content regardless.",
			},
		],
	},
	{
		slug: "real-estate",
		num: "05",
		name: "Real estate",
		tagline:
			"Answer listing and process questions 24/7, then route serious leads to an agent.",
		headline: "Answer listing questions the moment they're asked.",
		lead: "Buyers and renters browse at midnight. The agent answers questions about your listings and process, then hands serious leads to an agent before they go cold.",
		problem:
			"A hot lead goes cold when their question sits unanswered until the next business day.",
		body: [
			"Property searches happen after hours, and interest fades fast. A prospect with an unanswered question simply moves on to the next listing.",
			"Clanker Support answers questions about your listings, application process, and fees from your content right away, and routes a serious enquiry — someone who wants a viewing — straight to an agent with everything they've already shared.",
		],
		handles: [
			"Listing details, features, and availability",
			"Viewing and booking process",
			"Application and document requirements",
			"Fees, deposits, and timelines",
			"“I'd like to view this place” → escalated to an agent",
		],
		points: [
			{
				heading: "Capture leads 24/7",
				body: "Answers after-hours questions so an interested prospect doesn't drift to the next listing.",
			},
			{
				heading: "Qualify before handoff",
				body: "Handles the routine questions and passes a warm, context-rich lead to an agent.",
			},
			{
				heading: "Free up agents",
				body: "Keeps agents on viewings and closings instead of repetitive enquiry replies.",
			},
		],
		faqs: [
			{
				question: "How does it know about our current listings?",
				answer:
					"It answers from the listing details and information you provide. Keep that content current in the dashboard and the agent stays accurate; for anything it can't answer, it escalates to an agent.",
			},
			{
				question: "Can it book a viewing directly?",
				answer:
					"It doesn't connect to a calendar — instead it captures the request and escalates to an agent with the full conversation, so your team can confirm the viewing personally.",
			},
		],
	},
	{
		slug: "hospitality",
		num: "06",
		name: "Hotels & hospitality",
		tagline:
			"Answer check-in, amenity, and local questions any hour, and hand real requests to your staff.",
		headline: "Be the front desk that never sleeps.",
		lead: "Guests ask about check-in, amenities, and the area at every hour. The agent answers instantly from your information and hands real requests to your staff.",
		problem:
			"Guest questions arrive around the clock, but your front desk can't be staffed for all of them.",
		body: [
			"Guests have questions before they arrive and throughout their stay — check-in times, Wi-Fi, parking, what's nearby. Each one is quick to answer, but they never stop coming.",
			"Clanker Support answers them from your property information instantly, and routes genuine requests — a late checkout, a special arrangement — to your staff with the full conversation.",
		],
		handles: [
			"Check-in and check-out times and policies",
			"Amenities, Wi-Fi, and facilities",
			"Parking, directions, and transport",
			"Local recommendations",
			"Special requests → escalated to your staff",
		],
		points: [
			{
				heading: "Better guest experience",
				body: "Gives guests instant answers at any hour instead of waiting on a call back.",
			},
			{
				heading: "Fewer repetitive calls",
				body: "Handles the same arrival and amenity questions so staff aren't tied to the phone.",
			},
			{
				heading: "Staff on what matters",
				body: "Frees your team for in-person hospitality while the agent covers the FAQs.",
			},
		],
		faqs: [
			{
				question: "Can it take a reservation or a room request?",
				answer:
					"It answers questions from your property information rather than managing bookings. When a guest needs something actioned, it escalates to your staff with the conversation so a person can take it from there.",
			},
			{
				question: "Does it work on our existing website?",
				answer:
					"Yes. It's one script tag that drops onto any site and loads in an isolated widget, so it won't interfere with your existing design or booking tools.",
			},
		],
	},
];

/** Look up a use case by slug. */
export function getUseCase(slug: string): UseCase | undefined {
	return USE_CASES.find((u) => u.slug === slug);
}
