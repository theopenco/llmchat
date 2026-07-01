/** Tiny classnames joiner — drops falsy parts. Avoids a clsx dependency. */
export function cx(...parts: (string | false | null | undefined)[]): string {
	return parts.filter(Boolean).join(" ");
}
