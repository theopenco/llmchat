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
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						submit();
					}
				}}
				placeholder="Type a message…"
			/>
			<button type="submit" disabled={!value.trim() || disabled}>
				Send
			</button>
		</form>
	);
}
