"use client";

import { ChevronsUpDown, LogOut, UserCog } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/lib/use-sign-out";

/**
 * The escape hatch on the onboarding/paywall screen (which has no sidebar): a
 * small top-right account control so a signed-in, no-plan user can reach their
 * account settings or sign out instead of being stranded on the paywall. It does
 * NOT let them use the product — the paywall + the server-side 402 still gate
 * that — only manage or leave their account.
 */
export function OnboardingAccountMenu({ email }: { email: string }) {
	const handleSignOut = useSignOut();
	const initials = email.slice(0, 2).toUpperCase();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					aria-label="Account menu"
					className="h-auto gap-2 bg-background/70 py-1.5 pl-1.5 pr-2 backdrop-blur"
				>
					<Avatar className="size-7 rounded-md">
						<AvatarFallback className="rounded-md text-xs">
							{initials}
						</AvatarFallback>
					</Avatar>
					{/* Email hidden on the smallest screens to keep the control compact;
					    the avatar + chevron remain tappable. */}
					<span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
						{email}
					</span>
					<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				<DropdownMenuLabel className="truncate text-xs text-muted-foreground">
					{email}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/settings/account">
						<UserCog />
						Account settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem onClick={handleSignOut}>
					<LogOut />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
