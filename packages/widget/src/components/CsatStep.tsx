import { useState } from "react";

import { StarIcon } from "./icons";

/**
 * Closing screen: a 1–5 star "How was your experience?" prompt, or a brief
 * thank-you after a rating is submitted. Tapping a star submits; "Skip" (and the
 * frame's close button) always dismiss — the visitor is never trapped.
 */
export function CsatStep({
	step,
	onRate,
	onSkip,
}: {
	step: "prompt" | "thanks";
	onRate: (rating: number) => void;
	onSkip: () => void;
}) {
	const [hover, setHover] = useState(0);

	if (step === "thanks") {
		return (
			<div className="llmchat-csat" role="status">
				<p className="llmchat-csat-title">Thanks for your feedback!</p>
			</div>
		);
	}

	return (
		<div className="llmchat-csat">
			<p className="llmchat-csat-title">How was your experience?</p>
			<div
				className="llmchat-csat-stars"
				role="group"
				aria-label="Rate from 1 to 5 stars"
				onMouseLeave={() => setHover(0)}
			>
				{[1, 2, 3, 4, 5].map((n) => (
					<button
						key={n}
						type="button"
						className="llmchat-csat-star"
						aria-label={`${n} star${n > 1 ? "s" : ""}`}
						aria-pressed={false}
						onMouseEnter={() => setHover(n)}
						onClick={() => onRate(n)}
					>
						<StarIcon filled={n <= hover} />
					</button>
				))}
			</div>
			<button type="button" className="llmchat-csat-skip" onClick={onSkip}>
				Skip
			</button>
		</div>
	);
}
