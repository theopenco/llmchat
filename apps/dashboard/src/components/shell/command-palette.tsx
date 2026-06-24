"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderKanban, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useWorkspace } from "@/lib/workspace";

const MIN_QUERY_LENGTH = 2;

type SearchMatch = { field: "body" | "name" | "email"; snippet: string };

interface ConversationResult {
	id: string;
	projectId: string;
	projectName: string;
	name: string | null;
	email: string | null;
	match: SearchMatch;
}

interface ProjectResult {
	id: string;
	name: string;
}

interface SearchResponse {
	conversations: ConversationResult[];
	projects: ProjectResult[];
}

/**
 * ⌘K command palette: workspace-wide search across conversations (visitor name,
 * email, message body) and projects, backed by GET /api/search. Controlled by
 * the shell (open state + the ⌘K listener live there; the TopBar search button
 * also opens it).
 *
 * Honesty rail: results are the server's real rows only. While a query is in
 * flight we say "Searching…"; the "No matches" empty state shows ONLY after a
 * settled query (never mid-debounce, never for a too-short term). Selecting a
 * result routes to it — conversations deep-link into the inbox thread, projects
 * to their settings page.
 */
export function CommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const { workspaceId } = useWorkspace();
	const [query, setQuery] = useState("");
	const trimmed = query.trim();
	const debounced = useDebouncedValue(trimmed, 250);
	const active = debounced.length >= MIN_QUERY_LENGTH;

	// Reset the term whenever the palette closes so it reopens clean.
	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	const { data, isFetching } = useQuery({
		queryKey: ["global-search", workspaceId, debounced],
		enabled: open && !!workspaceId && active,
		// Forward react-query's signal so a superseded keystroke aborts the
		// in-flight request rather than racing it.
		queryFn: ({ signal }) =>
			api<SearchResponse>(`/api/search?q=${encodeURIComponent(debounced)}`, {
				workspaceId: workspaceId!,
				signal,
			}),
		// Keep the previous results on screen while the next query for the SAME
		// workspace resolves (no empty flash between keystrokes); drop them on a
		// workspace switch so another workspace's rows never linger.
		placeholderData: (prev, prevQuery) =>
			prevQuery && prevQuery.queryKey[1] === workspaceId ? prev : undefined,
	});

	function close() {
		onOpenChange(false);
	}

	function openConversation(r: ConversationResult) {
		close();
		// Both ids are required: the inbox thread is keyed by (projectId,
		// conversationId), and every conversation API is /projects/:p/conversations/:c.
		router.push(`/inbox?project=${r.projectId}&c=${r.id}`);
	}

	function openProject(r: ProjectResult) {
		close();
		router.push(`/settings/projects/${r.id}`);
	}

	// Display gates on the LIVE input, not just the debounced term: after close
	// resets `query` to "", `typing` is false on reopen even though `debounced`
	// lags 250ms — so a previous search's still-cached rows never flash.
	const typing = trimmed.length >= MIN_QUERY_LENGTH;
	// `data` is keyed on `debounced`; while the live term is ahead (or a fetch is
	// in flight) it reflects an OLDER term — treat as pending, not settled.
	const pending = typing && (isFetching || debounced !== trimmed);
	const conversations = typing ? (data?.conversations ?? []) : [];
	const projects = typing ? (data?.projects ?? []) : [];
	const hasResults = conversations.length > 0 || projects.length > 0;
	// "No matches" is honest only once the query for the CURRENT term has settled —
	// never while typing/debouncing/fetching, never for a sub-2-char term.
	const settledEmpty = typing && !pending && !!data && !hasResults;

	return (
		// shouldFilter={false}: the server already ranked + filtered; cmdk must not
		// re-filter our results by the raw input (it would hide valid body matches).
		<CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
			<CommandInput
				value={query}
				onValueChange={setQuery}
				placeholder="Search conversations & projects…"
			/>
			<CommandList>
				{!typing && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						Type at least {MIN_QUERY_LENGTH} characters to search.
					</div>
				)}
				{pending && !hasResults && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						Searching…
					</div>
				)}
				{settledEmpty && <CommandEmpty>No matches.</CommandEmpty>}

				{conversations.length > 0 && (
					<CommandGroup heading="Conversations">
						{conversations.map((r) => (
							<CommandItem
								key={r.id}
								value={`conversation-${r.id}`}
								onSelect={() => openConversation(r)}
								className="flex items-start gap-2"
							>
								<MessageSquare className="mt-0.5 shrink-0 text-muted-foreground" />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate font-medium">
											{r.name || r.email || "Anonymous visitor"}
										</span>
										<span className="shrink-0 text-xs text-muted-foreground">
											{r.projectName}
										</span>
									</div>
									<p className="truncate text-xs text-muted-foreground">
										{r.match.snippet}
									</p>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{projects.length > 0 && (
					<CommandGroup heading="Projects">
						{projects.map((r) => (
							<CommandItem
								key={r.id}
								value={`project-${r.id}`}
								onSelect={() => openProject(r)}
							>
								<FolderKanban className="text-muted-foreground" />
								<span className="truncate">{r.name}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	);
}
