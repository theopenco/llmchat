"use client";

import { Trash2 } from "lucide-react";

import { Button, Card, dsInputClass, Field } from "@/components/ds";
import type { TierEntitlements } from "@llmchat/shared";

import type { ProjectDraft } from "../types";

/** Powered-by is server-authoritative + plan-gated (entitlements.branding) — read
 * the real state, never a fake per-project toggle. */
function poweredByCopy(branding?: TierEntitlements["branding"]) {
	if (branding === "badge")
		return {
			state: "Shown",
			note: "The “Powered by Clanker” badge is on your plan. Upgrade to remove it.",
		};
	if (branding === "off" || branding === "custom")
		return { state: "Hidden", note: "Removed on your plan." };
	return { state: "—", note: "Set by your plan." };
}

export function GeneralTab({
	draft,
	set,
	branding,
	onRequestDelete,
}: {
	draft: ProjectDraft;
	set: <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => void;
	branding?: TierEntitlements["branding"];
	onRequestDelete: () => void;
}) {
	const powered = poweredByCopy(branding);
	return (
		<div className="flex flex-col gap-6">
			<Card className="flex flex-col gap-5 p-5">
				<Field
					label="Agent name"
					hint="Internal name for this support agent (shown in your dashboard)."
				>
					{(id) => (
						<input
							id={id}
							className={dsInputClass}
							value={draft.name}
							onChange={(e) => set("name", e.target.value)}
						/>
					)}
				</Field>

				{/* Powered-by: honest read-only, not a fake switch. */}
				<div className="flex items-center justify-between gap-4 border-t border-ck-border pt-4">
					<div>
						<p className="text-[13px] font-semibold text-ck-text">
							“Powered by Clanker” badge
						</p>
						<p className="text-xs text-ck-faint">{powered.note}</p>
					</div>
					<span className="shrink-0 rounded-full bg-ck-chip px-2.5 py-1 text-[11px] font-semibold text-ck-muted">
						{powered.state}
					</span>
				</div>
			</Card>

			{/* Danger zone — delete is non-optimistic + confirmed (dialog in page). */}
			<Card className="flex items-center justify-between gap-4 border-ck-warn/30 bg-ck-warn/5 p-5">
				<div>
					<p className="text-[13px] font-semibold text-ck-warn">Danger zone</p>
					<p className="text-xs text-ck-muted">
						Permanently delete this project and all its conversations.
					</p>
				</div>
				<Button
					variant="outline"
					className="shrink-0 border-ck-warn/30 text-ck-warn hover:bg-ck-warn/10 hover:text-ck-warn"
					onClick={onRequestDelete}
				>
					<Trash2 className="size-4" />
					Delete project
				</Button>
			</Card>
		</div>
	);
}
