"use client";

import { Building2, Gauge, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut, useSession } from "@/lib/auth-client";
import { cx } from "@/lib/cx";

const NAV = [
	{ href: "/", label: "Overview", icon: Gauge },
	{ href: "/workspaces", label: "Workspaces", icon: Building2 },
	{ href: "/users", label: "Users", icon: Users },
] as const;

function isActive(pathname: string, href: string): boolean {
	return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Console chrome: a persistent left rail (brand, nav, session footer) plus the
 * main content column. Assumes an authenticated admin (rendered under AdminGate). */
export function Shell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { data } = useSession();
	const email = data?.user?.email ?? "";

	return (
		<div className="flex min-h-dvh flex-col md:flex-row">
			<aside className="flex shrink-0 flex-col gap-1 border-b border-line bg-panel/50 px-3 py-4 md:w-60 md:border-b-0 md:border-r">
				<div className="mb-5 flex items-center gap-2.5 px-2">
					<span className="grid size-8 place-items-center rounded-md bg-accent/15 text-accent-soft">
						<span className="num text-sm font-bold">CS</span>
					</span>
					<div className="leading-tight">
						<div className="font-mono text-[0.7rem] font-semibold uppercase tracking-label text-text">
							Clanker
						</div>
						<div className="label">Admin console</div>
					</div>
				</div>

				<nav className="flex gap-1 md:flex-col">
					{NAV.map((item) => {
						const active = isActive(pathname, item.href);
						const Icon = item.icon;
						return (
							<Link
								key={item.href}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={cx(
									"flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
									active
										? "bg-accent/15 text-text"
										: "text-muted hover:bg-raise hover:text-text",
								)}
							>
								<Icon
									className={cx(
										"size-4",
										active ? "text-accent-soft" : "text-faint",
									)}
								/>
								<span>{item.label}</span>
							</Link>
						);
					})}
				</nav>

				<div className="mt-auto hidden md:block">
					<div className="mt-6 border-t border-line pt-4">
						<div className="truncate px-2 text-xs text-muted" title={email}>
							{email || "—"}
						</div>
						<button
							type="button"
							onClick={() =>
								signOut().then(() => window.location.assign("/login"))
							}
							className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-faint transition-colors hover:bg-raise hover:text-text"
						>
							<LogOut className="size-3.5" />
							Sign out
						</button>
					</div>
				</div>
			</aside>

			<main className="min-w-0 flex-1">{children}</main>
		</div>
	);
}
