---
name: using-maxsim
description: Routes work through MaxsimCLI commands based on project state and user intent. Provides command reference and decision routing table. Used when determining which MaxsimCLI command to use or when starting a new session.
---

# Using MaxsimCLI

MaxsimCLI is a spec-driven development system. Work flows through phases, plans, and tasks -- not ad-hoc coding.

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
| CI/CD pipeline is failing | `/maxsim:fix-loop` |
| Resume stale work | `/maxsim:go` |

---

## State Detection for /maxsim:go

When `/maxsim:go` is invoked, it detects the current project state and routes to the highest-priority action. Detection signals are evaluated in priority order (P0 first). The first actionable signal determines the route.

### Detection Signals

| Signal | Source | Priority | Route |
|--------|--------|----------|-------|
| Failing CI/CD | `gh run list --limit 5` | P0 | `/maxsim:fix-loop` -- fix blockers first |
| Uncommitted changes | `git status` | P0 | Prompt to stash or commit before proceeding |
| Open P0/P1 issues | `gh issue list --label "P0 Critical,P1 High"` | P0 | `/maxsim:debug` -- address critical issues |
| In-progress phase | GitHub Project Board (In Progress column) | P1 | `/maxsim:execute N` -- resume active work |
| Failed verification | GitHub Issues with `maxsim:auto` label and open state | P1 | Re-run failed plan verification |
| Stale context | Last commit > 7 days ago on active branch | P2 | Suggest context refresh (see below) |
| Idle agent activity | No commits in 24h on active phase branch | P2 | Suggest resuming paused work |
| Metric regression | `autoresearch-results.tsv` shows declining trend | P3 | `/maxsim:improve` -- optimize regressing metric |
| Completed phase | All plans in current phase done | P3 | `/maxsim:plan N+1` -- advance to next phase |

### Routing Priority

Signals are evaluated P0 -> P1 -> P2 -> P3. Within the same priority level, signals are evaluated top-to-bottom as listed. The first match wins.

- **P0 (Blockers):** Must be resolved before any other work. CI failures, dirty worktree, and critical issues take absolute precedence.
- **P1 (Active Work):** Resume work already in progress. Do not start new work when existing plans or verifications need attention.
- **P2 (Staleness):** Advisory signals that suggest the project context may need refreshing or that paused work should resume.
- **P3 (Optimization):** Low-priority signals for improvement or phase advancement. Only surface when nothing higher-priority is detected.

### Proactive Suggestions

When `/maxsim:go` detects P2/P3 signals, it presents proactive suggestions rather than auto-routing:

- "Branch `maxsim/phase-5-task-42` has not had a commit in 3 days. Resume with `/maxsim:execute 5`?"
- "Metric `test-coverage` has declined for 3 consecutive runs. Run `/maxsim:improve test-coverage`?"
- "Phase 4 is complete. Ready to plan Phase 5 with `/maxsim:plan 5`?"
- "Last commit on this branch was 12 days ago. Consider running `/maxsim:progress` to review current state."

### Context Freshness

Context freshness measures how current the project state is. Stale context increases the risk of working against outdated assumptions.

| Indicator | Threshold | Action |
|-----------|-----------|--------|
| Last commit age | > 7 days | Warn: "Context may be stale. Run `/maxsim:progress` to review." |
| MEMORY.md size | > 50 KB | Warn: "Memory file is large. Consider pruning old entries." |
| Active branch divergence | > 20 commits behind main | Warn: "Branch is significantly behind main. Consider rebasing." |

Context freshness checks are best-effort and informational. They never block session start or command execution.

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
- Ignoring P0 blockers (CI failures, critical issues) and starting new work instead

If any of these occur: stop, check the routing table, and follow the workflow.

---

## v6 Changes from v5

- `/maxsim:resume-work` replaced by `/maxsim:go`
- `/maxsim:plan-phase` and `/maxsim:execute-phase` replaced by `/maxsim:plan N` and `/maxsim:execute N`
- Project memory now uses GitHub Issues instead of local STATE.md comments
- `research` skill merges former `research-methodology` and `tool-priority-guide`
- `project-memory` skill replaces `memory-management`

## See also

- `verification` -- Evidence-based verification with quality gates
