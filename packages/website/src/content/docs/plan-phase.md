---
id: plan-phase
title: Plan Phase
group: Workflow
---

`/maxsim:plan` is the planning entry point for a phase. It runs discussion, research, and planning stages in sequence, producing GitHub Issues and task breakdowns ready for execution. You can also use `/maxsim:go` to auto-detect the current state and run the right workflow automatically.

{% codeblock language="bash" %}
/maxsim:plan 1
{% /codeblock %}

### Plan Mode approval gate

Before planning output is finalized, `/maxsim:plan` enters Plan Mode (`EnterPlanMode`). The planner presents the proposed task breakdown — Issues, acceptance criteria, wave grouping, dependencies — and waits for your explicit approval before writing anything to GitHub. Approve to proceed or reject to send the planner back for revisions. `ExitPlanMode` fires only when you approve. This gate applies to each stage: discussion, research, and planning each have their own approval step.

### Discussion stage

The discussion agent reads your roadmap and phase context from GitHub, then asks targeted questions about the phase. Questions adapt based on your answers. If you mention a third-party API, it asks about rate limits and authentication. If you mention real-time features, it asks about WebSocket vs. polling tradeoffs. Discussion output is written as a comment on the phase GitHub Issue.

### Research stage

The researcher agent takes the discussion output and investigates the codebase, dependencies, and technical landscape relevant to the phase. Findings are written as a GitHub Issue comment and used by the planner. Pass `--force-research` to re-run research even if research notes already exist.

### Planning stage

The planner agent consumes discussion and research to break the phase into task Issues with acceptance criteria and ordering. A plan-checker then validates the plan before marking the phase as ready for execution. Pass `--skip-verify` to bypass plan verification.

### GitHub as source of truth

All stage state (discussion, research, plan) is stored as GitHub Issue labels and comments — not local files. Re-entering `/maxsim:plan 1` on an already-planned phase shows current status and offers to view, re-plan, or proceed to execution.
