"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Copy, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Card, Field, dsInputClass } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { api, describeApiError } from "@/lib/api";

import type { IntegrationKind, IntegrationView } from "@llmchat/shared";

/**
 * Integrations tab — where the agent graduates from answering to ACTING:
 * booking calls through Cal.com (Zoom/Meet via the event type's location) and
 * looking up / returning Shopify orders. Credentials are write-only: the API
 * returns a masked view, so a connected card never re-displays a secret.
 */
export function IntegrationsTab({
	projectId,
	workspaceId,
	canManage,
}: {
	projectId: string;
	workspaceId: string;
	canManage: boolean;
}) {
	const qc = useQueryClient();
	const listQ = useQuery({
		queryKey: ["integrations", projectId],
		queryFn: () =>
			api<{ integrations: IntegrationView[] }>(
				`/api/projects/${projectId}/integrations`,
				{ workspaceId },
			),
	});
	const byKind = new Map(
		(listQ.data?.integrations ?? []).map((i) => [i.kind, i]),
	);
	const invalidate = () =>
		qc.invalidateQueries({ queryKey: ["integrations", projectId] });

	const upsert = useMutation({
		mutationFn: (input: {
			kind: IntegrationKind;
			config: Record<string, unknown>;
		}) =>
			api(`/api/projects/${projectId}/integrations/${input.kind}`, {
				method: "PUT",
				body: { enabled: true, config: input.config },
				workspaceId,
			}),
		onSuccess: (_d, input) => {
			toast.success("Integration connected");
			track(ANALYTICS_EVENTS.integrationConnected, { kind: input.kind });
			void invalidate();
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Could not save the integration")),
	});

	const toggle = useMutation({
		mutationFn: (input: { kind: IntegrationKind; enabled: boolean }) =>
			api(`/api/projects/${projectId}/integrations/${input.kind}`, {
				method: "PATCH",
				body: { enabled: input.enabled },
				workspaceId,
			}),
		onSuccess: () => void invalidate(),
		onError: (e) =>
			toast.error(describeApiError(e, "Could not update the integration")),
	});

	const remove = useMutation({
		mutationFn: (kind: IntegrationKind) =>
			api(`/api/projects/${projectId}/integrations/${kind}`, {
				method: "DELETE",
				workspaceId,
			}),
		onSuccess: () => {
			toast.success("Integration disconnected");
			void invalidate();
		},
		onError: (e) =>
			toast.error(describeApiError(e, "Could not disconnect the integration")),
	});

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-2xl text-[13px] leading-relaxed text-ck-muted">
				Give your agent hands, not just answers. Connected integrations become
				tools the agent can use mid-conversation — every action is grounded in a
				real API call, never invented.
			</p>

			<CalcomCard
				view={byKind.get("calcom")}
				canManage={canManage}
				pending={upsert.isPending || toggle.isPending || remove.isPending}
				onConnect={(config) => upsert.mutate({ kind: "calcom", config })}
				onToggle={(enabled) => toggle.mutate({ kind: "calcom", enabled })}
				onDisconnect={() => remove.mutate("calcom")}
			/>

			<ShopifyCard
				view={byKind.get("shopify")}
				projectId={projectId}
				workspaceId={workspaceId}
				canManage={canManage}
				pending={upsert.isPending || toggle.isPending || remove.isPending}
				onConnect={(config) => upsert.mutate({ kind: "shopify", config })}
				onToggle={(enabled) => toggle.mutate({ kind: "shopify", enabled })}
				onDisconnect={() => remove.mutate("shopify")}
				onCodeRedeemed={() => void invalidate()}
			/>

			{!canManage && (
				<p className="text-[12.5px] text-ck-faint">
					Only workspace admins can connect or change integrations.
				</p>
			)}
		</div>
	);
}

/* ── Shared chrome ──────────────────────────────────────────────────────── */

function ProviderHeader({
	icon,
	name,
	blurb,
	view,
	canManage,
	pending,
	onToggle,
	onDisconnect,
}: {
	icon: React.ReactNode;
	name: string;
	blurb: string;
	view?: IntegrationView;
	canManage: boolean;
	pending: boolean;
	onToggle: (enabled: boolean) => void;
	onDisconnect: () => void;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="flex items-start gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-ck-border bg-ck-chip text-ck-text">
					{icon}
				</div>
				<div>
					<div className="flex items-center gap-2">
						<h3 className="text-[15px] font-bold tracking-[-0.01em] text-ck-text">
							{name}
						</h3>
						{view && (
							<span
								className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
									view.enabled
										? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
										: "border-ck-border bg-ck-chip text-ck-faint"
								}`}
							>
								<span
									className={`size-1.5 rounded-full ${
										view.enabled ? "bg-emerald-500" : "bg-ck-faint"
									}`}
								/>
								{view.enabled ? "Live" : "Paused"}
							</span>
						)}
					</div>
					<p className="mt-0.5 max-w-md text-[12.5px] leading-relaxed text-ck-muted">
						{blurb}
					</p>
					{view && (
						<p className="mt-1.5 font-mono text-[11.5px] text-ck-faint">
							{view.summary} · key {view.secretHint}
						</p>
					)}
				</div>
			</div>
			{view && canManage && (
				<div className="flex shrink-0 items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={pending}
						onClick={() => onToggle(!view.enabled)}
					>
						{view.enabled ? "Pause" : "Resume"}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						disabled={pending}
						className="text-ck-warn hover:bg-ck-warn/10 hover:text-ck-warn"
						onClick={onDisconnect}
					>
						Disconnect
					</Button>
				</div>
			)}
		</div>
	);
}

/* ── Cal.com ────────────────────────────────────────────────────────────── */

function CalcomCard({
	view,
	canManage,
	pending,
	onConnect,
	onToggle,
	onDisconnect,
}: {
	view?: IntegrationView;
	canManage: boolean;
	pending: boolean;
	onConnect: (config: Record<string, unknown>) => void;
	onToggle: (enabled: boolean) => void;
	onDisconnect: () => void;
}) {
	const [apiKey, setApiKey] = useState("");
	const [eventTypeId, setEventTypeId] = useState("");
	const [timeZone, setTimeZone] = useState("UTC");
	const [editing, setEditing] = useState(false);
	const showForm = canManage && (!view || editing);

	return (
		<Card className="flex flex-col gap-5 p-5">
			<ProviderHeader
				icon={<CalendarClock className="size-5" aria-hidden />}
				name="Cal.com scheduling"
				blurb="The agent offers real open slots and books calls for visitors. Zoom, Meet, or phone comes from the event type's location in Cal.com."
				view={view}
				canManage={canManage}
				pending={pending}
				onToggle={onToggle}
				onDisconnect={onDisconnect}
			/>

			{view && canManage && !editing && (
				<button
					type="button"
					className="w-fit text-[12.5px] font-semibold text-ck-accent hover:underline"
					onClick={() => setEditing(true)}
				>
					Replace credentials
				</button>
			)}

			{showForm && (
				<form
					className="grid gap-4 border-t border-ck-border pt-4 sm:grid-cols-2"
					onSubmit={(e) => {
						e.preventDefault();
						onConnect({
							apiKey: apiKey.trim(),
							eventTypeId: Number(eventTypeId),
							timeZone: timeZone.trim() || "UTC",
						});
						setEditing(false);
						setApiKey("");
					}}
				>
					<Field
						label="API key"
						hint="Cal.com → Settings → Developer → API keys."
					>
						{(id) => (
							<input
								id={id}
								type="password"
								required
								autoComplete="off"
								className={`${dsInputClass} font-mono text-xs`}
								placeholder="cal_live_…"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
							/>
						)}
					</Field>
					<Field
						label="Event type ID"
						hint="The numeric ID of the event the agent books."
					>
						{(id) => (
							<input
								id={id}
								type="number"
								required
								min={1}
								className={`${dsInputClass} font-mono text-xs`}
								placeholder="123456"
								value={eventTypeId}
								onChange={(e) => setEventTypeId(e.target.value)}
							/>
						)}
					</Field>
					<Field
						label="Time zone"
						hint="Slots are offered to visitors in this time zone."
					>
						{(id) => (
							<input
								id={id}
								className={`${dsInputClass} font-mono text-xs`}
								placeholder="UTC"
								value={timeZone}
								onChange={(e) => setTimeZone(e.target.value)}
							/>
						)}
					</Field>
					<div className="flex items-end">
						<Button type="submit" disabled={pending || !apiKey || !eventTypeId}>
							{view ? "Save credentials" : "Connect Cal.com"}
						</Button>
					</div>
				</form>
			)}
		</Card>
	);
}

/* ── Shopify ────────────────────────────────────────────────────────────── */

function ShopifyCard({
	view,
	projectId,
	workspaceId,
	canManage,
	pending,
	onConnect,
	onToggle,
	onDisconnect,
	onCodeRedeemed,
}: {
	view?: IntegrationView;
	projectId: string;
	workspaceId: string;
	canManage: boolean;
	pending: boolean;
	onConnect: (config: Record<string, unknown>) => void;
	onToggle: (enabled: boolean) => void;
	onDisconnect: () => void;
	onCodeRedeemed: () => void;
}) {
	const [shopDomain, setShopDomain] = useState("");
	const [accessToken, setAccessToken] = useState("");
	const [editing, setEditing] = useState(false);
	const [pairCode, setPairCode] = useState<string | null>(null);
	const showSetup = canManage && (!view || editing);

	const mintCode = useMutation({
		mutationFn: () =>
			api<{ code: string; expiresInSeconds: number }>(
				`/api/projects/${projectId}/integrations/shopify/connect-code`,
				{ method: "POST", workspaceId },
			),
		onSuccess: (data) => setPairCode(data.code),
		onError: (e) =>
			toast.error(describeApiError(e, "Could not create a pairing code")),
	});

	return (
		<Card className="flex flex-col gap-5 p-5">
			<ProviderHeader
				icon={<ShoppingBag className="size-5" aria-hidden />}
				name="Shopify order actions"
				blurb="The agent looks up a visitor's own order (status, tracking, totals) and files returns — always verified against the email on the order."
				view={view}
				canManage={canManage}
				pending={pending}
				onToggle={onToggle}
				onDisconnect={onDisconnect}
			/>

			{view && canManage && !editing && (
				<button
					type="button"
					className="w-fit text-[12.5px] font-semibold text-ck-accent hover:underline"
					onClick={() => setEditing(true)}
				>
					Replace credentials
				</button>
			)}

			{showSetup && (
				<div className="grid gap-5 border-t border-ck-border pt-4 lg:grid-cols-2">
					{/* Path A — the Shopify app */}
					<div className="flex flex-col gap-3 rounded-[10px] border border-ck-border bg-ck-chip/40 p-4">
						<div>
							<h4 className="text-[13px] font-bold text-ck-text">
								Via the Shopify app
								<span className="ml-2 rounded-full bg-ck-accent/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ck-accent">
									Recommended
								</span>
							</h4>
							<p className="mt-1 text-[12.5px] leading-relaxed text-ck-muted">
								Generate a one-time pairing code, then paste it in the Clanker
								Support app inside your Shopify admin. The app sends the store
								credentials over — nothing to copy out of Shopify.
							</p>
						</div>
						{pairCode ? (
							<div className="flex items-center gap-2">
								<code
									className="rounded-[8px] border border-ck-border bg-ck-card px-3 py-2 font-mono text-[13px] font-semibold tracking-[0.12em] text-ck-text"
									data-testid="pair-code"
								>
									{pairCode}
								</code>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										void navigator.clipboard.writeText(pairCode);
										toast.success("Code copied");
									}}
								>
									<Copy className="size-3.5" aria-hidden />
									Copy
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setPairCode(null);
										onCodeRedeemed();
									}}
								>
									Done
								</Button>
							</div>
						) : (
							<Button
								variant="outline"
								size="sm"
								className="w-fit"
								disabled={mintCode.isPending}
								onClick={() => mintCode.mutate()}
							>
								Generate pairing code
							</Button>
						)}
						{pairCode && (
							<p className="text-[11.5px] text-ck-faint">
								Expires in 10 minutes and works once.
							</p>
						)}
					</div>

					{/* Path B — manual token (self-hosters / custom apps) */}
					<form
						className="flex flex-col gap-4"
						onSubmit={(e) => {
							e.preventDefault();
							onConnect({
								shopDomain: shopDomain.trim().toLowerCase(),
								accessToken: accessToken.trim(),
							});
							setEditing(false);
							setAccessToken("");
						}}
					>
						<Field
							label="Shop domain"
							hint="Your *.myshopify.com domain (not the storefront URL)."
						>
							{(id) => (
								<input
									id={id}
									required
									className={`${dsInputClass} font-mono text-xs`}
									placeholder="acme-tools.myshopify.com"
									value={shopDomain}
									onChange={(e) => setShopDomain(e.target.value)}
								/>
							)}
						</Field>
						<Field
							label="Admin API access token"
							hint="Custom app token with read_orders + write_returns scopes."
						>
							{(id) => (
								<input
									id={id}
									type="password"
									required
									autoComplete="off"
									className={`${dsInputClass} font-mono text-xs`}
									placeholder="shpat_…"
									value={accessToken}
									onChange={(e) => setAccessToken(e.target.value)}
								/>
							)}
						</Field>
						<Button
							type="submit"
							variant="outline"
							className="w-fit"
							disabled={pending || !shopDomain || !accessToken}
						>
							{view ? "Save credentials" : "Connect manually"}
						</Button>
					</form>
				</div>
			)}
		</Card>
	);
}
