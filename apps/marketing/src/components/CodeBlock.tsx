export function CodeBlock({ code, label }: { code: string; label?: string }) {
	return (
		<div className="overflow-hidden rounded-xl border border-ink/15 bg-ink shadow-[0_20px_45px_-28px_rgba(26,25,22,0.7)]">
			{label && (
				<div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
					<span className="h-2.5 w-2.5 rounded-full bg-accent" />
					<span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-paper/55">
						{label}
					</span>
				</div>
			)}
			<pre className="overflow-x-auto px-4 py-4 font-mono text-[0.82rem] leading-relaxed text-paper/90">
				<code>{code}</code>
			</pre>
		</div>
	);
}
