---
id: context-rot
title: Context Rot
group: Core Concepts
---

Context rot is the degradation of AI output quality that happens as a conversation grows long. Every message you send to an AI agent adds to the context window. Debugging sessions add stack traces. Planning sessions add half-formed ideas and rejected alternatives. Execution sessions add file contents, test output, and error messages.

By the time you're 20,000 tokens into a session, the model is paying attention to recent tokens far more than early ones. It may forget that you rejected a particular approach in hour one and suggest it again in hour three. It may lose track of the agreed-upon architecture and start making local decisions that contradict the global design.

MaxsimCLI's solution is structural: never ask one agent to hold the entire project in mind. Instead, each subagent receives only the context it needs to do its specific job. The executor sees the plan. The verifier sees the plan and the deliverables. The researcher sees the phase description and the codebase. Nothing more.

Structured artifacts — PLAN.md, SUMMARY.md, RESEARCH.md, STATE.md — serve as the hand-off medium between agents. Because artifacts are written files, they don't decay. An agent spawned six months later reads the same STATE.md as the one spawned yesterday.

{% callout type="note" %}
MaxsimCLI doesn't prevent you from having long conversations — it makes long conversations unnecessary for implementation work. Research, planning, execution, and verification each happen in a clean, scoped context.
{% /callout %}
