---
name: maxsim:init
description: Initialize MaxsimCLI in current project with GitHub integration
argument-hint: "[--auto]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebFetch, WebSearch, EnterPlanMode, ExitPlanMode]
---

<objective>
Initialize MaxsimCLI for the current project. Scans the repo, interviews the user, sets up GitHub Milestone and Project Board, writes CLAUDE.md, and optionally generates a Roadmap.
</objective>

<context>
Arguments: $ARGUMENTS

Flags:
- `--auto` — Skip confirmations after config questions. For new projects, expects an idea document via @ reference.

GitHub is the sole source of truth. Init creates GitHub Milestones and Issues — no .planning/ files.
</context>

<process>
Follow @.claude/maxsim/workflows/init.md end-to-end.

1. Scan repo in parallel — spawn Research agents to analyze architecture, frameworks, CI/CD, tests, dependencies, and documentation
2. Interview user: project name, description, goals, tech stack, conventions, testing strategy, deployment, acceptance criteria, no-gos, risks
3. GitHub Setup — ensure standard labels, create Project Board (Kanban), create Milestone, offer repo creation if needed
4. Write CLAUDE.md with project context and MaxsimCLI config
5. Optionally generate Roadmap as GitHub Issues (phases)
6. Confirm setup and suggest `/maxsim:go` as next step
</process>
