---
name: agent-teams
description: >-
  Coordinates Tier 2 Agent Teams with TeamCreate, SendMessage, competitive
  implementation, multi-reviewer code review, and collaborative debugging
  patterns. Used when workflows require inter-agent communication, adversarial
  debate, or shared task lists.
user-invocable: false
---

# Agent Teams (Tier 2)

Agent Teams (available since Claude Code v2.1.32, Feb 2026) enable inter-agent communication for workflows that require debate, cross-checking, or collaborative problem-solving. MaxsimCLI sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` during install and registers `TeammateIdle` and `TaskCompleted` quality-gate hooks.

**Current status:** Infrastructure is in place (env var, hooks). Tier 2 workflow patterns (competitive implementation, multi-reviewer code review, collaborative debugging) are defined below with executable `TeamCreate`/`SendMessage` call syntax. All workflows gracefully degrade to Tier 1 subagents when Agent Teams are unavailable.

## When to Use Tier 2 vs Tier 1

Use Tier 2 Agent Teams only when agents need to communicate with each other during execution. If tasks are independent and can simply report results back to an orchestrator, use Tier 1 subagents from `maxsim-batch`.

| Workflow | Tier | Reason |
|----------|------|--------|
| Phase execution (independent tasks) | Tier 1 (Subagents) | Tasks don't need to communicate |
| Codebase scanning | Tier 1 (Subagents) | Read-only, report back |
| Research gathering | Tier 1 (Subagents) | Collect and report |
| Competitive implementation | **Tier 2 (Agent Teams)** | Agents need to debate |
| Multi-dimensional code review | **Tier 2 (Agent Teams)** | Findings need cross-checking |
| Collaborative debugging | **Tier 2 (Agent Teams)** | Hypotheses need adversarial testing |
| Architecture exploration | **Tier 2 (Agent Teams)** | Requires discussion |

**Rule of thumb:** If the word "debate", "challenge", "cross-check", or "adversarial" describes the interaction, use Tier 2. Otherwise, Tier 1.

## Activation Check

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

## Architecture

### Roles

- **Team Lead** -- The orchestrating agent that creates the team, spawns teammates, and synthesizes results. There is exactly one team lead per team.
- **Teammates** -- Spawned agents that perform work and communicate via `SendMessage`. Each teammate has a unique name within the team.
- **Verifier** -- A fresh agent (NOT a team member) that evaluates results objectively. Spawned after team work completes.

### Communication

- **Task List** -- Shared task list managed by the team lead. Teammates can read but not modify it.
- **Mailbox** -- Each teammate has a mailbox. `SendMessage` delivers messages to a teammate's mailbox. Messages include `type`, `recipient`, `content`, and `summary`.

### Lifecycle

1. `TeamCreate` -- Team lead creates the team
2. Spawn teammates with specific roles and prompts
3. Teammates work independently, then communicate via `SendMessage`
4. Quality gates fire (`TeammateIdle`, `TaskCompleted`)
5. Team lead collects results and spawns verifier
6. Team is dissolved after verification

---

## Pattern 1 -- Competitive Implementation (Debate)

**Use when:** A task is marked `critical` and `config.execution.competitive_enabled` is `true`. Multiple agents implement the same task independently, then adversarially critique each other's work before a neutral verifier selects the winner.

**Flow:** `TeamCreate` --> spawn 2-3 competitors --> each implements independently --> `SendMessage` critiques --> fresh verifier judges --> winner selected.

### Step 1 -- Create the competition team

```
TeamCreate(
  team_name: "competition-phase-{N}-task-{id}",
  description: "Competitive implementation: {task_description}. Each teammate implements independently, then reviews the others adversarially."
)
```

### Step 2 -- Spawn competing teammates

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

### Step 3 -- Adversarial critique via SendMessage

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

### Step 4 -- Fresh verifier selects winner

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

## Pattern 2 -- Multi-Reviewer Code Review (Cross-Checking)

**Use when:** A PR or implementation requires review from multiple specialist perspectives that must challenge each other's findings.

**Flow:** `TeamCreate` --> spawn 3 specialist reviewers --> each reviews independently --> `SendMessage` to share findings --> each reviewer challenges other reviewers' findings --> coordinator synthesizes unified report.

### Step 1 -- Create the review team

```
TeamCreate(
  team_name: "review-phase-{N}-task-{id}",
  description: "Multi-dimensional code review: {description}. Reviewers share and cross-check findings."
)
```

### Step 2 -- Spawn specialist reviewers

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

### Step 3 -- Share and cross-check findings

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

### Step 4 -- Coordinator synthesizes report

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

## Pattern 3 -- Collaborative Debugging (Adversarial Hypothesis Testing)

**Use when:** A bug's root cause is unclear and multiple hypotheses need to be tested simultaneously. Each investigator pursues a different theory and actively tries to disprove the others.

**Flow:** `TeamCreate` --> spawn 2-3 investigators --> each pursues a different hypothesis --> `SendMessage` to share evidence and challenge other hypotheses --> hypothesis that survives adversarial testing wins --> fix implemented by the confirmed investigator.

### Step 1 -- Create the investigation team

```
TeamCreate(
  team_name: "debug-phase-{N}-task-{id}",
  description: "Adversarial debugging: {bug description}. Investigators pursue competing hypotheses and challenge each other's evidence."
)
```

### Step 2 -- Spawn investigators with distinct hypotheses

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

### Step 3 -- Evidence sharing and adversarial challenges

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

### Step 4 -- Resolution

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

## Key Constraints

- **One team per session** -- A single orchestrator session can only manage one active team at a time. Complete and dissolve the current team before creating another.
- **No nested teams** -- A teammate cannot create its own sub-team. If a teammate needs parallel work, it uses Tier 1 subagents.
- **3-5 teammates** -- Keep teams small. Fewer than 3 loses the benefit of cross-checking; more than 5 creates communication overhead that exceeds value.
- **File locking** -- Teammates must not modify the same files. If shared file access is required, designate one teammate as the file owner and others communicate changes via `SendMessage`.

## Quality Gates

MaxsimCLI registers two hooks for Agent Teams quality control:

- **`TeammateIdle`** -- Fires when a teammate has been idle for more than 60 seconds. The team lead should check if the teammate is stuck and either send a nudge message or mark the task as blocked.
- **`TaskCompleted`** -- Fires when a teammate reports completion. The team lead should verify the output contract (`RESULT: PASS` or `RESULT: FAIL`) and update the status table.

These hooks ensure the team lead maintains awareness of team progress without polling.

## Graceful Degradation

If Agent Teams are unavailable (env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. Inform the user with this exact message:

> "Competitive mode: using Tier 1 subagents (Agent Teams not available or not required for this strategy). Each executor works independently; verifier selects the best result."

The user is informed but not blocked. All workflows remain fully functional via Tier 1. Each pattern above includes a specific Tier 1 fallback that preserves the core workflow (parallel execution + verifier selection) without inter-agent messaging.
