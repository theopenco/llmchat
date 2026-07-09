# Integrations demo / e2e harness

Runs the Cal.com + Shopify agent actions against the LIVE local stack with a
deterministic mock upstream — no LLM Gateway key, Cal.com account, or Shopify
store needed. The mock serves an OpenAI-compatible scripted "model" plus
Cal.com/Shopify API fixtures; everything else (AI SDK tool loop, api clients,
persistence, widget, dashboard) runs for real.

```sh
pnpm dev                                            # terminal 1 — the stack
pnpm seed                                           # once
node apps/api/scripts/integrations-demo/mock-upstream.mjs   # terminal 2
# point the model at the mock: in apps/api/.env set
#   LLMGATEWAY_BASE_URL=http://127.0.0.1:9099/v1
#   LLMGATEWAY_API_KEY=demo-local-key
node apps/api/scripts/integrations-demo/setup.mjs   # configure both integrations
node apps/api/scripts/integrations-demo/e2e-chat.mjs        # 9-check e2e
node apps/api/scripts/integrations-demo/record-demo.mjs     # record the demo video
```
