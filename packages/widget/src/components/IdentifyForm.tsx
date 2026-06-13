export function IdentifyForm({
	name,
	email,
	onNameChange,
	onEmailChange,
	onSubmit,
}: {
	name: string;
	email: string;
	onNameChange: (value: string) => void;
	onEmailChange: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (!name.trim()) {
					return;
				}
				onSubmit();
			}}
			className="llmchat-identify"
		>
			<p>Welcome! Tell us who you are.</p>
			<input
				required
				placeholder="Your name"
				value={name}
				onChange={(e) => onNameChange(e.target.value)}
			/>
			<input
				type="email"
				placeholder="Email (optional)"
				value={email}
				onChange={(e) => onEmailChange(e.target.value)}
			/>
			<button type="submit">Start chat</button>
		</form>
	);
}
