"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Tag } from "./types";

const FALLBACK = "#6b7280"; // gray-500 when a tag has no color

/** Tint a tag's color into a soft chip (subtle bg/border, readable text) that
 * reads in both themes — we never paint the raw saturated color as a fill. */
function chipStyle(color: string | null): React.CSSProperties {
	const c = color ?? FALLBACK;
	return {
		// 18% bg / 38% border over the theme surface; text stays the full color and
		// is lightened by the dark-mode class below.
		backgroundColor: `${c}2e`,
		borderColor: `${c}61`,
		color: c,
	};
}

export function TagChip({
	tag,
	onRemove,
	className,
}: {
	tag: Pick<Tag, "id" | "name" | "color">;
	/** When provided, renders a trailing "×" that calls this instead of nothing. */
	onRemove?: (tagId: string) => void;
	className?: string;
}) {
	return (
		<span
			style={chipStyle(tag.color)}
			className={cn(
				"inline-flex max-w-[10rem] items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium leading-5 [color-scheme:light] dark:brightness-150",
				className,
			)}
		>
			<span className="truncate">{tag.name}</span>
			{onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onRemove(tag.id);
					}}
					aria-label={`Remove tag ${tag.name}`}
					className="-mr-0.5 grid size-3.5 shrink-0 place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/15"
				>
					<X className="size-2.5" />
				</button>
			)}
		</span>
	);
}
