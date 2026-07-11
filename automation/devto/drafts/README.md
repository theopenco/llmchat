# dev.to drafts lane

Drop NEW original articles here (ones **not** already published on
`clankersupport.com`) that you want syndicated to dev.to as a **draft** for review
before they go live.

1. Add `your-article.md` in this folder. Front matter is optional — if present, its
   `title`/`description` are used; otherwise set them in the queue item.
2. Add an item to [`../queue.json`](../queue.json):

   ```json
   {
   	"slug": "your-article",
   	"source": "automation/devto/drafts/your-article.md",
   	"series": "AI customer support in 2026",
   	"tags": ["ai", "customersupport"],
   	"published": false
   }
   ```

   Leave `canonical` off for content original to dev.to (there is no site URL to point
   back to). Set `published: false` so it lands as a **draft** — the workflow will not
   publish it; you review it on dev.to and publish by hand.

Keep root-relative links (`](/pricing)`) — they are rewritten to absolute
`clankersupport.com` URLs automatically at post time.
