import { notFound } from "next/navigation";

import { ToolPage } from "@/components/tools/ToolPage";
import { LlmsTxtGenerator } from "@/components/tools/LlmsTxtGenerator";
import { getTool } from "@/lib/tools";
import { pageMeta } from "@/lib/seo";

const tool = getTool("llms-txt-generator");

export const metadata = tool
	? pageMeta({
			title: tool.seoTitle,
			description: tool.seoDescription,
			path: `/tools/${tool.slug}`,
		})
	: {};

export default function LlmsTxtGeneratorPage() {
	if (!tool) notFound();
	return (
		<ToolPage tool={tool}>
			<LlmsTxtGenerator />
		</ToolPage>
	);
}
