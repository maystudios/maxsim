---
name: using-maxsim
description: Routes work through MaxsimCLI commands based on project state and user intent. Provides command reference and decision routing table. Use when determining which MaxsimCLI command to use or when starting a new session.
---

# Using MaxsimCLI

MaxsimCLI is a spec-driven development system. Work flows through phases, plans, and tasks — not ad-hoc coding.

**No implementation without a plan.** If there is no `.planning/` directory, run `/maxsim:init` first. If there is no current phase, run `/maxsim:plan N` first. If there is a plan, run `/maxsim:execute N` to execute it.

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
| Check progress | `/maxsim:progress` |
| Change settings | `/maxsim:settings` |
| See all commands | `/maxsim:help` |

---

## Session Start Routing

Before beginning any task in a session:

1. Check for `.planning/` directory — if missing, run `/maxsim:init`
2. Read `STATE.md` — if a checkpoint exists, resume from it via `/maxsim:go`
3. Check `ROADMAP.md` — identify the active phase
4. Route to the correct command using the table above

GitHub Issues with label `maxsim:lesson` or `maxsim:decision` are the source of truth for project learnings and architectural decisions. Read them before planning.

---

## Skills Per Agent Type

Skills load on-demand based on the current task. Each agent type draws from a different set.

| Agent | Primary Skills |
|-------|---------------|
| Planner | `research`, `brainstorming`, `roadmap-writing`, `project-memory` |
| Executor | `tdd`, `systematic-debugging`, `verification`, `maxsim-simplify` |
| Verifier | `verification`, `code-review`, `systematic-debugging` |
| Researcher | `research`, `project-memory` |

Skills are not auto-loaded. They activate when invoked directly (e.g., `/research`) or when the orchestrator spawns an agent with explicit skill instructions.

---

## GitHub as Source of Truth

All persistent project state lives in GitHub, not in local files that disappear between sessions:

| Artifact | Location |
|----------|---------|
| Phase plans | `.planning/phases/N/PLAN.md` (committed) |
| Roadmap | `.planning/ROADMAP.md` (committed) |
| Session state | `.planning/STATE.md` (committed after each checkpoint) |
| Learnings | GitHub Issues — label `maxsim:lesson` |
| Decisions | GitHub Issues — label `maxsim:decision` |

---

## Common Pitfalls

- Writing implementation code without a `PLAN.md`
- Skipping `/maxsim:init` because the project seems simple
- Ignoring `STATE.md` checkpoints from previous sessions
- Working outside the current phase without explicit user approval
- Making architectural decisions without recording them as `maxsim:decision` issues

If any of these occur: stop, check the routing table, and follow the workflow.

---

## v6 Changes from v5

- `/maxsim:resume-work` replaced by `/maxsim:go`
- `/maxsim:plan-phase` and `/maxsim:execute-phase` replaced by `/maxsim:plan N` and `/maxsim:execute N`
- Project memory now uses GitHub Issues instead of local STATE.md comments
- `research` skill merges former `research-methodology` and `tool-priority-guide`
- `project-memory` skill replaces `memory-management`
