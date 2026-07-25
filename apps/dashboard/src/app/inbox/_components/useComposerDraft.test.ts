import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useComposerDraft } from "./useComposerDraft";

describe("useComposerDraft — AI-draft marker + conversation-switch clearing", () => {
	it("acceptDraft fills the composer and marks it; edits leave the marker to derive stale", () => {
		const { result } = renderHook(() => useComposerDraft("conv-a"));
		act(() => result.current.acceptDraft("AI text"));
		expect(result.current.value).toBe("AI text");
		expect(result.current.aiDraft).toBe("AI text");
		// The "unedited" check is derivation, not state: after an edit the
		// values simply diverge.
		act(() => result.current.setValue("AI text, edited"));
		expect(result.current.value).not.toBe(result.current.aiDraft);
	});

	it("clears an UNEDITED AI draft on conversation switch (the carry-over hazard)", () => {
		const { result, rerender } = renderHook(
			({ id }: { id: string | null }) => useComposerDraft(id),
			{ initialProps: { id: "conv-a" as string | null } },
		);
		act(() => result.current.acceptDraft("draft for A"));
		rerender({ id: "conv-b" });
		expect(result.current.value).toBe("");
		expect(result.current.aiDraft).toBeNull();
	});

	it("keeps operator-typed text across switches (existing behavior pinned)", () => {
		const { result, rerender } = renderHook(
			({ id }: { id: string | null }) => useComposerDraft(id),
			{ initialProps: { id: "conv-a" as string | null } },
		);
		act(() => result.current.setValue("half-typed reply"));
		rerender({ id: "conv-b" });
		expect(result.current.value).toBe("half-typed reply");
		expect(result.current.aiDraft).toBeNull();
	});

	it("keeps an EDITED draft's text on switch but drops the marker", () => {
		const { result, rerender } = renderHook(
			({ id }: { id: string | null }) => useComposerDraft(id),
			{ initialProps: { id: "conv-a" as string | null } },
		);
		act(() => {
			result.current.acceptDraft("draft");
		});
		act(() => {
			result.current.setValue("draft + my edits");
		});
		rerender({ id: "conv-b" });
		expect(result.current.value).toBe("draft + my edits");
		expect(result.current.aiDraft).toBeNull();
	});

	it("clear() resets both after a send", () => {
		const { result } = renderHook(() => useComposerDraft("conv-a"));
		act(() => result.current.acceptDraft("draft"));
		act(() => result.current.clear());
		expect(result.current.value).toBe("");
		expect(result.current.aiDraft).toBeNull();
	});
});
