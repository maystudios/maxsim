---
id: project-state
title: Project State
group: Core Concepts
---

STATE.md is MaxsimCLI's cross-session memory. Every executor agent writes to it after completing tasks. Every orchestrator reads it before starting a new session. It answers the question: "where are we and why did we make the decisions we made?"

STATE.md tracks four categories of information: decisions (architectural choices and the reasoning behind them), blockers (unresolved issues that need human input), performance metrics (task counts, duration, file counts per plan), and session bookmarks (which plan was last active, what the next action is).

{% codeblock language="markdown" %}
# Project State

## Current Position
- Phase: 02 — API Layer
- Plan: 02-01
- Status: executing
- Stopped at: Completed JWT middleware, next: refresh endpoint

## Decisions
- 2026-02-15: Chose jose over jsonwebtoken — better ESM support
- 2026-02-14: PostgreSQL over SQLite — need concurrent writes

## Blockers
- [ ] Stripe webhook secret not yet provisioned by devops

## Performance Metrics
| Phase | Plan | Tasks | Files | Duration |
|-------|------|-------|-------|----------|
| 01    | 01   | 8     | 23    | 45m      |
{% /codeblock %}

You can edit STATE.md directly, or let MaxsimCLI's agents manage it. The `/maxsim:resume-work` command reads STATE.md to restore full context in a new session.
