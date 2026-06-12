import { Hono } from "hono";

import { db } from "@/lib/db";
import { escapeHtml } from "@/lib/email";

import type { AppContext } from "@/env";

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FALLBACK_BRAND = "#111827";

/**
 * Full-page chat for `<iframe src=".../embed/<publicKey>">` embeds. Serves an
 * HTML shell that mounts the widget in inline mode; the chat itself talks to
 * the same-origin /v1 endpoints.
 */
export const embed = new Hono<AppContext>().get("/embed/:key", async (c) => {
	const key = c.req.param("key");
	const project = await db(c.env).query.project.findFirst({
		where: (pt, { eq: e }) => e(pt.publicKey, key),
	});
	if (!project) {
		return c.text("Unknown project key", 404);
	}

	const origin = new URL(c.req.url).origin;
	const brand = HEX_COLOR.test(project.brandColor)
		? project.brandColor
		: FALLBACK_BRAND;

	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(project.name)} — Chat</title>
<style>html,body{margin:0;height:100%;background:#fff}</style>
</head>
<body>
<script src="${origin}/widget.js" data-project="${escapeHtml(project.publicKey)}" data-api="${origin}" data-brand="${brand}" data-mode="inline" defer></script>
</body>
</html>`;

	// Framing by any site is the point of this page; everything else is locked
	// down. style-src 'unsafe-inline' covers the widget's shadow-DOM <style>.
	c.header(
		"content-security-policy",
		"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors *",
	);
	c.header("x-content-type-options", "nosniff");
	c.header("referrer-policy", "no-referrer");
	c.header("cache-control", "public, max-age=300");
	return c.html(html);
});
