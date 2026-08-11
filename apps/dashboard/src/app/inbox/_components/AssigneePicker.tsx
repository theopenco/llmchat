"use client";

import { Check, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { WorkspaceMember } from "@/lib/members";
import { cn } from "@/lib/utils";

import type { Assignee } from "./types";

export interface AssigneePickerProps {
	/** The workspace roster (shared members cache). */
	members: WorkspaceMember[];
	/** Current assignee of the open conversation; null when unassigned. */
	assignee: Assignee | null;
	/** The signed-in operator — drives the "Assign to me" shortcut. */
	currentUserId: string | null;
	/** Assign (a member) or unassign (null). Optimistic in the caller. */
	onAssign: (assignee: Assignee | null) => void;
	/** True while an assign/unassign is in flight. */
	pending?: boolean;
	/** Display name of who assigned the current assignee (from the members
	 * cache); shown as a plain title tooltip — the locked "cheap" treatment. */
	assignedByName?: string | null;
}

/**
 * Assignee combobox for the open conversation (#96) — replaces the dimmed
 * ROADMAP stub. Same shape as TagPicker: shadcn Popover + Command, purely
 * presentational with the mutation lifted to the inbox page. "Assign to me"
 * leads, then the searchable roster, then Unassign (only when assigned).
 * Feedback is the chip/label itself — deliberately no toast on success.
 */
export function AssigneePicker({
	members,
	assignee,
	currentUserId,
	onAssign,
	pending,
	assignedByName,
}: AssigneePickerProps) {
	const [open, setOpen] = useState(false);

	const pick = (member: WorkspaceMember) => {
		onAssign({
			userId: member.userId,
			name: member.name,
			assignedBy: currentUserId,
		});
		setOpen(false);
	};
	const self = members.find((m) => m.userId === currentUserId);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={pending}
					title={assignedByName ? `Assigned by ${assignedByName}` : undefined}
					className="h-8 gap-1.5 rounded-[10px] px-2.5 text-xs font-medium"
				>
					<UserPlus className="size-4" />
					<span className="hidden max-w-[9rem] truncate sm:inline">
						{assignee ? (assignee.name ?? "Assigned") : "Assign"}
					</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-60 p-0" align="end">
				<Command>
					<CommandInput placeholder="Search members…" />
					<CommandList>
						<CommandEmpty>No members found.</CommandEmpty>
						{self && assignee?.userId !== self.userId && (
							<>
								<CommandGroup>
									<CommandItem
										// A distinct value keeps this row from colliding with the
										// roster row for the same person in Command's matcher.
										value={`__me__${self.name}`}
										onSelect={() => pick(self)}
										className="gap-2 font-medium"
									>
										<UserPlus className="size-3.5 shrink-0" />
										Assign to me
									</CommandItem>
								</CommandGroup>
								<CommandSeparator />
							</>
						)}
						<CommandGroup>
							{members.map((m) => {
								const on = assignee?.userId === m.userId;
								return (
									<CommandItem
										key={m.userId}
										value={`${m.name} ${m.email}`}
										onSelect={() => pick(m)}
										className="gap-2"
									>
										<span className="flex-1 truncate">{m.name}</span>
										<span className="text-[10px] uppercase tracking-wide text-muted-foreground">
											{m.role}
										</span>
										<Check
											className={cn(
												"size-3.5 shrink-0",
												on ? "opacity-100" : "opacity-0",
											)}
										/>
									</CommandItem>
								);
							})}
						</CommandGroup>
						{assignee && (
							<>
								<CommandSeparator />
								<CommandGroup>
									<CommandItem
										value="__unassign__"
										onSelect={() => {
											onAssign(null);
											setOpen(false);
										}}
										className="gap-2 text-muted-foreground"
									>
										<UserMinus className="size-3.5 shrink-0" />
										Unassign
									</CommandItem>
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
