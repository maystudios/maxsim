---
name: maxsim:init
description: Initialize MaxsimCLI in current project with GitHub integration
argument-hint: "[--auto]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebFetch]
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
Follow @~/.claude/maxsim/workflows/init.md end-to-end.

1. Scan repo structure (language, framework, existing CI)
2. Interview user: project goal, scope, constraints, success criteria
3. Create GitHub Milestone for this project/version
4. Write CLAUDE.md with project context and MaxsimCLI config
5. Optionally generate Roadmap as GitHub Issues (phases)
6. Confirm setup and suggest `/maxsim:plan 1` as next step
</process>
