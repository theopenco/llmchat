import { DashboardGate } from "@/components/dashboard-gate";

export default function ProjectsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardGate>{children}</DashboardGate>;
}
