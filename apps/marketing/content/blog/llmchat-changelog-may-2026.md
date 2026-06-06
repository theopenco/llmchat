---
title: "Changelog: May 2026 — knowledge base improvements and new model options"
description: "Longer knowledge base support, model selection per project, and a handful of inbox quality-of-life improvements."
date: "2026-05-01"
category: "Changelog"
featured: false
---
Here's what shipped in May.

**Longer knowledge base support.** We've increased the knowledge base character limit from 8k to 32k characters. Customers running large doc sets can now paste in significantly more content without hitting the cap.

**Model selection per project.** You can now choose which LLM Gateway model to use on a per-project basis from the project settings page. We've pre-populated the dropdown with the models we've tested and recommend, but you can also enter a custom model ID.

**Inbox: unread badge.** The conversation list now shows an unread badge on conversations with messages your team hasn't seen. Badge counts reset when you open the conversation.

**Inbox: archive bulk action.** You can now select multiple conversations and archive them in one action. Useful for cleaning up resolved conversations at the end of a shift.

**Widget: branded color inheritance.** The widget now picks up your brand color for the header and primary button. Set it once in project settings and it applies automatically.

**Bug fix: email threading on reply.** Fixed an issue where customer email replies were occasionally creating duplicate messages in the conversation. Inbound email parsing is now more robust against non-standard reply formatting.

Next up: Slack webhook notifications, conversation search, and a public API for pulling usage data.
