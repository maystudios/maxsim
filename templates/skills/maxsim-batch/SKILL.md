---
name: maxsim-batch
description: >-
  Orchestrates parallel agent execution using worktree isolation following
  Anthropic's batch pattern. Used when multiple independent tasks can be
  executed simultaneously.
---

# Batch Parallel Execution

Decompose large tasks into independent units, spawn all agents in a single message block, track progress, collect results.

## When to Use

Use batch execution when:
- 3 or more tasks with no shared file modifications
- Each task can be verified independently
- Speed matters and the overhead of coordination is worth it

Do not use for fewer than 3 tasks (overhead exceeds benefit), sequential dependencies, or tasks that modify the same files.

## Process

### 1. DECOMPOSE -- Verify Independence

List all units. For each unit, list the files it will create or modify. Check:

- No file appears in more than one unit
- No unit's output is another unit's input
- Each unit's tests pass without the other units' changes

If overlap exists: merge overlapping units, or extract shared code into a prerequisite unit that runs first (serially) before the parallel batch begins.

### 2. SPAWN -- All Agents in One Message Block

Spawn all agents in a single message. Each agent call must be self-contained -- the prompt includes all context the agent needs without relying on shared state or prior conversation.

Agent configuration:
- `isolation: "worktree"` -- each agent works in an isolated git worktree
- `run_in_background: true` -- agents run in parallel

Each agent prompt must include:
1. The specific task and acceptance criteria
2. The exact files it owns (and only those files)
3. The base branch to branch from
4. Instructions: implement, run tests, commit, push, create PR
5. Output contract (see below)

### 3. OUTPUT CONTRACT

Every agent returns a terminal line that the orchestrator reads:

```
RESULT: PASS — [brief summary]
RESULT: FAIL — [reason for failure]
```

The line must be the last non-whitespace line of agent output. This is what the orchestrator uses to update the status table -- do not use other formats.

Full handoff output follows the `handoff-contract` skill format.

### 4. TRACK -- Status Table

Maintain a status table and re-render it after each agent completion:

| # | Unit | Branch | Status | PR |
|---|------|--------|--------|----|
| 1 | description | feat/unit-1 | done | #123 |
| 2 | description | feat/unit-2 | in-progress | -- |
| 3 | description | feat/unit-3 | pending | -- |

Statuses: `pending` → `in-progress` → `done` | `failed`

Update the table in place -- replace the previous table, do not append a new one each time.

### 5. COLLECT -- Handle Results

When all agents complete:
1. List all PRs created
2. Verify each PR is independently mergeable (no dependency on another PR)
3. Handle failures:
   - Unit fails tests: spawn a fix agent in the same worktree (up to 2 retries)
   - Merge conflict found: decomposition was wrong -- fix overlap and re-run the conflicting units
   - 3+ failures on one unit: stop and escalate to user with full failure context

## Agent Teams (Tier 2 — Opt-in)

Agent Teams (available since Claude Code v2.1.32, Feb 2026) enable inter-agent communication for workflows that require debate, cross-checking, or collaborative problem-solving. MaxsimCLI sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` during install and registers `TeammateIdle` and `TaskCompleted` quality-gate hooks.

**Current status:** Infrastructure is in place (env var, hooks). Workflow templates that invoke `TeamCreate`/`SendMessage` for Tier 2 patterns (competitive implementation, multi-reviewer code review, collaborative debugging) are planned but not yet implemented. All workflows currently use Tier 1 subagents. See PROJECT.md §7.2 for the full specification.

### Tier Selection Logic

MaxsimCLI chooses the tier automatically based on the workflow:

| Workflow | Tier | Reason |
|----------|------|--------|
| Phase execution (independent tasks) | Tier 1 (Subagents) | Tasks don't need to communicate |
| Codebase scanning | Tier 1 (Subagents) | Read-only, report back |
| Research gathering | Tier 1 (Subagents) | Collect and report |
| Competitive implementation | Tier 2 (Agent Teams) | Agents need to debate |
| Multi-dimensional code review | Tier 2 (Agent Teams) | Findings need cross-checking |
| Collaborative debugging | Tier 2 (Agent Teams) | Hypotheses need adversarial testing |
| Architecture exploration | Tier 2 (Agent Teams) | Requires discussion |

**When Tier 2 is ready, it will be used for:**
- Competitive implementation with adversarial debate
- Multi-dimensional code review (security + performance + test coverage)
- Collaborative debugging with competing hypotheses
- Cross-layer feature work (frontend + backend + tests)

### Graceful Degradation

If Agent Teams are unavailable (env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. Inform the user with this exact message:

> "Competitive mode: using Tier 1 subagents (Agent Teams not available or not required for this strategy). Each executor works independently; verifier selects the best result."

The user is informed but not blocked. All workflows remain fully functional via Tier 1.

## Limits

- Up to 30 parallel agents; typically 3-10 for manageable coordination
- Each unit must be independently mergeable -- prefer fast-forward, rebase if needed
- Context budget: each agent consumes its own context window; keep prompts focused

## Common Pitfalls

| Pitfall | Reality |
|---------|---------|
| "The overlap is minor" | Minor overlap causes merge conflicts. Extract shared code first. |
| "We'll merge in dependency order" | Order-dependent merges are not independent. Serialize those units. |
| "Only 2 units, let's use batch anyway" | Overhead is not worth it. Run sequentially. |
| "Agents can ask each other for context" | Agents are isolated. All context goes in the spawn prompt. |
| "I'll fix the prompt after spawning" | Re-spawning restarts work. Write complete prompts before spawning. |

## Verification Before Completion

Before reporting batch complete:

- [ ] All units touch non-overlapping files
- [ ] All agents returned `RESULT: PASS`
- [ ] Each unit was implemented in an isolated worktree
- [ ] Each unit's tests pass independently
- [ ] Each unit has its own PR
- [ ] No PR depends on another PR being merged first
- [ ] Status table shows `done` for all units
