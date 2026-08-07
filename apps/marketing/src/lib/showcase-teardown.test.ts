import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../../..");

// References that dead-end (the domain, the deleted app) or would silently
// resurrect the retired surface's plumbing (env vars, the old probe symbol).
// The bare word "showcase" is deliberately NOT scanned: historical prose (the
// advisor log, old blog narratives, AGENTS.md's local-dev note) may tell the
// story — nothing may LINK to or WIRE UP the retired surface.
const FORBIDDEN = [
	"showcase.clankersupport.com",
	"apps/showcase",
	"@llmchat/showcase",
	"SHOWCASE_URL", // also catches NEXT_PUBLIC_SHOWCASE_URL
	"SHOWCASE_WIDGET_KEY",
	"CANONICAL_SHOWCASE_URL",
	"probeShowcaseWidget",
];

const ALLOWLIST = new Set([
	"docs/advisor-log.md", // the one-line-per-PR historical record
	"apps/marketing/src/lib/showcase-teardown.test.ts", // this scan itself
	"apps/marketing/next.config.ts", // the 301 must name the retired host to catch it
]);

describe("showcase teardown is total (git history is the only archive)", () => {
	it("no tracked file references the retired app, its domain, or its env plumbing", () => {
		const files = execSync("git ls-files -z", { cwd: REPO_ROOT })
			.toString("utf8")
			.split("\0")
			.filter(Boolean)
			.filter((f) => !ALLOWLIST.has(f));

		const offenders: string[] = [];
		for (const file of files) {
			let text: string;
			try {
				text = readFileSync(join(REPO_ROOT, file), "utf8");
			} catch {
				continue; // deleted-but-listed race; binary reads still string-match safely
			}
			for (const token of FORBIDDEN) {
				if (text.includes(token)) offenders.push(`${file} → ${token}`);
			}
		}
		expect(offenders).toEqual([]);
	});
});
