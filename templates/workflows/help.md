<purpose>
Display all available MaxsimCLI commands with descriptions, syntax, and examples. Output ONLY the reference content — no project analysis, no git status, no commentary.
</purpose>

<reference>
# MAXSIM Command Reference

MAXSIM is a spec-driven development system for Claude Code. It structures work into milestones, phases, plans, and tasks — each backed by GitHub Issues as the sole source of truth.

---

## Commands

| Command | Description |
|---------|-------------|
| `/maxsim:init` | Initialize a new project or start a new milestone |
| `/maxsim:plan [N]` | Plan a phase (discussion → research → planning) |
| `/maxsim:execute [N]` | Execute all plans in a phase |
| `/maxsim:go` | Auto-detect state and dispatch to the right command |
| `/maxsim:progress` | Show project status and recommend next action |
| `/maxsim:quick` | Run a small ad-hoc task without phase ceremony |
| `/maxsim:settings` | View and modify MaxsimCLI configuration |
| `/maxsim:debug [desc]` | Investigate and fix a bug using GitHub Issues |
| `/maxsim:help` | Show this command reference |

---

### /maxsim:init

Initialize a new project or start a new milestone cycle.

- **New project:** Questioning → research → requirements → roadmap → GitHub Issues
- **Existing project:** Detects current state, offers milestone lifecycle options

```
/maxsim:init
/maxsim:init --auto
```

---

### /maxsim:plan [N]

Plan a phase through three stages: Discussion, Research, Planning.

- Gather implementation decisions via conversation (posts context to the phase GitHub Issue)
- Spawn researcher agent for domain analysis (posts research findings to the phase GitHub Issue)
- Spawn planner agent to create executable plans (posted as comments on the phase GitHub Issue)
- Auto-detects current stage and resumes from checkpoint

```
/maxsim:plan 3
/maxsim:plan          (auto-detects next unplanned phase)
/maxsim:plan 3 --force-research
```

---

### /maxsim:execute [N]

Execute all plans in a phase using wave-ordered parallel agents.

- Runs plans in wave order (parallel within waves, sequential across waves)
- Auto-verifies after execution via GitHub Issue task completion
- Retries failed verification (max 2 retries, 3 total attempts)

```
/maxsim:execute 3
```

---

### /maxsim:go

Auto-detect project state from GitHub Issues and dispatch to the right command.

- Reads live GitHub board to determine current position
- Surfaces blockers and anomalies before suggesting an action
- No arguments — pure auto-detection

```
/maxsim:go
```

---

### /maxsim:progress

Show project status from GitHub Issues and recommend the next action.

- Overall progress percentage and phase breakdown by status
- Current milestone and its completion %
- Open blockers and bugs
- Recommends the correct next command

```
/maxsim:progress
```

---

### /maxsim:quick

Run a small ad-hoc task without full phase planning.

- Creates a GitHub Issue with label "type:quick"
- Executes the task directly (no plan files, no wave scheduling)
- Runs verification, commits, closes the issue

```
/maxsim:quick
/maxsim:quick refactor the auth module to remove dead code
```

---

### /maxsim:settings

View and modify MaxsimCLI configuration.

- Model profile: quality, balanced, or budget
- Toggle agents: researcher, plan checker, verifier
- Parallelism and competition strategy
- Git branching strategy

```
/maxsim:settings
```

---

### /maxsim:debug [desc]

Investigate and fix a bug via GitHub Issues.

- Creates a GitHub Issue labeled "type:bug" for tracking
- Spawns a debug agent to reproduce, diagnose root cause, and fix
- Posts findings and fix as comments on the bug issue
- Runs verification and closes the issue on success

```
/maxsim:debug
/maxsim:debug login form crashes when email is empty
```

---

### /maxsim:help

Show this command reference.

```
/maxsim:help
```

---

## Core Loop

```
/maxsim:init → /maxsim:plan 1 → /maxsim:execute 1 → /maxsim:plan 2 → /maxsim:execute 2 → ...
```

**Returning?** Run `/maxsim:go` — it reads GitHub Issues and resumes automatically.

---

## Quick Reference

| Want to... | Run |
|------------|-----|
| Start a new project | `/maxsim:init` |
| Resume where you left off | `/maxsim:go` |
| Plan next phase | `/maxsim:plan` |
| Plan a specific phase | `/maxsim:plan N` |
| Execute a phase | `/maxsim:execute N` |
| Check progress | `/maxsim:progress` |
| Quick ad-hoc task | `/maxsim:quick` |
| Change settings | `/maxsim:settings` |
| Debug a bug | `/maxsim:debug` |
| See this help | `/maxsim:help` |

---

## Documentation

Full docs: https://maxsimcli.dev

Update to latest:
```bash
npx maxsimcli@latest
```
</reference>
