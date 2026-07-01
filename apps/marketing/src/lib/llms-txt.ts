// Builds the /llms.txt body — the llmstxt.org convention: an H1, a one-line
// blockquote summary, then sections of markdown links so an AI system can grab
// a map of the product and its key pages. Pure (data in, string out) so it's
// unit-tested without the content-collections build or Next.

export interface LlmsTxtInput {
	posts: { slug: string; title: string; description: string }[];
	competitors: { id: string; name: string; tldr: string }[];
	migrations: { slug: string; name: string; tagline: string }[];
	tools: { slug: string; name: string; tagline: string }[];
}

const SUMMARY =
	"An AI-powered support agent you embed with one script tag — it answers from your docs and sources, then escalates to your team. Open and self-hostable (bring your own keys); the hosted version has flat monthly plans from $19/mo with no per-seat fees.";

export function buildLlmsTxt(siteUrl: string, input: LlmsTxtInput): string {
	const lines: string[] = [
		"# Clanker Support",
		"",
		`> ${SUMMARY}`,
		"",
		"## Product",
		`- [Overview](${siteUrl}/): What Clanker Support is and how the drop-in agent works.`,
		`- [Docs](${siteUrl}/docs): Quickstart, training on your docs, escalation, and migration.`,
		`- [Compare](${siteUrl}/compare): How Clanker Support compares to other AI support tools.`,
		`- [Pricing](${siteUrl}/pricing.md): Self-host (free) and hosted plans — Starter, Growth, and Scale.`,
	];

	if (input.tools.length) {
		lines.push("", "## Free tools");
		for (const t of input.tools) {
			lines.push(`- [${t.name}](${siteUrl}/tools/${t.slug}): ${t.tagline}`);
		}
	}

	if (input.competitors.length) {
		lines.push("", "## Comparisons");
		for (const c of input.competitors) {
			lines.push(
				`- [Clanker Support vs ${c.name}](${siteUrl}/vs/${c.id}): ${c.tldr}`,
			);
		}
	}

	if (input.migrations.length) {
		lines.push("", "## Migration guides");
		for (const m of input.migrations) {
			lines.push(
				`- [Migrate from ${m.name} to Clanker Support](${siteUrl}/docs/migrate/${m.slug}): ${m.tagline}`,
			);
		}
	}

	if (input.posts.length) {
		lines.push("", "## Journal");
		for (const p of input.posts) {
			lines.push(`- [${p.title}](${siteUrl}/blog/${p.slug}): ${p.description}`);
		}
	}

	return `${lines.join("\n").trimEnd()}\n`;
}
