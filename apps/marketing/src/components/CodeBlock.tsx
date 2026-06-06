export function CodeBlock({ code, label }: { code: string; label?: string }) {
	return (
		<div className="overflow-hidden rounded-xl border border-gray-200">
			{label && (
				<div className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
					{label}
				</div>
			)}
			<pre className="overflow-x-auto bg-gray-900 px-4 py-4 text-sm leading-relaxed text-gray-100">
				<code>{code}</code>
			</pre>
		</div>
	);
}
