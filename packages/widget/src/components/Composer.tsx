import { SendIcon } from "./icons";

export function Composer({
	value,
	disabled,
	onChange,
	onSubmit,
}: {
	value: string;
	/** Sending in flight — blocks submit but keeps typing available. */
	disabled: boolean;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	function submit() {
		if (!value.trim() || disabled) {
			return;
		}
		onSubmit();
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submit();
			}}
			className="llmchat-input"
		>
			<textarea
				rows={1}
				value={value}
				// Content-driven direction: typing Arabic/Hebrew/Farsi flips the
				// field RTL as the visitor types; empty falls back to the
				// placeholder's LTR. Matches the bubbles' dir="auto".
				dir="auto"
				aria-label="Message"
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}}
				placeholder="Type a message…"
			/>
			<button
				type="submit"
				className="llmchat-send"
				disabled={!value.trim() || disabled}
				aria-label="Send message"
			>
				<SendIcon />
			</button>
		</form>
	);
}
