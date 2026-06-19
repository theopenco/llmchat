"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	getStoredConsent,
	isConsentRequiredRegion,
	setStoredConsent,
} from "@llmchat/shared";
import { ConsentBanner } from "@/components/ConsentBanner";

type ConsentContextValue = {
	/** True once analytics may load — explicit opt-in, or implied consent
	 * outside the EU/EEA + UK. Every analytics integration gates on this. */
	granted: boolean;
	accept: () => void;
	decline: () => void;
};

const ConsentContext = createContext<ConsentContextValue>({
	granted: false,
	accept: () => {},
	decline: () => {},
});

/** Read the visitor's consent state. Consumed by PostHog + Google Analytics. */
export function useConsent() {
	return useContext(ConsentContext);
}

/**
 * Single source of truth for analytics cookie consent. EU/EEA + UK visitors get
 * a banner and nothing loads until they accept; elsewhere we treat continued
 * use as implied consent. Owns the banner so every analytics integration can
 * gate on one `granted` flag instead of each re-reading storage.
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
	const [granted, setGranted] = useState(false);
	const [showBanner, setShowBanner] = useState(false);

	useEffect(() => {
		const stored = getStoredConsent();
		if (stored === "granted") {
			setGranted(true);
			return;
		}
		if (stored === "denied") return;
		// No decision yet: EU/EEA + UK require opt-in, so gate behind the banner.
		// Elsewhere, treat continued use as implied consent and allow analytics.
		if (isConsentRequiredRegion()) {
			setShowBanner(true);
		} else {
			setGranted(true);
		}
	}, []);

	const accept = useCallback(() => {
		setStoredConsent("granted");
		setShowBanner(false);
		setGranted(true);
	}, []);

	const decline = useCallback(() => {
		setStoredConsent("denied");
		setShowBanner(false);
	}, []);

	return (
		<ConsentContext.Provider value={{ granted, accept, decline }}>
			{children}
			{showBanner && <ConsentBanner onAccept={accept} onDecline={decline} />}
		</ConsentContext.Provider>
	);
}
