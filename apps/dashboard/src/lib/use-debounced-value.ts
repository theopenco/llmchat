import { useEffect, useState } from "react";

/**
 * Returns `value` after it has stopped changing for `delayMs`. Used to keep the
 * inbox search from firing a server query on every keystroke — the request only
 * goes out once the user pauses typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timer);
	}, [value, delayMs]);
	return debounced;
}
