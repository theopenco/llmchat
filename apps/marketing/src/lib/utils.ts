import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class merger — required by the vendored magicui components. */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
