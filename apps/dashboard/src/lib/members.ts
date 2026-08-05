import { api } from "./api";

/** Workspace-scoped react-query keys. Both lists are per workspace, so the
 * workspace id is part of the key — switching workspaces must not show the
 * previous one's roster from cache. */
export const MEMBERS_KEY = (workspaceId: string) => ["members", workspaceId];
export const INVITES_KEY = (workspaceId: string) => ["invites", workspaceId];

export type MemberRole = "owner" | "admin" | "agent";
/** Roles an invite or a role change may target — owner is never invitable and
 * ownership is not transferable here (docs/goals/invites.md R3). */
export type AssignableRole = "admin" | "agent";

export interface WorkspaceMember {
	userId: string;
	role: MemberRole;
	createdAt: number;
	name: string;
	email: string;
}

export interface MemberList {
	members: WorkspaceMember[];
	/** `max: null` means unlimited (Scale / internal). */
	seats: { used: number; max: number | null };
}

export interface PendingInvite {
	id: string;
	email: string;
	role: AssignableRole;
	createdAt: number;
	expiresAt: number;
	inviterName: string | null;
}

export interface CreatedInvite {
	invite: Omit<PendingInvite, "inviterName">;
	/** The one-time invite link. Returned by CREATE only — it is never in the
	 * list or preview responses, so it lives in component state for exactly as
	 * long as the operator needs to copy it, and is never persisted or logged. */
	link: string;
	emailSent: boolean;
}

export function fetchMembers(workspaceId: string) {
	return api<MemberList>("/api/members", { workspaceId });
}

export function fetchInvites(workspaceId: string) {
	return api<{ invites: PendingInvite[] }>("/api/invites", { workspaceId });
}

export function createInvite(
	workspaceId: string,
	body: { email: string; role: AssignableRole },
) {
	return api<CreatedInvite>("/api/invites", {
		method: "POST",
		body,
		workspaceId,
	});
}

export function revokeInvite(workspaceId: string, inviteId: string) {
	return api<{ ok: true }>(`/api/invites/${inviteId}/revoke`, {
		method: "POST",
		workspaceId,
	});
}

export function updateMemberRole(
	workspaceId: string,
	userId: string,
	role: AssignableRole,
) {
	return api<{ member: { userId: string; role: MemberRole } }>(
		`/api/members/${userId}`,
		{ method: "PATCH", body: { role }, workspaceId },
	);
}

export function removeMember(workspaceId: string, userId: string) {
	return api<{ ok: true }>(`/api/members/${userId}`, {
		method: "DELETE",
		workspaceId,
	});
}

export function previewInvite(token: string) {
	return api<{
		workspaceName: string;
		role: AssignableRole;
		email: string;
		inviterName: string | null;
	}>("/api/invites/preview", { method: "POST", body: { token } });
}

export function acceptInvite(token: string) {
	return api<{ workspaceId: string }>("/api/invites/accept", {
		method: "POST",
		body: { token },
	});
}

export function roleLabel(role: MemberRole) {
	return role[0]!.toUpperCase() + role.slice(1);
}

/** Seat usage as a sentence — "3 of 10 seats used", or the unlimited form. */
export function seatSummary(seats: MemberList["seats"]) {
	if (seats.max === null) return `${seats.used} members · unlimited seats`;
	return `${seats.used} of ${seats.max} seats used`;
}

/**
 * Map an invite/member API error code to an actionable sentence. Kept separate
 * from describeApiError because these codes are specific to this surface and
 * each one has a different next step for the operator or the invitee.
 */
export function describeInviteError(code: string | undefined): string | null {
	switch (code) {
		case "invite_expired":
			return "This invitation has expired. Ask for a new one.";
		case "invite_revoked":
			return "This invitation was revoked. Ask for a new one.";
		case "invite_used":
			return "This invitation has already been used. Ask for a new one.";
		case "invalid_invite":
			return "This invitation link isn't valid. Check you copied the whole link, or ask for a new one.";
		case "member_limit_reached":
			return "This workspace has no seats left. Ask an owner to upgrade the plan, then try again — the invitation still works.";
		case "already_member":
			return "You're already a member of this workspace.";
		case "last_owner":
			return "A workspace needs at least one owner. Make someone else an owner first.";
		case "last_workspace":
			return "This is your only workspace — you can't leave it. Create another one first.";
		case "not_member":
			return "That person is no longer a member of this workspace.";
		default:
			return null;
	}
}
