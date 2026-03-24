---
id: what-is-maxsim
title: What is MaxsimCLI
group: Introduction
---

MaxsimCLI is a meta-prompting, context engineering, and spec-driven development system for Claude Code. It solves one of the most common problems in AI-assisted development: context rot.

When you work with an AI coding agent for hours, the context window fills up with conversation history, intermediate thoughts, and dead ends. The model starts forgetting earlier decisions, making contradictory choices, and losing track of what the project needs. This is context rot, and it gets worse the more ambitious your project is.

MaxsimCLI solves this by offloading each discrete unit of work to a fresh-context subagent. Instead of one long conversation that degrades over time, you get a series of focused agents: a researcher that knows nothing except the phase it needs to study, an executor that sees only the plan it needs to implement, a verifier that checks only whether the deliverables match the promise. Each agent starts clean, works with full attention, and hands off a structured artifact to the next.

The core structure is a Plan→Execute→Verify cycle. The planner produces a phase plan with explicit deliverables. The executor implements only what the plan specifies. The verifier checks every deliverable against the plan before the phase closes. This cycle enforces quality at each handoff and prevents the model from drifting away from the original intent.

Quality control is built into the cycle through verification gates. A phase cannot close until the verifier confirms all deliverables are met. If verification fails, the phase loops back: the failure is documented, the executor is dispatched again with the failure details, and the verifier checks again. Nothing ships until it passes.

MaxsimCLI is built exclusively for Claude Code. It uses GitHub as its source of truth — phase plans, decisions, blockers, and task state are tracked as GitHub Issues and comments rather than local files.

MaxsimCLI ships as an npm package and installs markdown files (13 commands, 4 agent definitions, 14 skill modules, and workflow templates) into your project's `.claude/` directory. The "runtime" for MaxsimCLI is Claude Code itself. You use it through slash commands like `/maxsim:plan` and `/maxsim:execute`, not through a CLI binary you keep running.
