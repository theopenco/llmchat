"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Design-system dropdown menu for the Clanker restyle. A thin ck-token skin over
 * Radix's dropdown primitive — keeps the accessibility + keyboard nav, restyles
 * the surface. Generic: the shell's workspace / project / account menus all use
 * it, and future surfaces can too.
 */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export const MenuContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenu.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenu.Content>
>(({ className, sideOffset = 6, align = "start", ...props }, ref) => (
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			ref={ref}
			sideOffset={sideOffset}
			align={align}
			className={cn(
				"z-50 min-w-52 overflow-hidden rounded-xl border border-ck-border bg-ck-card p-1.5 text-ck-text shadow-lg",
				"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				className,
			)}
			{...props}
		/>
	</DropdownMenu.Portal>
));
MenuContent.displayName = "MenuContent";

export const MenuLabel = React.forwardRef<
	React.ElementRef<typeof DropdownMenu.Label>,
	React.ComponentPropsWithoutRef<typeof DropdownMenu.Label>
>(({ className, ...props }, ref) => (
	<DropdownMenu.Label
		ref={ref}
		className={cn(
			"px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ck-faint",
			className,
		)}
		{...props}
	/>
));
MenuLabel.displayName = "MenuLabel";

const menuItemClass = cn(
	"flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ck-text outline-none",
	"focus:bg-ck-navhover data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
	"[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ck-muted",
);

export const MenuItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenu.Item>,
	React.ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
		/** Show a trailing check (for selected rows in a switcher). */
		selected?: boolean;
	}
>(({ className, children, selected, asChild, ...props }, ref) => {
	// asChild: the caller's element (e.g. a <Link>) becomes the whole item and
	// carries the icon+label itself — don't inject our span/check wrapper.
	if (asChild) {
		return (
			<DropdownMenu.Item
				ref={ref}
				asChild
				className={cn(menuItemClass, className)}
				{...props}
			>
				{children}
			</DropdownMenu.Item>
		);
	}
	return (
		<DropdownMenu.Item
			ref={ref}
			className={cn(menuItemClass, className)}
			{...props}
		>
			<span className="flex flex-1 items-center gap-2.5">{children}</span>
			{selected && <Check className="ml-auto !text-ck-accent" />}
		</DropdownMenu.Item>
	);
});
MenuItem.displayName = "MenuItem";

export const MenuSeparator = React.forwardRef<
	React.ElementRef<typeof DropdownMenu.Separator>,
	React.ComponentPropsWithoutRef<typeof DropdownMenu.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenu.Separator
		ref={ref}
		className={cn("-mx-1.5 my-1.5 h-px bg-ck-border", className)}
		{...props}
	/>
));
MenuSeparator.displayName = "MenuSeparator";
