import { DashboardGate } from "@/components/dashboard-gate";

export default function WorkspacesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardGate>{children}</DashboardGate>;
}
