"use client";

import { MessageList, WidgetFrame } from "@llmchat/widget/chat";

import { defaultWelcomeMessage } from "@/lib/onboarding";

/**
 * The real widget chat surface (the same WidgetFrame + MessageList the embed
 * ships), bound to the form so the agent visibly takes shape: the brand color
 * recolors the chrome, the header shows the agent name, and the greeting bubble
 * shows the welcome message — all live as the user types.
 *
 * This is a *preview*, not a live bot: it makes no /v1 call (there's no project
 * yet). Onboarding ends here — once the form provisions the project, the user is
 * routed to its settings page, where the real embed snippet lives.
 */
export function LivePreview({
	name,
	welcomeMessage,
	brandColor,
}: {
	name: string;
	welcomeMessage: string;
	brandColor: string;
}) {
	const greeting = welcomeMessage.trim() || defaultWelcomeMessage(name);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
				Live preview · updates as you type
			</p>
			<div className="relative h-[34rem] overflow-hidden rounded-2xl border border-border shadow-xl">
				<WidgetFrame
					inline
					open
					brandColor={brandColor}
					onOpenChange={() => {}}
					badge={
						<span
							className="truncate rounded-full px-2 py-0.5 text-[11px] font-medium"
							style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
						>
							{name.trim() || "Your agent"}
						</span>
					}
				>
					<MessageList
						greeting={greeting}
						messages={[]}
						typing={false}
						error={null}
					/>
				</WidgetFrame>
			</div>
		</div>
	);
}
