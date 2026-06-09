"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function SetupProgressCard({
	hasProject,
	hasModel,
	hasInstructions,
	hasSources,
}: {
	hasProject: boolean;
	hasModel: boolean;
	hasInstructions: boolean;
	hasSources: boolean;
}) {
	const items = [
		{ label: "Project created", done: hasProject },
		{ label: "Model selected", done: hasModel },
		{ label: "Instructions configured", done: hasInstructions },
		{ label: "Sources added", done: hasSources },
	];
	const completed = items.filter((i) => i.done).length;

	return (
		<Card className="rounded-2xl shadow-sm">
			<CardHeader className="pb-3">
				<h3 className="text-base font-semibold text-foreground">
					Setup progress
				</h3>
				<p className="text-sm text-muted-foreground">
					{completed} of {items.length} completed
				</p>
				<Progress
					value={(completed / items.length) * 100}
					className="mt-2 h-2 [&>div]:bg-emerald-500"
				/>
			</CardHeader>
			<CardContent>
				<ul className="flex flex-col gap-3">
					{items.map((item) => (
						<li key={item.label} className="flex items-center gap-2.5 text-sm">
							{item.done ? (
								<CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
							) : (
								<Circle className="size-5 shrink-0 text-slate-300" />
							)}
							<span
								className={cn(
									item.done ? "text-foreground" : "text-muted-foreground",
								)}
							>
								{item.label}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
