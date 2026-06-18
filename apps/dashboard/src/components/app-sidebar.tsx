"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
	Check,
	ChevronsUpDown,
	CreditCard,
	ExternalLink,
	FolderKanban,
	LifeBuoy,
	LogOut,
	MessagesSquare,
	Plus,
} from "lucide-react";

import { api } from "@/lib/api";
import { signOut } from "@/lib/auth-client";
import { track, resetAnalytics, ANALYTICS_EVENTS } from "@/lib/analytics";
import { useWorkspace } from "@/lib/workspace";
import { BrandLogo } from "@/components/brand-logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV = [
	{ title: "Conversations", href: "/inbox", icon: MessagesSquare },
	{ title: "Projects", href: "/settings/projects", icon: FolderKanban },
	{ title: "Billing", href: "/settings/billing", icon: CreditCard },
];

const SETUP_STEPS = [
	{ id: "basics", label: "Basics" },
	{ id: "model", label: "Model" },
	{ id: "instructions", label: "Instructions" },
	{ id: "sources", label: "Sources" },
	{ id: "install", label: "Install" },
];
const STEP_IDS = SETUP_STEPS.map((s) => s.id);

interface ProjectSummary {
	id: string;
	name: string;
	brandColor: string;
}

/** Tracks which setup section is in view so the sidebar steps highlight it. */
function useScrollSpy(ids: string[], enabled: boolean) {
	const [active, setActive] = useState(ids[0]);
	useEffect(() => {
		if (!enabled) return;
		const els = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);
		if (!els.length) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.toSorted(
						(a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
					);
				if (visible[0]) setActive(visible[0].target.id);
			},
			{ rootMargin: "-20% 0px -65% 0px", threshold: 0 },
		);
		els.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, [ids, enabled]);
	return active;
}

function scrollToStep(stepId: string) {
	document
		.getElementById(stepId)
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AppSidebar({ userEmail }: { userEmail: string }) {
	const pathname = usePathname();
	const router = useRouter();
	const { workspaces, workspaceId, setWorkspaceId } = useWorkspace();
	const initials = userEmail.slice(0, 2).toUpperCase();

	const projectMatch = pathname.match(/^\/settings\/projects\/([^/]+)$/);
	const currentProjectId = projectMatch?.[1] ?? null;
	const inProject = currentProjectId !== null;

	const projectsQ = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: ProjectSummary[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});
	const projects = projectsQ.data?.projects ?? [];
	const currentProject = projects.find((p) => p.id === currentProjectId);

	const activeStep = useScrollSpy(STEP_IDS, inProject);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild size="lg">
							<Link href="/inbox">
								<BrandLogo className="size-8" />
								<span className="font-display text-base font-semibold tracking-tight-display">
									Clanker Support
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel className="uppercase tracking-[0.12em]">
						Platform
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV.map((item) => {
								const active =
									pathname === item.href ||
									pathname.startsWith(`${item.href}/`);
								return (
									<SidebarMenuItem key={item.href}>
										<SidebarMenuButton
											asChild
											isActive={active}
											tooltip={item.title}
											className={cn(
												active &&
													"bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
											)}
										>
											<Link href={item.href}>
												<item.icon />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{inProject && (
					<>
						<SidebarGroup className="group-data-[collapsible=icon]:hidden">
							<SidebarGroupLabel className="uppercase tracking-[0.12em]">
								Current project
							</SidebarGroupLabel>
							<SidebarGroupContent>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											className="h-auto w-full justify-between px-3 py-2"
										>
											<span className="flex min-w-0 items-center gap-2">
												<span
													className="size-2.5 shrink-0 rounded-full"
													style={{
														backgroundColor:
															currentProject?.brandColor || "#6366f1",
													}}
												/>
												<span className="truncate font-medium">
													{currentProject?.name ?? "Project"}
												</span>
											</span>
											<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56"
									>
										<DropdownMenuLabel className="text-xs text-muted-foreground">
											Switch project
										</DropdownMenuLabel>
										<DropdownMenuGroup>
											{projects.map((p) => (
												<DropdownMenuItem
													key={p.id}
													onClick={() =>
														router.push(`/settings/projects/${p.id}`)
													}
												>
													<span
														className="size-2.5 rounded-full"
														style={{
															backgroundColor: p.brandColor || "#6366f1",
														}}
													/>
													<span className="truncate">{p.name}</span>
													{p.id === currentProjectId && (
														<Check className="ml-auto" />
													)}
												</DropdownMenuItem>
											))}
										</DropdownMenuGroup>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => router.push("/onboarding?new=1")}
										>
											<Plus />
											<span>New bot</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</SidebarGroupContent>
						</SidebarGroup>

						<SidebarGroup className="group-data-[collapsible=icon]:hidden">
							<SidebarGroupLabel className="uppercase tracking-[0.12em]">
								Setup
							</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{SETUP_STEPS.map((step) => {
										const active = activeStep === step.id;
										return (
											<SidebarMenuItem key={step.id}>
												<SidebarMenuButton
													onClick={() => scrollToStep(step.id)}
													isActive={active}
													className={cn(
														active &&
															"bg-sidebar-primary font-medium text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
													)}
												>
													<span
														className={cn(
															"flex size-4 items-center justify-center rounded-full border",
															active
																? "border-current"
																: "border-muted-foreground/40",
														)}
													>
														{active && (
															<span className="size-1.5 rounded-full bg-current" />
														)}
													</span>
													<span>{step.label}</span>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}

				<div className="mt-auto p-2 group-data-[collapsible=icon]:hidden">
					<div className="rounded-xl border border-border bg-card p-4">
						<div className="flex items-center gap-2 text-sm font-medium text-foreground">
							<LifeBuoy className="size-4" />
							Need help?
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Check our docs or contact support.
						</p>
						<Button asChild variant="outline" size="sm" className="mt-3 w-full">
							<a
								href="https://docs.meetploy.com"
								target="_blank"
								rel="noreferrer"
							>
								View docs
								<ExternalLink />
							</a>
						</Button>
					</div>
				</div>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent"
								>
									<Avatar className="size-8 rounded-lg">
										<AvatarFallback className="rounded-lg">
											{initials}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{userEmail}</span>
										<span className="truncate text-xs text-muted-foreground">
											Admin
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								side="top"
								className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56"
							>
								<DropdownMenuLabel className="truncate text-xs text-muted-foreground">
									{userEmail}
								</DropdownMenuLabel>
								{workspaces.length > 1 && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuLabel className="text-xs text-muted-foreground">
											Workspaces
										</DropdownMenuLabel>
										<DropdownMenuGroup>
											{workspaces.map((w) => (
												<DropdownMenuItem
													key={w.id}
													onClick={() => setWorkspaceId(w.id)}
												>
													<span className="truncate">{w.name}</span>
													{w.id === workspaceId && (
														<Check className="ml-auto" />
													)}
												</DropdownMenuItem>
											))}
										</DropdownMenuGroup>
									</>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => {
										track(ANALYTICS_EVENTS.signedOut);
										signOut().then(() => {
											resetAnalytics();
											router.replace("/sign-in");
										});
									}}
								>
									<LogOut />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
					<SidebarMenuItem className="flex items-center px-1 group-data-[collapsible=icon]:hidden">
						<ModeToggle />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
