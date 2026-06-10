import { DashboardGate } from "@/components/dashboard-gate";

export default function InboxLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardGate>{children}</DashboardGate>;
}
