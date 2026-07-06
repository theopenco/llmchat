import { notFound } from "next/navigation";

import { ToolPage } from "@/components/tools/ToolPage";
import { SavingsCalculator } from "@/components/tools/SavingsCalculator";
import { getTool } from "@/lib/tools";
import { pageMeta } from "@/lib/seo";

const tool = getTool("support-roi-calculator");

export const metadata = tool
	? pageMeta({
			title: tool.seoTitle,
			description: tool.seoDescription,
			path: `/tools/${tool.slug}`,
		})
	: {};

export default function SupportRoiCalculatorPage() {
	if (!tool) notFound();
	return (
		<ToolPage tool={tool}>
			<SavingsCalculator />
		</ToolPage>
	);
}
