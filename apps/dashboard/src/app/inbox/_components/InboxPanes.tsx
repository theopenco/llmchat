"use client";

import { ChevronLeft, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface InboxPanesProps {
	/** A conversation is open — drives one-pane-at-a-time on mobile. */
	hasSelection: boolean;
	/** Return to the list (mobile back button). */
	onBack: () => void;
	/** Contact-details sheet (mobile/tablet) open state. */
	detailsOpen: boolean;
	onDetailsOpenChange: (open: boolean) => void;
	/** Conversation list pane (project switcher + list). */
	list: React.ReactNode;
	/** Thread header content (avatar / name / subtitle / escalated badge). */
	threadHeader?: React.ReactNode;
	/** Thread body — the reused MessageThread, or a loading state. */
	threadBody?: React.ReactNode;
	/** Pinned reply composer. */
	composer?: React.ReactNode;
	/** Contact-details panel; null when nothing is open. */
	details?: React.ReactNode;
	/** Shown in the thread pane on tablet/desktop when nothing is open. */
	emptyState: React.ReactNode;
	/** Shown in the details aside on desktop when nothing is open. */
	detailsEmptyState: React.ReactNode;
}

/**
 * Responsive inbox frame — the single source of truth for how the list, thread,
 * and contact-details panes coexist across breakpoints. No mobile fork: the same
 * nodes are arranged differently by CSS.
 *
 * - mobile (< md): one pane at a time. List full-width; opening a conversation
 *   swaps to the thread (with a back button); details live in a right Sheet.
 * - tablet (md–lg): two panes (list + thread); details still in the Sheet.
 * - desktop (≥ lg): three panes — list + thread + a permanent details aside.
 *
 * Both panes stay mounted (visibility is CSS, not conditional rendering), so the
 * thread keeps its scroll position and the stick-to-bottom hook never
 * re-initialises on a pane switch.
 */
export function InboxPanes({
	hasSelection,
	onBack,
	detailsOpen,
	onDetailsOpenChange,
	list,
	threadHeader,
	threadBody,
	composer,
	details,
	emptyState,
	detailsEmptyState,
}: InboxPanesProps) {
	return (
		<div className="flex min-h-0 flex-1">
			{/* Left — conversation list (full-width on mobile, fixed rail from md) */}
			<div
				data-pane="list"
				className={cn(
					"min-h-0 flex-col border-r border-ck-border md:w-80 md:shrink-0",
					hasSelection ? "hidden md:flex" : "flex w-full",
				)}
			>
				{list}
			</div>

			{/* Center — thread (full-screen on mobile when a conversation is open) */}
			<section
				data-pane="thread"
				className={cn(
					"min-h-0 min-w-0 flex-1 flex-col",
					hasSelection ? "flex" : "hidden md:flex",
				)}
			>
				{hasSelection ? (
					<>
						<div className="flex items-center gap-2 border-b border-ck-border px-4 py-3 sm:px-6">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="-ml-1 shrink-0 md:hidden"
								onClick={onBack}
								aria-label="Back to conversations"
							>
								<ChevronLeft />
							</Button>
							<div className="flex min-w-0 flex-1 items-center gap-3">
								{threadHeader}
							</div>
							{details && (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="shrink-0 lg:hidden"
									onClick={() => onDetailsOpenChange(true)}
									aria-label="Conversation details"
								>
									<Info />
								</Button>
							)}
						</div>
						{threadBody}
						{composer}
					</>
				) : (
					emptyState
				)}
			</section>

			{/* Right — details aside (desktop only) */}
			<aside
				data-pane="details"
				className="hidden w-72 shrink-0 border-l border-ck-border lg:flex lg:flex-col"
			>
				{details ?? detailsEmptyState}
			</aside>

			{/* Details as a Sheet on mobile/tablet — never shown on desktop (lg:hidden,
			    and its trigger is lg:hidden too). */}
			<Sheet open={detailsOpen} onOpenChange={onDetailsOpenChange}>
				<SheetContent
					side="right"
					className="w-full gap-0 overflow-y-auto p-0 sm:max-w-sm lg:hidden"
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Conversation details</SheetTitle>
						<SheetDescription>
							Contact, session, device, and rating for this conversation.
						</SheetDescription>
					</SheetHeader>
					{details}
				</SheetContent>
			</Sheet>
		</div>
	);
}
