import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useComposerDraft } from "./useComposerDraft";

describe("useComposerDraft — AI-draft marker + conversation-switch clearing", () => {
	it("acceptDraft fills the composer and marks it; edits leave the marker to derive stale", () => {
		const { result } = renderHook(() => useComposerDraft("conv-a"));
		act(() => result.current.acceptDraft("AI text", "conv-a"));
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
		act(() => result.current.acceptDraft("draft for A", "conv-a"));
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
			result.current.acceptDraft("draft", "conv-a");
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
		act(() => result.current.acceptDraft("draft", "conv-a"));
		act(() => result.current.clear());
		expect(result.current.value).toBe("");
		expect(result.current.aiDraft).toBeNull();
	});

	// In-flight binding (#98 review blocker): a suggest request is bound to the
	// conversation it was FIRED for. A response landing after the operator moved
	// on must be dropped, never planted in another thread's composer.
	it("DROPS a draft that lands after switching conversations (in-flight race)", () => {
		const { result, rerender } = renderHook(
			({ id }: { id: string | null }) => useComposerDraft(id),
			{ initialProps: { id: "conv-a" as string | null } },
		);
		rerender({ id: "conv-b" });
		// The request was fired while viewing conv-a; it resolves on conv-b.
		act(() => result.current.acceptDraft("draft generated for A", "conv-a"));
		expect(result.current.value).toBe("");
		expect(result.current.aiDraft).toBeNull();
	});

	it("DROPS a draft that lands after the operator started typing (protects typed text)", () => {
		const { result } = renderHook(() => useComposerDraft("conv-a"));
		act(() => result.current.setValue("already typing my own reply"));
		act(() => result.current.acceptDraft("late AI draft", "conv-a"));
		expect(result.current.value).toBe("already typing my own reply");
		expect(result.current.aiDraft).toBeNull();
	});

	it("still ACCEPTS over an unedited earlier draft (the Regenerate path)", () => {
		const { result } = renderHook(() => useComposerDraft("conv-a"));
		act(() => result.current.acceptDraft("first draft", "conv-a"));
		act(() => result.current.acceptDraft("second draft", "conv-a"));
		expect(result.current.value).toBe("second draft");
		expect(result.current.aiDraft).toBe("second draft");
	});
});
