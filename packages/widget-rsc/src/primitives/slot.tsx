"use client";

import { Children, cloneElement, isValidElement } from "react";

import type { HTMLAttributes, ReactNode } from "react";

type AnyProps = Record<string, unknown>;

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
	const merged: AnyProps = { ...slotProps, ...childProps };
	for (const key of Object.keys(slotProps)) {
		const slotValue = slotProps[key];
		const childValue = childProps[key];
		if (key === "className") {
			merged[key] = [slotValue, childValue].filter(Boolean).join(" ");
		} else if (key === "style") {
			merged[key] = {
				...(slotValue as object | undefined),
				...(childValue as object | undefined),
			};
		} else if (
			/^on[A-Z]/.test(key) &&
			typeof slotValue === "function" &&
			typeof childValue === "function"
		) {
			// Compose handlers: the child's own runs first, then the primitive's.
			merged[key] = (...args: unknown[]) => {
				(childValue as (...a: unknown[]) => void)(...args);
				(slotValue as (...a: unknown[]) => void)(...args);
			};
		}
	}
	return merged;
}

/**
 * Minimal Radix-style Slot: merges the primitive's props (className, style,
 * handlers, aria/data attributes) onto the single child element, so any
 * primitive with `asChild` can render YOUR component instead of its default
 * tag.
 */
export function Slot({
	children,
	...slotProps
}: HTMLAttributes<HTMLElement> & { children?: ReactNode }) {
	const child = Children.only(children);
	if (!isValidElement(child)) {
		return null;
	}
	return cloneElement(child, mergeProps(slotProps, child.props as AnyProps));
}
