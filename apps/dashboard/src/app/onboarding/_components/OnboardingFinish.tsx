"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { EmbedSnippet } from "@/components/embed-snippet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Final step: confirmation + the install snippet, reusing EmbedSnippet. */
export function OnboardingFinish({
	projectName,
	publicKey,
	brandColor,
}: {
	projectName: string;
	publicKey: string;
	brandColor: string;
}) {
	return (
		<Card className="w-full max-w-2xl">
			<CardHeader>
				<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
					<CheckCircle2 className="size-5" />
					<span className="text-sm font-medium">{projectName} is ready</span>
				</div>
				<CardTitle className="text-xl">Add the widget to your site</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				<EmbedSnippet publicKey={publicKey} brandColor={brandColor} />
				<div className="flex justify-end">
					<Button asChild>
						<Link href="/inbox">
							Go to dashboard
							<ArrowRight />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
