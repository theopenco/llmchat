import { notFound } from "next/navigation";

import { ToolPage } from "@/components/tools/ToolPage";
import { CannedResponseGenerator } from "@/components/tools/CannedResponseGenerator";
import { getTool } from "@/lib/tools";
import { pageMeta } from "@/lib/seo";

const tool = getTool("canned-response-generator");

export const metadata = tool
	? pageMeta({
			title: `${tool.seoTitle} — Clanker Support`,
			description: tool.seoDescription,
			path: `/tools/${tool.slug}`,
		})
	: {};

export default function CannedResponseGeneratorPage() {
	if (!tool) notFound();
	return (
		<ToolPage tool={tool}>
			<CannedResponseGenerator />
		</ToolPage>
	);
}
