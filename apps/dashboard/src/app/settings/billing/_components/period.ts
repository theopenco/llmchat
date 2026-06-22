/**
 * Human label for the current metering window, derived from the API's
 * `monthStartUnix` (UTC start-of-month). Real boundaries only — no guessing.
 * Falls back to a generic label when the timestamp is absent/zero.
 */
const day = (d: Date) =>
	d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});

export function periodLabel(monthStartUnix: number): string {
	if (!monthStartUnix) return "This billing period";
	const start = new Date(monthStartUnix * 1000);
	// Last day of the same UTC month.
	const end = new Date(
		Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
	);
	return `${day(start)} – ${day(end)}, ${start.getUTCFullYear()}`;
}
