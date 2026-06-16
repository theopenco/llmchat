"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";

/** Single-field first step: name the chatbot/business. */
export function OnboardingNameStep({
	onSubmit,
	pending,
}: {
	onSubmit: (name: string) => void;
	pending: boolean;
}) {
	const [name, setName] = useState("");
	const trimmed = name.trim();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!trimmed || pending) return;
		onSubmit(trimmed);
	}

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle className="text-xl">Name your chatbot</CardTitle>
				<CardDescription>
					We&apos;ll set up a support assistant for your business. You can
					change everything later.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<FormField id="business-name" label="Business or chatbot name">
						<Input
							id="business-name"
							autoFocus
							placeholder="Acme Tools"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</FormField>
					<Button
						type="submit"
						disabled={!trimmed || pending}
						className="w-full"
					>
						{pending ? "Creating…" : "Create chatbot"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
