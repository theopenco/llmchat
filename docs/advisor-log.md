# Advisor log

One line per shipped PR — PR · date · what changed and why it mattered. Newest last.

- PR #167 · 2026-07-26 · Suggest with AI shipped (operator-side reply drafting): draft ≠ send, notes never reach the model, `kind='suggestion'` metering excluded from the visitor quota; pre-PR adversarial review caught the in-flight composer race and empirically falsified the drizzle `.default()` INSERT-omission assumption (preview impact documented in the PR).
- PR #172 · 2026-07-26 · Homepage honesty pass after the live claim-check of the 883e7ca redesign: hero demo re-scripted around the real visitor-tap escalation, auto-escalation copy corrected, fabricated citation footers removed; showcase build guard + weekly Discord demo-health probe added (showcase key replacement still pending — task 125).
- PR #181 · 2026-08-02 · Voice KB grounding fix (audit item 0): the mint shipped the text path's 80k+-char prompt past the realtime 16,384-token cap and the widget warn-and-continued into live ungrounded calls — now a voice-sized budget + token-ceiling backstop server-side, and rejection/timeout is call-fatal ("unavailable") client-side; 6 adversarial-review findings fixed pre-merge, 8/8 mutants killed; upstream mint-time instruction binding filed as llmgateway#3377.
