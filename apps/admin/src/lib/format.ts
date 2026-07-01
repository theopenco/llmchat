const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-US", {
	notation: "compact",
	compactDisplay: "short",
	maximumFractionDigits: 1,
});
const usd0 = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 2,
});
const usd4 = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 4,
});
const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});
const dayFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** Whole-number count, thousands-separated. */
export function fmtInt(n: number | null | undefined): string {
	return intFmt.format(n ?? 0);
}

/** Compact count (1.2k, 3.4M) for tight spaces / large totals. */
export function fmtCompact(n: number | null | undefined): string {
	return compactFmt.format(n ?? 0);
}

/** Whole-dollar amount (revenue headlines). */
export function fmtUsd(n: number | null | undefined): string {
	return usd0.format(n ?? 0);
}

/** Dollar amount with precision that scales to size: sub-dollar costs show 4
 * decimals, everything else 2. */
export function fmtUsdPrecise(n: number | null | undefined): string {
	const v = n ?? 0;
	if (v > 0 && v < 1) return usd4.format(v);
	return usd2.format(v);
}

/** "Jan 5, 2026" from an ISO string / epoch / Date. */
export function fmtDate(
	iso: string | number | Date | null | undefined,
): string {
	if (iso === null || iso === undefined) return "—";
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** "Jan 5" from a `YYYY-MM-DD` series key (parsed as UTC — no timezone drift). */
export function fmtDayLabel(dayKey: string): string {
	const d = new Date(`${dayKey}T00:00:00Z`);
	return Number.isNaN(d.getTime()) ? dayKey : dayFmt.format(d);
}
