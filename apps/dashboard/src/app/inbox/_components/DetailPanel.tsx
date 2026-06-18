"use client";

import {
	Archive,
	ArchiveRestore,
	Clock,
	Globe,
	Mail,
	MessageCircle,
	Monitor,
	Star,
	Trash2,
	TriangleAlert,
	User,
} from "lucide-react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
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
		<div className="flex flex-col gap-3 border-t px-4 py-4 first:border-t-0">
			<h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
			<span className="mt-0.5 text-muted-foreground">{icon}</span>
			<div className="min-w-0">
				<p className="text-xs font-medium text-muted-foreground">{label}</p>
				<p
					className={cn(
						"break-words text-sm text-foreground",
						mono && "font-mono text-xs",
					)}
				>
					{value}
				</p>
			</div>
		</div>
	);
}

export function DetailPanel({
	conversation,
	onArchive,
	onDelete,
	archiving,
	deleting,
}: {
	conversation: Conversation;
	onArchive: () => void;
	onDelete: () => void;
	archiving: boolean;
	deleting: boolean;
}) {
	const archived = Boolean(conversation.archivedAt);
	const device = parseDevice(conversation.userAgent);

	return (
		<div className="flex min-h-0 flex-col">
			<div className="flex flex-col items-center gap-3 border-b px-6 py-6">
				<span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
					{initials(conversation.name)}
				</span>
				<div className="text-center">
					<p className="text-sm font-semibold">
						{conversation.name ?? "Anonymous"}
					</p>
					{conversation.email && (
						<p className="mt-0.5 break-all text-xs text-muted-foreground">
							{conversation.email}
						</p>
					)}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{conversation.escalatedAt && (
					<div className="m-4 rounded-lg bg-amber-500/10 p-3">
						<div className="flex items-center gap-2">
							<TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
							<span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
								Escalated to a human
							</span>
						</div>
						<p className="mt-1 text-xs text-amber-700/80 dark:text-amber-500">
							{formatFullDate(conversation.escalatedAt)}
						</p>
					</div>
				)}

				<Section title="Contact details">
					<Field
						icon={<User className="size-4" />}
						label="Name"
						value={conversation.name ?? "Not provided"}
					/>
					<Field
						icon={<Mail className="size-4" />}
						label="Email"
						value={conversation.email ?? "Not provided"}
					/>
				</Section>

				<Section title="Session info">
					<Field
						icon={<Clock className="size-4" />}
						label="Started"
						value={formatFullDate(conversation.createdAt)}
					/>
					<Field
						icon={<MessageCircle className="size-4" />}
						label="Messages"
						value={conversation.messageCount}
					/>
				</Section>

				<Section title="Visitor device">
					<Field
						icon={<Monitor className="size-4" />}
						label="Device"
						value={device ?? "Unknown"}
					/>
					<Field
						icon={<Globe className="size-4" />}
						label="IP address"
						value={conversation.ipAddress ?? "Unknown"}
						mono
					/>
				</Section>

				<Section title="Rating">
					{/* Conversation-level CSAT (1–5), prompted on widget close — distinct
					    from the per-message thumbs shown in the thread. */}
					{conversation.csatRating != null ? (
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-0.5">
								{[1, 2, 3, 4, 5].map((n) => (
									<Star
										key={n}
										className={cn(
											"size-4",
											n <= conversation.csatRating!
												? "text-amber-500"
												: "text-muted-foreground/30",
										)}
										fill={
											n <= conversation.csatRating! ? "currentColor" : "none"
										}
									/>
								))}
							</div>
							<span className="text-sm font-medium text-foreground">
								{conversation.csatRating} / 5
							</span>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">Not rated</p>
					)}
				</Section>
			</div>

			<div className="flex flex-col gap-2 border-t p-4">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full"
					disabled={archiving}
					onClick={onArchive}
				>
					{archived ? (
						<>
							<ArchiveRestore />
							Unarchive
						</>
					) : (
						<>
							<Archive />
							Archive
						</>
					)}
				</Button>

				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<Trash2 />
							Delete conversation
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete conversation?</AlertDialogTitle>
							<AlertDialogDescription>
								This permanently deletes the conversation and all its messages.
								This can&apos;t be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								className={cn(buttonVariants({ variant: "destructive" }))}
								disabled={deleting}
								onClick={onDelete}
							>
								{deleting ? "Deleting…" : "Delete"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</div>
	);
}
