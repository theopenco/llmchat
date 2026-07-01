// Analytics cookie consent — single source of truth shared by the browser apps
// (marketing + dashboard). EU/EEA + UK visitors must give prior opt-in consent
// before any analytics cookies are set (GDPR / UK-GDPR + the ePrivacy/PECR
// cookie rules); elsewhere we treat continued use as implied consent and load
// analytics immediately. All functions are browser-only and guard their globals
// so this module is safe to import from non-DOM runtimes (it has no top-level
// side effects).

export const CONSENT_STORAGE_KEY = "ph_analytics_consent";

export type ConsentValue = "granted" | "denied";

// EEA + UK + EFTA (CH, NO, IS, LI) sit under IANA `Europe/*`. A few EEA regions
// live outside that prefix (Iceland, plus Portugal's Atlantic territories), so
// list them explicitly. This errs toward asking a little more broadly than the
// strict legal map (e.g. it also catches non-EU `Europe/*` zones) — that is the
// privacy-protective direction, so it's the safe default.
const CONSENT_REQUIRED_EXTRA_ZONES = new Set([
	"Atlantic/Reykjavik", // Iceland (EEA)
	"Atlantic/Madeira", // Portugal
	"Atlantic/Canary", // Spain
	"Atlantic/Azores", // Portugal
]);

function currentTimeZone(): string {
	if (typeof Intl === "undefined" || !Intl.DateTimeFormat) return "";
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
	} catch {
		return "";
	}
}

/**
 * Whether the visitor is in a jurisdiction that requires prior opt-in consent
 * for analytics cookies. Detected from the browser's IANA time zone (no network
 * call, no geo-IP). When the zone can't be read we assume consent is required —
 * the conservative, privacy-protective default.
 */
export function isConsentRequiredRegion(
	timeZone: string = currentTimeZone(),
): boolean {
	if (!timeZone) return true;
	if (timeZone.startsWith("Europe/")) return true;
	return CONSENT_REQUIRED_EXTRA_ZONES.has(timeZone);
}

/** Read the visitor's stored consent decision, or null if none recorded yet. */
export function getStoredConsent(): ConsentValue | null {
	if (typeof window === "undefined") return null;
	try {
		const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
		return v === "granted" || v === "denied" ? v : null;
	} catch {
		return null;
	}
}

/** Persist the visitor's consent decision. No-ops if storage is unavailable. */
export function setStoredConsent(value: ConsentValue): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
	} catch {
		// private mode / storage disabled — nothing else we can do
	}
}
