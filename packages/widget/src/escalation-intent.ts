/**
 * Detects a visitor explicitly asking for a human, so the "Talk to a human"
 * CTA can surface immediately instead of waiting for the message-count
 * threshold.
 *
 * Matching leans toward recall over precision: a match only REVEALS the
 * escalate button (the visitor still has to click it), so a rare false
 * positive costs one extra affordance while a false negative traps a
 * frustrated visitor with the bot. Patterns stay word-boundary anchored so
 * ordinary prose ("humanity", "agenda", "repeat", "personal") never matches.
 */

/** Nouns visitors use for "a human" (article/qualifier handled per pattern). */
const PERSON =
	"(?:human(?:\\s+being)?|person|agent|representative|rep|operator|advisor|somebody|someone|staff(?:\\s+member)?|team\\s?(?:mate|member)|customer\\s+(?:service|support|care)|support\\s+(?:team|staff|person))";

/** Optional emphasis in front of the noun ("a REAL person", "a live agent"). */
const QUALIFIER = "(?:real|actual|live|human|support)";

const ARTICLE = "(?:an?\\s+|the\\s+|your\\s+)?";

const PATTERNS: RegExp[] = [
	// "talk to a human", "can I speak with a real person", "chat with someone",
	// "connect me to your support team", "put me through to an agent"
	new RegExp(
		`\\b(?:talk(?:ing)?|speak(?:ing)?|chat(?:ting)?|connect(?:\\s+me)?|put\\s+me\\s+(?:through|in\\s+touch))\\s+(?:to|with)\\s+${ARTICLE}(?:${QUALIFIER}\\s+)?${PERSON}\\b`,
	),
	// "get me a human", "give me an agent"
	new RegExp(
		`\\b(?:get|give)\\s+me\\s+${ARTICLE}(?:${QUALIFIER}\\s+)?${PERSON}\\b`,
	),
	// "I want/need/would like a human/agent/rep" (with or without "to talk to")
	new RegExp(
		`\\bi\\s*(?:'d|would)?\\s*(?:want|need|like|prefer|wanna)\\s+${ARTICLE}(?:${QUALIFIER}\\s+)?(?:human|person|agent|representative|rep|operator)\\b`,
	),
	// "is there a human/anyone/someone (I can talk to)?"
	new RegExp(
		`\\bis\\s+there\\s+(?:a\\s+)?(?:${QUALIFIER}\\s+)?(?:human|person|agent|anyone|anybody|somebody|someone)\\b`,
	),
	// Strong bigrams anywhere: "real person", "live agent", "human support"…
	/\b(?:real|actual|live)\s+(?:human|person|agent|representative)\b/,
	/\bhuman\s+(?:agent|support|help|assistance|being)\b/,
	// "human please", "agent, please" — or the message is just "human"/"agent".
	/\b(?:human|agent|operator|representative),?\s+please\b/,
	/^\s*(?:an?\s+)?(?:human|agent|operator|representative)\s*[.!?]*\s*$/,
	// Explicit escalation / transfer verbs.
	/\bescalat(?:e|ion|ing)\b/,
	/\btransfer\s+me\b/,
	/\bhand\s+(?:me\s+)?(?:off|over)\b/,
	// Bot frustration: a negative word followed shortly (same clause) by a bot
	// noun — "not a bot", "no bots please", "I don't want to talk to a robot",
	// "stop, I did not ask for an AI", "tired of this chatbot".
	/\b(?:no|not|don'?t|dont|stop|hate|quit|tired\s+of|sick\s+of|enough\s+of)\b[^.!?]{0,25}\b(?:bots?|robots?|ai|chatbots?|machines?|clankers?)\b/,
];

/** True when the message reads as an explicit request for a human. */
export function requestsHuman(text: string): boolean {
	const t = text.toLowerCase();
	return PATTERNS.some((re) => re.test(t));
}
