"use client";

import { PageHeader } from "@/components/Page";
import { PlanBadge } from "@/components/PlanBadge";
import { cx } from "@/lib/cx";
import { fmtDate, fmtInt, fmtUsdPrecise } from "@/lib/format";
import { useWorkspaces } from "@/lib/hooks";

export default function WorkspacesPage() {
	const { data, isLoading, isError } = useWorkspaces();
	const rows = data?.workspaces ?? [];

	return (
		<>
			<PageHeader
				title="Workspaces"
				subtitle="Every workspace with its plan, owner, and 30-day usage."
				right={
					<span className="num text-xs text-faint">
						{fmtInt(rows.length)} shown
					</span>
				}
			/>
			<div className="px-6 py-6 md:px-8">
				<div className="card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[820px] text-sm">
							<thead>
								<tr className="border-b border-line text-left">
									<Th>Workspace</Th>
									<Th>Owner</Th>
									<Th>Plan</Th>
									<Th className="text-right">Members</Th>
									<Th className="text-right">Projects</Th>
									<Th className="text-right">Responses 30d</Th>
									<Th className="text-right">Cost 30d</Th>
									<Th className="text-right">Created</Th>
								</tr>
							</thead>
							<tbody>
								{isError ? (
									<EmptyRow>Couldn&apos;t load workspaces.</EmptyRow>
								) : isLoading ? (
									<EmptyRow>Loading…</EmptyRow>
								) : rows.length === 0 ? (
									<EmptyRow>No workspaces yet.</EmptyRow>
								) : (
									rows.map((w) => {
										const paid = w.plan !== "none";
										return (
											<tr
												key={w.id}
												className="border-b border-line/60 last:border-0 hover:bg-panel/60"
											>
												<Td className="font-medium text-text">{w.name}</Td>
												<Td className="text-muted">{w.ownerEmail ?? "—"}</Td>
												<Td>
													<span className="inline-flex items-center gap-2">
														<PlanBadge plan={w.plan} />
														{paid ? (
															<span
																className={cx(
																	"size-1.5 rounded-full",
																	w.hasSubscription ? "bg-pos" : "bg-warn",
																)}
																title={
																	w.hasSubscription
																		? "Active Stripe subscription"
																		: "Paid plan with no Stripe subscription id (drift)"
																}
															/>
														) : null}
													</span>
												</Td>
												<Td className="num text-right">{fmtInt(w.members)}</Td>
												<Td className="num text-right">{fmtInt(w.projects)}</Td>
												<Td className="num text-right">
													{fmtInt(w.responses30d)}
												</Td>
												<Td className="num text-right text-muted">
													{fmtUsdPrecise(w.costUsd30d)}
												</Td>
												<Td className="num text-right text-faint">
													{fmtDate(w.createdAt)}
												</Td>
											</tr>
										);
									})
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
			<td colSpan={8} className="px-4 py-10 text-center text-sm text-faint">
				{children}
			</td>
		</tr>
	);
}
