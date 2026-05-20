export function App() {
	return (
		<main className="page">
			<header className="topbar">
				<div className="brand">Acme Tools</div>
				<nav>
					<a href="#features">Features</a>
					<a href="#pricing">Pricing</a>
					<a href="#docs">Docs</a>
				</nav>
			</header>

			<section className="hero">
				<p className="kicker">llmchat showcase</p>
				<h1>Inventory software for hardware teams.</h1>
				<p className="lede">
					This is a fake landing page. The real point is the chat bubble in
					the bottom-right — that&apos;s the embedded llmchat widget, pointed
					at your local API.
				</p>
				<div className="cta-row">
					<button type="button" className="cta-primary">
						Start free trial
					</button>
					<a className="cta-secondary" href="#features">
						See features
					</a>
				</div>
			</section>

			<section id="features" className="features">
				<div className="card">
					<h2>Try it out</h2>
					<p>
						Click the chat bubble. Ask anything. Messages stream from the
						local API using the seeded project (<code>local-dev-key</code>).
					</p>
				</div>
				<div className="card">
					<h2>See it escalate</h2>
					<p>
						Send 3+ messages and the &ldquo;Talk to a human&rdquo; button
						appears. Clicking it flips the conversation to escalated.
					</p>
				</div>
				<div className="card">
					<h2>Check the inbox</h2>
					<p>
						Sign in to the dashboard at{" "}
						<a href="http://localhost:3001">localhost:3001</a> with{" "}
						<code>admin@example.com</code> / <code>admin@example.com</code>{" "}
						to see the conversation land.
					</p>
				</div>
			</section>

			<footer className="footer">
				Showcase only. Edit{" "}
				<code>apps/showcase/src/main.tsx</code> to change widget config.
			</footer>
		</main>
	);
}
