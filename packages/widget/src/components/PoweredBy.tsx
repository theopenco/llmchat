/**
 * "Powered by Clanker Support" attribution badge shown at the foot of the live
 * widget panel on plans that include it (Starter). Higher tiers suppress it;
 * the decision is server-driven (see useShowBranding), not customer markup.
 */
export function PoweredBy() {
	return (
		<a
			className="llmchat-powered-by"
			href="https://clankersupport.com"
			target="_blank"
			rel="noopener noreferrer"
		>
			Powered by{" "}
			<span className="llmchat-powered-by-name">Clanker Support</span>
		</a>
	);
}
