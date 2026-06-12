"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "./SectionCard";
import type { ProjectDraft } from "./types";

export function BotBasicsCard({
	draft,
	set,
}: {
	draft: ProjectDraft;
	set: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
}) {
	return (
		<SectionCard
			id="basics"
			step={1}
			title="Bot basics"
			description="Name your chatbot and customize how it appears to visitors."
		>
			<div className="grid gap-5 md:grid-cols-3">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="name">Chatbot name</Label>
					<Input
						id="name"
						value={draft.name}
						onChange={(e) => set("name", e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						This name is only visible inside your dashboard.
					</p>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="welcome">Welcome message</Label>
					<Input
						id="welcome"
						value={draft.welcomeMessage}
						onChange={(e) => set("welcomeMessage", e.target.value)}
						placeholder="Hi! How can I help you today?"
					/>
					<p className="text-xs text-muted-foreground">
						This is the first message visitors will see.
					</p>
				</div>

				<div className="flex flex-col gap-1.5">
					<Label htmlFor="brandColor">Brand color</Label>
					<div className="flex items-center gap-2">
						<Label
							htmlFor="brandColor"
							className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
							style={{ backgroundColor: draft.brandColor || "#000000" }}
						>
							<Input
								id="brandColor"
								type="color"
								value={draft.brandColor || "#000000"}
								onChange={(e) => set("brandColor", e.target.value)}
								className="absolute inset-0 size-full cursor-pointer opacity-0"
								aria-label="Brand color"
							/>
						</Label>
						<Input
							value={draft.brandColor || "#000000"}
							onChange={(e) => set("brandColor", e.target.value)}
							className="font-mono"
							aria-label="Brand color hex value"
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						Choose the primary color for your chat widget.
					</p>
				</div>
			</div>
		</SectionCard>
	);
}
