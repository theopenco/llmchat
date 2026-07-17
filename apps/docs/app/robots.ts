import { DOCS_URL } from "@/lib/site";

import type { MetadataRoute } from "next";

// Public, indexable docs. An explicit robots.txt (instead of the 404 the app
// served before) is unambiguous for crawlers and is the only place the docs
// sitemap gets advertised — this host isn't registered in Search Console the
// way the marketing site is.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
		sitemap: `${DOCS_URL}/sitemap.xml`,
	};
}
