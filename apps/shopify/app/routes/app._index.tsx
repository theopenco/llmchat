import { useEffect, useState } from "react";
import type {
	ActionFunctionArgs,
	HeadersFunction,
	LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getShopify, getShopifyEnv } from "../shopify.server";
import {
	clankerApiOrigin,
	clearProjectKey,
	getConnection,
	maskKey,
	registerOrderActions,
	themeEditorDeepLink,
	validateProjectKey,
	writeProjectKey,
} from "../lib/clanker.server";

/**
 * The one settings page (docs/shopify-app-plan.md §5): a single card with
 * three states — not connected (paste key), couldn't-verify (offer
 * save-anyway), connected (masked key + theme-editor deep link).
 *
 * Status honesty: we do NOT claim to know whether the merchant toggled the
 * embed on in the theme editor — detecting that needs read_themes and
 * settings_data.json parsing (v1.1 candidate). The copy tells them what to do;
 * it never pretends to verify they did it.
 */

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
	const { admin, session } =
		await getShopify(context).authenticate.admin(request);
	// A null projectKey is first-run BY DEFINITION — including after a
	// reinstall. Metafield survival across uninstall/reinstall is undocumented;
	// we never assume the key is still there (plan §6).
	const { projectKey } = await getConnection(admin);
	return {
		connected: projectKey !== null && projectKey !== "",
		maskedKey: projectKey ? maskKey(projectKey) : null,
		enableUrl: themeEditorDeepLink(
			session.shop,
			getShopifyEnv(context).SHOPIFY_API_KEY || "",
		),
	};
};

export type ConnectActionResult =
	| { status: "connected" }
	| { status: "disconnected" }
	| { status: "invalid" }
	| { status: "unverified"; key: string }
	| { status: "actions-linked" }
	// `from` attributes the failure to a page section (link-actions renders its
	// own banner); absent = the connect/disconnect card owns it.
	| { status: "error"; message: string; from?: "link-actions" };

export const action = async ({
	request,
	context,
}: ActionFunctionArgs): Promise<ConnectActionResult> => {
	const { admin, session } =
		await getShopify(context).authenticate.admin(request);
	const form = await request.formData();
	const intent = form.get("intent");

	// Order actions: redeem the dashboard's one-time pairing code with this
	// shop's domain + offline Admin token so the Clanker agent can look up
	// orders and file returns (needs the read_orders/write_returns scopes).
	if (intent === "link-actions") {
		const code = String(form.get("pairCode") ?? "").trim();
		if (!code) {
			return {
				status: "error",
				message: "Enter the pairing code.",
				from: "link-actions",
			};
		}
		if (!session.accessToken) {
			return {
				status: "error",
				message: "No Admin API token on this session — reinstall the app.",
				from: "link-actions",
			};
		}
		const result = await registerOrderActions(
			{ code, shopDomain: session.shop, accessToken: session.accessToken },
			fetch,
			clankerApiOrigin(getShopifyEnv(context)),
		);
		return result.ok
			? { status: "actions-linked" }
			: { status: "error", message: result.message, from: "link-actions" };
	}

	if (intent === "disconnect") {
		const { installationId } = await getConnection(admin);
		const result = await clearProjectKey(admin, installationId);
		return result.ok
			? { status: "disconnected" }
			: { status: "error", message: result.message };
	}

	const key = String(form.get("projectKey") ?? "").trim();
	if (!key) {
		return { status: "error", message: "Enter your Clanker project key." };
	}

	// Save-anyway is the merchant's explicit choice after a "couldn't verify":
	// we write without re-validating (re-checking would just replay the flake).
	const saveAnyway = form.get("saveAnyway") === "true";
	if (!saveAnyway) {
		// Origin resolves from the request context on workerd (no ambient
		// process.env there); clankerApiOrigin owns the fallback chain.
		const verdict = await validateProjectKey(
			key,
			fetch,
			clankerApiOrigin(getShopifyEnv(context)),
		);
		if (verdict === "invalid") return { status: "invalid" };
		if (verdict === "unverified") return { status: "unverified", key };
	}

	const { installationId } = await getConnection(admin);
	const result = await writeProjectKey(admin, installationId, key);
	return result.ok
		? { status: "connected" }
		: { status: "error", message: result.message };
};

export default function Index() {
	const { connected, maskedKey, enableUrl } = useLoaderData<typeof loader>();
	const fetcher = useFetcher<typeof action>();
	const shopify = useAppBridge();
	const [key, setKey] = useState("");
	const [pairCode, setPairCode] = useState("");
	const result = fetcher.data;

	// Attribute the spinner to the control that was actually clicked — four
	// submit paths share one fetcher.
	const busy = fetcher.state !== "idle";
	const savingAnyway = busy && fetcher.formData?.get("saveAnyway") === "true";
	const disconnecting =
		busy && fetcher.formData?.get("intent") === "disconnect";
	const linking = busy && fetcher.formData?.get("intent") === "link-actions";
	const connecting = busy && !savingAnyway && !disconnecting && !linking;

	useEffect(() => {
		if (result?.status === "connected") {
			shopify.toast.show("Clanker project connected");
			setKey("");
		}
		if (result?.status === "disconnected") {
			shopify.toast.show("Project disconnected");
		}
		if (result?.status === "actions-linked") {
			shopify.toast.show("Order actions enabled");
			setPairCode("");
		}
	}, [result, shopify]);

	const linkActions = () =>
		fetcher.submit({ intent: "link-actions", pairCode }, { method: "POST" });

	const connect = (saveAnyway: boolean) =>
		fetcher.submit(
			{
				intent: "connect",
				// The unverified banner resubmits the exact key the server saw, so
				// an edit made after the banner appeared can't silently diverge.
				projectKey:
					saveAnyway && result?.status === "unverified" ? result.key : key,
				...(saveAnyway ? { saveAnyway: "true" } : {}),
			},
			{ method: "POST" },
		);

	const disconnect = () =>
		fetcher.submit({ intent: "disconnect" }, { method: "POST" });

	// Opened TOP-LEVEL: App Bridge routes window.open(url, "_top") out of the
	// embedded iframe; a plain location assignment would navigate the iframe
	// only and trap the theme editor inside the admin frame.
	const openThemeEditor = () => window.open(enableUrl, "_top");

	return (
		<s-page heading="Clanker Support">
			{connected ? (
				<s-section heading="Your store is connected">
					<s-stack direction="block" gap="base">
						<s-stack direction="inline" gap="small-200">
							<s-badge tone="success" icon="check-circle">
								Connected
							</s-badge>
							<s-text color="subdued">Project key {maskedKey}</s-text>
						</s-stack>
						<s-paragraph>
							One step left: the widget ships as a theme app embed, and embeds
							are off until you enable them.
						</s-paragraph>
						<s-paragraph>
							Click Enable, then press <s-text type="strong">Save</s-text> in
							the theme editor.
						</s-paragraph>
						<s-paragraph>
							The embed is enabled <s-text type="strong">per theme</s-text> — if
							you publish a different theme, click Enable again.
						</s-paragraph>
						<s-paragraph>
							Already added Clanker to your theme by hand? Remove that snippet —
							the app replaces it.
						</s-paragraph>
						<s-stack direction="inline" gap="base">
							<s-button variant="primary" onClick={openThemeEditor}>
								Enable on your store
							</s-button>
							<s-button
								variant="tertiary"
								tone="critical"
								onClick={disconnect}
								{...(disconnecting ? { loading: true } : {})}
								{...(busy && !disconnecting ? { disabled: true } : {})}
							>
								Disconnect
							</s-button>
						</s-stack>
						{result?.status === "error" && !result.from && (
							<s-banner tone="critical" heading="Something went wrong">
								<s-paragraph>{result.message}</s-paragraph>
							</s-banner>
						)}
					</s-stack>
				</s-section>
			) : (
				<s-section heading="Connect your Clanker project">
					<s-stack direction="block" gap="base">
						<s-paragraph>
							Paste the project key from your Clanker Support dashboard
							(Settings → Projects). Your storefront chat will answer from that
							project&apos;s knowledge base.
						</s-paragraph>
						{result?.status === "invalid" && (
							<s-banner
								tone="critical"
								heading="That key doesn't match any Clanker project"
							>
								<s-paragraph>
									Check for typos, or copy it again from Settings → Projects in
									your Clanker dashboard.
								</s-paragraph>
							</s-banner>
						)}
						{result?.status === "unverified" && (
							<s-banner
								tone="warning"
								heading="We couldn't verify your key right now"
							>
								<s-paragraph>
									Clanker&apos;s API didn&apos;t respond, so the key can&apos;t
									be checked — that doesn&apos;t mean it&apos;s wrong. You can
									save it anyway; the widget will use it as soon as the API is
									reachable.
								</s-paragraph>
								<s-button
									slot="secondary-actions"
									onClick={() => connect(true)}
									{...(savingAnyway ? { loading: true } : {})}
									{...(busy && !savingAnyway ? { disabled: true } : {})}
								>
									Save anyway
								</s-button>
							</s-banner>
						)}
						{result?.status === "error" && !result.from && (
							<s-banner tone="critical" heading="Something went wrong">
								<s-paragraph>{result.message}</s-paragraph>
							</s-banner>
						)}
						<s-text-field
							label="Clanker project key"
							name="projectKey"
							value={key}
							placeholder="pk_…"
							details="Found in your Clanker dashboard under Settings → Projects."
							onInput={(e) => setKey(e.currentTarget.value)}
						/>
						<s-stack direction="inline" gap="base">
							<s-button
								variant="primary"
								onClick={() => connect(false)}
								{...(connecting ? { loading: true } : {})}
								{...(key.trim() === "" || (busy && !connecting)
									? { disabled: true }
									: {})}
							>
								Connect
							</s-button>
						</s-stack>
					</s-stack>
				</s-section>
			)}

			{connected && (
				<s-section heading="Order actions">
					<s-stack direction="block" gap="base">
						<s-paragraph>
							Let the chat agent look up a shopper&apos;s own order and file
							returns — always verified against the email on the order. In your
							Clanker dashboard open{" "}
							<s-text type="strong">
								Project settings → Integrations → Shopify
							</s-text>
							, generate a pairing code, and paste it here.
						</s-paragraph>
						{result?.status === "actions-linked" && (
							<s-banner tone="success" heading="Order actions enabled">
								<s-paragraph>
									The agent can now look up orders and file returns for this
									store.
								</s-paragraph>
							</s-banner>
						)}
						{result?.status === "error" && result.from === "link-actions" && (
							<s-banner tone="critical" heading="Couldn't enable order actions">
								<s-paragraph>{result.message}</s-paragraph>
							</s-banner>
						)}
						<s-text-field
							label="Pairing code"
							name="pairCode"
							value={pairCode}
							placeholder="Paste the code from your Clanker dashboard"
							details="Codes are single-use and expire after 10 minutes."
							onInput={(e) => setPairCode(e.currentTarget.value)}
						/>
						<s-stack direction="inline" gap="base">
							<s-button
								variant="primary"
								onClick={linkActions}
								{...(linking ? { loading: true } : {})}
								{...(pairCode.trim() === "" || (busy && !linking)
									? { disabled: true }
									: {})}
							>
								Enable order actions
							</s-button>
						</s-stack>
					</s-stack>
				</s-section>
			)}

			<s-section slot="aside" heading="How it works">
				<s-paragraph>
					Visitors chat with a bubble on your storefront. Answers come from your
					Clanker project&apos;s knowledge base; conversations land in your
					Clanker inbox, and anything the AI can&apos;t handle escalates to your
					team.
				</s-paragraph>
				<s-paragraph>
					<s-link href="https://clankersupport.com" target="_blank">
						Manage your project on clankersupport.com
					</s-link>
				</s-paragraph>
			</s-section>
		</s-page>
	);
}

export const headers: HeadersFunction = (headersArgs) => {
	return boundary.headers(headersArgs);
};
