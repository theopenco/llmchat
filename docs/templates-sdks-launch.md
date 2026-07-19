# Templates + SDKs launch runbook

Built 2026-07-17 on `feat/templates-sdks` (+ two new local repos). Everything below is authored, verified as far as this machine allows, and committed locally. Nothing is pushed or published — each step marked 🔑 needs Omar (credentials and/or push approval).

## What exists where

| Artifact | Location | Verified |
| --- | --- | --- |
| Python SDK `clankersupport` (PyPI) | `sdks/python` (this repo) | 10/10 unittest + editable-install packaging check |
| Ruby gem `clankersupport` | `sdks/ruby` (this repo) | static review only (no Ruby locally) — CI runs Minitest on push |
| SDKs CI | `.github/workflows/sdks.yml` | python job command verified locally |
| PHP package `clankersupport/clankersupport-php` | `~/dev/clankersupport-php` (own repo — Packagist needs `composer.json` at repo root) | static review (3 fixes applied); CI matrix php 8.1–8.4 on push |
| Templates monorepo | `~/dev/clankersupport-templates` — `templates/{nextjs-shadcn,tanstack-start,react-router,laravel,fastapi}` | 3 JS templates `pnpm build` green; FastAPI 2/2 pytest + live boot; Laravel static review (3 fixes) |
| Marketing `/templates` page | `apps/marketing/src/app/templates/` (this branch) | 42/42 tests, prettier, oxlint |

Deploy buttons follow the llmgateway pattern exactly: Vercel `new/clone` with `repository-url=theopenco/clankersupport-templates` + `root-directory=templates/<name>` + env pre-fill (`NEXT_PUBLIC_CLANKER_KEY` / `VITE_CLANKER_KEY` / `CLANKER_PROJECT_KEY`); Laravel uses a Railway template button (`railway.com/deploy/clanker-laravel`).

## Publish order (dependencies flow downward)

1. 🔑 **PyPI** — name `clankersupport` is free (checked 2026-07-17).
   `cd sdks/python && python3 -m pip install build twine && python3 -m build && twine upload dist/*`
2. 🔑 **RubyGems** — name free. Needs a machine with Ruby ≥ 3.0:
   `cd sdks/ruby && bundle install && bundle exec rake test && gem build clankersupport.gemspec && gem push clankersupport-1.0.0.gem`
3. 🔑 **Create + push GitHub repos** (approval gate):
   - `theopenco/clankersupport-php` ← push `~/dev/clankersupport-php` (CI will run PHPUnit for the first time — watch it).
   - `theopenco/clankersupport-templates` ← push `~/dev/clankersupport-templates` (Vercel deploy buttons work the moment this is public).
4. 🔑 **Packagist** — submit `https://github.com/theopenco/clankersupport-php` (vendor name `clankersupport` unclaimed). Until published, the Laravel template's `composer install` fails — its README says so.
5. 🔑 **Railway template** — register `clanker-laravel` from `templates/laravel` in the Railway dashboard (slug must match the button URL). Set `APP_KEY` as a generated template variable — `php artisan key:generate` can't self-heal there. Note: sqlite on Railway is ephemeral (fine for a demo).
6. 🔑 **Push `feat/templates-sdks` + PR** (this repo: 2 SDKs + CI + marketing page). Merge after steps 1–4 so the page's registry links resolve.
7. **Post-launch fast-follows**: swap the FastAPI verify note once PyPI resolves; consider a `preview.png` per template + demo deploys (llmgateway ships both); optional npx scaffolder via degit (llmgateway's CLI pattern).

## Polish wave (2026-07-18) — built, one publish + two content steps left

Shipped (PR #151 on llmchat; templates repo pushed direct to main):

- **Preview images** — five 1200×630 on-brand cards at `apps/marketing/public/templates/<slug>.png` + each template README hero. On every `/templates` card and the page OG image.
- **npx scaffolder** — `create-clanker-support` in the templates repo (`packages/create-clanker-support`, giget-based). CI `cli` job proves it (offline checks + a live scaffold). `/templates` shows `npm create clanker-support@latest` with a copy button.
- **SDK docs** — `apps/docs/content/sdks/` (SDK overview + templates page), in the sidebar and docs `llms.txt` — real crawlable content for the support agent.
- **Live-demo slots** — `demoUrl?` per template on the `/templates` page; renders a link only when set (dark until demos exist).

Hand-off status (updated 2026-07-19):

1. ✅ **CLI published** — `create-clanker-support@1.0.0` is on npm (Luca, 2026-07-19). The NPM_TOKEN/tag plan is obsolete: npm can't attach a trusted publisher to a package that doesn't exist yet, so 1.0.0 went out manually, then an **npm OIDC trusted publisher** was bound to `release-cli.yml` in the templates repo, and that workflow now runs **semantic-release on every merge to main** (`semantic-release-monorepo` scopes commit analysis to `packages/create-clanker-support`, tags `create-clanker-support@<version>`, publishes with `--provenance`; the committed package.json version is a placeholder semantic-release stamps at publish time). Future CLI releases = merge a conventional `feat:`/`fix:` commit touching that package — no tokens, no tags.
2. ✅ **Dashboard Recrawl** — done 2026-07-19; the live widget answers about the pip/gem/Composer packages. For future recrawls: every source crawl now cache-busts with a unique query param (`__recrawl=…`, plus `cache: "no-store"` and no-cache request headers — `apps/api/src/lib/fetch-url.ts`), so a Recrawl clicked right after a deploy fetches the fresh copy instead of an hour-stale edge-cached one (marketing llms.txt serves `max-age=3600`). One caveat: if the busted URL fails (e.g. signed URLs), the fetcher falls back to the original URL, which an edge cache may still serve stale — when a recrawl must be provably fresh, check the source's stored content actually changed.
3. 🔑 **Hosted demos** (still open): deploy each template (`vercel --cwd templates/<name>` with the public showcase key `pk_be2d…`, or the Railway template for Laravel), then set `demoUrl` in the `/templates` page's `TEMPLATES` array and redeploy. The link slot lights up automatically.

## Verification gaps only a runtime can close

- PHP/Ruby code never executed locally (no interpreters, no Docker) — first CI run on push is the real gate. The adversarial static review already fixed: unbound composer PHP constraint (broke `composer validate --strict`), empty-env → 500 hazard in the Laravel provider, `(int) env()` empty-cast bug, Laravel quickstart missing sqlite touch + migrate, Railway startCommand missing `migrate --force`, `.env.example` placeholder defeating the setup callout.
- Laravel package auto-discovery + Blade directive compilation asserted from docs, not a booted app — smoke-test after Packagist publish (`composer create-project` the template, hit `/`).
- Rails Railtie `on_load(:action_view)` wiring likewise — the gem's helper raises without `CLANKER_PROJECT_KEY` by design (documented divergence from Laravel's comment fallback).
