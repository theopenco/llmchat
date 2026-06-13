import type { ReactNode } from "react";

/**
 * Shared chrome for every widget variant: the floating launcher bubble (in
 * bubble layout), the panel, and the branded header. Conversation behavior is
 * composed in via children — live and showcase variants render different
 * children inside the same frame.
 */
export function WidgetFrame({
	inline,
	brandColor,
	open,
	onOpenChange,
	badge,
	children,
}: {
	inline: boolean;
	brandColor: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional header adornment, e.g. the showcase "Demo mode" pill. */
	badge?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="llmchat" style={{ ["--brand" as string]: brandColor }}>
			{!inline && (
				<button
					type="button"
					className="llmchat-bubble"
					onClick={() => onOpenChange(!open)}
					aria-label={open ? "Close chat" : "Open chat"}
				>
					{open ? "×" : "💬"}
				</button>
			)}
			{open && (
				<div
					className={
						inline ? "llmchat-panel llmchat-panel-inline" : "llmchat-panel"
					}
					role={inline ? undefined : "dialog"}
				>
					<header className="llmchat-header">
						<span>Support</span>
						{badge}
						{!inline && (
							<button
								type="button"
								onClick={() => onOpenChange(false)}
								aria-label="Close"
							>
								×
							</button>
						)}
					</header>
					{children}
				</div>
			)}
		</div>
	);
}
