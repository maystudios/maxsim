---
id: what-is-maxsim
title: What is MaxsimCLI
group: Introduction
---

MaxsimCLI is a meta-prompting, context engineering, and spec-driven development system for Claude Code. It solves one of the most common problems in AI-assisted development: context rot.

When you work with an AI coding agent for hours, the context window fills up with conversation history, intermediate thoughts, and dead ends. The model starts forgetting earlier decisions, making contradictory choices, and losing track of what the project needs. This is context rot, and it gets worse the more ambitious your project is.

MaxsimCLI solves this by offloading each discrete unit of work to a fresh-context subagent. Instead of one long conversation that degrades over time, you get a series of focused agents: a researcher that knows nothing except the phase it needs to study, an executor that sees only the plan it needs to implement, a verifier that checks only whether the deliverables match the promise. Each agent starts clean, works with full attention, and hands off a structured artifact to the next.

MaxsimCLI is built exclusively for Claude Code. It uses GitHub as its source of truth — phase plans, decisions, blockers, and task state are tracked as GitHub Issues and comments rather than local files.

MaxsimCLI ships as an npm package and installs markdown files (9 commands, 4 agent definitions, 14 skill modules, and workflow templates) into your project's `.claude/` directory. The "runtime" for MaxsimCLI is Claude Code itself. You use it through slash commands like `/maxsim:plan` and `/maxsim:execute`, not through a CLI binary you keep running.
