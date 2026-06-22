"use client";

import {
	Check,
	Clock,
	Globe,
	Mail,
	MessageCircle,
	Monitor,
	RotateCcw,
	Star,
	Trash2,
	TriangleAlert,
	User,
} from "lucide-react";
import { useState } from "react";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ds";
import { cn } from "@/lib/utils";

import { formatFullDate, initials, parseDevice } from "./format";
import type { Conversation } from "./types";

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 border-t border-ck-border px-4 py-4 first:border-t-0">
			<h3 className="text-[11px] font-semibold uppercase tracking-wider text-ck-faint">
				{title}
			</h3>
			{children}
		</div>
	);
}

function Field({
	icon,
	label,
	value,
	mono,
}: {
	icon: React.ReactNode;
	label: string;
	value: React.ReactNode;
	mono?: boolean;
}) {
	return (
		<div className="flex items-start gap-3">
			<span className="mt-0.5 text-ck-faint [&_svg]:size-4">{icon}</span>
			<div className="min-w-0">
				<p className="text-xs font-medium text-ck-faint">{label}</p>
				<p
					className={cn(
						"break-words text-sm text-ck-text",
						mono && "font-mono text-xs",
					)}
				>
					{value}
				</p>
			</div>
		</div>
	);
}

/** Visitor-context fields the widget does NOT capture yet. Shown as an honest
 * empty block — designed, not wired — never with a guessed value. */
const ROADMAP_FIELDS = [
	"Location",
	"Local time",
	"First seen",
	"Current page",
	"Referrer",
	"Pages viewed",
	"Channel",
] as const;

export function DetailPanel({
	conversation,
	onResolve,
	onDelete,
	resolving,
	deleting,
}: {
	conversation: Conversation;
	/** Toggle resolved (over PATCH {archived}); optimistic + reversible. */
	onResolve: () => void;
	/** Permanently delete — fired from the confirm dialog (non-optimistic). */
	onDelete: () => void;
	resolving: boolean;
	deleting: boolean;
}) {
	const resolved = Boolean(conversation.archivedAt);
	const device = parseDevice(conversation.userAgent);
	const [confirmOpen, setConfirmOpen] = useState(false);

	return (
		<div className="flex min-h-0 flex-col bg-ck-sidebar">
			<div className="flex flex-col items-center gap-3 border-b border-ck-border px-6 py-6">
				<span className="flex size-16 items-center justify-center rounded-2xl bg-ck-accent text-lg font-bold text-white">
					{initials(conversation.name)}
				</span>
				<div className="text-center">
					<p className="text-sm font-bold text-ck-text">
						{conversation.name ?? "Anonymous"}
					</p>
					{conversation.email && (
						<p className="mt-0.5 break-all text-xs text-ck-faint">
							{conversation.email}
						</p>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{conversation.escalatedAt && (
					<div className="m-4 rounded-[10px] bg-ck-warn/12 p-3">
						<div className="flex items-center gap-2">
							<TriangleAlert className="size-4 text-ck-warn" />
							<span className="text-xs font-semibold text-ck-warn">
								Escalated to a human
							</span>
						</div>
						<p className="mt-1 text-xs text-ck-warn/80">
							{formatFullDate(conversation.escalatedAt)}
						</p>
					</div>
				)}

				{/* LIVE — real captured fields only. */}
				<Section title="Contact">
					<Field
						icon={<User />}
						label="Name"
						value={conversation.name ?? "Not provided"}
					/>
					<Field
						icon={<Mail />}
						label="Email"
						value={conversation.email ?? "Not provided"}
					/>
				</Section>

				<Section title="Session">
					<Field
						icon={<Clock />}
						label="Started"
						value={formatFullDate(conversation.createdAt)}
					/>
					<Field
						icon={<MessageCircle />}
						label="Messages"
						value={conversation.messageCount}
					/>
					<Field
						icon={<Monitor />}
						label="Device"
						value={device ?? "Unknown"}
					/>
					<Field
						icon={<Globe />}
						label="IP address"
						value={conversation.ipAddress ?? "Unknown"}
						mono
					/>
				</Section>

				<Section title="CSAT rating">
					{conversation.csatRating != null ? (
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-0.5">
								{[1, 2, 3, 4, 5].map((n) => (
									<Star
										key={n}
										className={cn(
											"size-4",
											n <= conversation.csatRating!
												? "text-ck-warn"
												: "text-ck-disabled",
										)}
										fill={
											n <= conversation.csatRating! ? "currentColor" : "none"
										}
									/>
								))}
							</div>
							<span className="text-sm font-medium text-ck-text">
								{conversation.csatRating} / 5
							</span>
						</div>
					) : (
						<p className="text-sm text-ck-faint">Not rated</p>
					)}
				</Section>

				{/* ROADMAP — honest empty. The widget doesn't capture these yet; show
				    the intended fields with em-dashes, never a fabricated value. */}
				<div className="m-4 rounded-[14px] border border-dashed border-ck-border p-4">
					<h3 className="text-[11px] font-semibold uppercase tracking-wider text-ck-faint">
						Visitor context
					</h3>
					<p className="mt-1 text-[11px] leading-relaxed text-ck-faint">
						Not captured yet — never show a guessed value.
					</p>
					<div className="mt-3 flex flex-col gap-2">
						{ROADMAP_FIELDS.map((label) => (
							<div
								key={label}
								className="flex items-center justify-between gap-3"
							>
								<span className="text-xs text-ck-faint">{label}</span>
								<span className="text-sm font-medium text-ck-disabled">—</span>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-2 border-t border-ck-border p-4">
				<Button
					variant="outline"
					size="sm"
					className="w-full"
					disabled={resolving}
					onClick={onResolve}
				>
					{resolved ? (
						<>
							<RotateCcw className="size-4" />
							Reopen
						</>
					) : (
						<>
							<Check className="size-4" />
							Resolve
						</>
					)}
				</Button>

				<Button
					variant="ghost"
					size="sm"
					className="w-full text-ck-warn hover:bg-ck-warn/10 hover:text-ck-warn"
					onClick={() => setConfirmOpen(true)}
				>
					<Trash2 className="size-4" />
					Delete conversation
				</Button>

				{/*
				 * Controlled AlertDialog + a plain submit Button — NOT AlertDialogAction,
				 * which auto-closes on click and (under React 18) unmounts before the
				 * handler fires (the dead-button bug). Delete is non-optimistic: the
				 * dialog stays open showing "Deleting…" until the server confirms, so a
				 * failed delete surfaces instead of reading as success.
				 */}
				<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete conversation?</AlertDialogTitle>
							<AlertDialogDescription>
								This permanently deletes the conversation and all its messages.
								This can&apos;t be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel type="button">Cancel</AlertDialogCancel>
							<Button
								variant="primary"
								className="bg-ck-warn hover:bg-ck-warn/90"
								disabled={deleting}
								onClick={onDelete}
							>
								{deleting ? "Deleting…" : "Delete"}
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
