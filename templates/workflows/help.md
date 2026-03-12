<purpose>
Display the complete MAXSIM command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<reference>
# MAXSIM Command Reference

MAXSIM is a spec-driven development system for Claude Code. It structures work into milestones, phases, plans, and tasks -- each backed by state-machine logic that tracks progress and resumes automatically.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Commands](#commands)
3. [Plan Flow](#plan-flow)
4. [Execute Flow](#execute-flow)
5. [Project Structure](#project-structure)
6. [Quick Reference](#quick-reference)

---

## Getting Started

**First time?** Run `/maxsim:init` to initialize your project.

**Returning?** Run `/maxsim:go` to auto-detect where you left off.

**Core loop:**
```
/maxsim:init --> /maxsim:plan 1 --> /maxsim:execute 1 --> /maxsim:plan 2 --> ...
```

---

## Commands

### /maxsim:init

Initialize a new project or manage milestone lifecycle.

- **New project:** Deep questioning, optional domain research, requirements definition, roadmap creation
- **Existing project:** Scans codebase, creates planning docs from existing code
- **Active project:** Detects current state, offers milestone lifecycle options (complete, start new)

Usage: `/maxsim:init` or `/maxsim:init --auto`

---

### /maxsim:plan [N]

Plan a phase through three stages: Discussion, Research, Planning.

- **Discussion:** Gather implementation decisions via conversation, creates CONTEXT.md
- **Research:** Spawn researcher agent for domain analysis, creates RESEARCH.md
- **Planning:** Spawn planner agent to create executable PLAN.md files
- Auto-detects current stage and resumes from there
- Gate confirmation between each stage

Usage: `/maxsim:plan 3` or `/maxsim:plan` (auto-detects next unplanned phase)

Flags: `--force-research` (re-run research), `--skip-verify` (skip plan verification)

---

### /maxsim:execute [N]

Execute all plans in a phase with auto-verification.

- Runs plans in wave order (parallel within waves)
- Auto-verifies after execution completes
- Retries failed verification (max 2 retries, 3 total attempts)
- On final failure, reports what failed and lets you decide

Usage: `/maxsim:execute 3`

---

### /maxsim:go

Auto-detect project state and dispatch to the right command.

- Deep context analysis: project state, git status, recent commits
- Surfaces problems proactively before suggesting actions
- Show + Act pattern: displays what was detected, then acts immediately
- No arguments -- pure auto-detection

Usage: `/maxsim:go`

---

### /maxsim:progress

View project progress and milestone status.

- Phase completion overview with visual progress
- Recent activity summary from SUMMARY files
- Current position and what comes next
- Offers milestone completion when all phases are done

Usage: `/maxsim:progress`

---

### /maxsim:debug [description]

Systematic debugging with persistent state across context resets.

- Scientific method: gather symptoms, hypothesize, test, verify
- Persistent debug sessions in `.planning/debug/` -- survives `/clear`
- Spawns isolated verifier agent (fresh 200K context per investigation)
- Run with no args to resume an active session

Usage: `/maxsim:debug login form returns 500` or `/maxsim:debug` (resume)

---

### /maxsim:quick [--full]

Ad-hoc tasks with MAXSIM guarantees.

- Atomic commits, state tracking
- `--full` flag enables plan-checking and verification agents

Usage: `/maxsim:quick` or `/maxsim:quick --full`

---

### /maxsim:settings

Configure MAXSIM workflow and model profile.

- Model profile: quality, balanced, or budget
- Toggle agents: researcher, plan checker, verifier
- Branching strategy configuration
- Updates `.planning/config.json`

Usage: `/maxsim:settings`

---

### /maxsim:help

Show this command reference.

Usage: `/maxsim:help`

---

## Plan Flow

```
/maxsim:plan N
     |
     v
 Discussion -- gather decisions via conversation
     |
     | Gate: "N decisions captured. Continue?"
     v
  Research -- spawn researcher agent
     |
     | Gate: "Research complete. Continue?"
     v
  Planning -- spawn planner agent
     |
     | Gate: "N plans in M waves. Ready?"
     v
   Done -- CONTEXT.md + RESEARCH.md + PLAN.md files created
```

**Artifacts produced at each stage:**

| Stage | Artifact | Contains |
|-------|----------|----------|
| Discussion | CONTEXT.md | Locked decisions, constraints, boundaries |
| Research | RESEARCH.md | Domain findings, patterns, recommendations |
| Planning | PLAN.md (1+) | Executable tasks with verification criteria |

**Re-entry:** Running `/maxsim:plan` on an already-planned phase shows status and offers options (view plans, re-plan, execute).

---

## Execute Flow

```
/maxsim:execute N
     |
     v
  Execute -- run plans in wave order
     |      (parallel within waves)
     v
  Verify -- spawn verifier agent
     |
     +--> PASS --> Phase complete!
     |
     +--> FAIL --> Retry (max 2)
               |
               v
           Fix --> Re-verify
               |
               +--> PASS --> Done
               +--> FAIL --> Report to user
```

**Wave execution:** Plans declare wave numbers in their frontmatter. All plans in wave 1 run first (in parallel), then wave 2, etc. This respects dependencies between plans.

---

## Project Structure

```
.planning/
  PROJECT.md           # Project vision and context
  REQUIREMENTS.md      # Scoped requirements with IDs
  ROADMAP.md           # Phase structure and progress
  STATE.md             # Project memory: decisions, blockers, metrics
  config.json          # Workflow preferences
  phases/
    01-foundation/
      01-CONTEXT.md    # Discussion decisions
      01-RESEARCH.md   # Domain research
      01-01-PLAN.md    # Execution plan
      01-01-SUMMARY.md # Completion record
    02-features/
      ...
  debug/               # Active debug sessions
  quick/               # Quick task plans and summaries
```

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
| Debug an issue | `/maxsim:debug description` |
| Quick ad-hoc task | `/maxsim:quick` |
| Change settings | `/maxsim:settings` |
| See this help | `/maxsim:help` |

---

## Staying Updated

Update MAXSIM to the latest version:

```bash
npx maxsimcli@latest
```
</reference>
