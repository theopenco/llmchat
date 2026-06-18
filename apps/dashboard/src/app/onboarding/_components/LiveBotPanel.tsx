"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { lazy, Suspense } from "react";

import { Button } from "@/components/ui/button";
import { EmbedSnippet } from "@/components/embed-snippet";
import { apiBaseUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";

import { ONBOARDING_PRIMARY } from "./onboarding-steps";

// The live widget pulls in the AI SDK — lazy-load it so it stays out of the
// onboarding route's initial bundle. The page prefetches this chunk during the
// interview, so it's usually warm by the time we render the payoff.
const Widget = lazy(() =>
	import("@llmchat/widget").then((m) => ({ default: m.Widget })),
);

export interface LiveProject {
	id: string;
	name: string;
	publicKey: string;
	brandColor: string;
}

/**
 * The payoff: the same chat surface now talks to the user's *real* configured
 * bot (live `/v1/chat`), so they experience exactly what their visitors will.
 * If the LLM key is unset the widget shows its honest error bubble — we never
 * fake a reply. Below it, the real embed snippet and the exit to the dashboard.
 */
export function LiveBotPanel({
	project,
	onFinish,
}: {
	project: LiveProject;
	onFinish: () => void;
}) {
	return (
		<div className="flex flex-col gap-8">
			<div className="text-center">
				<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
					<Sparkles className="size-3.5" />
					Live
				</span>
				<h1 className="mt-3 font-display text-2xl font-semibold tracking-tight-display">
					Meet {project.name} — your bot is ready
				</h1>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					Say hi below to try it, exactly as your visitors will. Then drop the
					snippet on your site and you&apos;re live.
				</p>
			</div>

			{/* Framed inline widget — the panel fills this relative container. */}
			<div className="mx-auto w-full max-w-sm">
				<div className="relative h-[34rem] overflow-hidden rounded-2xl border border-border shadow-xl">
					<Suspense
						fallback={
							<div className="absolute inset-0 animate-pulse bg-muted" />
						}
					>
						<Widget
							widgetMode="live"
							mode="inline"
							projectKey={project.publicKey}
							apiUrl={apiBaseUrl()}
							brandColor={project.brandColor}
						/>
					</Suspense>
				</div>
				{/* The bot is optional here — the snippet and CTA below are always
				    reachable, so a model hiccup (e.g. no LLM key on preview) never
				    blocks finishing onboarding. */}
				<p className="mt-3 text-center text-xs text-muted-foreground">
					Bot not responding? You can still grab your snippet and finish below.
				</p>
			</div>

			<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
				<h2 className="font-display text-lg font-semibold tracking-tight-display">
					Add it to your site
				</h2>
				<p className="mt-1 mb-5 text-sm text-muted-foreground">
					One snippet, any page. You can always grab this again from the
					project&apos;s settings.
				</p>
				<EmbedSnippet
					publicKey={project.publicKey}
					brandColor={project.brandColor}
				/>
			</div>

			<div className="flex justify-center">
				<Button
					onClick={onFinish}
					size="lg"
					className={cn(ONBOARDING_PRIMARY, "min-w-56")}
				>
					Go to dashboard
					<ArrowRight />
				</Button>
			</div>
		</div>
	);
}
