---
id: discuss-phase
title: Discuss Phase
group: Workflow
---

The discussion stage is the first stage of `/maxsim:plan`. It surfaces assumptions, scope questions, and architectural decisions before research or planning begins.

{% codeblock language="bash" %}
/maxsim:plan 1
{% /codeblock %}

### What discussion does

The discussion agent reads your roadmap and phase context from GitHub, then asks targeted questions about the phase. Questions adapt based on your answers. If you mention a third-party API, it asks about rate limits and authentication. If you mention real-time features, it asks about WebSocket vs. polling tradeoffs.

At the end of the discussion stage, output is written as a comment on the phase GitHub Issue and feeds directly into the research stage.

### After discussion

Once discussion is complete, `/maxsim:plan` shows a gate summary and waits for confirmation before advancing to the research stage. You can review or add to the discussion notes before proceeding.

{% callout type="note" %}
The discussion stage is valuable for phases that touch infrastructure, external services, or cross-phase integration points. The questions it raises are the ones an experienced architect would ask in a pre-sprint meeting.
{% /callout %}
