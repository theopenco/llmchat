// Inline SVG icons — kept hand-rolled so the public embed pulls in no icon
// library. All are decorative; the interactive buttons carry the aria-labels.
type IconProps = { className?: string };

export function ChatIcon({ className }: IconProps) {
	return (
		<svg
			className={className}
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.6a8.5 8.5 0 0 1-.9-3.9A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
		</svg>
	);
}

export function CloseIcon({ className }: IconProps) {
	return (
		<svg
			className={className}
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	);
}

export function SendIcon({ className }: IconProps) {
	return (
		<svg
			className={className}
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
		</svg>
	);
}

export function AgentIcon({ className }: IconProps) {
	return (
		<svg
			className={className}
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M3 18v-2a4 4 0 0 1 4-4h2M21 18v-2a4 4 0 0 0-4-4h-2" />
			<circle cx="12" cy="7" r="4" />
		</svg>
	);
}
