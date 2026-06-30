// Default privacy policy the chat is processed under when the project hasn't set
// its own (Clanker Support is the processor). The widget is embedded on customer
// sites, so this is an absolute URL that opens the policy in a new tab.
const DEFAULT_PRIVACY_POLICY_URL = "https://clankersupport.com/privacy-policy";

/**
 * Consent line shown directly above the composer at the start of a chat and
 * removed once the visitor sends their first message (the caller gates on the
 * user message count). Purely informational — it never blocks sending.
 *
 * Links to the project's configured privacy policy URL when set, otherwise the
 * Clanker Support default.
 */
export function PrivacyNotice({
	privacyPolicyUrl,
}: {
	privacyPolicyUrl?: string | null;
}) {
	const href = privacyPolicyUrl || DEFAULT_PRIVACY_POLICY_URL;
	return (
		<p className="llmchat-privacy">
			By chatting, you agree to our{" "}
			<a href={href} target="_blank" rel="noopener noreferrer">
				privacy policy
			</a>
			.
		</p>
	);
}
