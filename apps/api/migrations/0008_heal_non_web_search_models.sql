-- Heal projects created before the web-search-only rule. Any project whose
-- model is NOT a valid web-search model (e.g. the old 'openai/gpt-4o-mini'
-- default, or 'gpt-4o-search-preview') is reset to the default 'gpt-5.4-mini'.
-- Projects already on a web-search model are left untouched.
--
-- This also fixes the seeded dev demo project on existing DBs, where the 0001
-- `INSERT OR IGNORE` can't update an already-inserted row.
--
-- The id list below MUST match WEB_SEARCH_MODELS in packages/shared/src/models.ts
-- (the single source of truth). SQL can't import it, so it is duplicated here —
-- update both together.
UPDATE `project`
SET `model` = 'gpt-5.4-mini'
WHERE `model` NOT IN (
	'gpt-5.5-pro',
	'gpt-5.5',
	'gpt-5.4-pro',
	'gpt-5.4',
	'gpt-5.4-mini',
	'gpt-5.4-nano',
	'gpt-5.3-codex',
	'gpt-5.2-codex',
	'claude-opus-4-8',
	'claude-opus-4-7',
	'claude-sonnet-4-6',
	'gemini-pro-latest',
	'gemini-3.5-flash',
	'gemini-3.1-pro-preview',
	'gemini-3.1-flash-lite',
	'qwen3.7-max',
	'qwen3.6-plus',
	'qwen3.6-35b-a3b',
	'qwen35-397b-a17b',
	'glm-5.1'
);
