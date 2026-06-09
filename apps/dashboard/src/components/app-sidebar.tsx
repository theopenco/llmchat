"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	Check,
	ChevronsUpDown,
	FolderKanban,
	LogOut,
	MessagesSquare,
	Plus,
} from "lucide-react";

import { signOut } from "@/lib/auth-client";
import { useWorkspace } from "@/lib/workspace";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const NAV = [
	{ title: "Conversations", href: "/inbox", icon: MessagesSquare },
	{ title: "Projects", href: "/settings/projects", icon: FolderKanban },
];

export function AppSidebar({ userEmail }: { userEmail: string }) {
	const pathname = usePathname();
	const router = useRouter();
	const { workspaces, workspaceId, setWorkspaceId } = useWorkspace();
	const current = workspaces.find((w) => w.id === workspaceId);
	const initials = userEmail.slice(0, 2).toUpperCase();

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent"
								>
									<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
										<MessagesSquare className="size-4" />
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{current?.name ?? "llmchat"}
										</span>
										<span className="truncate text-xs text-muted-foreground">
											Workspace
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56"
							>
								<DropdownMenuLabel className="text-xs text-muted-foreground">
									Workspaces
								</DropdownMenuLabel>
								<DropdownMenuGroup>
									{workspaces.map((w) => (
										<DropdownMenuItem
											key={w.id}
											onClick={() => setWorkspaceId(w.id)}
										>
											{w.name}
											{w.id === workspaceId && <Check className="ml-auto" />}
										</DropdownMenuItem>
									))}
								</DropdownMenuGroup>
								<DropdownMenuSeparator />
								<DropdownMenuItem disabled>
									<Plus />
									New workspace
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Platform</SidebarGroupLabel>
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
										<span className="truncate text-xs text-muted-foreground">
											Signed in as
										</span>
										<span className="truncate font-medium">{userEmail}</span>
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
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() =>
										signOut().then(() => router.replace("/sign-in"))
									}
								>
									<LogOut />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
					<SidebarMenuItem className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:hidden">
						<span className="text-xs text-muted-foreground">Theme</span>
						<ModeToggle />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
