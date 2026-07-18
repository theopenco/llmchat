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

Deploy buttons follow the llmgateway pattern exactly: Vercel `new/clone` with `repository-url=theopenco/clankersupport-templates` + `root-directory=templates/<name>` + env pre-fill (`NEXT_PUBLIC_CLANKER_KEY` / `VITE_CLANKER_KEY` / `CLANKER_PROJECT_KEY`); Laravel uses a Railway template button (`railway.com/template/clanker-laravel`).

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

## Verification gaps only a runtime can close

- PHP/Ruby code never executed locally (no interpreters, no Docker) — first CI run on push is the real gate. The adversarial static review already fixed: unbound composer PHP constraint (broke `composer validate --strict`), empty-env → 500 hazard in the Laravel provider, `(int) env()` empty-cast bug, Laravel quickstart missing sqlite touch + migrate, Railway startCommand missing `migrate --force`, `.env.example` placeholder defeating the setup callout.
- Laravel package auto-discovery + Blade directive compilation asserted from docs, not a booted app — smoke-test after Packagist publish (`composer create-project` the template, hit `/`).
- Rails Railtie `on_load(:action_view)` wiring likewise — the gem's helper raises without `CLANKER_PROJECT_KEY` by design (documented divergence from Laravel's comment fallback).
