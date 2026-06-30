// The privacy policy the chat is processed under (Clanker Support is the
// processor). The widget is embedded on customer sites, so this is an absolute
// URL that opens the marketing-site policy in a new tab.
const PRIVACY_POLICY_URL = "https://clankersupport.com/privacy-policy";

/**
 * Consent line shown directly above the composer at the start of a chat and
 * removed once the visitor sends their first message (the caller gates on the
 * user message count). Purely informational — it never blocks sending.
 */
export function PrivacyNotice() {
	return (
		<p className="llmchat-privacy">
			By chatting, you agree to our{" "}
			<a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
				privacy policy
			</a>
			.
		</p>
	);
}
