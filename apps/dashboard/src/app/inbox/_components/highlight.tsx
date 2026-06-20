import { Fragment } from "react";

export interface HighlightSegment {
	text: string;
	hit: boolean;
}

/**
 * Split `text` into segments around every case-insensitive occurrence of
 * `query`. Pure and exported for testing. An empty query yields a single
 * non-hit segment (no highlighting).
 */
export function highlightSegments(
	text: string,
	query: string,
): HighlightSegment[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return text ? [{ text, hit: false }] : [];

	const segments: HighlightSegment[] = [];
	const haystack = text.toLowerCase();
	let cursor = 0;
	for (;;) {
		const idx = haystack.indexOf(needle, cursor);
		if (idx === -1) {
			if (cursor < text.length) {
				segments.push({ text: text.slice(cursor), hit: false });
			}
			break;
		}
		if (idx > cursor)
			segments.push({ text: text.slice(cursor, idx), hit: false });
		segments.push({ text: text.slice(idx, idx + needle.length), hit: true });
		cursor = idx + needle.length;
	}
	return segments;
}

/**
 * Render `text` with every occurrence of `query` wrapped in `<mark>`. The text
 * segments are rendered as React string children, which React **auto-escapes**,
 * so a message containing HTML (e.g. `<img onerror=…>`) shows as inert text and
 * can never inject — we deliberately never use dangerouslySetInnerHTML here.
 */
export function Highlighted({ text, query }: { text: string; query: string }) {
	const segments = highlightSegments(text, query);
	return (
		<>
			{segments.map((seg, i) =>
				seg.hit ? (
					<mark
						key={i}
						className="rounded-[2px] bg-amber-200/80 px-0.5 text-foreground dark:bg-amber-400/30 dark:text-amber-50"
					>
						{seg.text}
					</mark>
				) : (
					<Fragment key={i}>{seg.text}</Fragment>
				),
			)}
		</>
	);
}
