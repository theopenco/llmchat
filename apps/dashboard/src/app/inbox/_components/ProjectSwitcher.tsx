"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface ProjectOption {
	id: string;
	name: string;
}

export function ProjectSwitcher({
	projects,
	value,
	onChange,
}: {
	projects: ProjectOption[];
	value: string | null;
	onChange: (id: string) => void;
}) {
	return (
		<div className="border-b p-3">
			<Select value={value ?? undefined} onValueChange={onChange}>
				<SelectTrigger className="w-full" aria-label="Project">
					<SelectValue placeholder="Select a project" />
				</SelectTrigger>
				<SelectContent>
					{projects.map((p) => (
						<SelectItem key={p.id} value={p.id}>
							{p.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
