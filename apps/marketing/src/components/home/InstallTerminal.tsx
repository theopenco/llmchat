"use client";

import { MotionConfig } from "motion/react";
import {
	AnimatedSpan,
	Terminal,
	TypingAnimation,
} from "@/components/magicui/terminal";
import { CopyButton } from "@/components/tools/CopyButton";

/**
 * The one-script-tag moment. The snippet is the REAL embed (placeholder
 * project key — it's an instruction, not fake data); every ✔ line states
 * actual product behavior. Copy button reuses the tools CopyButton, which
 * reports tool_used {tool: "home_install_snippet"} — a new event, additive
 * only; the existing signup CTA events are untouched.
 */
const SNIPPET = `<script src="https://api.clankersupport.com/widget.js"
  data-project="pk_YOUR_PROJECT_KEY" async></script>`;

export function InstallTerminal() {
	return (
		<MotionConfig reducedMotion="user">
			<div className="flex flex-col gap-4">
				<Terminal className="max-h-none min-h-0 w-full max-w-none bg-paper-card/80 text-left">
					<TypingAnimation duration={18} className="text-muted">
						{`$ cat index.html`}
					</TypingAnimation>
					<AnimatedSpan
						delay={1400}
						className="whitespace-pre-wrap break-all text-accent-soft"
					>
						{SNIPPET}
					</AnimatedSpan>
					<AnimatedSpan
						delay={2200}
						className="text-emerald-700 dark:text-emerald-400"
					>
						✔ Widget mounted — isolated shadow DOM, your brand color
					</AnimatedSpan>
					<AnimatedSpan
						delay={2700}
						className="text-emerald-700 dark:text-emerald-400"
					>
						✔ Answering from your docs and sources
					</AnimatedSpan>
					<AnimatedSpan delay={3200} className="text-muted">
						→ Escalations land in your team inbox
					</AnimatedSpan>
				</Terminal>
				<div>
					<CopyButton
						text={() => SNIPPET}
						tool="home_install_snippet"
						label="Copy the script tag"
					/>
				</div>
			</div>
		</MotionConfig>
	);
}
