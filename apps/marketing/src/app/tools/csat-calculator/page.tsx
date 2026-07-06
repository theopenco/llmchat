import { notFound } from "next/navigation";

import { ToolPage } from "@/components/tools/ToolPage";
import { CsatCalculator } from "@/components/tools/CsatCalculator";
import { getTool } from "@/lib/tools";
import { pageMeta } from "@/lib/seo";

const tool = getTool("csat-calculator");

export const metadata = tool
	? pageMeta({
			title: tool.seoTitle,
			description: tool.seoDescription,
			path: `/tools/${tool.slug}`,
		})
	: {};

export default function CsatCalculatorPage() {
	if (!tool) notFound();
	return (
		<ToolPage tool={tool}>
			<CsatCalculator />
		</ToolPage>
	);
}
