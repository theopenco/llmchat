"use client";

import { useState } from "react";
import { fieldInput, fieldLabel } from "@/components/tools/field";
import { CopyButton, useToolUsedOnce } from "@/components/tools/CopyButton";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";

const TOOL = "llms-txt-generator";

interface LinkRow {
	title: string;
	url: string;
	note: string;
}

interface Section {
	title: string;
	links: LinkRow[];
}

const emptyLink = (): LinkRow => ({ title: "", url: "", note: "" });

/** Build a spec-correct llms.txt (llmstxt.org): H1, blockquote, H2 link lists. */
function buildFile(opts: {
	name: string;
	summary: string;
	details: string;
	sections: Section[];
}): string {
	const lines: string[] = [`# ${opts.name.trim() || "Your site"}`];

	if (opts.summary.trim()) lines.push("", `> ${opts.summary.trim()}`);
	if (opts.details.trim()) lines.push("", opts.details.trim());

	for (const section of opts.sections) {
		const links = section.links.filter((l) => l.url.trim());
		if (!section.title.trim() || !links.length) continue;
		lines.push("", `## ${section.title.trim()}`);
		for (const l of links) {
			const title = l.title.trim() || l.url.trim();
			const note = l.note.trim();
			lines.push(`- [${title}](${l.url.trim()})${note ? `: ${note}` : ""}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

/** Form in, live spec-correct llms.txt out — copy it or download the file. */
export function LlmsTxtGenerator() {
	const [name, setName] = useState("");
	const [summary, setSummary] = useState("");
	const [details, setDetails] = useState("");
	const [sections, setSections] = useState<Section[]>([
		{ title: "Docs", links: [emptyLink()] },
	]);
	const used = useToolUsedOnce(TOOL);

	const output = buildFile({ name, summary, details, sections });

	const setSection = (i: number, next: Section) =>
		setSections((prev) => prev.map((s, j) => (j === i ? next : s)));

	const download = () => {
		track(ANALYTICS_EVENTS.toolUsed, { tool: TOOL, action: "downloaded" });
		const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "llms.txt";
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="grid gap-px overflow-hidden rounded-3xl border border-rule bg-rule lg:grid-cols-[1fr_1.15fr]">
			{/* ── Form ───────────────────────────────────────────── */}
			<div className="bg-paper-card p-7 sm:p-8">
				<p className="kicker">Describe your site</p>

				<div className="mt-6 space-y-5">
					<label className="block">
						<span className={fieldLabel}>Site or project name (the H1)</span>
						<input
							value={name}
							onChange={(e) => {
								used();
								setName(e.target.value);
							}}
							placeholder="Acme Analytics"
							className={fieldInput}
						/>
					</label>

					<label className="block">
						<span className={fieldLabel}>
							One-line summary (the blockquote)
						</span>
						<input
							value={summary}
							onChange={(e) => {
								used();
								setSummary(e.target.value);
							}}
							placeholder="Privacy-first product analytics you can self-host."
							className={fieldInput}
						/>
					</label>

					<label className="block">
						<span className={fieldLabel}>Optional context paragraph</span>
						<textarea
							value={details}
							onChange={(e) => {
								used();
								setDetails(e.target.value);
							}}
							rows={2}
							placeholder="Anything an AI should know before picking a link."
							className={`${fieldInput} resize-y font-sans`}
						/>
					</label>

					{sections.map((section, i) => (
						<fieldset
							key={i}
							className="rounded-2xl border border-rule bg-paper p-5"
						>
							<div className="flex items-center justify-between gap-3">
								<label className="block flex-1">
									<span className={fieldLabel}>Section title (H2)</span>
									<input
										value={section.title}
										onChange={(e) => {
											used();
											setSection(i, { ...section, title: e.target.value });
										}}
										placeholder="Docs"
										className={fieldInput}
									/>
								</label>
								{sections.length > 1 && (
									<button
										type="button"
										aria-label={`Remove section ${section.title || i + 1}`}
										onClick={() =>
											setSections((prev) => prev.filter((_, j) => j !== i))
										}
										className="mt-6 font-mono text-xs text-faint transition-colors hover:text-ink"
									>
										✕
									</button>
								)}
							</div>

							{section.links.map((link, j) => (
								<div
									key={j}
									className="mt-4 grid gap-3 border-t border-rule-soft pt-4 sm:grid-cols-2"
								>
									<label className="block">
										<span className={fieldLabel}>Link title</span>
										<input
											value={link.title}
											onChange={(e) => {
												used();
												const links = section.links.with(j, {
													...link,
													title: e.target.value,
												});
												setSection(i, { ...section, links });
											}}
											placeholder="Quickstart"
											className={fieldInput}
										/>
									</label>
									<label className="block">
										<span className={fieldLabel}>URL</span>
										<input
											value={link.url}
											onChange={(e) => {
												used();
												const links = section.links.with(j, {
													...link,
													url: e.target.value,
												});
												setSection(i, { ...section, links });
											}}
											placeholder="https://acme.dev/docs"
											className={fieldInput}
										/>
									</label>
									<label className="block sm:col-span-2">
										<span className={fieldLabel}>
											What's on that page (after the colon)
										</span>
										<input
											value={link.note}
											onChange={(e) => {
												used();
												const links = section.links.with(j, {
													...link,
													note: e.target.value,
												});
												setSection(i, { ...section, links });
											}}
											placeholder="Install, configure, and send your first event."
											className={fieldInput}
										/>
									</label>
								</div>
							))}

							<button
								type="button"
								onClick={() =>
									setSection(i, {
										...section,
										links: [...section.links, emptyLink()],
									})
								}
								className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-accent-soft transition-colors hover:text-accent"
							>
								+ Add link
							</button>
						</fieldset>
					))}

					<button
						type="button"
						onClick={() =>
							setSections((prev) => [
								...prev,
								{ title: "", links: [emptyLink()] },
							])
						}
						className="w-full rounded-2xl border border-dashed border-rule py-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/40 hover:text-ink"
					>
						+ Add section
					</button>
				</div>
			</div>

			{/* ── Live preview ───────────────────────────────────── */}
			<div className="relative flex flex-col overflow-hidden bg-paper p-7 sm:p-8">
				<div className="grid-backdrop pointer-events-none absolute inset-0" />
				<div className="relative flex flex-1 flex-col">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="kicker">llms.txt · live preview</p>
						<div className="flex items-center gap-2">
							<CopyButton text={() => output} tool={TOOL} label="Copy" />
							<button
								type="button"
								onClick={download}
								className="inline-flex items-center gap-2 rounded-full border border-rule px-5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
							>
								Download
								<span aria-hidden>↓</span>
							</button>
						</div>
					</div>

					<pre className="mt-6 flex-1 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-rule bg-paper-card/60 p-6 font-mono text-[0.82rem] leading-relaxed text-ink-soft">
						{output}
					</pre>

					<p className="mt-4 text-xs leading-relaxed text-muted">
						Serve it at <code className="text-ink-soft">/llms.txt</code> from
						your site root as plain text. This site publishes its own —{" "}
						<a
							href="/llms.txt"
							className="text-accent-soft underline underline-offset-2 hover:text-accent"
						>
							see it live
						</a>
						.
					</p>
				</div>
			</div>
		</div>
	);
}
