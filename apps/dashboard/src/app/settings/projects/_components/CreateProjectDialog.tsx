"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	onNameChange: (name: string) => void;
	onSubmit: () => void;
	pending: boolean;
}

export function CreateProjectDialog({
	open,
	onOpenChange,
	name,
	onNameChange,
	onSubmit,
	pending,
}: CreateProjectDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create a new project</DialogTitle>
					<DialogDescription>
						Give your project a name to get started.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (name.trim()) onSubmit();
					}}
					className="flex flex-col gap-4"
				>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="new-project-name">Project name</Label>
						<Input
							id="new-project-name"
							autoFocus
							required
							placeholder="e.g. Support Bot, Sales Assistant"
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={pending || !name.trim()}>
							{pending ? "Creating…" : "Create Project"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
