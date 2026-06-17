import { DashboardGate } from "@/components/dashboard-gate";

export default function BillingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardGate>{children}</DashboardGate>;
}
