import * as React from "react";

import { cn } from "@/lib/utils";

export interface NavItemProps extends React.HTMLAttributes<HTMLElement> {
	icon: React.ReactNode;
	label: string;
	active?: boolean;
	/** Optional trailing content (e.g. an unread count badge). */
	trailing?: React.ReactNode;
	/** Render as a different element (e.g. a Next <Link>) via asChild. */
	asChild?: boolean;
}

/**
 * Design-system sidebar nav row for the Clanker restyle. Generic + token-driven:
 * icon · label · optional trailing slot, with active/inactive states from the ck
 * scale (active = solid accent; inactive = muted, hover surface). `asChild` lets
 * a Next <Link> own the anchor while keeping the styling here. Shared by the
 * shell and any future nav.
 */
export const NavItem = React.forwardRef<HTMLElement, NavItemProps>(
	(
		{ icon, label, active, trailing, asChild, className, children, ...props },
		ref,
	) => {
		const cls = cn(
			"flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium transition-colors",
			"[&_svg]:size-[18px] [&_svg]:shrink-0",
			active
				? "bg-ck-accent text-white [&_svg]:text-white"
				: "text-ck-muted hover:bg-ck-navhover hover:text-ck-text [&_svg]:text-ck-muted",
			className,
		);

		const inner = (
			<>
				{icon}
				<span className="flex-1 truncate">{label}</span>
				{trailing}
			</>
		);

		// asChild: the single child (e.g. a <Link>) becomes the element and
		// receives the className + content.
		if (asChild && React.isValidElement(children)) {
			return React.cloneElement(
				children as React.ReactElement<{ className?: string }>,
				{
					className: cn(
						cls,
						(children as React.ReactElement<{ className?: string }>).props
							.className,
					),
				},
				inner,
			);
		}

		return (
			<div ref={ref as React.Ref<HTMLDivElement>} className={cls} {...props}>
				{inner}
			</div>
		);
	},
);
NavItem.displayName = "NavItem";
