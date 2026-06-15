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
			<div className="llmchat-identify-intro">
				<h2 className="llmchat-identify-title">Welcome 👋</h2>
				<p className="llmchat-identify-sub">
					Tell us who you are and we'll get the conversation started.
				</p>
			</div>
			<label className="llmchat-field">
				<span className="llmchat-field-label">Name</span>
				<input
					required
					autoFocus
					placeholder="Your name"
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
				/>
			</label>
			<label className="llmchat-field">
				<span className="llmchat-field-label">Email (optional)</span>
				<input
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => onEmailChange(e.target.value)}
				/>
			</label>
			<button type="submit">Start chat</button>
		</form>
	);
}
