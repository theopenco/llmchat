// Behavioral eval for Bug 1 (agent identity-awareness). The deterministic unit tests
// (src/lib/llm.test.ts, src/routes/chat.test.ts) prove the identity block is ASSEMBLED
// into the exact system string — but they can't prove the MODEL stops re-asking, because
// every in-repo LLM call is mocked. This script runs the REAL streamChat against the live
// LLM Gateway and measures the per-field re-ask rate.
//
// It lives OUTSIDE src/ on purpose: vitest's include glob is src/**/*.test.ts, so this is
// never collected into `pnpm test` and never makes a paid gateway call in CI. Run it by
// hand once (results go in the PR body):
//
//   node --experimental-strip-types apps/api/scripts/eval-identity.mjs
//   EVAL_TRIALS=10 EVAL_MODELS=gpt-5.4-mini,claude-haiku-4-5,gemini-2.5-flash node --experimental-strip-types apps/api/scripts/eval-identity.mjs
//
// It imports the REAL renderIdentityBlock/buildSystem/streamChat from ../src/lib/llm.ts
// (Node strips the type-only `@/env` import), so it exercises production prompt assembly
// with zero drift. Refuses to run (exit 0) when LLMGATEWAY_API_KEY is unset.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateText } from "ai";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";

import { streamChat } from "../src/lib/llm.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- env (mirror seed.mjs: a tiny .env parser, no dotenv dependency) -----------------
function loadDotEnv(path) {
	const out = {};
	if (!existsSync(path)) return out;
	for (const raw of readFileSync(path, "utf8").split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq === -1) continue;
		const key = line.slice(0, eq).trim();
		let val = line.slice(eq + 1).trim();
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1);
		}
		out[key] = val;
	}
	return out;
}

const fileEnv = loadDotEnv(join(__dirname, "..", ".env"));
const LLMGATEWAY_API_KEY =
	process.env.LLMGATEWAY_API_KEY ?? fileEnv.LLMGATEWAY_API_KEY;
const LLMGATEWAY_BASE_URL =
	process.env.LLMGATEWAY_BASE_URL ?? fileEnv.LLMGATEWAY_BASE_URL;

if (!LLMGATEWAY_API_KEY) {
	console.log(
		"eval-identity: LLMGATEWAY_API_KEY unset — skipping behavioral eval (this is a manual, gateway-billed script, never run in CI).",
	);
	process.exit(0);
}

const TRIALS = Number(process.env.EVAL_TRIALS ?? 10);
const MODELS = (
	process.env.EVAL_MODELS ?? "gpt-5.4-mini,claude-haiku-4-5,gemini-2.5-flash"
)
	.split(",")
	.map((m) => m.trim())
	.filter(Boolean);
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 6);

const runEnv = {
	vars: { LLMGATEWAY_API_KEY, LLMGATEWAY_BASE_URL },
};

// --- fixtures ------------------------------------------------------------------------
const OPERATOR_WITH_CLAUSE =
	"You are Acme's support agent. Be concise and friendly. When a visitor asks to talk to a human or requests a callback, collect their full name, email address, and a short note describing their issue before you escalate.";
const OPERATOR_WITHOUT_CLAUSE =
	"You are Acme's support agent. Be concise and friendly.";
const IDENTITY = { name: "Jane Doe", email: "jane@acme.com" };
const USER_MESSAGE =
	"This still isn't working. I want to talk to a real person.";

// The 2x2: isolate emergent vs operator-driven re-ask AND measure the fix on each.
const CELLS = [
	{
		key: "A",
		clause: false,
		identity: false,
		label: "no-clause · no-identity (baseline: is the re-ask even emergent?)",
	},
	{
		key: "B",
		clause: true,
		identity: false,
		label: "WITH-clause · no-identity (worst-case bug repro)",
	},
	{
		key: "C",
		clause: false,
		identity: true,
		label: "no-clause · identity ON (fix, emergent case)",
	},
	{
		key: "D",
		clause: true,
		identity: true,
		label:
			"WITH-clause · identity ON (fix, operator-prompt case — the HARD cell)",
	},
];

// --- model call (REAL production path) -----------------------------------------------
async function runOnce(model, cell) {
	const res = await streamChat(runEnv, {
		model,
		systemPrompt: cell.clause ? OPERATOR_WITH_CLAUSE : OPERATOR_WITHOUT_CLAUSE,
		knowledgeText: "",
		sources: [],
		identity: cell.identity ? IDENTITY : undefined,
		messages: [
			{ id: "u1", role: "user", parts: [{ type: "text", text: USER_MESSAGE }] },
		],
	});
	return await res.text;
}

// --- grading: deterministic regex pre-filter + a strict gpt-5-nano judge --------------
const judgeGateway = createLLMGateway({
	apiKey: LLMGATEWAY_API_KEY,
	baseURL: LLMGATEWAY_BASE_URL,
});

function gradeRegex(text) {
	const t = text || "";
	return {
		asksForName:
			/\b(your|the)\s+(full\s+)?name\b/i.test(t) &&
			/(name[^.?!]*\?|(provide|share|give|have|get|confirm)[^.?!]*name)/i.test(
				t,
			),
		asksForEmail:
			/\be-?mail\b/i.test(t) &&
			/(e-?mail[^.?!]*\?|(provide|share|give|have|get|confirm)[^.?!]*e-?mail)/i.test(
				t,
			),
		reassuresOnFile:
			/\b(already (have|on file|on record)|on file|on record|have (your|it) on)\b/i.test(
				t,
			),
	};
}

async function gradeJudge(text) {
	try {
		const { text: out } = await generateText({
			model: judgeGateway("gpt-5-nano"),
			system:
				'You grade a customer-support agent\'s reply. Output STRICT minified JSON only, no prose, no code fence. Keys (all boolean): asksForName (the reply asks the visitor to provide/share/confirm their name), asksForEmail (asks for their email address), asksForNote (asks for a description/note of the issue), reassuresDetailsOnFile (reassures the visitor their contact details are already on file/known). Example: {"asksForName":false,"asksForEmail":false,"asksForNote":true,"reassuresDetailsOnFile":true}',
			prompt: `Agent reply:\n"""\n${text}\n"""`,
			maxOutputTokens: 80,
		});
		const json = out.replace(/```json|```/g, "").trim();
		const parsed = JSON.parse(json);
		return {
			asksForName: !!parsed.asksForName,
			asksForEmail: !!parsed.asksForEmail,
			asksForNote: !!parsed.asksForNote,
			reassuresDetailsOnFile: !!parsed.reassuresDetailsOnFile,
			ok: true,
		};
	} catch (err) {
		return { ok: false, error: String(err).split("\n")[0] };
	}
}

// Combine conservatively: a field counts as "asked" if EITHER signal flags it, so a leak
// the judge misses still surfaces. asksForNote is tracked but NEVER a failure — the
// override's scope is name+email only; the operator's note request stays legitimate.
function combine(text, regex, judge) {
	const j = judge.ok ? judge : {};
	return {
		asksForName: regex.asksForName || !!j.asksForName,
		asksForEmail: regex.asksForEmail || !!j.asksForEmail,
		asksForNote: !!j.asksForNote,
		reassuresOnFile: regex.reassuresOnFile || !!j.reassuresDetailsOnFile,
		judgeOk: judge.ok,
	};
}

// --- tiny concurrency pool -----------------------------------------------------------
async function mapPool(items, limit, fn) {
	const out = Array.from({ length: items.length });
	let i = 0;
	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		async () => {
			while (i < items.length) {
				const idx = i++;
				out[idx] = await fn(items[idx], idx);
			}
		},
	);
	await Promise.all(workers);
	return out;
}

function pct(n, d) {
	return d === 0 ? "—" : `${((n / d) * 100).toFixed(0)}%`;
}

// --- run -----------------------------------------------------------------------------
console.log(
	`\neval-identity — Bug 1 behavioral check\nmodels: ${MODELS.join(", ")}\ntrials/cell: ${TRIALS}\n`,
);

const results = [];
for (const model of MODELS) {
	for (const cell of CELLS) {
		const trials = Array.from({ length: TRIALS }, (_, k) => k);
		const graded = await mapPool(trials, CONCURRENCY, async () => {
			try {
				const text = await runOnce(model, cell);
				const grade = combine(text, gradeRegex(text), await gradeJudge(text));
				return { ...grade, error: null };
			} catch (err) {
				return { error: String(err).split("\n")[0] };
			}
		});
		const ok = graded.filter((g) => !g.error);
		const errs = graded.filter((g) => g.error);
		const sum = (k) => ok.filter((g) => g[k]).length;
		const row = {
			model,
			cell: cell.key,
			label: cell.label,
			n: ok.length,
			errors: errs.length,
			name: sum("asksForName"),
			email: sum("asksForEmail"),
			note: sum("asksForNote"),
			reassure: sum("reassuresOnFile"),
			firstError: errs[0]?.error ?? null,
		};
		results.push(row);
		console.log(
			`[${model}] cell ${cell.key} ${cell.label}\n` +
				`   n=${row.n}/${TRIALS} (errors ${row.errors})  ` +
				`asksName ${row.name}/${row.n} (${pct(row.name, row.n)})  ` +
				`asksEmail ${row.email}/${row.n} (${pct(row.email, row.n)})  ` +
				`note ${row.note}/${row.n}  reassure ${row.reassure}/${row.n} (${pct(row.reassure, row.n)})` +
				(row.firstError ? `\n   first error: ${row.firstError}` : ""),
		);
	}
}

// --- verdict -------------------------------------------------------------------------
// Pass = in the identity-ON cells (C, D), name & email ask-rate is 0 across all models.
const fixCells = results.filter((r) => r.cell === "C" || r.cell === "D");
const anyAsk = fixCells.filter((r) => r.name > 0 || r.email > 0);

console.log("\n================ SUMMARY ================");
console.log(
	"Baseline re-ask WITHOUT the fix (cells A/B) — how often the model asks for name/email when identity is NOT injected:",
);
for (const r of results.filter((r) => r.cell === "A" || r.cell === "B")) {
	console.log(
		`  ${r.model} ${r.cell}: name ${pct(r.name, r.n)}, email ${pct(r.email, r.n)}`,
	);
}
console.log(
	"\nWith the fix (cells C/D) — should be 0% for both name and email:",
);
for (const r of fixCells) {
	console.log(
		`  ${r.model} ${r.cell}: name ${r.name}/${r.n} (${pct(r.name, r.n)}), email ${r.email}/${r.n} (${pct(r.email, r.n)}), reassure ${pct(r.reassure, r.n)}`,
	);
}

// Guard against a spurious PASS: a cell whose trials all errored has name=email=0 but
// proves nothing. Require the bug to actually reproduce (cell B) and every fix cell to
// have real successful trials before trusting a 0% re-ask rate.
const totalErrors = results.reduce((a, r) => a + r.errors, 0);
const emptyCells = results.filter((r) => r.n === 0);
const reproCells = results.filter((r) => r.cell === "B");
const bugReproduced = reproCells.some((r) => r.name > 0 || r.email > 0);
if (totalErrors > 0) {
	console.log(
		`\n(${totalErrors} trial error(s) across all cells — see per-cell counts above.)`,
	);
}
if (emptyCells.length > 0 || !bugReproduced) {
	console.log(
		"\nVERDICT: INCONCLUSIVE — " +
			(emptyCells.length > 0
				? `${emptyCells.length} cell(s) had zero successful trials (all errored)`
				: "the bug did not reproduce in cell B (no baseline to fix)") +
			". Re-run; do not treat a 0% re-ask rate from an empty/failed cell as a pass.",
	);
	process.exit(1);
}

if (anyAsk.length === 0) {
	console.log(
		"\nVERDICT: PASS — 0/" +
			TRIALS +
			" name & email re-asks in every identity-ON cell across the model subset.",
	);
	process.exit(0);
} else {
	console.log(
		"\nVERDICT: RESIDUAL — the fix did not fully eliminate the re-ask in:",
	);
	for (const r of anyAsk) {
		const kind = r.cell === "D" ? "operator-prompt-driven" : "emergent";
		console.log(
			`  ${r.model} cell ${r.cell} (${kind}): name ${r.name}/${r.n}, email ${r.email}/${r.n}`,
		);
	}
	console.log(
		"This is an instruction-conflict ceiling (report it honestly; a residual in cell D means the operator prompt is being followed over the override on that model — the remedy is product-side, not more prompt positioning).",
	);
	process.exit(0);
}
