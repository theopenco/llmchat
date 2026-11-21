---
title: "Why we built on LLM Gateway instead of calling OpenAI directly"
seoTitle: "Why we built on LLM Gateway instead of calling OpenAI"
description: "Our reasoning for using a model abstraction layer from day one — and why it's already paid off twice."
seoDescription: "Why Clanker Support routes every AI reply through LLM Gateway: one API for GPT, Claude, Gemini and open models, per-project model choice, and no rewrites."
date: "2026-05-10"
updated: "2026-11-21"
category: "Engineering"
featured: false
---

When we started Clanker Support, the obvious path was to call OpenAI's API directly. Every tutorial does it, the SDK is excellent, and it's what you know. We chose not to, and it's already paid off twice.

The first time: GPT-4o pricing changed. We were able to re-evaluate and switch models for lower-cost use cases without touching our integration code. One config change.

The second time: a customer needed to run on a self-hosted model for data residency reasons. We added their endpoint as a custom provider in LLM Gateway, pointed the project at it, and nothing else changed.

LLM Gateway gives us a single interface — the OpenAI-compatible API — with routing, fallback, cost attribution, and usage metering on top. We use the Vercel AI SDK with their custom provider, which means our streaming code is the same regardless of what model is underneath.

The practical implication for Clanker Support users: every project can run a different model. You might run a small, cheap model such as GPT-6 Luna or Claude Haiku 5.5 on a high-volume FAQ widget and Claude Sonnet 5.5 or GPT-6.2 Sol on your flagship product. You get cost and usage per project without building that instrumentation yourself.

## How the model catalog stays current

The list of models you can pick is not hand-maintained. It is generated from LLM Gateway's own model registry (the `@llmgateway/models` package) and filtered to models that can actually do the job of a support agent:

- **Web search** on at least one provider route, so the agent can look things up when your knowledge base runs out.
- **Tool calling**, because integration actions such as booking a Cal.com slot or looking up a Shopify order run as tools.
- **Still live.** Routes the gateway has deactivated are dropped, and text-only chat models are kept (image generators that also advertise search are left out).

As of November 2026 that is 67 models across OpenAI (GPT-5.x and GPT-6), Anthropic (Claude 4.x and 5.x), Google (Gemini 3.x and 4), DeepSeek, Alibaba (Qwen) and Z.ai (GLM). When the gateway ships a new model, it shows up in the picker after a regenerate; when it retires one, any project still saved on it falls back to the default model instead of erroring, so the widget keeps answering.

We're believers in the principle that the model layer should be a runtime concern, not a compile-time one. LLM Gateway makes that real.
