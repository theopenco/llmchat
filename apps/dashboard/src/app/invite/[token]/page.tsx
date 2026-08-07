"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { ANALYTICS_EVENTS, track } from "@/lib/analytics";
import { ApiError, describeApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import {
	acceptInvite,
	describeInviteError,
	previewInvite,
} from "@/lib/members";
import {
	peekPendingInvite,
	stashPendingInvite,
	withInvite,
} from "@/lib/invite-return";
import { useWorkspace } from "@/lib/workspace";
import {
	upsertWorkspaceSummary,
	WORKSPACES_KEY,
	type WorkspacesResponse,
} from "@/lib/workspace-utils";

function errorText(error: unknown, fallback: string) {
	const code = error instanceof ApiError ? error.code : undefined;
	return describeInviteError(code) ?? describeApiError(error, fallback);
}

/**
 * Invitation acceptance. The token rides the URL path (that is the whole
 * delivery mechanism), so this page is careful about where it can travel:
 *
 * - The dashboard sends `$current_url` on every pageview and autocapture
 *   event, so this route's URL would otherwise ship the token to analytics.
 *   `scrubUrl` (lib/scrub-url.ts) redacts it — both at our capture() calls
 *   and, for events PostHog builds itself, via `sanitize_properties`.
 * - The token is sent to the API in a POST body, never a query string.
 * - Nothing here writes it to localStorage or a log.
 */
export default function AcceptInvitePage() {
	const params = useParams<{ token: string }>();
	const token = params?.token ?? "";
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending: sessionPending } = useSession();
	const { setWorkspaceId } = useWorkspace();

	const previewQ = useQuery({
		queryKey: ["invite-preview"],
		queryFn: () => previewInvite(token),
		enabled: Boolean(token) && Boolean(session?.user),
		retry: false,
	});

	const accept = useMutation({
		mutationFn: () => acceptInvite(token),
		onSuccess: ({ workspaceId }) => {
			// The provider's reconcile validates the stored selection against the
			// CACHED workspace list, which predates this membership — left alone
			// it would demote the selection straight back to the auto-provisioned
			// personal workspace (the first-run bug). Patch a provisional row in
			// so the joined workspace resolves immediately, then refetch the
			// authoritative list.
			qc.setQueryData<WorkspacesResponse>(WORKSPACES_KEY, (prev) =>
				upsertWorkspaceSummary(prev, {
					id: workspaceId,
					name: previewQ.data?.workspaceName ?? "Workspace",
					role: previewQ.data?.role ?? "agent",
				}),
			);
			void qc.invalidateQueries({ queryKey: WORKSPACES_KEY });
			setWorkspaceId(workspaceId);
			track(ANALYTICS_EVENTS.inviteAccepted);
			toast.success("You're in — welcome to the team");
			// Hard navigation: the workspace context is read at load, and the
			// inbox must come up already pointed at the workspace just joined.
			window.location.assign("/inbox");
		},
		onError: (error) =>
			toast.error(errorText(error, "Couldn't accept that invitation.")),
	});

	// An abandoned OAuth attempt in this tab may have stashed this same token;
	// now that the query-param path is carrying it, the stash is redundant and
	// would go stale (→ a wrong redirect on a later /onboarding visit) the
	// moment this invitation is used. A DIFFERENT token's stash is a separate
	// pending carry and is left alone.
	useEffect(() => {
		if (peekPendingInvite() === token) stashPendingInvite(null);
	}, [token]);

	// Not signed in: send them to sign-up carrying the invite, so they come
	// back here after creating an account.
	useEffect(() => {
		if (!sessionPending && !session?.user) {
			router.replace(
				withInvite("/sign-in", `invite=${encodeURIComponent(token)}`),
			);
		}
	}, [sessionPending, session, router, token]);

	if (sessionPending || !session?.user) {
		return (
			<AuthLayout
				heading={<>You&apos;ve been invited</>}
				subheading="One moment…"
			>
				<p className="text-sm text-muted-foreground">Checking your session…</p>
			</AuthLayout>
		);
	}

	if (previewQ.isLoading) {
		return (
			<AuthLayout
				heading={<>You&apos;ve been invited</>}
				subheading="Looking up your invitation…"
			>
				<p className="text-sm text-muted-foreground">One moment…</p>
			</AuthLayout>
		);
	}

	if (previewQ.isError) {
		return (
			<AuthLayout
				heading={<>This invitation can&apos;t be used</>}
				subheading="Invitations are personal, single-use, and expire after 7 days."
			>
				<p className="text-sm text-muted-foreground">
					{errorText(previewQ.error, "This invitation link isn't valid.")}
				</p>
				<Button asChild className="mt-6 w-full">
					<Link href="/inbox">Go to your dashboard</Link>
				</Button>
			</AuthLayout>
		);
	}

	const preview = previewQ.data!;
	const inviter = preview.inviterName ?? "A teammate";

	return (
		<AuthLayout
			heading={<>Join {preview.workspaceName}</>}
			subheading="Accept this invitation to start working in the shared inbox."
		>
			<div className="rounded-lg border p-4">
				<div className="flex items-center gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Users className="size-4" />
					</span>
					<p className="text-sm text-foreground">
						<span className="font-medium">{inviter}</span> invited you to{" "}
						<span className="font-medium">{preview.workspaceName}</span> as{" "}
						<span className="font-medium">
							{preview.role === "admin" ? "an admin" : "an agent"}
						</span>
						.
					</p>
				</div>
				<p className="mt-3 text-xs text-muted-foreground">
					Sent to {preview.email}. You&apos;ll join as {session.user.email}
					{session.user.email !== preview.email &&
						" — the account you're signed in with"}
					.
				</p>
			</div>

			<Button
				className="mt-6 w-full"
				disabled={accept.isPending}
				onClick={() => accept.mutate()}
			>
				{accept.isPending ? "Joining…" : "Accept invitation"}
				{!accept.isPending && <ArrowRight />}
			</Button>
			<p className="mt-4 text-center text-sm text-muted-foreground">
				Not you?{" "}
				<Link href="/inbox" className="font-medium text-primary">
					Go to your dashboard
				</Link>
			</p>
		</AuthLayout>
	);
}
