// Relative import, NOT "@llmchat/shared": this file runs inside the
// fumadocs-mdx config loader, which externalizes package dependencies — Node
// then tries to execute the shared barrel's extensionless ESM directly and
// fails. A relative path gets bundled by the loader instead (billing-tiers'
// only transitive imports are ./models and the generated model snapshot).
import {
	BILLING_TIERS,
	DISCOUNT_ACTIVE,
	DISCOUNT_PERCENT,
	usdPhrase,
} from "../../../packages/shared/src/billing-tiers";

/**
 * Substitutes `%%PRICE_*%%` / `%%PRICING_PROMO_NOTE%%` tokens in the docs
 * content with values derived from the shared billing-tiers table — the same
 * source the dashboard paywall and the Stripe prices follow.
 *
 * A remark plugin rather than a React component on purpose: the docs are also
 * served as plain markdown to AI answer engines (/llms.txt, /llms-full.txt,
 * /llms.mdx/*), and that pipeline stringifies the mdast without rendering
 * React — a component would leave unrendered tags where the prices should be.
 * Substituting at the mdast level keeps the HTML page and the machine-readable
 * surfaces identical, and ending a promotion (DISCOUNT_PERCENT = 0) updates
 * every figure and removes the promo note at the next build with no copy edit.
 */

/** Minimal structural mdast shape — enough to walk and edit text nodes. */
interface Node {
	type: string;
	value?: string;
	children?: Node[];
}

const PLANS = ["starter", "growth", "scale"] as const;

function buildReplacements(): Map<string, string> {
	// usdPhrase is the shared price-phrase convention for text surfaces —
	// "$19 (normally $38)" during a promotion, "$19" otherwise — the same one
	// the marketing FAQ and /pricing.md use ("…/yr" appended outside, ditto).
	const map = new Map<string, string>();
	for (const plan of PLANS) {
		const tier = BILLING_TIERS[plan];
		const key = plan.toUpperCase();
		map.set(`%%PRICE_${key}_MONTHLY%%`, usdPhrase(tier.priceUsdMonthly));
		map.set(`%%PRICE_${key}_ANNUAL%%`, `${usdPhrase(tier.priceUsdAnnual)}/yr`);
	}
	map.set(
		"%%PRICING_PROMO_NOTE%%",
		DISCOUNT_ACTIVE
			? `All hosted plans are currently ${DISCOUNT_PERCENT}% off — every figure below shows the promotional price with the regular price alongside.`
			: "",
	);
	return map;
}

function substitute(node: Node, replacements: Map<string, string>): void {
	if (typeof node.value === "string" && node.value.includes("%%")) {
		for (const [token, replacement] of replacements) {
			node.value = node.value.replaceAll(token, replacement);
		}
	}
	if (!node.children) return;
	for (const child of node.children) substitute(child, replacements);
	// A paragraph whose entire content was a token that resolved to "" (the
	// promo note outside a promotion) would render as an empty <p> — drop it.
	node.children = node.children.filter(
		(child) =>
			!(
				child.type === "paragraph" &&
				child.children?.every((c) => c.type === "text" && c.value === "")
			),
	);
}

export function remarkPricing() {
	return (tree: Node) => {
		substitute(tree, buildReplacements());
	};
}
