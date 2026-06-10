"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-client";
import { useWorkspace } from "@/lib/workspace";
import { api } from "@/lib/api";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { dismissOnboarding } from "@/lib/use-onboarding-redirect";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	ArrowRight,
	BookOpen,
	Check,
	Code2,
	Copy,
	FolderPlus,
	Loader2,
	Sparkles,
} from "lucide-react";

interface Project {
	id: string;
	name: string;
	publicKey: string;
	model: string;
	brandColor: string;
	knowledgeText: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export default function OnboardingPage() {
	const router = useRouter();
	const qc = useQueryClient();
	const { data: session, isPending } = useSession();
	const { workspaceId, setWorkspaceId } = useWorkspace();

	// Auth guard — mirror the inbox/projects layouts.
	useEffect(() => {
		if (!isPending && !session?.user) router.replace("/sign-in");
	}, [isPending, session, router]);

	// Fire onboarding_started once per browser.
	const startedRef = useRef(false);
	useEffect(() => {
		if (startedRef.current || typeof window === "undefined") return;
		startedRef.current = true;
		if (!localStorage.getItem("llmchat:onboarding:started")) {
			localStorage.setItem("llmchat:onboarding:started", "1");
			track(ANALYTICS_EVENTS.onboardingStarted);
		}
	}, []);

	const projects = useQuery({
		queryKey: ["projects", workspaceId],
		enabled: !!workspaceId,
		queryFn: () =>
			api<{ projects: Project[] }>("/api/projects", {
				workspaceId: workspaceId!,
			}),
	});
	const project = projects.data?.projects[0] ?? null;

	const [name, setName] = useState("");
	const [knowledge, setKnowledge] = useState("");
	const [copied, setCopied] = useState(false);
	const [embedCopied, setEmbedCopied] = useState(false);

	// Hydrate the knowledge draft + embed-copied flag when the project loads.
	useEffect(() => {
		if (!project) return;
		setKnowledge(project.knowledgeText ?? "");
		setEmbedCopied(
			localStorage.getItem(`llmchat:onboarding:embed:${project.id}`) === "1",
		);
	}, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

	const createProject = useMutation({
		mutationFn: async (projectName: string) => {
			// A brand-new user has no workspace yet — bootstrap one first.
			let wsId = workspaceId;
			if (!wsId) {
				const userName = session?.user?.name?.trim();
				const wsName = userName ? `${userName}'s workspace` : "My workspace";
				const res = await api<{ workspace: { id: string } }>("/api/workspaces", {
					method: "POST",
					body: { name: wsName },
				});
				wsId = res.workspace.id;
				setWorkspaceId(wsId);
				await qc.invalidateQueries({ queryKey: ["workspaces"] });
			}
			return api<{ project: Project }>("/api/projects", {
				method: "POST",
				body: { name: projectName },
				workspaceId: wsId,
			});
		},
		onSuccess: (res) => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			track(ANALYTICS_EVENTS.projectCreated, {
				project_id: res.project.id,
				source: "onboarding",
			});
			track(ANALYTICS_EVENTS.onboardingStepCompleted, {
				step: "create_project",
				step_number: 1,
			});
			toast.success("Project created");
		},
		onError: (e) =>
			toast.error("Couldn't create project", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const saveKnowledge = useMutation({
		mutationFn: () =>
			api(`/api/projects/${project!.id}`, {
				method: "PATCH",
				body: { knowledgeText: knowledge },
				workspaceId: workspaceId!,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["projects"] });
			track(ANALYTICS_EVENTS.knowledgeBaseUpdated, {
				project_id: project!.id,
				source: "onboarding",
			});
			track(ANALYTICS_EVENTS.onboardingStepCompleted, {
				step: "configure",
				step_number: 2,
			});
			toast.success("Knowledge base saved");
		},
		onError: (e) =>
			toast.error("Couldn't save", {
				description: e instanceof Error ? e.message : undefined,
			}),
	});

	const embed = project
		? `<script src="${apiUrl}/widget.js" data-project="${project.publicKey}" data-api="${apiUrl}" data-brand="${project.brandColor}"></script>`
		: "";

	function copyEmbed() {
		if (!project) return;
		navigator.clipboard.writeText(embed);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
		if (!embedCopied) {
			setEmbedCopied(true);
			localStorage.setItem(`llmchat:onboarding:embed:${project.id}`, "1");
			track(ANALYTICS_EVENTS.widgetEmbedCopied, {
				project_id: project.id,
				source: "onboarding",
			});
			track(ANALYTICS_EVENTS.onboardingStepCompleted, {
				step: "install",
				step_number: 3,
			});
		}
		toast.success("Embed snippet copied");
	}

	const step1Done = !!project;
	const step2Done = !!project?.knowledgeText?.trim(); // recommended, not required
	const step3Done = embedCopied;
	// Completion is the two core steps; the knowledge base is recommended.
	const requiredDone = [step1Done, step3Done].filter(Boolean).length;
	const allDone = step1Done && step3Done;

	// Fire onboarding_completed once when the core steps are finished, and stop
	// the zero-project redirect from pulling the user back here.
	const completedRef = useRef(false);
	useEffect(() => {
		if (!allDone || completedRef.current) return;
		completedRef.current = true;
		dismissOnboarding();
		if (!localStorage.getItem("llmchat:onboarding:completed")) {
			localStorage.setItem("llmchat:onboarding:completed", "1");
			track(ANALYTICS_EVENTS.onboardingCompleted);
		}
	}, [allDone]);

	if (isPending || !session?.user) return null;

	return (
		<main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
			{/* Header */}
			<div className="mb-2 flex items-center justify-between">
				<span className="font-semibold">llmchat</span>
				<Link
					href="/inbox"
					onClick={dismissOnboarding}
					className="text-sm text-muted-foreground transition-colors hover:text-foreground"
				>
					Skip for now →
				</Link>
			</div>

			<h1 className="mt-8 text-3xl font-bold tracking-tight">
				{session.user.name
					? `Welcome, ${session.user.name.split(" ")[0]}`
					: "Welcome to llmchat"}
			</h1>
			<p className="mt-2 text-muted-foreground">
				Get your AI support widget live in three steps.
			</p>

			{/* Progress (core steps; knowledge base is optional) */}
			<div className="mt-6 flex items-center gap-3">
				<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-primary transition-all duration-500"
						style={{ width: `${(requiredDone / 2) * 100}%` }}
					/>
				</div>
				<span className="font-mono text-xs text-muted-foreground">
					{requiredDone} / 2
				</span>
			</div>

			{/* Steps */}
			<ol className="mt-10 space-y-4">
				<Step
					index={1}
					done={step1Done}
					icon={<FolderPlus className="size-4" />}
					title="Create your first project"
					description="A project is the unit you embed. It holds your bot's knowledge, model, and widget settings."
				>
					{project ? (
						<p className="text-sm text-muted-foreground">
							Created{" "}
							<span className="font-medium text-foreground">{project.name}</span>.
						</p>
					) : (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (!name.trim()) return;
								createProject.mutate(name.trim());
							}}
							className="flex flex-col gap-3 sm:flex-row"
						>
							<div className="flex-1">
								<Label htmlFor="project-name" className="sr-only">
									Project name
								</Label>
								<Input
									id="project-name"
									autoFocus
									required
									placeholder="e.g. Support Bot"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<Button
								type="submit"
								disabled={createProject.isPending || !name.trim()}
							>
								{createProject.isPending ? (
									<>
										<Loader2 className="animate-spin" />
										Creating…
									</>
								) : (
									"Create project"
								)}
							</Button>
						</form>
					)}
				</Step>

				<Step
					index={2}
					done={step2Done}
					locked={!step1Done}
					icon={<BookOpen className="size-4" />}
					title="Add your knowledge base"
					badge={
						<span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
							Recommended
						</span>
					}
					description="Paste docs, FAQs, or policies. The bot answers from this and escalates when it can't. You can skip this and add it later."
				>
					<div className="flex flex-col gap-3">
						<Textarea
							rows={6}
							value={knowledge}
							onChange={(e) => setKnowledge(e.target.value)}
							placeholder={
								"# FAQ\n\n## How do I reset my password?\nGo to Settings → Account → Reset password.\n\n## What are your hours?\nMon–Fri, 9am–5pm EST."
							}
							className="font-mono text-sm"
							disabled={!step1Done}
						/>
						<div className="flex items-center gap-3">
							<Button
								type="button"
								onClick={() => saveKnowledge.mutate()}
								disabled={
									!step1Done || saveKnowledge.isPending || !knowledge.trim()
								}
							>
								{saveKnowledge.isPending ? (
									<>
										<Loader2 className="animate-spin" />
										Saving…
									</>
								) : (
									"Save knowledge"
								)}
							</Button>
							{step2Done && (
								<span className="text-xs text-muted-foreground">
									You can refine this anytime in project settings.
								</span>
							)}
						</div>
					</div>
				</Step>

				<Step
					index={3}
					done={step3Done}
					locked={!step1Done}
					icon={<Code2 className="size-4" />}
					title="Install the widget"
					description="Drop this snippet before </body> on your site. That's the whole integration."
					last
				>
					<div className="flex flex-col gap-3">
						<pre className="overflow-x-auto rounded-lg bg-primary p-4 text-xs leading-relaxed text-primary-foreground/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
							{embed || "Create a project to get your snippet."}
						</pre>
						<Button
							type="button"
							onClick={copyEmbed}
							disabled={!step1Done}
							variant={step3Done ? "outline" : "default"}
						>
							{copied ? <Check /> : <Copy />}
							{step3Done ? "Copied" : "Copy embed snippet"}
						</Button>
					</div>
				</Step>
			</ol>

			{/* Finish */}
			<div
				className={cn(
					"mt-8 flex flex-col items-start gap-4 rounded-2xl border p-6 transition-colors sm:flex-row sm:items-center sm:justify-between",
					allDone ? "border-primary/30 bg-primary/5" : "bg-muted/30",
				)}
			>
				<div className="flex items-center gap-3">
					<div
						className={cn(
							"flex size-9 items-center justify-center rounded-full",
							allDone
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground",
						)}
					>
						<Sparkles className="size-4" />
					</div>
					<div>
						<p className="font-semibold">
							{allDone ? "You're all set" : "Almost there"}
						</p>
						<p className="text-sm text-muted-foreground">
							{allDone
								? step2Done
									? "Your widget is live. Conversations land in your inbox."
									: "Your widget is live. Tip: add a knowledge base for sharper answers."
								: "Finish the steps above, or jump in and explore."}
						</p>
					</div>
				</div>
				<Button asChild>
					<Link href="/inbox" onClick={dismissOnboarding}>
						Go to inbox
						<ArrowRight />
					</Link>
				</Button>
			</div>
		</main>
	);
}

function Step({
	index,
	done,
	locked,
	last,
	icon,
	title,
	badge,
	description,
	children,
}: {
	index: number;
	done: boolean;
	locked?: boolean;
	last?: boolean;
	icon: React.ReactNode;
	title: string;
	badge?: React.ReactNode;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<li className="relative flex gap-4">
			{/* Rail */}
			<div className="flex flex-col items-center">
				<div
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
						done
							? "border-primary bg-primary text-primary-foreground"
							: locked
								? "border-border bg-muted text-muted-foreground/50"
								: "border-primary/40 bg-background text-foreground",
					)}
				>
					{done ? <Check className="size-4" /> : icon}
				</div>
				{!last && (
					<div
						className={cn(
							"mt-1 w-px flex-1",
							done ? "bg-primary/30" : "bg-border",
						)}
					/>
				)}
			</div>

			{/* Body — min-w-0 lets the long embed snippet scroll instead of
			    stretching the card past the viewport. */}
			<div
				className={cn(
					"min-w-0 flex-1 rounded-2xl border p-5 transition-opacity",
					done ? "bg-muted/20" : "bg-background",
					locked && "pointer-events-none opacity-55",
				)}
			>
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<h2 className="font-semibold">{title}</h2>
						{badge}
					</div>
					<span className="font-mono text-xs text-muted-foreground">
						Step {index}
					</span>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				<div className="mt-4">{children}</div>
			</div>
		</li>
	);
}
