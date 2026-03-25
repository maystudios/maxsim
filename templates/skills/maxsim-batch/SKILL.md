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

**Current status:** Infrastructure is in place (env var, hooks). Tier 2 workflow patterns (competitive implementation, multi-reviewer code review, collaborative debugging) are defined below with executable `TeamCreate`/`SendMessage` call syntax. All workflows gracefully degrade to Tier 1 subagents when Agent Teams are unavailable. See PROJECT.md §7.2 for the authoritative specification.

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

### Tier 2 Activation Check

Before using any Tier 2 pattern, verify availability:

```bash
# 1. Check env var
[ "$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" = "1" ] || { echo "Tier 2 unavailable: env var not set"; TIER=1; }
```

```
# 2. Probe TeamCreate (lightweight -- create and immediately clean up)
TeamCreate(team_name: "probe-{timestamp}", description: "availability check")
# If probe fails, set TIER=1 and log reason
```

If either check fails, skip to the Graceful Degradation section below. Do not attempt Tier 2 patterns.

---

### Pattern 1 -- Competitive Implementation (Debate)

**Use when:** A task is marked `critical` and `config.execution.competitive_enabled` is `true`. Multiple agents implement the same task independently, then adversarially critique each other's work before a neutral verifier selects the winner.

**Flow:** `TeamCreate` --> spawn 2-3 competitors --> each implements independently --> `SendMessage` critiques --> fresh verifier judges --> winner selected.

**Step 1 -- Create the competition team:**
```
TeamCreate(
  team_name: "competition-phase-{N}-task-{id}",
  description: "Competitive implementation: {task_description}. Each teammate implements independently, then reviews the others adversarially."
)
```

**Step 2 -- Spawn competing teammates:**
Spawn 2 teammates minimum, 3 for tasks labeled `critical`. Each gets a distinct approach directive and the full task context.

```
// Teammate A -- conservative approach
Spawn teammate "competitor-a" with prompt:
  "Implement {task_description} using approach: CONSERVATIVE.
   Prefer existing patterns, minimal new abstractions, conventional solutions.
   Work in isolation until the review phase.
   Phase: {N}, Plan: {id}, Issue: #{phase_issue_number}.
   Success criteria: {criteria from plan}.
   When done, commit your work and report RESULT: PASS or RESULT: FAIL."
Model: {executor_model}

// Teammate B -- innovative approach
Spawn teammate "competitor-b" with prompt:
  "Implement {task_description} using approach: INNOVATIVE.
   Optimize for performance and elegance, explore novel patterns where justified.
   Work in isolation until the review phase.
   Phase: {N}, Plan: {id}, Issue: #{phase_issue_number}.
   Success criteria: {criteria from plan}.
   When done, commit your work and report RESULT: PASS or RESULT: FAIL."
Model: {executor_model}

// (Optional -- critical tasks only) Teammate C -- defensive approach
Spawn teammate "competitor-c" with prompt:
  "Implement {task_description} using approach: DEFENSIVE.
   Maximize error handling, edge case coverage, and robustness.
   Work in isolation until the review phase.
   Phase: {N}, Plan: {id}, Issue: #{phase_issue_number}.
   Success criteria: {criteria from plan}.
   When done, commit your work and report RESULT: PASS or RESULT: FAIL."
Model: {executor_model}
```

**Step 3 -- Adversarial critique via SendMessage:**
After all teammates complete, each reviews the others' implementations:

```
SendMessage({
  type: "message",
  recipient: "competitor-b",
  content: "Review competitor-a's implementation. Be adversarial: (1) correctness issues, (2) missing edge cases, (3) maintainability concerns. Find real problems, not style preferences.",
  summary: "Requesting adversarial review of competitor-a"
})

SendMessage({
  type: "message",
  recipient: "competitor-a",
  content: "Review competitor-b's implementation. Be adversarial: (1) correctness issues, (2) missing edge cases, (3) maintainability concerns. Find real problems, not style preferences.",
  summary: "Requesting adversarial review of competitor-b"
})
```

**Step 4 -- Fresh verifier selects winner:**
Spawn a verifier agent (NOT a team member) to evaluate both implementations and both critiques:

```
Agent(
  subagent_type: "verifier",
  model: "{verifier_model}",
  prompt: "
    Judge a competitive implementation. Agents implemented the same task independently, then critiqued each other.

    Implementations: competitor-a (CONSERVATIVE), competitor-b (INNOVATIVE)
    Critiques: {critique summaries}

    Selection criteria (priority order):
    1. Correctness -- satisfies all success criteria
    2. Test coverage -- edge cases tested
    3. Code quality -- readability, codebase consistency
    4. Simplicity -- fewer abstractions when correctness is equal

    Output: WINNER: competitor-{a|b|c}
    Followed by justification.
  "
)
```

Discard the losing worktree branch. Merge the winner via the standard flow.

**Tier 1 fallback:** Spawn 2 independent executor subagents via `Agent(isolation: "worktree", run_in_background: true)` with different approach prompts. After both complete, spawn a verifier to compare. No inter-agent messaging -- the verifier reads both outputs directly.

---

### Pattern 2 -- Multi-Reviewer Code Review (Cross-Checking)

**Use when:** A PR or implementation requires review from multiple specialist perspectives that must challenge each other's findings.

**Flow:** `TeamCreate` --> spawn 3 specialist reviewers --> each reviews independently --> `SendMessage` to share findings --> each reviewer challenges other reviewers' findings --> coordinator synthesizes unified report.

**Step 1 -- Create the review team:**
```
TeamCreate(
  team_name: "review-phase-{N}-task-{id}",
  description: "Multi-dimensional code review: {description}. Reviewers share and cross-check findings."
)
```

**Step 2 -- Spawn specialist reviewers:**
```
// Security reviewer
Spawn teammate "reviewer-security" with prompt:
  "Review the implementation for security concerns: authentication, authorization, input validation, injection risks, token handling, data exposure.
   Files to review: {file list or PR reference}.
   Report findings as: CRITICAL / WARNING / INFO with evidence (file path + line number).
   When done, send your findings to reviewer-performance and reviewer-tests."
Model: {executor_model}

// Performance reviewer
Spawn teammate "reviewer-performance" with prompt:
  "Review the implementation for performance concerns: N+1 queries, missing indexes, unnecessary allocations, caching opportunities, algorithmic complexity.
   Files to review: {file list or PR reference}.
   Report findings as: CRITICAL / WARNING / INFO with evidence (file path + line number).
   When done, send your findings to reviewer-security and reviewer-tests."
Model: {executor_model}

// Test coverage reviewer
Spawn teammate "reviewer-tests" with prompt:
  "Review the implementation for test coverage: missing edge cases, untested error paths, assertion quality, flaky test patterns, coverage gaps.
   Files to review: {file list or PR reference}.
   Report findings as: CRITICAL / WARNING / INFO with evidence (file path + line number).
   When done, send your findings to reviewer-security and reviewer-performance."
Model: {executor_model}
```

**Step 3 -- Share and cross-check findings:**
After each reviewer completes their initial review, they share findings with the others via `SendMessage`:

```
// Each reviewer sends findings to the other two
SendMessage({
  type: "message",
  recipient: "reviewer-performance",
  content: "My security findings: {findings list}. Do any of these conflict with your performance findings? Are there performance optimizations that would introduce security risks?",
  summary: "Security reviewer sharing findings for cross-check"
})
```

Each reviewer then challenges the others' findings:
```
SendMessage({
  type: "message",
  recipient: "reviewer-security",
  content: "Reviewing your security findings: Finding #2 (SQL injection risk in query builder) -- I confirmed this also causes a performance issue due to string concatenation in a hot path. Finding #4 (token expiry) -- this is a false positive; the token refresh middleware handles this case. Evidence: {file}:{line}.",
  summary: "Performance reviewer challenging security findings"
})
```

**Step 4 -- Coordinator synthesizes report:**
The team lead (or a fresh agent) collects all findings and cross-check results, then produces a unified review:

```
Agent(
  subagent_type: "verifier",
  model: "{verifier_model}",
  prompt: "
    Synthesize a unified code review from three specialist reviewers.

    Security findings: {security reviewer's final findings}
    Performance findings: {performance reviewer's final findings}
    Test coverage findings: {test reviewer's final findings}
    Cross-check disputes: {list of challenged findings and resolutions}

    Produce a single review report:
    - CRITICAL items (must fix before merge)
    - WARNING items (should fix, not blocking)
    - INFO items (suggestions)
    - Disputed findings and resolution
  "
)
```

Post the unified report as a GitHub comment on the relevant issue.

**Tier 1 fallback:** Spawn 3 independent reviewer subagents via `Agent(run_in_background: true)`. Each produces its own report. The orchestrator merges reports manually -- no cross-checking between reviewers. Less thorough but fully functional.

---

### Pattern 3 -- Collaborative Debugging (Adversarial Hypothesis Testing)

**Use when:** A bug's root cause is unclear and multiple hypotheses need to be tested simultaneously. Each investigator pursues a different theory and actively tries to disprove the others.

**Flow:** `TeamCreate` --> spawn 2-3 investigators --> each pursues a different hypothesis --> `SendMessage` to share evidence and challenge other hypotheses --> hypothesis that survives adversarial testing wins --> fix implemented by the confirmed investigator.

**Step 1 -- Create the investigation team:**
```
TeamCreate(
  team_name: "debug-phase-{N}-task-{id}",
  description: "Adversarial debugging: {bug description}. Investigators pursue competing hypotheses and challenge each other's evidence."
)
```

**Step 2 -- Spawn investigators with distinct hypotheses:**
Derive hypotheses from the bug symptoms, error logs, and codebase analysis.

```
// Investigator A -- hypothesis: race condition
Spawn teammate "investigator-a" with prompt:
  "Bug: {bug description with symptoms and error output}.
   Your hypothesis: RACE CONDITION in {suspected component}.
   Investigate this hypothesis:
   1. Find evidence supporting or refuting it
   2. Write a reproducer test if possible
   3. If confirmed, draft a fix
   4. Share evidence with other investigators via SendMessage
   5. Actively challenge other investigators' hypotheses with counter-evidence"
Model: {executor_model}

// Investigator B -- hypothesis: configuration error
Spawn teammate "investigator-b" with prompt:
  "Bug: {bug description with symptoms and error output}.
   Your hypothesis: CONFIGURATION ERROR in {suspected component}.
   Investigate this hypothesis:
   1. Find evidence supporting or refuting it
   2. Write a reproducer test if possible
   3. If confirmed, draft a fix
   4. Share evidence with other investigators via SendMessage
   5. Actively challenge other investigators' hypotheses with counter-evidence"
Model: {executor_model}

// Investigator C -- hypothesis: data corruption
Spawn teammate "investigator-c" with prompt:
  "Bug: {bug description with symptoms and error output}.
   Your hypothesis: DATA CORRUPTION in {suspected component}.
   Investigate this hypothesis:
   1. Find evidence supporting or refuting it
   2. Write a reproducer test if possible
   3. If confirmed, draft a fix
   4. Share evidence with other investigators via SendMessage
   5. Actively challenge other investigators' hypotheses with counter-evidence"
Model: {executor_model}
```

**Step 3 -- Evidence sharing and adversarial challenges:**
Investigators share findings and challenge each other via `SendMessage`:

```
// Investigator A shares evidence
SendMessage({
  type: "message",
  recipient: "investigator-b",
  content: "Evidence for race condition hypothesis: I found unsynchronized access to {resource} at {file}:{line}. The timing window is ~50ms under load. This contradicts your configuration hypothesis because the config values are correct -- the issue only manifests under concurrent access. Can you disprove this?",
  summary: "Investigator-a sharing race condition evidence, challenging config hypothesis"
})

// Investigator B responds with counter-evidence
SendMessage({
  type: "message",
  recipient: "investigator-a",
  content: "Your race condition evidence is plausible but I found that the same symptom occurs on single-threaded test runs. See: {test output}. This suggests the root cause is upstream of the concurrent access point. My config hypothesis: the timeout value at {file}:{line} defaults to 0 when the env var is missing.",
  summary: "Investigator-b providing counter-evidence to race condition hypothesis"
})
```

**Step 4 -- Resolution:**
The team lead evaluates which hypothesis survived adversarial testing:

```
Agent(
  subagent_type: "verifier",
  model: "{verifier_model}",
  prompt: "
    Evaluate competing debugging hypotheses.

    Hypothesis A (race condition): {evidence summary, challenges received, responses}
    Hypothesis B (configuration): {evidence summary, challenges received, responses}
    Hypothesis C (data corruption): {evidence summary, challenges received, responses}

    Determine:
    1. Which hypothesis best explains ALL symptoms?
    2. Which hypothesis survived adversarial challenge?
    3. Is the proposed fix correct and complete?

    Output: CONFIRMED: investigator-{a|b|c} -- {hypothesis name}
    Followed by: evidence that confirms, evidence that was disproven, recommended fix.
  "
)
```

The confirmed investigator's fix is merged. Other worktree branches are discarded.

**Tier 1 fallback:** Spawn 2-3 independent debugging subagents via `Agent(isolation: "worktree", run_in_background: true)`. Each investigates a different hypothesis and reports findings. The orchestrator compares reports without inter-agent debate. Less adversarial but still tests multiple hypotheses in parallel.

---

### Graceful Degradation

If Agent Teams are unavailable (env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. Inform the user with this exact message:

> "Competitive mode: using Tier 1 subagents (Agent Teams not available or not required for this strategy). Each executor works independently; verifier selects the best result."

The user is informed but not blocked. All workflows remain fully functional via Tier 1. Each pattern above includes a specific Tier 1 fallback that preserves the core workflow (parallel execution + verifier selection) without inter-agent messaging.

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
