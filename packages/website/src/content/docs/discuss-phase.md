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

The agent acts as a thinking partner, not an interviewer. You are the visionary; it is the builder. Its job is to capture decisions that will guide research and planning, not to figure out the implementation itself.

### Adaptive questioning

Questions are not generated from a fixed checklist. The discussion agent analyzes the phase description to identify gray areas -- places where the description is ambiguous, where multiple valid approaches exist, or where a wrong assumption could derail execution. Common categories include:

{% doctable headers=["Category", "Example Questions"] rows=[["Scope boundaries", "Does 'user dashboard' include admin views or only end-user views?"], ["Technology choices", "Will authentication use session cookies or JWT tokens?"], ["Integration points", "Does the payment flow need to support both Stripe and PayPal, or Stripe only?"], ["Non-functional requirements", "What is the target response time for the search API? Under 200ms or under 1 second?"], ["Edge cases", "What happens when a user submits the form while offline?"]] %}
{% /doctable %}

### Output format

At the end of the discussion stage, output is written as a comment on the phase GitHub Issue with the marker `<!-- maxsim:type=context -->`. This comment contains the questions asked, the answers provided, and the decisions made. The researcher and planner agents read this comment directly when they start their work.

### After discussion

Once discussion is complete, `/maxsim:plan` shows a gate summary and waits for confirmation before advancing to the research stage. You can review the discussion output in the GitHub Issue and add or modify decisions before proceeding.

{% callout type="note" %}
The discussion stage is most valuable for phases that touch infrastructure, external services, or cross-phase integration points. For simple, well-defined phases, the questions are brief and the stage completes quickly.
{% /callout %}
