import { DashboardShell } from "@/components/dashboard-shell";

export default function ProjectsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <DashboardShell>{children}</DashboardShell>;
}
