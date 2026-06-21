"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

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
	fetchAccount,
	updateAccountName,
	type Account,
} from "@/lib/account";
import { describeApiError } from "@/lib/api";

const NAME_MAX = 100;

export default function AccountSettingsPage() {
	const qc = useQueryClient();
	const accountQ = useQuery({ queryKey: ACCOUNT_KEY, queryFn: fetchAccount });

	// Draft name, seeded from the loaded profile. Keyed on the loaded value so a
	// background refetch that changes the server name re-seeds the field (when the
	// user hasn't started editing — see `dirty`).
	const loadedName = accountQ.data?.name ?? "";
	const [draft, setDraft] = useState<string | null>(null);
	const name = draft ?? loadedName;
	const trimmed = name.trim();
	const dirty = draft !== null && trimmed !== loadedName;

	const save = useMutation({
		mutationFn: () => updateAccountName(trimmed),
		onSuccess: (data: Account) => {
			qc.setQueryData(ACCOUNT_KEY, data);
			setDraft(null);
			toast.success("Name updated");
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Couldn't update your name")),
	});

	return (
		<div className="mx-auto w-full max-w-[800px] space-y-6 p-6">
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
									value={accountQ.data?.email ?? ""}
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
		</div>
	);
}
