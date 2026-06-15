import type { Env } from "@/env";

interface SlackEscalationInput {
	projectName: string;
	conversationId: string;
	/** Canonical dashboard origin, used to build an inbox link when available. */
	dashboardUrl?: string;
}

/** Incoming-webhook message text for an escalation notice. */
export function buildEscalationSlackText({
	projectName,
	conversationId,
	dashboardUrl,
}: SlackEscalationInput): string {
	const lines = [
		`:rotating_light: New escalation for *${projectName}*`,
		`Conversation: ${conversationId}`,
	];
	if (dashboardUrl) {
		lines.push(`Inbox: ${dashboardUrl.replace(/\/+$/, "")}/inbox`);
	}
	return lines.join("\n");
}

/**
 * Post an escalation notice to a project's Slack incoming webhook.
 *
 * Never throws and never blocks the caller: an unset webhook is skipped, and
 * any network/HTTP failure is logged but swallowed. Run it inside waitUntil so
 * a slow or failing Slack call can't delay or break the escalation response.
 */
export async function sendEscalationSlack(
	env: Env,
	project: { name: string; slackWebhookUrl: string | null },
	conversationId: string,
): Promise<void> {
	const webhookUrl = project.slackWebhookUrl?.trim();
	if (!webhookUrl) {
		return;
	}
	try {
		const text = buildEscalationSlackText({
			projectName: project.name,
			conversationId,
			dashboardUrl: env.vars.DASHBOARD_URL,
		});
		const res = await fetch(webhookUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text }),
		});
		if (!res.ok) {
			throw new Error(`Slack webhook responded ${res.status}`);
		}
	} catch (err) {
		console.error("escalate: slack notification failed", err);
	}
}
