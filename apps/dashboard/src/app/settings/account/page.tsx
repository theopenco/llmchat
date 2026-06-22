"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	ACCOUNT_KEY,
	deleteAccount,
	fetchAccount,
	updateAccountName,
	type Account,
	type DeletionImpact,
} from "@/lib/account";
import { ApiError, describeApiError } from "@/lib/api";
import { resetAnalytics } from "@/lib/analytics";
import { signOut } from "@/lib/auth-client";

import { DeleteAccountDialog } from "./_components/DeleteAccountDialog";

const NAME_MAX = 100;

function plural(n: number, word: string) {
	return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function impactSentence(i: DeletionImpact): string {
	return `Deleting your account permanently removes ${plural(i.workspaces, "workspace")}, ${plural(i.projects, "project")}, ${plural(i.conversations, "conversation")}, ${plural(i.sources, "source")}, and ${plural(i.members, "team member")}. This can't be undone.`;
}

/** Map a DELETE /account failure to a clear sentence. */
function deleteErrorMessage(e: unknown): string {
	if (e instanceof ApiError) {
		switch (e.code) {
			case "email_mismatch":
				return "The email you typed doesn't match your account.";
			case "password_required":
			case "invalid_password":
				return "Incorrect password.";
			case "co_owner":
				return "You share ownership of a workspace. Remove the other owner first.";
			case "active_subscription":
				return "Cancel your subscription in Billing before deleting your account.";
			case "billing_unverified":
				return "We couldn't verify your billing status — please try again.";
			case "billing_drift":
				return "We couldn't confirm your billing status. Contact support.";
		}
	}
	return describeApiError(e, "Couldn't delete your account");
}

export default function AccountSettingsPage() {
	const qc = useQueryClient();
	const router = useRouter();
	const accountQ = useQuery({ queryKey: ACCOUNT_KEY, queryFn: fetchAccount });
	const acct = accountQ.data;

	const loadedName = acct?.name ?? "";
	const [draft, setDraft] = useState<string | null>(null);
	const name = draft ?? loadedName;
	const trimmed = name.trim();
	const dirty = draft !== null && trimmed !== loadedName;

	const save = useMutation({
		mutationFn: () => updateAccountName(trimmed),
		onSuccess: (data: { name: string; email: string }) => {
			qc.setQueryData<Account>(ACCOUNT_KEY, (prev) =>
				prev ? { ...prev, name: data.name } : prev,
			);
			setDraft(null);
			toast.success("Name updated");
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Couldn't update your name")),
	});

	const [deleteOpen, setDeleteOpen] = useState(false);
	const remove = useMutation({
		mutationFn: (body: { confirmEmail: string; password?: string }) =>
			deleteAccount(body),
		onSuccess: async () => {
			setDeleteOpen(false);
			toast.success("Your account has been deleted");
			// No dead-cookie window: sign out (clears the cookie), drop all cached
			// state, and land on sign-in.
			await signOut();
			resetAnalytics();
			qc.clear();
			router.replace("/sign-in");
		},
		onError: (e) => toast.error(deleteErrorMessage(e)),
	});

	const blockers = acct?.blockers;
	const blocked = Boolean(
		blockers &&
		(blockers.coOwner || blockers.activeSubscription || blockers.drift),
	);

	return (
		<PageContainer className="space-y-6">
			<header>
				<h1 className="font-display text-2xl font-semibold tracking-tight-display">
					Account
				</h1>
				<p className="mt-0.5 text-sm text-muted-foreground">
					Manage your personal account details.
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
					<CardDescription>
						Your name and the email you sign in with.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					{accountQ.isLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : (
						<>
							<form
								className="flex flex-col gap-1.5"
								onSubmit={(e) => {
									e.preventDefault();
									if (dirty && trimmed) save.mutate();
								}}
							>
								<Label htmlFor="account-name">Name</Label>
								<div className="flex flex-col gap-2 sm:flex-row">
									<Input
										id="account-name"
										value={name}
										maxLength={NAME_MAX}
										onChange={(e) => setDraft(e.target.value)}
										placeholder="Your name"
										autoComplete="name"
									/>
									<Button
										type="submit"
										disabled={!dirty || !trimmed || save.isPending}
										className="shrink-0"
									>
										{save.isPending ? "Saving…" : "Save"}
									</Button>
								</div>
							</form>

							<div className="flex flex-col gap-1.5">
								<Label htmlFor="account-email">Email</Label>
								<Input
									id="account-email"
									value={acct?.email ?? ""}
									readOnly
									disabled
									aria-label="Email (read-only)"
								/>
								<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Info className="size-3.5 shrink-0" />
									Contact support to change your email.
								</p>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Billing</CardTitle>
					<CardDescription>
						Manage your workspace plan and subscription.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<Link href="/settings/billing">
							<CreditCard />
							Go to Billing
						</Link>
					</Button>
				</CardContent>
			</Card>

			<Card className="border-destructive/40">
				<CardHeader>
					<CardTitle className="text-destructive">Danger zone</CardTitle>
					<CardDescription>
						Permanently delete your account and all of its data.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{acct && (
						<p className="text-sm text-muted-foreground">
							{impactSentence(acct.impact)}
						</p>
					)}

					{blockers?.coOwner ? (
						<p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
							You share ownership of a workspace. Transfer or remove the other
							owner before deleting your account.
						</p>
					) : blockers?.activeSubscription ? (
						<div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
							<span>
								Cancel your subscription before deleting your account.
							</span>
							<Button asChild variant="outline" size="sm">
								<Link href="/settings/billing">Go to Billing</Link>
							</Button>
						</div>
					) : blockers?.drift ? (
						<p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
							We couldn&apos;t confirm your billing status. Please contact
							support before deleting your account.
						</p>
					) : null}

					<Button
						variant="destructive"
						disabled={!acct || blocked || remove.isPending}
						onClick={() => setDeleteOpen(true)}
					>
						Delete account
					</Button>
				</CardContent>
			</Card>

			{acct && (
				<DeleteAccountDialog
					open={deleteOpen}
					onOpenChange={setDeleteOpen}
					email={acct.email}
					requirePassword={acct.hasPassword}
					pending={remove.isPending}
					error={remove.isError ? deleteErrorMessage(remove.error) : null}
					onConfirm={(body) => remove.mutate(body)}
				/>
			)}
		</PageContainer>
	);
}
