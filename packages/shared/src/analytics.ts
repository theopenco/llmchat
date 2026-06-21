// Single source of truth for product analytics event names + property shapes.
// Naming convention (from the analytics skill): object_action, lowercase_snake.
// Keep every event tied to a decision; never put PII in properties.

export const ANALYTICS_EVENTS = {
	// ── Marketing site ──────────────────────────────────────────────
	ctaClicked: "cta_clicked",
	signupStarted: "signup_started",
	comparisonViewed: "comparison_viewed",
	migrationGuideViewed: "migration_guide_viewed",
	useCaseViewed: "use_case_viewed",
	blogPostRead: "blog_post_read",

	// ── Product / dashboard ─────────────────────────────────────────
	signupCompleted: "signup_completed",
	signedIn: "signed_in",
	signedOut: "signed_out",
	onboardingStarted: "onboarding_started",
	onboardingStepCompleted: "onboarding_step_completed",
	onboardingCompleted: "onboarding_completed",
	projectCreated: "project_created",
	projectDeleted: "project_deleted",
	projectSettingsSaved: "project_settings_saved",
	widgetEmbedCopied: "widget_embed_copied",
	modelChanged: "model_changed",
	knowledgeBaseUpdated: "knowledge_base_updated",
	systemPromptSaved: "system_prompt_saved",
	sourceAdded: "source_added",
	conversationOpened: "conversation_opened",

	// ── Server / widget (captured in the API) ───────────────────────
	conversationStarted: "conversation_started",
	widgetMessageSent: "widget_message_sent",
	conversationEscalated: "conversation_escalated",
} as const;

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// Common property keys, documented so apps stay consistent. Properties are a
// loose record at the call site, but these are the canonical names to reuse.
export type AnalyticsProps = Record<
	string,
	string | number | boolean | null | undefined
>;
