// Cal.com API v2 client — plain fetch, workerd-safe (no SDK; same posture as
// lib/stripe.ts). The agent books against ONE configured event type; Zoom (or
// Meet/phone) comes from that event type's location in Cal.com, surfaced back
// through the booking response's `location` join link.

import type { CalcomConfig } from "@llmchat/shared";

const DEFAULT_BASE = "https://api.cal.com";
// Versioned per endpoint (Cal.com pins each route separately).
const SLOTS_API_VERSION = "2024-09-04";
const BOOKINGS_API_VERSION = "2024-08-13";

/** Upstream failure with a visitor-safe message (no key material, no URLs). */
export class CalcomError extends Error {}

function base(cfg: CalcomConfig): string {
	return (cfg.apiBase ?? DEFAULT_BASE).replace(/\/$/, "");
}

async function calFetch(
	cfg: CalcomConfig,
	path: string,
	apiVersion: string,
	init?: RequestInit,
): Promise<unknown> {
	// Typed off fetch itself — the workerd Response type and lib.dom's disagree.
	let res: Awaited<ReturnType<typeof fetch>>;
	try {
		res = await fetch(`${base(cfg)}${path}`, {
			...init,
			headers: {
				authorization: `Bearer ${cfg.apiKey}`,
				"cal-api-version": apiVersion,
				"content-type": "application/json",
				...init?.headers,
			},
		});
	} catch {
		throw new CalcomError("the scheduling service could not be reached");
	}
	const body = (await res.json().catch(() => null)) as {
		status?: string;
		data?: unknown;
		error?: { message?: string };
	} | null;
	if (!res.ok || body?.status !== "success") {
		// Cal.com error messages are safe to relay ("no_available_users_found_error"
		// etc.) and help the model recover — e.g. offer a different time.
		const detail =
			body?.error?.message ?? `scheduling request failed (${res.status})`;
		throw new CalcomError(detail);
	}
	return body.data;
}

export interface CalcomSlot {
	/** ISO start time, in the event type's / requested time zone. */
	start: string;
}

/**
 * Available slots for the configured event type between two ISO dates
 * (inclusive), flattened and capped so a wide-open calendar can't flood the
 * model's context.
 */
export async function calcomGetSlots(
	cfg: CalcomConfig,
	opts: { start: string; end: string; maxSlots?: number },
): Promise<CalcomSlot[]> {
	const params = new URLSearchParams({
		eventTypeId: String(cfg.eventTypeId),
		start: opts.start,
		end: opts.end,
		timeZone: cfg.timeZone,
	});
	const data = await calFetch(cfg, `/v2/slots?${params}`, SLOTS_API_VERSION);
	// Shape: { "2026-07-07": [{ start: "..." }, ...], ... }
	const flat: CalcomSlot[] = [];
	if (data && typeof data === "object") {
		for (const day of Object.values(data as Record<string, unknown>)) {
			if (!Array.isArray(day)) continue;
			for (const slot of day) {
				const start = (slot as { start?: unknown })?.start;
				if (typeof start === "string") flat.push({ start });
			}
		}
	}
	flat.sort((a, b) => a.start.localeCompare(b.start));
	return flat.slice(0, opts.maxSlots ?? 40);
}

export interface CalcomBooking {
	uid: string;
	status: string;
	start: string;
	end?: string;
	/** Join link (Zoom/Meet/…) or location text from the event type. */
	location?: string;
}

/** Book the configured event type for an attendee at a given start time. */
export async function calcomCreateBooking(
	cfg: CalcomConfig,
	opts: { start: string; name: string; email: string; notes?: string },
): Promise<CalcomBooking> {
	const data = (await calFetch(cfg, "/v2/bookings", BOOKINGS_API_VERSION, {
		method: "POST",
		body: JSON.stringify({
			start: opts.start,
			eventTypeId: cfg.eventTypeId,
			attendee: {
				name: opts.name,
				email: opts.email,
				timeZone: cfg.timeZone,
			},
			...(opts.notes ? { metadata: { notes: opts.notes.slice(0, 500) } } : {}),
		}),
	})) as {
		uid?: unknown;
		status?: unknown;
		start?: unknown;
		end?: unknown;
		location?: unknown;
	};
	if (typeof data?.uid !== "string") {
		throw new CalcomError("booking was not confirmed");
	}
	return {
		uid: data.uid,
		status: typeof data.status === "string" ? data.status : "unknown",
		start: typeof data.start === "string" ? data.start : opts.start,
		end: typeof data.end === "string" ? data.end : undefined,
		location: typeof data.location === "string" ? data.location : undefined,
	};
}
