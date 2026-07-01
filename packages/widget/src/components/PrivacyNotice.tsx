import { useState } from "react";

import { CloseIcon } from "./icons";

// Default privacy policy the chat is processed under when the project hasn't set
// its own (Clanker Support is the processor). The widget is embedded on customer
// sites, so this is an absolute URL that opens the policy in a new tab.
const DEFAULT_PRIVACY_POLICY_URL = "https://clankersupport.com/privacy-policy";

/**
 * Consent bar shown directly above the composer at the start of a chat and
 * removed once the visitor sends their first message (the caller gates on the
 * user message count). Purely informational — it never blocks sending.
 *
 * The × only hides the reminder for the current view (in-memory, resets on
 * reload). Consent still happens by the act of chatting, so dismissing changes
 * nothing about the consent/privacy behaviour — it just clears the notice.
 *
 * Links to the project's configured privacy policy URL when set, otherwise the
 * Clanker Support default.
 */
export function PrivacyNotice({
	privacyPolicyUrl,
}: {
	privacyPolicyUrl?: string | null;
}) {
	const [dismissed, setDismissed] = useState(false);
	if (dismissed) return null;

	const href = privacyPolicyUrl || DEFAULT_PRIVACY_POLICY_URL;
	return (
		<div className="llmchat-privacy">
			<p className="llmchat-privacy-text">
				By chatting, you agree to our{" "}
				<a href={href} target="_blank" rel="noopener noreferrer">
					privacy policy
				</a>
				.
			</p>
			<button
				type="button"
				className="llmchat-privacy-dismiss"
				onClick={() => setDismissed(true)}
				aria-label="Dismiss privacy notice"
			>
				<CloseIcon className="llmchat-privacy-dismiss-icon" />
			</button>
		</div>
	);
}
