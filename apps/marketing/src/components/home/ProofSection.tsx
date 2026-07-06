import Image from "next/image";
import { Safari } from "@/components/magicui/safari";

/**
 * Real pixels only: both images are actual product screenshots from our own
 * workspace (fictional persona data, same standard as the docs screenshots).
 * No mocked UI, no invented metrics.
 */
export function ProofSection() {
	return (
		<section className="mx-auto max-w-6xl px-6 py-24">
			<p className="kicker">Real product</p>
			<h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-tight-display text-ink sm:text-4xl">
				The inbox your team works. The widget your customers see.
			</h2>
			<p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
				Actual screenshots — an escalated conversation landing in the team
				inbox, and the live widget mid-answer.
			</p>

			<div className="mt-12 grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
				<Safari
					url="app.clankersupport.com/inbox"
					imageSrc="/proof/inbox-escalation.webp"
					className="size-full"
				/>
				<div className="overflow-hidden rounded-2xl border border-rule bg-paper-card/60 shadow-lift">
					<Image
						src="/proof/widget-live.webp"
						alt="The Clanker Support widget answering a visitor question"
						width={800}
						height={1904}
						className="h-auto w-full"
					/>
				</div>
			</div>
		</section>
	);
}
