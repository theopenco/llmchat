-- Heal projects saved on a model LLM Gateway has deactivated or scheduled for
-- deactivation: Claude 3.x and Sonnet 4.5, Gemini 2.5 and 3.7 Flash, GPT-4o,
-- GPT-5 / 5 mini / 5 nano, the GPT-4o search previews, the GPT-5.1/5.2 Codex
-- routes, Kimi K2, and others. The chat path already coerces these through
-- effectiveModel(), so this only realigns the stored value with what is
-- actually served and what the dashboard model picker can show. Projects on an
-- offered model are untouched.
--
-- One-shot: the id list is the WEB_SEARCH_MODELS snapshot as of this migration
-- (packages/shared/src/web-search-models.generated.ts). Later regenerations
-- don't need to edit this file: retirements after that point are handled at
-- runtime by isWebSearchModel() reading WEB_SEARCH_MODEL_RETIREMENTS.
UPDATE `project`
SET `model` = 'gpt-5.4-mini'
WHERE `model` NOT IN (
	'claude-haiku-4-5',
	'claude-haiku-4-5-20251001',
	'claude-haiku-5-5',
	'claude-opus-4-5-20251101',
	'claude-opus-4-6',
	'claude-opus-4-7',
	'claude-opus-4-8',
	'claude-opus-5',
	'claude-opus-5-5',
	'claude-sonnet-4-6',
	'claude-sonnet-5',
	'claude-sonnet-5-5',
	'deepseek-v4-pro',
	'deepseek-v4.1-flash-1017',
	'gemini-3-flash-preview',
	'gemini-3.1-flash-lite',
	'gemini-3.1-pro-preview',
	'gemini-3.5-flash',
	'gemini-3.5-flash-lite',
	'gemini-3.6-flash',
	'gemini-3.8-flash',
	'gemini-4-argon',
	'gemini-4-carbon',
	'gemini-4-hydrogen',
	'gemini-4-neon',
	'gemini-pro-latest',
	'glm-4.5',
	'glm-4.6',
	'glm-4.7',
	'glm-5',
	'glm-5.1',
	'glm-5.2',
	'glm-5.3',
	'gpt-5-pro',
	'gpt-5.1',
	'gpt-5.2',
	'gpt-5.2-pro',
	'gpt-5.3-codex',
	'gpt-5.4',
	'gpt-5.4-mini',
	'gpt-5.4-nano',
	'gpt-5.4-pro',
	'gpt-5.5',
	'gpt-5.5-pro',
	'gpt-5.6-luna',
	'gpt-5.6-sol',
	'gpt-5.6-terra',
	'gpt-6-astra',
	'gpt-6-luna',
	'gpt-6-sol',
	'gpt-6.1-sol',
	'gpt-6.1-terra',
	'gpt-6.2-astra',
	'gpt-6.2-sol',
	'qwen3.6-35b-a3b',
	'qwen3.6-plus',
	'qwen3.7-max',
	'qwen3.8-flash',
	'qwen3.8-max',
	'qwen35-397b-a17b'
);
