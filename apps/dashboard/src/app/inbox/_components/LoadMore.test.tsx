import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoadMore } from "./LoadMore";

describe("LoadMore", () => {
	it("fires onLoadMore when the button is clicked", async () => {
		const onLoadMore = vi.fn();
		render(<LoadMore onLoadMore={onLoadMore} loading={false} />);
		await userEvent.click(screen.getByRole("button", { name: /load more/i }));
		expect(onLoadMore).toHaveBeenCalledTimes(1);
	});

	it("disables the button and shows a loading label while fetching", () => {
		render(<LoadMore onLoadMore={vi.fn()} loading={true} />);
		const btn = screen.getByRole("button");
		expect(btn).toBeDisabled();
		expect(btn).toHaveTextContent(/loading/i);
	});
});
