import type { MetadataRoute } from "next";

// Deliberately allow crawling: the layout serves a noindex robots meta on every
// page, and Google can only see that tag on pages it's allowed to fetch. A
// Disallow here would leave externally-linked URLs indexed as bare URLs with no
// way to discover the noindex. (Same reasoning as the dashboard's robots.ts.)
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
	};
}
