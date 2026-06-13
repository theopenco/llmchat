/**
 * Decide which item should be selected given the current/persisted selection
 * and the set that actually exists.
 *
 * - no items                  -> null (nothing to select)
 * - current id still valid    -> keep it (honor the user's choice)
 * - current id stale/missing  -> first item (so a deleted/foreign id can't pin
 *                                the UI to something that no longer exists)
 */
export function resolveSelectedId(
	current: string | null,
	items: readonly { id: string }[],
): string | null {
	if (items.length === 0) return null;
	if (current && items.some((item) => item.id === current)) return current;
	return items[0]!.id;
}
