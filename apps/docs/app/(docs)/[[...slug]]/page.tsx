import { createRelativeLink } from "fumadocs-ui/mdx";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { DOCS_URL } from "@/lib/site";
import { source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

import type { Metadata } from "next";

export async function generateMetadata(props: {
	params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
	const { slug = [] } = await props.params;
	const page = source.getPage(slug);
	if (!page) {
		notFound();
	}

	const { title, description } = page.data;
	return {
		title,
		description,
		// Self-referencing canonical — metadataBase (root layout) makes it
		// absolute. Without it, preview hosts and ?-parameter URLs compete with
		// the real page.
		alternates: { canonical: page.url },
		openGraph: {
			type: "article",
			url: page.url,
			title,
			description,
			siteName: "Clanker Support Docs",
			// Explicit: a page-level openGraph replaces the layout's resolved
			// metadata (shallow merge), so the file-convention og:image from
			// app/opengraph-image.png never reaches these pages on its own.
			images: [{ url: "/opengraph-image.png" }],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: ["/opengraph-image.png"],
		},
	};
}

/**
 * schema.org BreadcrumbList for a docs page: home, any ancestor slug that is
 * itself a page (e.g. /learn), then the page. Google requires absolute `item`
 * URLs.
 */
function breadcrumbLd(slug: string[], title: string, pageUrl: string) {
	const items: { name: string; url: string }[] = [
		{ name: "Docs", url: `${DOCS_URL}/` },
	];
	for (let i = 1; i < slug.length; i++) {
		const ancestor = source.getPage(slug.slice(0, i));
		if (ancestor) {
			items.push({
				name: ancestor.data.title,
				url: `${DOCS_URL}${ancestor.url}`,
			});
		}
	}
	items.push({ name: title, url: `${DOCS_URL}${pageUrl}` });
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

export default async function Page(props: {
	params: Promise<{ slug?: string[] }>;
}) {
	const { slug = [] } = await props.params;
	const page = source.getPage(slug);
	if (!page) {
		notFound();
	}

	const MDXContent = page.data.body;

	// TechArticle marks each page as technical documentation for answer
	// engines; the breadcrumb gives them the section trail.
	const articleLd = {
		"@context": "https://schema.org",
		"@type": "TechArticle",
		headline: page.data.title,
		description: page.data.description,
		url: `${DOCS_URL}${page.url}`,
		publisher: {
			"@type": "Organization",
			name: "Clanker Support",
			url: "https://clankersupport.com",
		},
	};

	return (
		<DocsPage toc={page.data.toc} full={page.data.full}>
			<JsonLd data={articleLd} />
			{slug.length > 0 && (
				<JsonLd data={breadcrumbLd(slug, page.data.title, page.url)} />
			)}
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDXContent
					components={getMDXComponents({
						a: createRelativeLink(source, page),
					})}
				/>
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return source.generateParams();
}
