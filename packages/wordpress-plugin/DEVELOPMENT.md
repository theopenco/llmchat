# Clanker Support — WordPress plugin (developer docs)

The official WordPress plugin for [Clanker Support](https://clankersupport.com), structured for distribution through the [wordpress.org plugin directory](https://wordpress.org/plugins/). It wraps the public `widget.js` embed: a Settings → Clanker Support page in wp-admin, a front-end enqueue of `<api_url>/widget.js` with the same `data-*` attributes the dashboard embed snippet generates, and a `[clanker_support]` inline-iframe shortcode.

> **About the two readmes:** `clanker-support/readme.txt` is the canonical wordpress.org readme, and `README.md` at this package's root is a byte-for-byte mirror of it so the readme validator can be pointed at the GitHub file. When you change `readme.txt`, re-copy it over `README.md`. When validating by URL, use the **raw** URL — `https://raw.githubusercontent.com/theopenco/llmchat/main/packages/wordpress-plugin/README.md` — a `github.com/.../blob/...` link serves GitHub's HTML page, which the validator can't parse.

## Layout

```
clanker-support/            The plugin itself (this folder is what ships in the zip / SVN trunk)
├── clanker-support.php     Bootstrap: plugin header, constants, requires, activation hook
├── includes/               Classes: core, settings (option + sanitize), admin page, frontend
├── admin/                  Settings page template + admin CSS
├── languages/              Translation template (clanker-support.pot)
├── readme.txt              wordpress.org readme (description, FAQ, screenshots, changelog)
└── uninstall.php           Deletes the option + status transient
.wordpress-org/             Directory listing assets (SVN /assets, NOT shipped in the zip)
├── icon.svg / icon-*.png   Plugin icon (128 + 256)
├── banner.svg / banner-*.png  Listing banner (772x250 + 1544x500)
└── (screenshot-N.png)      TODO: capture from a live wp-admin before submission —
                            numbering must match readme.txt == Screenshots ==
scripts/build-zip.mjs       Packages dist/clanker-support-<version>.zip
```

## What the plugin does

- **Settings → Clanker Support** (`manage_options`): project key, floating-bubble toggle, brand color, escalation threshold, and a self-host API URL — stored in a single `clanker_support_settings` option.
- **Connection check**: the settings page verifies the key server-side against `GET <api_url>/v1/config/<key>` (200 = connected, 404 = invalid key) and shows a status pill; the result is cached in a 5-minute transient that saving clears.
- **Front end**: when enabled and configured, enqueues `<api_url>/widget.js` in the footer and filters the printed tag to add `async` plus `data-project` / `data-api` / `data-brand` / `data-escalation-threshold` — the exact contract `packages/widget/src/config.ts` reads. The script version is `null` on purpose: the file is evergreen on the API origin.
- **`[clanker_support width="400" height="600"]`**: inline chat via the API's CSP-hardened `/embed/<key>` page in an iframe; independent of the floating-bubble toggle.

## Development

There is no build step — the plugin is plain PHP. To hack on it against a real site, map the plugin folder into a local WordPress (e.g. [wp-env](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/) or LocalWP):

```sh
npx @wordpress/env start   # with .wp-env.json mapping ./clanker-support to wp-content/plugins/clanker-support
```

Point the API URL setting at `http://localhost:8787` and use the seeded `local-dev-key` project (see the repo root README / `pnpm seed`).

Before submitting, run the official [Plugin Check](https://wordpress.org/plugins/plugin-check/) plugin against it — that's what the wordpress.org review team runs first.

## Packaging

```sh
pnpm --filter @clankersupport/wordpress-plugin package
# → dist/clanker-support-<version>.zip
```

The zip contains a single `clanker-support/` folder at its root, ready for Plugins → Add New → Upload Plugin or for the wordpress.org submission form.

## wordpress.org submission

1. Sign in to the wordpress.org account you're submitting from — currently `bidbogs` (registered 2026-07-02 with haythamchhilif@gmail.com, until a company email/account exists). The submitting username must be listed under `Contributors:` in `readme.txt`; if the plugin later moves to a `clankersupport` company account, add that username to `Contributors:` and transfer ownership from the plugin's Advanced admin page.
2. Validate `readme.txt` with the [readme validator](https://wordpress.org/plugins/developers/readme-validator/) and the zip with Plugin Check.
3. Submit the zip at [wordpress.org/plugins/developers/add](https://wordpress.org/plugins/developers/add/). Review typically takes days–weeks; the "External services" section in the readme covers the SaaS-connector disclosure reviewers ask for.
4. Once approved you get SVN access:
   - `trunk/` ← contents of `clanker-support/`
   - `tags/<version>/` ← copy of trunk per release
   - `assets/` ← contents of `.wordpress-org/` (icons, banners, `screenshot-N.png`)
5. Capture real screenshots (settings page, bubble, inline shortcode, dashboard inbox) as `screenshot-1.png` … `screenshot-4.png` in `assets/`, matching the `== Screenshots ==` numbering in `readme.txt`.

## Releasing a new version

Bump the version in **three** places, then re-package and (post-approval) `svn cp trunk tags/<version>`:

1. `clanker-support/clanker-support.php` — the `Version:` header **and** the `CLANKER_SUPPORT_VERSION` constant
2. `clanker-support/readme.txt` — `Stable tag:` + a new `== Changelog ==` entry
3. `package.json` — `version`
