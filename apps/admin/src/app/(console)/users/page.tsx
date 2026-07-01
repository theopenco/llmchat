"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/Page";
import { cx } from "@/lib/cx";
import { fmtDate, fmtInt } from "@/lib/format";
import { useUsers } from "@/lib/hooks";

export default function UsersPage() {
	const { data, isLoading, isError } = useUsers();
	const rows = data?.users ?? [];
	const admins = rows.filter((u) => u.role === "admin").length;

	return (
		<>
			<PageHeader
				title="Users"
				subtitle="Everyone who has signed up, most recent first."
				right={
					<span className="num text-xs text-faint">
						{fmtInt(rows.length)} shown · {fmtInt(admins)} admin
					</span>
				}
			/>
			<div className="px-6 py-6 md:px-8">
				<div className="card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-sm">
							<thead>
								<tr className="border-b border-line text-left">
									<Th>Name</Th>
									<Th>Email</Th>
									<Th>Role</Th>
									<Th>Verified</Th>
									<Th className="text-right">Signed up</Th>
								</tr>
							</thead>
							<tbody>
								{isError ? (
									<EmptyRow>Couldn&apos;t load users.</EmptyRow>
								) : isLoading ? (
									<EmptyRow>Loading…</EmptyRow>
								) : rows.length === 0 ? (
									<EmptyRow>No users yet.</EmptyRow>
								) : (
									rows.map((u) => (
										<tr
											key={u.id}
											className="border-b border-line/60 last:border-0 hover:bg-panel/60"
										>
											<Td className="font-medium text-text">{u.name || "—"}</Td>
											<Td className="text-muted">{u.email}</Td>
											<Td>
												{u.role === "admin" ? (
													<span className="inline-flex items-center gap-1.5 text-accent-soft">
														<ShieldCheck className="size-3.5" />
														<span className="text-xs font-medium">Admin</span>
													</span>
												) : (
													<span className="text-xs text-faint">User</span>
												)}
											</Td>
											<Td>
												{u.emailVerified ? (
													<span className="inline-flex items-center gap-1.5 text-pos">
														<BadgeCheck className="size-3.5" />
														<span className="text-xs">Verified</span>
													</span>
												) : (
													<span className="text-xs text-faint">—</span>
												)}
											</Td>
											<Td className="num text-right text-faint">
												{fmtDate(u.createdAt)}
											</Td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</>
	);
}

function Th({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<th className={cx("label px-4 py-3 font-medium", className)}>{children}</th>
	);
}

function Td({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<td className={cx("px-4 py-3 align-middle", className)}>{children}</td>
	);
}

function EmptyRow({ children }: { children: React.ReactNode }) {
	return (
		<tr>
			<td colSpan={5} className="px-4 py-10 text-center text-sm text-faint">
				{children}
			</td>
		</tr>
	);
}
