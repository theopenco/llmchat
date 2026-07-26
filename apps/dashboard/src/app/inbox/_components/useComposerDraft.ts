"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Composer text + AI-draft marker state (#98 R3). The "AI draft — review
 * before sending" treatment DERIVES from `value === aiDraft` rather than being
 * synced: any edit automatically unmarks the draft with no state juggling, and
 * "Regenerate" is offered only over an unedited draft.
 *
 * The conversation-switch rule closes a real hazard (Phase-1 sink census):
 * composer text deliberately survives conversation switches — but an UNEDITED
 * AI draft generated for conversation A must never sit in conversation B's
 * composer one Enter away from sending. On switch: an unedited draft is
 * cleared; operator-typed text keeps the existing carry-over behavior.
 */
export function useComposerDraft(selectedId: string | null) {
	const [value, setValue] = useState("");
	const [aiDraft, setAiDraft] = useState<string | null>(null);
	const valueRef = useRef(value);
	valueRef.current = value;
	const draftRef = useRef(aiDraft);
	draftRef.current = aiDraft;
	const prevId = useRef(selectedId);

	useEffect(() => {
		if (prevId.current === selectedId) return;
		prevId.current = selectedId;
		if (draftRef.current !== null && valueRef.current === draftRef.current) {
			setValue("");
		}
		setAiDraft(null);
	}, [selectedId]);

	/**
	 * An accepted suggestion: fills the composer AND marks it as an AI draft.
	 * `forId` is the conversation the draft was REQUESTED for — a response that
	 * lands after the operator switched conversations, or after they started
	 * typing during "Drafting…", is dropped: a draft generated for A must never
	 * appear in B's composer, and an in-flight suggestion must never clobber
	 * operator-typed text. (Still accepted over an unedited earlier AI draft —
	 * the Regenerate path.)
	 */
	function acceptDraft(draft: string, forId: string | null) {
		if (forId === null || forId !== selectedId) return;
		const current = valueRef.current;
		if (current.trim().length > 0 && current !== draftRef.current) return;
		setValue(draft);
		setAiDraft(draft);
	}

	/** Post-send reset: empty composer, no lingering draft marker. */
	function clear() {
		setValue("");
		setAiDraft(null);
	}

	return { value, setValue, aiDraft, acceptDraft, clear };
}
