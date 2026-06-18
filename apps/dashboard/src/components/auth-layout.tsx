import Link from "next/link";
import { Inbox, ShieldCheck, Users, Zap } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";

const FEATURES = [
	{
		icon: Inbox,
		tone: "bg-primary/15 text-primary",
		title: "Conversations in one inbox",
		body: "All visitor conversations in a single place",
	},
	{
		icon: Zap,
		tone: "bg-emerald-500/15 text-emerald-400",
		title: "Any model, any provider",
		body: "Powered by LLMGateway",
	},
	{
		icon: Users,
		tone: "bg-amber-500/15 text-amber-400",
		title: "Escalate to your team",
		body: "Visitors → humans, seamlessly",
	},
];

/** The dark brand panel (always dark, with its aurora) shown beside the form. */
function BrandPanel() {
	return (
		<div className="dark aurora relative hidden flex-col justify-between overflow-hidden bg-background p-12 text-foreground lg:flex">
			<div className="flex items-center gap-2">
				<BrandLogo className="size-9" />
				<span className="font-display text-xl font-semibold tracking-tight-display">
					Clanker Support
				</span>
			</div>

			<div className="relative max-w-md">
				<h2 className="font-display text-4xl font-semibold leading-tight tracking-tight-display">
					AI support that actually{" "}
					<span className="text-primary underline decoration-primary/50 underline-offset-4">
						escalates
					</span>
				</h2>
				<p className="mt-4 text-base text-muted-foreground">
					Manage conversations, train your bot on your docs, and escalate to
					humans — all in one place.
				</p>

				<ul className="mt-10 flex flex-col gap-5">
					{FEATURES.map((f) => (
						<li key={f.title} className="flex items-start gap-3">
							<span
								className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${f.tone}`}
							>
								<f.icon className="size-5" />
							</span>
							<div>
								<p className="font-medium">{f.title}</p>
								<p className="text-sm text-muted-foreground">{f.body}</p>
							</div>
						</li>
					))}
				</ul>
			</div>

			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<ShieldCheck className="size-4" />
				<span>
					<span className="font-medium text-foreground">
						Enterprise-grade security
					</span>{" "}
					— your data is encrypted and secure
				</span>
			</div>
		</div>
	);
}

/**
 * Split-screen auth shell from the mockups: dark brand panel (left, lg+) and the
 * form column (right). Replaces the old centered AuthCard.
 */
export function AuthLayout({
	heading,
	subheading,
	children,
}: {
	heading: React.ReactNode;
	subheading: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<BrandPanel />
			<main className="flex flex-col">
				<div className="flex flex-1 items-center justify-center p-6">
					<div className="w-full max-w-sm">
						<h1 className="font-display text-3xl font-semibold tracking-tight-display">
							{heading}
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
						<div className="mt-8">{children}</div>
					</div>
				</div>
				<footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 p-6 text-xs text-muted-foreground">
					<span>
						© {new Date().getFullYear()} Clanker Support. All rights reserved.
					</span>
					<Link href="/" className="hover:text-foreground">
						Privacy
					</Link>
					<span aria-hidden>·</span>
					<Link href="/" className="hover:text-foreground">
						Terms
					</Link>
				</footer>
			</main>
		</div>
	);
}
