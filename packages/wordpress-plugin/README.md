# @clankersupport/wordpress-plugin

The [Clanker Support](https://clankersupport.com) WordPress plugin — a thin, pure-PHP injector around the public `widget.js` script embed (see `packages/widget`). No build step, no bundled JavaScript: the plugin enqueues the widget script from the configured API origin with the same `data-*` attributes the dashboard's embed snippet generates, so widget updates ship from the API without a plugin release.

## What it does

- **Settings → Clanker Support** in wp-admin: project key, floating-bubble toggle, brand color, escalation threshold, and API URL (for self-hosting).
- Enqueues `<api_url>/widget.js` on front-end pages with `async`, `data-project`, `data-api`, `data-brand`, and optional `data-escalation-threshold` — mirroring `apps/dashboard/src/lib/embed-snippets.ts`.
- `[clanker_support width=400 height=600]` shortcode renders the API's `/embed/:key` page in an iframe for inline placement (works even with the site-wide bubble off).
- `uninstall.php` deletes the stored option on plugin deletion.

## Layout

- `clanker-support/` — the plugin itself (what a WordPress site installs). `readme.txt` inside is the wordpress.org-format readme, written for eventual directory submission.
- `scripts/build-zip.mjs` — packages the plugin into `dist/clanker-support.zip`.

## Building the installable zip

```sh
pnpm --filter @clankersupport/wordpress-plugin package
```

Produces `dist/clanker-support.zip` with the `clanker-support/` folder at the zip root, installable via Plugins → Add New → Upload Plugin. The `package` script is intentionally not named `build` so turbo CI doesn't require a system zip tool.

## Testing locally

Quickest path is [wp-env](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/) or any local WordPress:

1. Copy (or symlink) `clanker-support/` into `wp-content/plugins/`, or upload the built zip.
2. Activate, then set the project key under Settings → Clanker Support.
3. For a local llmchat API, set the API URL setting to your dev API origin (the widget script is served from it, e.g. `http://localhost:8787`).

## Releasing

- Bump `Version:` in `clanker-support/clanker-support.php`, `CLANKER_SUPPORT_VERSION`, and `Stable tag:` in `readme.txt` together.
- wordpress.org directory submission (SVN mirror) is a planned follow-up; the zip is the immediate distribution channel (to be offered from the dashboard's Embed page).
