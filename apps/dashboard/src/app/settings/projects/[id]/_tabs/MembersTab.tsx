"use client";

import { UserPlus } from "lucide-react";

import { Badge, Button, Card } from "@/components/ds";

/**
 * Members is workspace-level and mostly roadmap: the real owner is shown, but
 * invitations + role management aren't wired yet (#96). Honest scaffold — the
 * real owner, an explicit "not wired yet" note, a disabled Invite, and NO
 * fabricated teammates (same treatment as the inbox visitor-context card).
 */
export function MembersTab({
	ownerEmail,
	role,
}: {
	ownerEmail: string | null;
	role: string | null;
}) {
	const initials = (ownerEmail ?? "?").slice(0, 2).toUpperCase();
	return (
		<Card className="overflow-hidden">
			<div className="flex items-center justify-between gap-4 border-b border-ck-border p-5">
				<div>
					<h3 className="text-[15px] font-bold text-ck-text">Members</h3>
					<p className="text-sm text-ck-muted">
						Invitations &amp; roles aren&apos;t wired yet — this is the owner on
						file.
					</p>
				</div>
				{/* Disabled, not a working fake. */}
				<Button variant="outline" disabled className="shrink-0">
					<UserPlus className="size-4" />
					Invite
				</Button>
			</div>

			{ownerEmail && (
				<div className="flex items-center gap-3 p-4">
					<span className="flex size-9 items-center justify-center rounded-full bg-ck-accent text-[11.5px] font-bold text-white">
						{initials}
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate text-[13.5px] font-semibold text-ck-text">
							{ownerEmail}
						</p>
						<p className="text-[11px] text-ck-faint">You</p>
					</div>
					<Badge tone="accent">
						{role ? role[0].toUpperCase() + role.slice(1) : "Member"}
					</Badge>
				</div>
			)}
		</Card>
	);
}
