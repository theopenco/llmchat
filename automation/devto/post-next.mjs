#!/usr/bin/env node
// Cross-post the next queued article to dev.to. Posts exactly ONE item per run.
//
// Idempotent: before posting it fetches everything already on the account and
// skips any queue item whose canonical URL or title is already there, so a
// re-run (or a double-fire of the cron) never double-posts.
//
// Source of truth is the repo's own blog posts under apps/marketing/content/blog/.
// Each queue item is read from disk, its root-relative links are rewritten to
// absolute clankersupport.com URLs, and a dev.to front-matter block (title,
// series, tags, canonical_url, cover_image, published) is prepended — the exact
// shape you'd paste into dev.to's markdown editor by hand.
//
// Env:
//   DEVTO_API_KEY   required (unless DRY_RUN) — dev.to key (Settings -> Extensions -> DEV API Keys)
//   DRY_RUN=1       build + print the payload, never call the dev.to API
//   SITE_ORIGIN     canonical origin for link rewriting (default https://clankersupport.com)
//
// Usage:
//   node automation/devto/post-next.mjs           # post the next unposted item
//   node automation/devto/post-next.mjs --list    # show queue status, post nothing
//   DRY_RUN=1 node automation/devto/post-next.mjs  # rehearse without publishing

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://clankersupport.com";
const DEVTO_API = "https://dev.to/api";
const FOREM_ACCEPT = "application/vnd.forem.api-v1+json";

function parseFrontmatter(raw) {
	const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!m) return { data: {}, body: raw };
	const data = {};
	for (const line of m[1].split("\n")) {
		const kv = line.match(/^([\w-]+):\s*(.*)$/);
		if (!kv) continue;
		let v = kv[2].trim();
		if (
			(v.startsWith('"') && v.endsWith('"')) ||
			(v.startsWith("'") && v.endsWith("'"))
		) {
			v = v.slice(1, -1);
		}
		data[kv[1]] = v;
	}
	return { data, body: m[2] };
}

// ](/pricing) -> ](https://clankersupport.com/pricing); leaves ](//x) and ](http...) alone
function absolutizeLinks(body) {
	return body.replace(/\]\(\/(?!\/)/g, `](${SITE_ORIGIN}/`);
}

function yaml(value) {
	return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function buildArticle(item) {
	const raw = await readFile(path.join(REPO_ROOT, item.source), "utf8");
	const { data, body } = parseFrontmatter(raw);
	const title = item.title ?? data.title;
	if (!title) throw new Error(`No title for ${item.slug} (${item.source})`);
	const description = item.description ?? data.description ?? "";
	const published = item.published !== false;

	const fm = ["---", `title: ${yaml(title)}`];
	if (item.series) fm.push(`series: ${yaml(item.series)}`);
	fm.push(`published: ${published}`);
	if (description) fm.push(`description: ${yaml(description)}`);
	if (item.tags?.length) fm.push(`tags: ${item.tags.join(", ")}`);
	if (item.canonical) fm.push(`canonical_url: ${item.canonical}`);
	// dev.to cover (1000:420 crop). Queue `cover` wins over the post's own
	// `cover` frontmatter so a wide "-devto" variant can be pointed at instead.
	const cover = item.cover ?? data.cover;
	if (cover) {
		fm.push(
			`cover_image: ${/^https?:\/\//.test(cover) ? cover : SITE_ORIGIN + cover}`,
		);
	}
	fm.push("---", "");

	const bodyMarkdown = `${fm.join("\n")}\n${absolutizeLinks(body).trim()}\n`;
	return {
		slug: item.slug,
		title,
		canonical: item.canonical ?? null,
		published,
		tags: (item.tags ?? []).join(", "),
		bodyMarkdown,
	};
}

async function fetchExisting(apiKey) {
	const res = await fetch(`${DEVTO_API}/articles/me/all?per_page=1000`, {
		headers: { "api-key": apiKey, accept: FOREM_ACCEPT },
	});
	if (!res.ok) {
		throw new Error(
			`GET /articles/me/all -> ${res.status} ${await res.text()}`,
		);
	}
	const json = await res.json();
	if (!Array.isArray(json)) throw new Error("Unexpected /articles/me/all body");
	return json;
}

function alreadyPosted(existing, article) {
	const canon = (article.canonical ?? "").replace(/\/+$/, "");
	const title = article.title.trim().toLowerCase();
	return existing.some((a) => {
		const ac = (a.canonical_url ?? "").replace(/\/+$/, "");
		if (canon && ac && ac === canon) return true;
		return (a.title ?? "").trim().toLowerCase() === title;
	});
}

async function main() {
	const listOnly = process.argv.includes("--list");
	const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
	const apiKey = process.env.DEVTO_API_KEY;

	const { items = [] } = JSON.parse(
		await readFile(path.join(HERE, "queue.json"), "utf8"),
	);

	// Fetch existing articles whenever a key is present — proves auth and drives
	// the idempotency skip. Only a real (non-dry) post strictly requires the key.
	let existing = [];
	if (apiKey) {
		existing = await fetchExisting(apiKey);
	} else if (!dryRun) {
		throw new Error("DEVTO_API_KEY is not set (or run with DRY_RUN=1).");
	}
	const canCheck = Boolean(apiKey);

	if (listOnly) {
		console.log(`Queue — ${items.length} item(s):`);
		for (const item of items) {
			const art = await buildArticle(item);
			const done = canCheck && alreadyPosted(existing, art);
			console.log(
				`  ${done ? "✓ posted" : "· queued"}  ${art.published ? "publish" : "DRAFT  "}  ${item.slug}  [${art.tags}]`,
			);
		}
		return;
	}

	for (const item of items) {
		const article = await buildArticle(item);
		if (canCheck && alreadyPosted(existing, article)) {
			console.log(`skip (already on dev.to): ${item.slug}`);
			continue;
		}
		console.log(
			`Posting ${item.slug} → ${article.published ? "PUBLISH" : "draft"} [${article.tags}]`,
		);
		if (dryRun) {
			console.log("\n----- body_markdown (first 900 chars) -----");
			console.log(article.bodyMarkdown.slice(0, 900));
			console.log("----- [DRY RUN — nothing sent to dev.to] -----");
			return;
		}
		const res = await fetch(`${DEVTO_API}/articles`, {
			method: "POST",
			headers: {
				"api-key": apiKey,
				"content-type": "application/json",
				accept: FOREM_ACCEPT,
			},
			body: JSON.stringify({ article: { body_markdown: article.bodyMarkdown } }),
		});
		if (!res.ok) {
			throw new Error(
				`POST /articles for ${item.slug} -> ${res.status} ${await res.text()}`,
			);
		}
		const created = await res.json();
		console.log(`Posted ✓ ${item.slug} → ${created.url ?? `id ${created.id}`}`);
		return;
	}

	console.log("Nothing to post — the queue is fully drained.");
}

main().catch((err) => {
	console.error(err?.message ?? err);
	process.exit(1);
});
