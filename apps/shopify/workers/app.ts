// workerd entry (Ploy `kind: dynamic` / wrangler). Plugin-free variant:
// `react-router build` resolves all vite virtuals into build/server/index.js,
// so this entry imports the BUILT bundle — never `virtual:react-router/*`,
// which only exists inside vite and would break Ploy's esbuild.
// Build order therefore matters: `pnpm build:app` BEFORE bundling this file.
import { createRequestHandler } from "react-router";
// @ts-ignore — built artifact (gitignored); only exists after `pnpm build:app`.
import * as serverBuild from "../build/server/index.js";

const handler = createRequestHandler(
	serverBuild as never,
	// Literal, not import.meta.env.MODE: that's vite-only and undefined under
	// raw esbuild/wrangler bundling.
	"production",
);

type WaitUntilable = { waitUntil(promise: Promise<unknown>): void };

export default {
	fetch(request: Request, env: unknown, ctx: WaitUntilable) {
		return handler(request, { cloudflare: { env, ctx } } as never);
	},
};
