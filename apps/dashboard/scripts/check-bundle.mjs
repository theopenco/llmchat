// Post-build guard: fail the build if the client bundle CALLS an esbuild/tsup
// runtime helper that is DEFINED NOWHERE in the output.
//
// Why: a dependency shipped as esbuild/tsup output expects its helpers (e.g.
// `__name` from `keepNames`, decorator/private-field helpers) to be defined at
// its module top. When webpack code-splits and the helper definition is dropped
// into a chunk that isn't co-loaded, the call site throws `__name is not
// defined` at runtime and crashes client init — which is exactly what broke the
// sign-in / onboarding flow. Type-checks and unit tests are blind to it because
// it only manifests in the minified, split bundle. This converts that silent
// runtime ReferenceError into a hard build failure.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// esbuild/tsup helpers that are referenced as bare identifiers (not via a
// namespace) and therefore throw a ReferenceError if their definition is
// missing. Webpack's own runtime (`__webpack_require__`, `__webpack_exports__`)
// is intentionally excluded — it is provided by the webpack runtime chunk.
export const ESBUILD_HELPERS = [
	"__name",
	"__publicField",
	"__privateGet",
	"__privateSet",
	"__privateAdd",
	"__privateMethod",
	"__decorateClass",
	"__decorateParam",
	"__esDecorate",
	"__spreadValues",
	"__spreadProps",
	"__objRest",
];

const defPattern = (h) =>
	new RegExp(`(?:var|let|const|function)\\s+${h}\\b|\\b${h}\\s*=`);
const callPattern = (h) => new RegExp(`\\b${h}\\s*\\(`);

/**
 * Given the built chunk sources, return the helpers that are called somewhere
 * but defined nowhere. Definition and call may live in different chunks (webpack
 * splits freely), so both sides are evaluated across the whole output set.
 *
 * @param {{ name: string, code: string }[]} files
 * @returns {{ helper: string, calledIn: string[] }[]}
 */
export function findUndefinedHelpers(files) {
	const broken = [];
	for (const helper of ESBUILD_HELPERS) {
		const def = defPattern(helper);
		const call = callPattern(helper);
		const definedAnywhere = files.some((f) => def.test(f.code));
		if (definedAnywhere) continue;
		const calledIn = files.filter((f) => call.test(f.code)).map((f) => f.name);
		if (calledIn.length > 0) broken.push({ helper, calledIn });
	}
	return broken;
}

/**
 * Inline `<script>` blocks in prerendered HTML run in the shared global scope,
 * so an esbuild helper CALLED in one must be DEFINED by some inline script on
 * the same page (e.g. the `__name` shim in the root layout). A call with no
 * definition on the page throws at runtime (`__name is not defined`) and breaks
 * client init. This is the regression the chunk scan can't see: the offending
 * call lives in the prerendered HTML, not in static/chunks — Ploy's esbuild pass
 * bakes it into next-themes' inlined theme script.
 *
 * @param {{ name: string, code: string }[]} htmlFiles
 * @returns {{ helper: string, file: string }[]}
 */
export function findUndefinedInlineHelpers(htmlFiles) {
	const inlineScript = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
	const broken = [];
	for (const file of htmlFiles) {
		const blob = [...file.code.matchAll(inlineScript)]
			.map((m) => m[1])
			.join("\n");
		if (!blob) continue;
		for (const helper of ESBUILD_HELPERS) {
			if (!callPattern(helper).test(blob)) continue;
			if (defPattern(helper).test(blob)) continue;
			broken.push({ helper, file: file.name });
		}
	}
	return broken;
}

function collectFiles(dir, ext) {
	const out = [];
	const walk = (d) => {
		for (const entry of readdirSync(d)) {
			const p = join(d, entry);
			if (statSync(p).isDirectory()) walk(p);
			else if (entry.endsWith(ext))
				out.push({ name: p, code: readFileSync(p, "utf8") });
		}
	};
	walk(dir);
	return out;
}

function main() {
	const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const chunksDir = join(root, ".next", "static", "chunks");
	let files;
	try {
		files = collectFiles(chunksDir, ".js");
	} catch {
		console.error(
			`bundle check: no built chunks at ${chunksDir}. Run \`next build\` first.`,
		);
		process.exit(1);
	}

	// Prerendered HTML inline scripts (best-effort; absent if no static pages).
	let htmlFiles = [];
	try {
		htmlFiles = collectFiles(join(root, ".next", "server", "app"), ".html");
	} catch {
		/* no prerendered app HTML — nothing to scan */
	}
	const brokenInline = findUndefinedInlineHelpers(htmlFiles);
	if (brokenInline.length > 0) {
		console.error(
			"bundle check FAILED — prerendered HTML inline scripts call esbuild helpers defined nowhere on the page:",
		);
		for (const { helper, file } of brokenInline) {
			console.error(`  • ${helper} — in ${file}`);
		}
		console.error(
			"This crashes client init at runtime (e.g. `__name is not defined`). " +
				"Define the helper before the offending inline script (see the root-layout shim).",
		);
		process.exit(1);
	}

	const broken = findUndefinedHelpers(files);
	if (broken.length > 0) {
		console.error(
			"bundle check FAILED — client chunks call esbuild helpers that are defined nowhere:",
		);
		for (const { helper, calledIn } of broken) {
			console.error(`  • ${helper} — called in ${calledIn.length} chunk(s)`);
			for (const name of calledIn.slice(0, 5)) console.error(`      ${name}`);
		}
		console.error(
			"This crashes client init at runtime (e.g. `__name is not defined`). " +
				"Add the offending dependency to next.config `transpilePackages` so Next re-transpiles it.",
		);
		process.exit(1);
	}

	console.log(
		`bundle check OK — ${files.length} chunk(s), no undefined esbuild helpers.`,
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main();
}
