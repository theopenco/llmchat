import type { MetadataRoute } from "next";

// The showcase is a public, indexable demo page. Serving an explicit robots.txt
// replaces the 404 HTML the app returned before (crawlers treat a 404 as
// allow-all anyway, but an explicit file is unambiguous).
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
	};
}
