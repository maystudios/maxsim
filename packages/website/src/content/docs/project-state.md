---
id: project-state
title: Project State
group: Core Concepts
---

GitHub Issues and comments are MaxsimCLI's cross-session memory. Every agent writes decisions, blockers, and progress notes as comments on the relevant phase Issue. Every orchestrator reads GitHub before starting a new session. It answers the question: "where are we and why did we make the decisions we made?"

### State model

Project state is derived entirely from GitHub — there are no local state files:

{% doctable headers=["State dimension", "GitHub source"] rows=[["Phase status", "Project Board column position (Backlog / To Do / In Progress / In Review / Done)"], ["Task progress", "Open vs. closed task sub-Issues on the phase Issue"], ["Roadmap progress", "GitHub Milestone completion percentage (open vs. closed phase Issues)"], ["Decisions and context", "Comments on phase and task Issues"], ["Requirements", "GitHub Wiki requirements page for the milestone"], ["Discussions", "GitHub Discussions for open questions and architectural decisions"]] %}
{% /doctable %}

Phase Issues track four categories of information: decisions (architectural choices and the reasoning behind them), blockers (unresolved issues that need human input), performance metrics (task counts, duration, file counts per task), and current position (which task was last active, what the next action is).

{% codeblock language="markdown" %}
<!-- Example phase Issue comment written by an executor agent -->

## Session Update — 2026-02-15

**Current Position:** Phase 02 — API Layer, task 3 of 7
**Status:** In progress — Completed JWT middleware, next: refresh endpoint

**Decisions**
- Chose jose over jsonwebtoken — better ESM support
- PostgreSQL over SQLite — need concurrent writes

**Blockers**
- [ ] Stripe webhook secret not yet provisioned by devops
{% /codeblock %}

You can read and comment on phase Issues directly in GitHub. Run `/maxsim:go` at the start of any new Claude Code session to restore context automatically — it reads GitHub Issue state to determine where to resume.
