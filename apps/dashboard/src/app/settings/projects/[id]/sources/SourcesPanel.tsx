"use client";

import {
	FileText,
	FileUp,
	Globe,
	MessagesSquare,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card, dsInputClass, Field } from "@/components/ds";
import {
	formatRelativeTime,
	SOURCE_URL_ERRORS,
	validateSourceUrl,
} from "@/lib/source-url";
import { cn } from "@/lib/utils";

import type { Source } from "../types";
import {
	countByType,
	sourceItemLabel,
	STATUS_STYLE,
	sourceStatus,
	sourceType,
	type SourceType,
} from "./source-status";

const TYPE_ICON: Record<SourceType, typeof Globe> = {
	URL: Globe,
	"Q&A": MessagesSquare,
	Text: FileText,
};

// The "Add a source" type picker. Website/Q&A/Text are LIVE; File upload is an
// honest roadmap affordance (needs storage + parsing under workerd) — rendered
// dimmed + non-interactive, never a fake working control.
type AddKind = "url" | "qa" | "text" | "file";
const ADD_TYPES: ReadonlyArray<{
	kind: AddKind;
	label: string;
	icon: typeof Globe;
	roadmap?: boolean;
}> = [
	{ kind: "url", label: "Website", icon: Globe },
	{ kind: "qa", label: "Q&A pair", icon: MessagesSquare },
	{ kind: "text", label: "Text snippet", icon: FileText },
	{ kind: "file", label: "File upload", icon: FileUp, roadmap: true },
];

function AddSource({
	onAddUrl,
	onAddText,
	onAddQa,
	urlPending,
	textPending,
	qaPending,
}: {
	onAddUrl: (url: string) => void;
	onAddText: (input: { title?: string; content: string }) => void;
	onAddQa: (input: { question: string; answer: string }) => void;
	urlPending: boolean;
	textPending: boolean;
	qaPending: boolean;
}) {
	const [kind, setKind] = useState<AddKind>("url");
	const [url, setUrl] = useState("");
	const [question, setQuestion] = useState("");
	const [answer, setAnswer] = useState("");
	const [title, setTitle] = useState("");
	const [text, setText] = useState("");

	function submitUrl() {
		const value = url.trim();
		const error = validateSourceUrl(value);
		if (error === "empty") return;
		if (error) {
			toast.error(SOURCE_URL_ERRORS[error]);
			return;
		}
		onAddUrl(value);
		setUrl("");
	}

	function submitQa() {
		const q = question.trim();
		const a = answer.trim();
		if (!q || !a) return;
		onAddQa({ question: q, answer: a });
		setQuestion("");
		setAnswer("");
	}

	function submitText() {
		const body = text.trim();
		if (!body) return;
		const t = title.trim();
		onAddText(t ? { title: t, content: body } : { content: body });
		setTitle("");
		setText("");
	}

	return (
		<Card id="sources-add" className="flex flex-col gap-4 p-4">
			<div>
				<h2 className="text-sm font-semibold text-ck-text">Add a source</h2>
				<p className="mt-0.5 text-xs text-ck-faint">
					Anything you add here becomes content the agent can answer from.
				</p>
			</div>

			{/* Typed picker — File upload is a dimmed roadmap chip, not a fake add. */}
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{ADD_TYPES.map(({ kind: k, label, icon: Icon, roadmap }) => {
					const active = !roadmap && k === kind;
					return (
						<button
							key={k}
							type="button"
							disabled={roadmap}
							aria-pressed={active}
							onClick={() => !roadmap && setKind(k)}
							className={cn(
								"flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold transition-colors",
								roadmap
									? "cursor-not-allowed border-dashed border-ck-border text-ck-disabled"
									: active
										? "border-ck-accent bg-ck-accent/10 text-ck-accent"
										: "border-ck-border text-ck-muted hover:border-ck-accent/40 hover:text-ck-text",
							)}
						>
							<Icon className="size-4 shrink-0" />
							<span className="min-w-0 flex-1 truncate text-left">{label}</span>
							{roadmap && (
								<span className="text-[10px] font-bold uppercase tracking-wide text-ck-faint">
									Soon
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Active form for the selected type. */}
			{kind === "url" && (
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								submitUrl();
							}
						}}
						placeholder="https://example.com"
						aria-label="Source URL"
						className="h-10 flex-1 rounded-[10px] border border-ck-border bg-ck-card px-3 font-mono text-[13px] text-ck-text outline-none placeholder:text-ck-faint focus-visible:border-ck-accent"
					/>
					<Button
						onClick={submitUrl}
						disabled={urlPending || !url.trim()}
						className="shrink-0"
					>
						<Plus className="size-4" />
						{urlPending ? "Adding…" : "Add website"}
					</Button>
				</div>
			)}

			{kind === "qa" && (
				<div className="flex flex-col gap-3">
					<Field label="Question">
						{(id) => (
							<input
								id={id}
								value={question}
								onChange={(e) => setQuestion(e.target.value)}
								placeholder="Do you ship internationally?"
								className={dsInputClass}
							/>
						)}
					</Field>
					<Field label="Answer">
						{(id) => (
							<textarea
								id={id}
								value={answer}
								onChange={(e) => setAnswer(e.target.value)}
								rows={3}
								placeholder="Yes — we ship to 40 countries. Rates are shown at checkout."
								className={dsInputClass}
							/>
						)}
					</Field>
					<div className="flex justify-end">
						<Button
							onClick={submitQa}
							disabled={qaPending || !question.trim() || !answer.trim()}
						>
							<Plus className="size-4" />
							{qaPending ? "Adding…" : "Add Q&A"}
						</Button>
					</div>
				</div>
			)}

			{kind === "text" && (
				<div className="flex flex-col gap-3">
					<Field
						label="Title"
						hint="Optional — defaults to the start of the text."
					>
						{(id) => (
							<input
								id={id}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Restock cadence"
								className={dsInputClass}
							/>
						)}
					</Field>
					<Field label="Text">
						{(id) => (
							<textarea
								id={id}
								value={text}
								onChange={(e) => setText(e.target.value)}
								rows={4}
								placeholder="We restock weekly on Mondays. Sold-out sizes usually return within two weeks."
								className={dsInputClass}
							/>
						)}
					</Field>
					<div className="flex justify-end">
						<Button onClick={submitText} disabled={textPending || !text.trim()}>
							<Plus className="size-4" />
							{textPending ? "Adding…" : "Add text"}
						</Button>
					</div>
				</div>
			)}
		</Card>
	);
}

// Per-type rollup cards. Counts are real (sources grouped by kind); Files is a
// dimmed roadmap card since there's no upload path yet. The deep per-item depth
// the design hints at (pages crawled, documents parsed) is the roadmap moat —
// we don't claim it, so no fabricated page totals here.
function TypeRollup({ sources }: { sources: Source[] }) {
	const counts = countByType(sources);
	const live: ReadonlyArray<{
		label: string;
		icon: typeof Globe;
		n: number;
	}> = [
		{ label: "Websites", icon: Globe, n: counts.URL },
		{ label: "Q&A", icon: MessagesSquare, n: counts["Q&A"] },
		{ label: "Text", icon: FileText, n: counts.Text },
	];
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{live.map(({ label, icon: Icon, n }) => (
				<Card key={label} className="flex items-center gap-3 p-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ck-chip text-ck-muted">
						<Icon className="size-4" />
					</span>
					<div className="min-w-0">
						<p className="text-lg font-bold tabular-nums text-ck-text">{n}</p>
						<p className="truncate text-[11px] text-ck-faint">
							{label} · {n === 1 ? "source" : "sources"}
						</p>
					</div>
				</Card>
			))}
			<Card className="flex items-center gap-3 p-3 opacity-60">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ck-chip text-ck-disabled">
					<FileUp className="size-4" />
				</span>
				<div className="min-w-0">
					<p className="text-[13px] font-semibold text-ck-disabled">Files</p>
					<p className="truncate text-[11px] text-ck-faint">Coming soon</p>
				</div>
			</Card>
		</div>
	);
}

function SourceRow({
	source,
	onRefresh,
	onDelete,
	refreshing,
}: {
	source: Source;
	onRefresh: (id: string) => void;
	onDelete: (id: string) => void;
	refreshing: boolean;
}) {
	const type = sourceType(source);
	const status = STATUS_STYLE[sourceStatus(source)];
	const Icon = TYPE_ICON[type];
	// Only a qa source with real message provenance is "promoted from a reply";
	// a hand-written Q&A (no sourceMessageId) is not.
	const promoted = source.kind === "qa" && !!source.sourceMessageId;
	return (
		<div className="flex items-center gap-3 border-t border-ck-border px-4 py-3 first:border-t-0">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ck-chip text-ck-muted">
				<Icon className="size-4" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-[13.5px] font-medium text-ck-text">
					{source.url ?? source.title}
				</p>
				{promoted ? (
					<p className="truncate text-[11px] font-medium text-ck-accent">
						Promoted from a reply
					</p>
				) : (
					source.url &&
					source.title && (
						<p className="truncate text-[11px] text-ck-faint">{source.title}</p>
					)
				)}
			</div>
			<Badge
				tone="neutral"
				className="hidden w-16 justify-center sm:inline-flex"
			>
				{type}
			</Badge>
			<span className="hidden w-16 text-right text-[11px] text-ck-faint md:inline">
				{sourceItemLabel(source)}
			</span>
			<span
				className={cn(
					"hidden w-[88px] justify-center rounded-full px-2 py-1 text-[11px] font-semibold sm:inline-flex",
					status.className,
				)}
			>
				{status.label}
			</span>
			<span className="hidden w-16 text-right text-[11px] text-ck-faint lg:inline">
				{formatRelativeTime(source.createdAt)}
			</span>
			<div className="flex shrink-0 items-center gap-1">
				{source.url && (
					<Button
						variant="ghost"
						size="icon"
						className="text-ck-faint hover:text-ck-text"
						onClick={() => onRefresh(source.id)}
						disabled={refreshing}
						aria-label={`Recrawl ${source.url}`}
					>
						<RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
					</Button>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="text-ck-faint hover:bg-ck-warn/10 hover:text-ck-warn"
					onClick={() => onDelete(source.id)}
					aria-label={`Delete ${source.url ?? source.title}`}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</div>
	);
}

export function SourcesPanel({
	sources,
	isLoading,
	onAddUrl,
	onAddText,
	onAddQa,
	onRefresh,
	onDelete,
	addUrlPending,
	addTextPending,
	addQaPending,
	refreshingId,
}: {
	sources: Source[];
	isLoading: boolean;
	onAddUrl: (url: string) => void;
	onAddText: (input: { title?: string; content: string }) => void;
	onAddQa: (input: { question: string; answer: string }) => void;
	onRefresh: (id: string) => void;
	onDelete: (id: string) => void;
	addUrlPending: boolean;
	addTextPending: boolean;
	addQaPending: boolean;
	refreshingId: string | null;
}) {
	return (
		<div className="flex flex-col gap-5">
			<AddSource
				onAddUrl={onAddUrl}
				onAddText={onAddText}
				onAddQa={onAddQa}
				urlPending={addUrlPending}
				textPending={addTextPending}
				qaPending={addQaPending}
			/>

			{sources.length > 0 && <TypeRollup sources={sources} />}

			{isLoading ? (
				<Card className="p-4">
					<div className="h-5 w-1/3 animate-pulse rounded bg-ck-chip" />
				</Card>
			) : sources.length === 0 ? (
				<Card className="flex flex-col items-center gap-2 border-dashed p-8 text-center">
					<span className="flex size-9 items-center justify-center rounded-[10px] bg-ck-chip text-ck-faint">
						<Globe className="size-4" />
					</span>
					<p className="text-sm font-semibold text-ck-text">No sources yet</p>
					<p className="text-xs text-ck-faint">
						Add a website, Q&amp;A pair, or text snippet so your agent can
						answer from your content.
					</p>
				</Card>
			) : (
				<Card>
					{/* Column header (sm+). Items + Added narrow in at md/lg. */}
					<div className="hidden items-center gap-3 border-b border-ck-border px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-ck-faint sm:flex">
						<span className="size-8 shrink-0" />
						<span className="flex-1">Source</span>
						<span className="w-16 text-center">Type</span>
						<span className="hidden w-16 text-right md:inline">Items</span>
						<span className="w-[88px] text-center">Status</span>
						<span className="hidden w-16 text-right lg:inline">Added</span>
						<span className="w-[72px]" />
					</div>
					{sources.map((s) => (
						<SourceRow
							key={s.id}
							source={s}
							onRefresh={onRefresh}
							onDelete={onDelete}
							refreshing={refreshingId === s.id}
						/>
					))}
				</Card>
			)}
		</div>
	);
}
