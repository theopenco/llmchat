import { DashboardShell } from "@/components/dashboard-shell";

export default function InboxLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardShell>{children}</DashboardShell>;
}
