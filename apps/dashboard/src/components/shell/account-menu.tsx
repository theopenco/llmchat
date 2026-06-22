"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, LogOut, Monitor, Moon, Sun, UserCog } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import {
	Menu,
	MenuContent,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuTrigger,
} from "@/components/ds";
import { ACCOUNT_KEY, fetchAccount } from "@/lib/account";
import { useSignOut } from "@/lib/use-sign-out";

const THEMES = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Top-bar account menu: Account, Billing, an Appearance section (the Light/Dark/
 * System switcher — kept here so the top bar stays minimal), and Sign out. No
 * "Settings" entry: workspace management lives in the workspace switcher and
 * there's no global settings page, so it would be a dead/duplicate destination.
 */
export function AccountMenu({
	userEmail,
	roleLabel,
}: {
	userEmail: string;
	roleLabel: string;
}) {
	const handleSignOut = useSignOut();
	const qc = useQueryClient();
	const { theme, setTheme } = useTheme();
	const initials = userEmail.slice(0, 2).toUpperCase();

	// Warm the account page cache when the menu opens, so it renders with data.
	const prefetchAccount = () =>
		qc.prefetchQuery({ queryKey: ACCOUNT_KEY, queryFn: fetchAccount });

	return (
		<Menu onOpenChange={(open) => open && prefetchAccount()}>
			<MenuTrigger asChild>
				<button
					aria-label="Account menu"
					className="flex items-center rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ck-accent"
				>
					<span className="flex size-8 items-center justify-center rounded-lg bg-ck-accent text-[11.5px] font-bold text-white">
						{initials}
					</span>
				</button>
			</MenuTrigger>
			<MenuContent align="end" className="min-w-60">
				<div className="px-2.5 py-1.5">
					<div className="truncate text-[13px] font-semibold text-ck-text">
						{userEmail}
					</div>
					<div className="text-[11.5px] text-ck-faint">{roleLabel}</div>
				</div>
				<MenuSeparator />
				<MenuItem
					asChild
					onMouseEnter={prefetchAccount}
					onFocus={prefetchAccount}
				>
					<Link href="/settings/account" prefetch>
						<UserCog />
						Account
					</Link>
				</MenuItem>
				<MenuItem asChild>
					<Link href="/settings/billing">
						<CreditCard />
						Billing
					</Link>
				</MenuItem>
				<MenuSeparator />
				<MenuLabel>Appearance</MenuLabel>
				{THEMES.map((t) => (
					<MenuItem
						key={t.value}
						selected={theme === t.value}
						// Keep the menu open while flipping theme so it's easy to compare.
						onSelect={(e) => {
							e.preventDefault();
							setTheme(t.value);
						}}
					>
						<t.icon />
						{t.label}
					</MenuItem>
				))}
				<MenuSeparator />
				<MenuItem onSelect={handleSignOut}>
					<LogOut />
					Sign out
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
