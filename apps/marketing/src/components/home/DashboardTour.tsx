"use client";

import Image from "next/image";
import { useState } from "react";
import { Safari } from "@/components/magicui/safari";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";

/**
 * A tabbed tour of the actual operator dashboard — real screenshots from our
 * own seeded workspace (fictional persona data, same standard as the docs
 * screenshots), light and dark variants swapped with the site theme. Only the
 * active tab's image is mounted, so the page never pays for all eight.
 */

type Tab = {
	id: string;
	label: string;
	url: string;
	headline: string;
	points: [string, string];
	img: string;
	alt: string;
};

const TABS: Tab[] = [
	{
		id: "inbox",
		label: "Inbox",
		url: "app.clankersupport.com/inbox",
		headline: "Every conversation lands in one inbox",
		points: [
			"Escalations surface with the full AI thread attached — nobody starts cold.",
			"Filters, tags, unread counts, archive — triage without tab-hopping.",
		],
		img: "inbox",
		alt: "The Clanker Support team inbox listing AI and escalated conversations",
	},
	{
		id: "thread",
		label: "Conversation",
		url: "app.clankersupport.com/inbox",
		headline: "Read the whole story, then reply",
		points: [
			"The visitor's AI conversation arrives intact — your customer never repeats themselves.",
			"Your reply lands in the widget, and the thread continues over email.",
		],
		img: "thread",
		alt: "An escalated conversation thread open in the dashboard with the reply composer",
	},
	{
		id: "studio",
		label: "Widget studio",
		url: "app.clankersupport.com/settings",
		headline: "Make the widget unmistakably yours",
		points: [
			"Brand color, agent photo, welcome message, suggested questions — with a live preview.",
			"Changes apply from the dashboard. Your site's script tag never changes.",
		],
		img: "widget-studio",
		alt: "The widget customization settings with brand color, agent photo and live chat preview",
	},
	{
		id: "sources",
		label: "Knowledge",
		url: "app.clankersupport.com/settings",
		headline: "It answers from your docs — literally",
		points: [
			"Feed it URLs, text snippets, and hand-written Q&A pairs.",
			"Docs changed? Recrawl a source from the dashboard and the agent catches up.",
		],
		img: "sources",
		alt: "The knowledge base settings listing crawled URLs and Q&A sources",
	},
];

export function DashboardTour() {
	const [active, setActive] = useState<Tab>(TABS[0]);

	const pick = (tab: Tab) => {
		track(ANALYTICS_EVENTS.ctaClicked, {
			label: "dashboard_tour",
			location: "home_tour",
			tab: tab.id,
		});
		setActive(tab);
	};

	return (
		<div className="grid items-start gap-8 lg:grid-cols-[0.62fr_1.38fr] lg:gap-10">
			{/* Tab rail */}
			<div
				role="tablist"
				aria-label="Dashboard tour"
				aria-orientation="vertical"
				className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0"
			>
				{TABS.map((tab, i) => {
					const on = tab.id === active.id;
					return (
						<button
							key={tab.id}
							role="tab"
							aria-selected={on}
							id={`tour-tab-${tab.id}`}
							aria-controls="tour-panel"
							onClick={() => pick(tab)}
							className={`shrink-0 rounded-2xl px-4 py-3 text-left transition-colors lg:rounded-none lg:border-l-2 lg:px-5 lg:py-4 ${
								on
									? "bg-accent/10 lg:border-accent lg:bg-transparent"
									: "lg:border-rule hover:bg-paper-raise/60 lg:hover:bg-transparent"
							}`}
						>
							<span className="flex items-baseline gap-2.5">
								<span
									className={`font-mono text-xs font-medium ${on ? "text-accent" : "text-faint"}`}
								>
									0{i + 1}
								</span>
								<span
									className={`font-display text-base font-semibold tracking-tight-display sm:text-lg ${
										on ? "text-ink" : "text-muted"
									}`}
								>
									{tab.label}
								</span>
							</span>
							{on && (
								<span className="mt-2 hidden lg:block">
									<span className="block text-sm font-medium leading-snug text-ink-soft">
										{tab.headline}
									</span>
									<span className="mt-2 flex flex-col gap-1.5">
										{tab.points.map((p) => (
											<span
												key={p}
												className="flex gap-2 text-[0.82rem] leading-relaxed text-muted"
											>
												<span aria-hidden className="text-accent">
													·
												</span>
												{p}
											</span>
										))}
									</span>
								</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Screenshot panel — light/dark swapped with the site theme */}
			<div
				id="tour-panel"
				role="tabpanel"
				aria-labelledby={`tour-tab-${active.id}`}
			>
				<Safari url={active.url} className="size-full">
					<TourImage img={active.img} alt={active.alt} />
				</Safari>
				{/* Mobile: the active tab's story, under the shot */}
				<div className="mt-4 lg:hidden">
					<p className="text-sm font-medium leading-snug text-ink-soft">
						{active.headline}
					</p>
					<ul className="mt-2 flex flex-col gap-1.5">
						{active.points.map((p) => (
							<li
								key={p}
								className="flex gap-2 text-[0.82rem] leading-relaxed text-muted"
							>
								<span aria-hidden className="text-accent">
									·
								</span>
								{p}
							</li>
						))}
					</ul>
				</div>
				<p className="mt-4 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faint">
					Actual screenshots — our own workspace, fictional persona data
				</p>
			</div>
		</div>
	);
}

function TourImage({ img, alt }: { img: string; alt: string }) {
	return (
		<>
			<Image
				src={`/tour/${img}-light.webp`}
				alt={alt}
				width={1440}
				height={900}
				className="block size-full object-cover object-top dark:hidden"
			/>
			<Image
				src={`/tour/${img}-dark.webp`}
				alt={alt}
				width={1440}
				height={900}
				className="hidden size-full object-cover object-top dark:block"
			/>
		</>
	);
}
