import { AdminGate } from "@/components/AdminGate";
import { Shell } from "@/components/Shell";

/** Wraps every console page (overview / workspaces / users) in the access gate
 * and chrome. `/login` sits outside this route group, so it stays ungated. */
export default function ConsoleLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AdminGate>
			<Shell>{children}</Shell>
		</AdminGate>
	);
}
