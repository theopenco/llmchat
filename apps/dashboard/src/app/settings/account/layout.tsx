import { DashboardGate } from "@/components/dashboard-gate";

export default function AccountLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardGate>{children}</DashboardGate>;
}
