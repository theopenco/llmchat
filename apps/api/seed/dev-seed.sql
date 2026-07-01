-- Dev seed (NOT an auto-applied migration).
--
-- This file is applied ONLY by `pnpm seed`, against the local Ploy SQLite DB
-- (.ploy/db/llmchat_db.db). It is intentionally NOT in apps/api/migrations/,
-- so production deploys never create or re-assert this admin user. See
-- apps/api/scripts/seed.mjs and the "Zero-setup local dev" section of AGENTS.md.
--
-- Creates a default admin user, workspace, and demo project so the dashboard
-- and showcase work out-of-the-box locally without manual signup.
--
-- Sign in:   admin@example.com  /  admin@example.com
-- Widget key: local-dev-key
--
-- The password hash is scrypt(N=16384,r=16,p=1,dkLen=64) in better-auth's
-- "<saltHex>:<keyHex>" format. Salt is fixed so this seed is reproducible.
-- Safe to ship because it only matches the literal password "admin@example.com".
--
-- All statements are INSERT OR IGNORE: applying repeatedly is a no-op.

-- role = 'admin' makes the seeded user a PLATFORM admin, so the local admin
-- dashboard (apps/admin, admin.clankersupport.com in prod) works out of the box
-- with these credentials. Distinct from the workspace-scoped owner membership
-- below. (ADMIN_EMAILS in apps/api/.env.example also lists this address, so the
-- env-allowlist path works locally too.)
INSERT OR IGNORE INTO `user` (`id`, `name`, `email`, `email_verified`, `role`)
VALUES ('dev-admin', 'Local Admin', 'admin@example.com', 1, 'admin');

INSERT OR IGNORE INTO `account` (`id`, `user_id`, `account_id`, `provider_id`, `password`)
VALUES (
	'dev-admin-credential',
	'dev-admin',
	'dev-admin',
	'credential',
	'00112233445566778899aabbccddeeff:6aa30175b1e2659cbb0b45ea9f596ceb4ea420c505b22c28b7586a38cac986936f2746c188fe58479ea438173abfe48ef33e82de00103d698478e1573d8e87f3'
);

-- Seed the dev workspace on the top "scale" tier so local dev exercises the
-- full product (all models, project/member headroom) without a live Stripe
-- subscription. Production never runs this seed, so real signups still start at
-- 'none' and go through the paywall.
INSERT OR IGNORE INTO `workspace` (`id`, `name`, `owner_id`, `plan`)
VALUES ('dev-workspace', 'Dev Workspace', 'dev-admin', 'scale');

INSERT OR IGNORE INTO `member` (`id`, `workspace_id`, `user_id`, `role`)
VALUES ('dev-member', 'dev-workspace', 'dev-admin', 'owner');

INSERT OR IGNORE INTO `project` (
	`id`,
	`workspace_id`,
	`name`,
	`public_key`,
	`system_prompt`,
	`welcome_message`,
	`brand_color`,
	`model`,
	`notify_email`,
	`inbound_email_local`
) VALUES (
	'dev-project',
	'dev-workspace',
	'Acme Tools (demo)',
	'local-dev-key',
	'You are the support bot for Acme Tools, a fictional SaaS for managing hardware inventory. Keep replies short and friendly.',
	'Hi! Ask me anything about Acme Tools.',
	'#4f46e5',
	'gpt-5.4-mini',
	'admin@example.com',
	'dev'
);
