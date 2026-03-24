---
name: using-maxsim
description: Routes work through MaxsimCLI commands based on project state and user intent. Provides command reference and decision routing table. Used when determining which MaxsimCLI command to use or when starting a new session.
---

# Using MaxsimCLI

MaxsimCLI is a spec-driven development system. Work flows through phases, plans, and tasks — not ad-hoc coding.

**No implementation without a plan.** If MaxsimCLI is not initialized (no GitHub Project Board), run `/maxsim:init` first. If there is no current phase, run `/maxsim:plan N` first. If there is a plan, run `/maxsim:execute N` to execute it.

---

## Command Routing Table

Determine user intent, then route to the correct command.

| User Intent | Command |
|-------------|---------|
| Start a new project | `/maxsim:init` |
| Continue where I left off | `/maxsim:go` |
| Plan next phase | `/maxsim:plan N` |
| Execute planned work | `/maxsim:execute N` |
| Fix a bug | `/maxsim:debug` |
| Quick one-off task | `/maxsim:quick` |
| Optimize a metric | `/maxsim:improve` |
| Fix all build/lint errors | `/maxsim:fix-loop` |
| Hunt a bug autonomously | `/maxsim:debug-loop` |
| Security audit | `/maxsim:security` |
| Check progress | `/maxsim:progress` |
| Change settings | `/maxsim:settings` |
| See all commands | `/maxsim:help` |

---

## Session Start Routing

Before beginning any task in a session:

1. Check GitHub Project Board status using `gh project list` and `gh project item-list` commands directly.
2. Identify the active phase from GitHub Issues — if any phase is in progress, resume via `/maxsim:go`
3. Route to the correct command using the table above

GitHub Issues with label `maxsim:auto` are the source of truth for automation-created content. Issues with label `maxsim:user` track user-created items. Read them before planning.

---

## Skills Per Agent Type

Skills are matched to agents by semantic description. Each agent type is associated with a different set.

| Agent | Primary Skills |
|-------|---------------|
| Planner | `handoff-contract`, `roadmap-writing` |
| Executor | `handoff-contract`, `commit-conventions`, `maxsim-batch` |
| Verifier | `handoff-contract`, `verification`, `code-review` |
| Researcher | `handoff-contract`, `research` |
| Orchestrator | `handoff-contract`, `maxsim-batch` |

Skills are auto-loaded by Claude Code based on semantic description matching.

---

## GitHub as Source of Truth

All persistent project state lives in GitHub, not in local files that disappear between sessions:

| Artifact | Location |
|----------|---------|
| Phase plans | GitHub Sub-Issues on the phase Issue |
| Roadmap | GitHub Milestones + Phase Issues |
| Session state | GitHub Project Board column positions + Issue status |
| Learnings | GitHub Issue comments on relevant phase/task issues |
| Decisions | GitHub Issue comments on relevant phase/task issues |

---

## Common Pitfalls

- Writing implementation code without a phase plan on GitHub
- Skipping `/maxsim:init` because the project seems simple
- Ignoring Project Board state and in-progress issues from previous sessions
- Working outside the current phase without explicit user approval
- Making architectural decisions without recording them as comments on the relevant phase/task issue

If any of these occur: stop, check the routing table, and follow the workflow.

---

## v6 Changes from v5

- `/maxsim:resume-work` replaced by `/maxsim:go`
- `/maxsim:plan-phase` and `/maxsim:execute-phase` replaced by `/maxsim:plan N` and `/maxsim:execute N`
- Project memory now uses GitHub Issues instead of local STATE.md comments
- `research` skill merges former `research-methodology` and `tool-priority-guide`
- `project-memory` skill replaces `memory-management`
