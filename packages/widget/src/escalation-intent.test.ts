import { describe, expect, it } from "vitest";

import { requestsHuman } from "./escalation-intent";

describe("requestsHuman", () => {
	it.each([
		// talk/speak/chat/connect + person
		"Can I talk to a human?",
		"I want to speak with a real person",
		"can i chat with someone",
		"Connect me to your support team",
		"put me through to an agent",
		"could you connect me with customer service",
		"speaking to a representative would help",
		// get/give me
		"get me a human",
		"Give me an agent",
		// want/need/like
		"I need a rep",
		"I'd like a human",
		"i wanna talk to a person",
		"I would prefer an operator",
		// is there…
		"Is there a human I can talk to?",
		"is there anyone who can help me",
		// strong bigrams
		"a real human would understand this",
		"live agent",
		"I need human support here",
		// please / bare noun
		"human please",
		"Agent, please!",
		"human",
		"AGENT",
		// escalate / transfer
		"please escalate this",
		"can you transfer me",
		"hand me off to your team",
		// bot frustration
		"I don't want to talk to a bot",
		"no bots please",
		"stop, I did not ask for an AI",
	])("matches %j", (text) => {
		expect(requestsHuman(text)).toBe(true);
	});

	it.each([
		// Ordinary support questions must never match.
		"What exactly is Clanker Support?",
		"How do I add the widget to my website?",
		"My order hasn't arrived yet",
		"Thanks, that answers my question!",
		// Word-boundary traps: substrings of matched nouns/verbs.
		"humanity is doomed",
		"my personal email bounced",
		"what's on the agenda for tomorrow",
		"can you repeat that",
		"the review said my zip was secretly a tar",
		// Nouns in non-request contexts.
		"my user agent string looks wrong",
		"the person who emailed me was very nice",
	])("does not match %j", (text) => {
		expect(requestsHuman(text)).toBe(false);
	});
});
