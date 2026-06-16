import { Hono } from "hono";

import { db } from "@/lib/db";
import { renderEmbedPage } from "@/lib/embed-page";

import type { AppContext } from "@/env";

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

	const html = renderEmbedPage({
		projectName: project.name,
		publicKey: project.publicKey,
		brandColor: project.brandColor,
		escalationThreshold: project.escalationThreshold,
	});

	// Framing by any site is the point of this page; everything else is locked
	// down. style-src 'unsafe-inline' covers the widget's shadow-DOM <style>.
	c.header(
		"content-security-policy",
		"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors *",
	);
	c.header(
		"permissions-policy",
		"camera=(), microphone=(), geolocation=(), payment=()",
	);
	c.header("x-content-type-options", "nosniff");
	c.header("referrer-policy", "no-referrer");
	c.header("cache-control", "public, max-age=300");
	return c.html(html);
});
