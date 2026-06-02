import * as React from "react";

import { cn } from "@/lib/utils";

const Empty = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border py-16 text-center",
			className,
		)}
		{...props}
	/>
));
Empty.displayName = "Empty";

const EmptyHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col items-center gap-3", className)}
		{...props}
	/>
));
EmptyHeader.displayName = "EmptyHeader";

const EmptyMedia = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & { variant?: "icon" | "default" }
>(({ className, variant = "icon", ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			variant === "icon"
				? "flex h-14 w-14 items-center justify-center rounded-full bg-muted [&_svg]:size-6 [&_svg]:text-muted-foreground"
				: "",
			className,
		)}
		{...props}
	/>
));
EmptyMedia.displayName = "EmptyMedia";

const EmptyTitle = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("text-sm font-medium text-foreground", className)}
		{...props}
	/>
));
EmptyTitle.displayName = "EmptyTitle";

const EmptyDescription = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"max-w-xs text-xs leading-relaxed text-muted-foreground",
			className,
		)}
		{...props}
	/>
));
EmptyDescription.displayName = "EmptyDescription";

const EmptyContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("mt-4 flex items-center gap-2", className)}
		{...props}
	/>
));
EmptyContent.displayName = "EmptyContent";

export {
	Empty,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	EmptyDescription,
	EmptyContent,
};
