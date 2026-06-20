import { Suspense } from "react";
import { type Components, Streamdown } from "streamdown";

// Render links as real anchors that open in a new tab. Streamdown's default
// link is a <button> (for an optional safety modal), which loses hover preview,
// middle-click, and "open in new tab" — all expected of a link in a chat reply.
// Streamdown still sanitizes/hardens the href upstream (only safe protocols
// reach here), so this only changes the element, not the safety.
const components: Components = {
	a: ({ node: _node, children, ...props }) => (
		<a {...props} target="_blank" rel="noopener noreferrer nofollow">
			{children}
		</a>
	),
};

/**
 * Renders an assistant/agent message body as Markdown.
 *
 * The AI streams Markdown, so a raw `[label](url)` was previously shown
 * verbatim. Streamdown turns it into real elements — links, lists, code,
 * emphasis, tables — and is built for streaming: it tolerates the partial
 * Markdown that arrives mid-token and hardens/sanitizes the output (only safe
 * link protocols survive), which matters for content we render inside a page we
 * don't control.
 *
 * Styling comes from the widget's own shadow-DOM stylesheet (`.llmchat-md` in
 * styles.ts) rather than Tailwind, so no extra CSS ships. Control affordances
 * (copy / download / fullscreen) and code line numbers are turned off to keep a
 * support bubble uncluttered; token fade-in is off so we don't depend on
 * Streamdown's stylesheet. The Suspense boundary covers Streamdown's lazily
 * mounted block components, falling back to the raw text while they load.
 */
export function Markdown({ content }: { content: string }) {
	return (
		<Suspense fallback={<span className="llmchat-md">{content}</span>}>
			<Streamdown
				className="llmchat-md"
				components={components}
				controls={false}
				animated={false}
				lineNumbers={false}
			>
				{content}
			</Streamdown>
		</Suspense>
	);
}
