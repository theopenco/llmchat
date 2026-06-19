import type { MetadataRoute } from "next";

import { CANONICAL_SITE_URL } from "@/lib/site-urls";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
		sitemap: `${CANONICAL_SITE_URL}/sitemap.xml`,
		host: CANONICAL_SITE_URL,
	};
}
