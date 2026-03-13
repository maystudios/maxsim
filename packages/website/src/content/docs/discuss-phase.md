---
id: discuss-phase
title: Plan Phase
group: Workflow
---

`/maxsim:plan` manages the full planning lifecycle for a phase. It follows a state-machine approach with three stages: Discussion, Research, and Planning. Each stage produces artifacts that feed into the next.

{% codeblock language="bash" %}
/maxsim:plan 1
{% /codeblock %}

### Discussion stage

The discussion agent reads your ROADMAP.md, PROJECT.md, and REQUIREMENTS.md, then asks targeted questions about the phase. Questions adapt based on your answers — if you mention a third-party API, it asks about rate limits and authentication. If you mention real-time features, it asks about WebSocket vs. polling tradeoffs. At the end, it writes a CONTEXT.md file for the phase.

### Research stage

The researcher agent takes the discussion output and investigates the codebase, dependencies, and technical landscape relevant to the phase. It produces a RESEARCH.md file with findings, recommendations, and risk areas.

### Planning stage

The planner agent consumes CONTEXT.md and RESEARCH.md to create a detailed PLAN.md with task breakdowns, acceptance criteria, and ordering. A plan-checker then validates the plan against the project requirements before marking the phase as ready for execution.

{% callout type="note" %}
The planning command is especially valuable for phases that touch infrastructure, external services, or cross-phase integration points. The questions it asks during discussion are the same ones an experienced architect would ask in a pre-sprint meeting.
{% /callout %}
