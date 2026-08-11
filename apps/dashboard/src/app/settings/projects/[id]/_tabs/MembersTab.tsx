"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, Button, Card, Field, dsInputClass } from "@/components/ds";
import { RoleGate } from "@/components/role-gate";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { ApiError, describeApiError } from "@/lib/api";
import {
	INVITES_KEY,
	MEMBERS_KEY,
	createInvite,
	describeInviteError,
	fetchInvites,
	fetchMembers,
	removeMember,
	revokeInvite,
	roleLabel,
	seatSummary,
	updateMemberRole,
	type AssignableRole,
	type CreatedInvite,
	type WorkspaceMember,
} from "@/lib/members";
import { dropById, mapById, useOptimisticMutation } from "@/lib/optimistic";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace";

function describeError(error: unknown, fallback: string) {
	const code = error instanceof ApiError ? error.code : undefined;
	return describeInviteError(code) ?? describeApiError(error, fallback);
}

/** One current member: identity, role, and the controls the viewer may use. */
function MemberRow({
	member,
	isSelf,
	canAdminister,
	onRoleChange,
	onRemove,
	busy,
}: {
	member: WorkspaceMember;
	isSelf: boolean;
	canAdminister: boolean;
	onRoleChange: (role: AssignableRole) => void;
	onRemove: () => void;
	busy: boolean;
}) {
	return (
		<div className="flex items-center gap-3 border-b border-ck-border p-4 last:border-b-0">
			<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ck-accent text-[11.5px] font-bold text-white">
				{member.email.slice(0, 2).toUpperCase()}
			</span>
			{/* min-w floor (not min-w-0): a full-width sibling — the role select's
			    dsInputClass carries w-full — must never flex this block down to
			    zero and hide who the row is about. */}
			<div className="min-w-24 flex-1">
				<p className="truncate text-[13.5px] font-semibold text-ck-text">
					{member.name || member.email}
				</p>
				<p className="truncate text-[11px] text-ck-faint">
					{member.email}
					{isSelf && " · You"}
				</p>
			</div>
			{/* An owner is shown as a badge, never an editable select: ownership
			    isn't assignable here (R3) and the server refuses it anyway. */}
			{canAdminister && member.role !== "owner" ? (
				<select
					aria-label={`Role for ${member.email}`}
					// cn (tailwind-merge) so w-28 actually beats dsInputClass's
					// w-full — with a plain template literal both classes emit and
					// stylesheet order let w-full win, which ate the whole row.
					className={cn(dsInputClass, "h-8 w-28 py-0 text-[12.5px]")}
					value={member.role}
					disabled={busy}
					onChange={(e) => onRoleChange(e.target.value as AssignableRole)}
				>
					<option value="admin">Admin</option>
					<option value="agent">Agent</option>
				</select>
			) : (
				<Badge tone={member.role === "owner" ? "accent" : "neutral"}>
					{roleLabel(member.role)}
				</Badge>
			)}
			{(canAdminister || isSelf) && (
				<Button
					variant="ghost"
					size="sm"
					disabled={busy}
					onClick={onRemove}
					className="shrink-0"
				>
					{isSelf ? "Leave" : "Remove"}
				</Button>
			)}
		</div>
	);
}

/**
 * Members of this workspace — the roster with roles, pending invitations, and
 * the invite form. Workspace-level rather than project-level: every project in
 * the workspace shares these people.
 *
 * The invite link is rendered ONCE, straight after creation, from component
 * state. The API returns it in the create response and never again — no list
 * or preview call can reproduce it — so this is the only moment it can be
 * copied, and nothing persists it.
 */
export function MembersTab({
	/** The SIGNED-IN user's own email (from /api/account) — used to mark "You"
	 * and to keep the owner from administering their own row. */
	currentUserEmail,
}: {
	currentUserEmail: string | null;
}) {
	const qc = useQueryClient();
	const { workspaceId, role, canManage } = useWorkspace();
	const isOwner = role === "owner";
	const [email, setEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<AssignableRole>("agent");
	const [justCreated, setJustCreated] = useState<CreatedInvite | null>(null);
	const [copied, setCopied] = useState(false);

	const membersQ = useQuery({
		queryKey: MEMBERS_KEY(workspaceId ?? ""),
		queryFn: () => fetchMembers(workspaceId!),
		enabled: Boolean(workspaceId),
	});
	const invitesQ = useQuery({
		queryKey: INVITES_KEY(workspaceId ?? ""),
		queryFn: () => fetchInvites(workspaceId!),
		// Pending invites are admin-only server-side; asking as an agent would
		// only 403, so don't ask.
		enabled: Boolean(workspaceId) && canManage,
	});

	const invite = useMutation({
		mutationFn: () =>
			createInvite(workspaceId!, { email: email.trim(), role: inviteRole }),
		onSuccess: (created) => {
			setJustCreated(created);
			setCopied(false);
			setEmail("");
			track(ANALYTICS_EVENTS.inviteSent, { role: inviteRole });
			toast.success(
				created.emailSent
					? `Invitation sent to ${created.invite.email}`
					: "Invitation created — the email didn't send, so copy the link below",
			);
			void qc.invalidateQueries({ queryKey: INVITES_KEY(workspaceId!) });
		},
		onError: (error) =>
			toast.error(describeError(error, "Couldn't send that invitation.")),
	});

	const revoke = useOptimisticMutation({
		queryKey: INVITES_KEY(workspaceId ?? ""),
		mutationFn: (inviteId: string) => revokeInvite(workspaceId!, inviteId),
		apply: (prev, inviteId) => dropById(prev, "invites", inviteId),
		onError: (error) =>
			toast.error(describeError(error, "Couldn't revoke that invitation.")),
	});

	const changeRole = useOptimisticMutation({
		queryKey: MEMBERS_KEY(workspaceId ?? ""),
		mutationFn: (vars: { userId: string; role: AssignableRole }) =>
			updateMemberRole(workspaceId!, vars.userId, vars.role),
		apply: (prev, vars) =>
			mapById<WorkspaceMember & { id: string }>(
				prev,
				"members",
				vars.userId,
				(m) => ({ ...m, role: vars.role }),
			),
		onError: (error) =>
			toast.error(describeError(error, "Couldn't change that role.")),
	});

	// Removal is deliberately NOT optimistic: it's destructive and
	// server-guarded (last_owner / last_workspace), so the row stays until the
	// server agrees — the same reasoning as workspace delete.
	const remove = useMutation({
		mutationFn: (userId: string) => removeMember(workspaceId!, userId),
		onSuccess: () => {
			toast.success("Member removed");
			void qc.invalidateQueries({ queryKey: MEMBERS_KEY(workspaceId!) });
		},
		onError: (error) =>
			toast.error(describeError(error, "Couldn't remove that member.")),
	});

	const data = membersQ.data;
	const invites = invitesQ.data?.invites ?? [];
	const seatsFull =
		data !== undefined &&
		data.seats.max !== null &&
		data.seats.used >= data.seats.max;

	// mapById/dropById key off `id`; members are keyed by userId, so mirror it.
	const rows = (data?.members ?? []).map((m) => ({ ...m, id: m.userId }));
	const busy = changeRole.isPending || remove.isPending;

	return (
		<div className="flex flex-col gap-4">
			<Card className="overflow-hidden">
				<div className="border-b border-ck-border p-5">
					<h3 className="text-[15px] font-bold text-ck-text">
						Members of this workspace
					</h3>
					<p className="text-sm text-ck-muted">
						{data
							? seatSummary(data.seats)
							: "Everyone here can see this workspace's projects and inbox."}
					</p>
				</div>

				{membersQ.isLoading && (
					<p className="p-4 text-sm text-ck-muted">Loading members…</p>
				)}
				{membersQ.isError && (
					<p className="p-4 text-sm text-ck-muted">
						{describeError(membersQ.error, "Couldn't load members.")}
					</p>
				)}
				{rows.map((m) => (
					<MemberRow
						key={m.userId}
						member={m}
						isSelf={m.email === currentUserEmail}
						canAdminister={isOwner && m.email !== currentUserEmail}
						busy={busy}
						onRoleChange={(next) =>
							changeRole.mutate({ userId: m.userId, role: next })
						}
						onRemove={() => remove.mutate(m.userId)}
					/>
				))}
			</Card>

			<RoleGate>
				<Card className="overflow-hidden">
					<div className="border-b border-ck-border p-5">
						<h3 className="text-[15px] font-bold text-ck-text">
							Invite a teammate
						</h3>
						<p className="text-sm text-ck-muted">
							They get an email with a personal link that works once and expires
							in 7 days.
						</p>
					</div>

					<form
						className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
						onSubmit={(e) => {
							e.preventDefault();
							if (email.trim()) invite.mutate();
						}}
					>
						<Field label="Email address" className="flex-1">
							{(id) => (
								<input
									id={id}
									type="email"
									required
									autoComplete="off"
									placeholder="teammate@company.com"
									className={dsInputClass}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							)}
						</Field>
						<Field label="Role" className="sm:w-40">
							{(id) => (
								<select
									id={id}
									className={dsInputClass}
									value={inviteRole}
									onChange={(e) =>
										setInviteRole(e.target.value as AssignableRole)
									}
								>
									<option value="agent">Agent</option>
									{/* Only owners may mint admin invites (R3); the server
									    enforces it, so hiding it avoids a certain 403. */}
									{isOwner && <option value="admin">Admin</option>}
								</select>
							)}
						</Field>
						<Button
							type="submit"
							disabled={invite.isPending || !email.trim() || seatsFull}
							className="shrink-0"
						>
							<UserPlus className="size-4" />
							{invite.isPending ? "Sending…" : "Send invitation"}
						</Button>
					</form>

					{seatsFull && (
						<p className="px-4 pb-4 text-sm text-ck-muted">
							Every seat on your plan is taken. Upgrade in Billing to invite
							more teammates.
						</p>
					)}

					{justCreated && (
						<div className="mx-4 mb-4 rounded-[10px] border border-ck-border bg-ck-chip p-3">
							<p className="text-[12.5px] font-semibold text-ck-text">
								Invitation link for {justCreated.invite.email}
							</p>
							<p className="mt-0.5 text-[11px] text-ck-faint">
								Shown once — copy it now if you want to send it yourself.
							</p>
							<div className="mt-2 flex items-center gap-2">
								<code className="min-w-0 flex-1 truncate rounded bg-ck-card px-2 py-1.5 text-[11.5px] text-ck-muted">
									{justCreated.link}
								</code>
								<Button
									variant="outline"
									size="sm"
									className="shrink-0"
									onClick={() => {
										void navigator.clipboard?.writeText(justCreated.link);
										setCopied(true);
										toast.success("Invitation link copied");
									}}
								>
									{copied ? (
										<Check className="size-3.5" />
									) : (
										<Copy className="size-3.5" />
									)}
									{copied ? "Copied" : "Copy"}
								</Button>
							</div>
						</div>
					)}

					{invites.length > 0 && (
						<div className="border-t border-ck-border">
							<p className="px-4 pt-4 text-[12.5px] font-semibold text-ck-text">
								Pending invitations
							</p>
							{invites.map((inv) => (
								<div key={inv.id} className="flex items-center gap-3 px-4 py-3">
									<Mail className="size-4 shrink-0 text-ck-faint" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-[13px] text-ck-text">
											{inv.email}
										</p>
										<p className="truncate text-[11px] text-ck-faint">
											Invited by {inv.inviterName ?? "a former teammate"}
										</p>
									</div>
									<Badge tone="outline">{roleLabel(inv.role)}</Badge>
									<Button
										variant="ghost"
										size="sm"
										className="shrink-0"
										disabled={revoke.isPending}
										onClick={() => revoke.mutate(inv.id)}
									>
										Revoke
									</Button>
								</div>
							))}
						</div>
					)}
				</Card>
			</RoleGate>
		</div>
	);
}
