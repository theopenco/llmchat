# dev.to auto cross-posting

Publishes the marketing blog posts to [dev.to](https://dev.to) on autopilot — one
article every **Monday / Wednesday / Friday**, running in GitHub Actions (no laptop,
no manual step). Each post keeps its `canonical_url` pointed back at
`clankersupport.com`, so all Google ranking credit stays with the original.

## How it works

- **`queue.json`** — an ordered list of articles to post. Each item points at a blog
  post in `apps/marketing/content/blog/` (the single source of truth) and carries its
  dev.to tags, series, and canonical URL.
- **`post-next.mjs`** — reads the queue, finds the first item not yet on your dev.to
  account, rewrites its root-relative links to absolute `clankersupport.com` URLs,
  prepends a dev.to front-matter block, and posts it. **One item per run.**
- **`.github/workflows/devto-crosspost.yml`** — the Mon/Wed/Fri cron that runs the
  script. Also runnable on demand (Actions → devto-crosspost → Run workflow), with a
  **dry-run** checkbox.

It is **idempotent**: before posting, it fetches everything already on the account and
skips anything whose canonical URL or title matches. A re-run — or a double-fired cron
— never double-posts. When every queue item is already up, the run logs
"queue is fully drained" and exits cleanly.

## One-time setup

1. **Add the API key as a repo secret.** GitHub → repo **Settings → Secrets and
   variables → Actions → New repository secret**:
   - Name: `DEVTO_API_KEY`
   - Value: your dev.to key (dev.to → **Settings → Extensions → DEV Community API Keys**)

   That's the only setup. The key never touches the code or the repo — only the secret.

2. **(Optional) rehearse first.** Actions → **devto-crosspost** → **Run workflow** →
   tick **dry_run** → Run. It logs exactly what it *would* post without publishing.

## Adding more articles

- **Syndicate an existing blog post:** add an item to `queue.json` with
  `published: true`, pointing `source` at its file in `apps/marketing/content/blog/`.
  It goes live on dev.to on the next run.
- **Publish a NEW original (review before it goes live):** drop a markdown file in
  [`drafts/`](./drafts/), then add a queue item with `published: false` pointing at it.
  The workflow creates it as a **dev.to draft** — you review and hit publish yourself.
  Use this lane for anything not already on the site.

## Run it locally

```sh
# rehearse — no key needed, nothing is sent
DRY_RUN=1 node automation/devto/post-next.mjs

# show queue status (needs the key to mark what's already posted)
DEVTO_API_KEY=xxxxx node automation/devto/post-next.mjs --list

# actually post the next item
DEVTO_API_KEY=xxxxx node automation/devto/post-next.mjs
```

## Cadence & tuning

- Change the schedule via the `cron:` line in the workflow (currently
  `0 14 * * 1,3,5` = Mon/Wed/Fri 14:00 UTC). Keep it to a few posts a week — dev.to
  flags accounts that fire off a fresh post every single day.
- Change the canonical origin with the `SITE_ORIGIN` env var (defaults to
  `https://clankersupport.com`).
