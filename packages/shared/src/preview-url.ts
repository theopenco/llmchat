/**
 * Ploy serves preview deployments on hosts derived from the canonical one:
 * `<name>---<branch>.<domain>` for branch previews and `<name>--<sha>.<domain>`
 * for commit previews. Sibling services of one workspace share the suffix, so
 * a page running on a preview host can reach its preview API by grafting its
 * own suffix onto the API's canonical URL.
 *
 * Returns `canonicalUrl` unchanged when the current host is not a preview of
 * the same domain (localhost, custom domains, the canonical host itself).
 */
export function resolveSiblingUrl(
	canonicalUrl: string,
	currentHostname: string,
): string {
	let url: URL;
	try {
		url = new URL(canonicalUrl);
	} catch {
		return canonicalUrl;
	}
	const [canonicalName, ...domainParts] = url.hostname.split(".");
	const [currentName, ...currentDomainParts] = currentHostname.split(".");
	const domain = domainParts.join(".");
	if (!domain || domain !== currentDomainParts.join(".")) {
		return canonicalUrl;
	}
	const suffixStart = currentName.indexOf("--");
	if (suffixStart === -1) {
		return canonicalUrl;
	}
	url.hostname = `${canonicalName}${currentName.slice(suffixStart)}.${domain}`;
	return url.origin;
}
