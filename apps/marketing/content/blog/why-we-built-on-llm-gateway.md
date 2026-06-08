---
title: "Why we built on LLM Gateway instead of calling OpenAI directly"
description: "Our reasoning for using a model abstraction layer from day one — and why it's already paid off twice."
date: "2026-05-10"
category: "Engineering"
featured: false
---
When we started llmchat, the obvious path was to call OpenAI's API directly. Every tutorial does it, the SDK is excellent, and it's what you know. We chose not to, and it's already paid off twice.

The first time: GPT-4o pricing changed. We were able to re-evaluate and switch models for lower-cost use cases without touching our integration code. One config change.

The second time: a customer needed to run on a self-hosted model for data residency reasons. We added their endpoint as a custom provider in LLM Gateway, pointed the project at it, and nothing else changed.

LLM Gateway gives us a single interface — the OpenAI-compatible API — with routing, fallback, cost attribution, and usage metering on top. We use the Vercel AI SDK with their custom provider, which means our streaming code is the same regardless of what model is underneath.

The practical implication for llmchat users: every project can run a different model. You might use Claude 3.5 Haiku for your high-volume support widget and GPT-4o for your enterprise tier. You get cost and usage per project without building that instrumentation yourself.

We're believers in the principle that the model layer should be a runtime concern, not a compile-time one. LLM Gateway makes that real.
