---
title: "Setting up email threading for your support widget"
description: "A step-by-step guide to configuring inbound email so customer replies thread back into the same conversation."
date: "2026-05-05"
category: "Guides"
featured: false
---

When a conversation escalates in llmchat, we send an email to your configured notify address. What makes it useful rather than just a notification is what happens next: the customer can reply to that email, and their reply threads back into the conversation in your inbox.

**Step 1: Configure your notify email.** In your project settings, set the "Notify email" field to wherever you want escalation alerts to land. This is your team inbox or a shared support address.

**Step 2: Set up your inbound email domain.** llmchat uses Resend for both outbound and inbound email. You'll need to configure a receiving domain (e.g., inbound.yourdomain.com) and add the MX records Resend provides. This is a one-time DNS change.

**Step 3: Set your inbound email local.** In project settings, set the "Inbound email local" field to a short identifier (e.g., "support" for support@inbound.yourdomain.com). This is the address customers reply to.

**Step 4: Test it.** Create a test conversation, escalate it manually, and reply to the notification email from a different address. The reply should appear in your inbox within seconds.

Once set up, the thread works both ways: you can reply from your inbox and the customer sees it in the widget. No separate helpdesk required for the basic case.
