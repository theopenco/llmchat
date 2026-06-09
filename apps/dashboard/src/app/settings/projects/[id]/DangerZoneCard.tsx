"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DangerZoneCard({ onDelete }: { onDelete: () => void }) {
	return (
		<Card className="rounded-2xl border-red-500/30 bg-red-500/5 shadow-sm">
			<CardHeader className="pb-2">
				<h3 className="text-base font-semibold text-red-600 dark:text-red-400">
					Danger zone
				</h3>
				<p className="text-sm text-red-600/80 dark:text-red-400/80">
					Delete this project permanently.
				</p>
			</CardHeader>
			<CardContent>
				<Button
					type="button"
					variant="outline"
					className="border-red-500/30 bg-card text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
					onClick={onDelete}
				>
					<Trash2 />
					Delete project
				</Button>
			</CardContent>
		</Card>
	);
}
