# Competitive Implementation Design for MaxsimCLI

**Version:** 1.0
**Date:** 2026-03-22
**Status:** Draft
**Scope:** MaxsimCLI agent orchestration — parallel implementation strategy

---

## Table of Contents

1. [Overview and Motivation](#1-overview-and-motivation)
2. [Theoretical Foundation](#2-theoretical-foundation)
3. [How Many Parallel Implementations](#3-how-many-parallel-implementations)
4. [Structuring Prompts for Parallel Agents](#4-structuring-prompts-for-parallel-agents)
5. [Prompt Variation Strategies](#5-prompt-variation-strategies)
6. [Automated Comparison Criteria](#6-automated-comparison-criteria)
7. [Scoring and Ranking System](#7-scoring-and-ranking-system)
8. [Handling Partial Successes](#8-handling-partial-successes)
9. [Git Worktree Setup](#9-git-worktree-setup)
10. [Merging the Winner and Cleaning Up Losers](#10-merging-the-winner-and-cleaning-up-losers)
11. [When to Use Competitive Implementation](#11-when-to-use-competitive-implementation)
12. [When to Skip It](#12-when-to-skip-it)
13. [Integration with the Verification System](#13-integration-with-the-verification-system)
14. [Cost Analysis](#14-cost-analysis)
15. [Hybrid Strategy](#15-hybrid-strategy)
16. [Reference Architecture](#16-reference-architecture)

---

## 1. Overview and Motivation

Competitive implementation is a technique in which multiple AI agents independently implement the same feature or task, and the best result is selected programmatically. Rather than treating code generation as a single-shot process, it applies the statistical reasoning of best-of-N sampling: generating N candidates and selecting the highest-quality output according to a well-defined scoring function.

### 1.1 Why Not Just Retry on Failure?

A single agent retrying on failure is a sequential process. Each retry operates under the same priors and contextual biases as the previous attempt. If an agent has anchored on a structurally flawed approach, retries within that same context are unlikely to diverge from the error.

Parallel competitive agents solve this by:

- **Eliminating shared failure modes.** Each agent starts from a clean context. If Agent A picks a recursive approach and Agent B picks an iterative one, and the recursive approach has a stack overflow on large inputs, only Agent A fails.
- **Reducing variance through selection.** Individual LLM outputs have high variance. Best-of-N sampling consistently shifts the expected quality upward without changing the underlying model.
- **Surface-level diversity catching edge cases.** Different implementations exercise different code paths. An implementation that uses a library abstraction may handle character encoding correctly where a hand-rolled one does not.
- **Avoiding context contamination.** In a single-agent retry loop, the model's context grows with failed attempts. This can cause it to "remember" the wrong approach and continue anchoring on it even when instructed to start fresh.

### 1.2 Empirical Support

AlphaCode (DeepMind) demonstrated that generating millions of candidate solutions and then filtering and clustering to the top 10 pushed performance to the 98th percentile on competitive programming benchmarks — a feat unachievable with single-sample or low-retry strategies. The selection strategy alone contributed approximately 60 additional points in head-to-head evaluation compared to random submission selection from the same candidate pool.

For MaxsimCLI, competitive implementation applies this insight at a practical, cost-aware scale: not millions of candidates, but 2–5 focused implementations selected by a deterministic scoring pipeline.

---

## 2. Theoretical Foundation

### 2.1 Best-of-N Sampling

Best-of-N (BoN) sampling is a technique in which N independent outputs are drawn from an LLM and the highest-scoring output according to a proxy objective (a reward model, test suite, or scoring function) is returned.

The formal relationship: if a single sample has probability `p` of being correct, the probability that at least one of N samples is correct is `1 - (1-p)^N`. For p=0.6 and N=3, this yields ~0.936. For p=0.4 and N=5, this yields ~0.922.

This means competitive implementation is especially powerful for tasks where:
- Individual pass rates are in the 40–70% range (common for non-trivial features)
- The task has objectively verifiable correctness (tests pass or they do not)
- Selection can be automated with high confidence

### 2.2 Tournament Selection

Tournament selection, from genetic algorithms, selects candidates by running head-to-head comparisons between subsets and advancing winners. Applied to code:

1. All candidates are evaluated on the full scoring criteria.
2. Candidates are ranked.
3. The top candidate advances.

For small N (2–5), a full ranking rather than elimination brackets is appropriate. The distinction matters for larger N (10+), where pairwise comparisons become expensive.

Arena-Lite and similar LLM evaluation frameworks have validated that tournament-based direct comparisons reduce the number of required evaluations while maintaining ranking reliability. For MaxsimCLI, the scoring pipeline replaces a learned reward model with deterministic signals (test results, lint output, build status), which are more reliable and cheaper.

### 2.3 DiVeRSe Prompting

The DiVeRSe (Diverse Verifier on Reasoning Steps) prompting strategy generates multiple diverse prompts for the same task, producing multiple reasoning paths per prompt. This compounds the benefit: rather than N runs of the same prompt (which still share structural biases from the prompt itself), N runs of N prompt variants produce a richer candidate pool.

For MaxsimCLI, this informs the prompt variation strategies in Section 5.

---

## 3. How Many Parallel Implementations

### 3.1 The Tradeoff Curve

| N | Cost multiplier | Min correct rate for >90% success | Use case |
|---|---|---|---|
| 2 | 2× | p > 0.68 | Simple features, high-confidence tasks |
| 3 | 3× | p > 0.53 | Standard non-trivial features |
| 5 | 5× | p > 0.37 | Complex features, critical paths |
| 7 | 7× | p > 0.28 | High-stakes, low-confidence tasks |

"Min correct rate for >90% success" is the minimum single-sample pass probability needed for `1-(1-p)^N > 0.9`.

### 3.2 Recommended Defaults for MaxsimCLI

**N=2** — Quick competitive mode
Default for most feature tasks. Low overhead, catches the most common class of divergence (one correct, one flawed). Best when the task is well-specified and the test suite is comprehensive.

**N=3** — Standard competitive mode
Recommended default for all work tagged as `complexity: medium` or higher in the phase plan. The marginal quality gain from 2→3 is larger than from 3→5, making this the highest value point on the curve.

**N=5** — Deep competitive mode
Reserved for tasks tagged `critical` or `complexity: high`, and for tasks where previous single-agent attempts have failed. The cost is justified when a wrong implementation would require significant rework or where the feature sits on a critical path.

### 3.3 Diminishing Returns Beyond 5

Beyond N=5, the marginal gain per additional agent drops rapidly while cost grows linearly. The AlphaCode approach works at millions of samples because it uses fast inference at massive scale with automated test execution. For MaxsimCLI operating in an interactive or semi-interactive workflow, 5 is the practical ceiling for routine use.

---

## 4. Structuring Identical Prompts for Different Agents

### 4.1 The Core Prompt Template

Each agent receives the same canonical task prompt. This is the source-of-truth specification the agent is implementing against. It must be:

- **Complete:** No information that any agent needs should be withheld from the prompt.
- **Unambiguous:** Requirements must be stated precisely enough that any ambiguity is a deliberate design space (to be explored through variation), not accidental.
- **Self-contained:** Each agent runs in an isolated context. Cross-references to "earlier conversation" or "as discussed" are invalid.

**Canonical prompt structure:**

```
TASK: [one-sentence summary]

CONTEXT:
- [Existing system architecture relevant to the task]
- [Dependencies the implementation must integrate with]
- [Constraints: language, runtime, framework version]

REQUIREMENTS:
- [Requirement 1 — must, testable]
- [Requirement 2 — must, testable]
- [Requirement 3 — should, measurable]

ACCEPTANCE CRITERIA:
- All existing tests pass
- [Specific criterion 1]
- [Specific criterion 2]

DO NOT:
- [Antipattern 1 — specific behavior to avoid]
- [Antipattern 2]

OUTPUT FORMAT:
- Implement in [file(s)]
- Write or update tests in [test file(s)]
- Do not modify [out-of-scope files]
```

### 4.2 What Stays Constant Across All Agents

- The full requirements list
- The acceptance criteria
- The DO NOT constraints
- The output file targets
- The test suite that will be run for scoring

### 4.3 What Varies

See Section 5 for prompt variation strategies. The variation layer is a prefix or suffix added to the canonical prompt, not a replacement of it.

---

## 5. Prompt Variation Strategies

### 5.1 Why Variation is Necessary

N runs of the same prompt produce N samples from the same distribution. While there is natural stochastic variation, the structural approach the model takes will be similar across runs. To get genuinely different implementations — which is the point of competitive execution — the prompts must actively steer agents toward different solution spaces.

### 5.2 Strategy 1: Architectural Constraint Variation

Each agent is given a different architectural mandate in addition to the canonical requirements.

```
# Agent A prefix
Implement this using a functional programming style. Prefer pure functions,
avoid mutable state, use map/filter/reduce over imperative loops.

# Agent B prefix
Implement this using an object-oriented style. Design clear class boundaries,
use encapsulation, prefer method composition.

# Agent C prefix
Implement this with performance as the primary constraint. Optimize for
minimal memory allocation and CPU cycles. Benchmark-driven approach.
```

This produces implementations that are structurally distinct, making it likely that at least one covers edge cases the others miss.

### 5.3 Strategy 2: Library and Dependency Variation

```
# Agent A prefix
Use only the standard library. No third-party dependencies for this implementation.

# Agent B prefix
You may use any existing dependencies already in package.json.
Choose the most ergonomic solution.

# Agent C prefix
Prefer small, focused utility functions over library abstractions.
If a library function exists but is complex to configure, implement the behavior directly.
```

### 5.4 Strategy 3: Error Handling Variation

```
# Agent A prefix
Implement with defensive programming: validate all inputs, handle all error
cases explicitly, never throw uncaught exceptions.

# Agent B prefix
Implement with fail-fast semantics: validate at boundaries, throw descriptive
errors early, let the caller handle recovery.

# Agent C prefix
Implement with Result/Either types. All operations that can fail must return
a typed result object rather than throwing.
```

### 5.5 Strategy 4: Reasoning Style Variation (Chain-of-Thought)

Chain-of-Thought prompting produces the highest diversity of reasoning paths and approaches. Vary the thinking instruction:

```
# Agent A prefix
Before writing any code, write out your full approach as a numbered list of
steps. Consider at least two alternative approaches and explain why you are
choosing one over the other.

# Agent B prefix
Start by identifying the core data transformation this task requires.
Work from the data model outward to the interface.

# Agent C prefix
Start by writing the tests that must pass, then implement the minimum code
to make them pass. Test-first approach required.
```

### 5.6 Strategy 5: Persona Variation

Vary the agent's assigned role:

```
# Agent A prefix
You are a senior engineer who has been burned by over-engineered solutions.
Your instinct is always toward simplicity and readability.

# Agent B prefix
You are a performance engineer. Your instinct is to look for algorithmic
inefficiencies and unnecessary allocations before writing a single line.

# Agent C prefix
You are a QA-minded engineer. Your instinct is to think about what can go
wrong, not what should go right.
```

### 5.7 Combining Strategies

For N=3, a recommended combination is:

- Agent A: Architectural constraint (functional) + Chain-of-Thought (design-first)
- Agent B: Persona (simplicity) + Error handling (defensive)
- Agent C: Architectural constraint (performance) + Reasoning (test-first)

The combinations should be chosen so that the strategies do not conflict and do not all push toward the same solution space.

---

## 6. Automated Comparison Criteria

All criteria must be computable without human judgment. Each criterion produces a numerical score that feeds into the ranking function.

### 6.1 Test Pass Rate (Weight: 35%)

**What it measures:** Functional correctness against the test suite.

**How to compute:**
```
score = (passing_tests / total_tests) × 100
```

**Data source:** Output of the test runner (Jest, Vitest, Mocha, pytest, etc.)
**Disqualifier:** If score < 100% for tests marked `must-pass`, the implementation is eliminated regardless of other scores.

**Notes:** Distinguish between unit tests (higher weight), integration tests (medium weight), and snapshot tests (lower weight, since snapshots can be regenerated). A suite with 10 unit tests and 5 integration tests is not treated as 15 equally-weighted tests.

### 6.2 Build Success (Weight: 15%)

**What it measures:** Whether the implementation compiles and produces a valid build artifact.

**How to compute:** Binary — build succeeds (100) or fails (0). A failed build disqualifies the implementation.

**Data source:** TypeScript compiler, bundler, or equivalent.

**Notes:** A build that succeeds with warnings but no errors scores 90. A build with type errors that were suppressed with `@ts-ignore` or `any` casts scores 70.

### 6.3 Lint Score (Weight: 15%)

**What it measures:** Code style compliance and static analysis findings.

**How to compute:**
```
score = max(0, 100 - (errors × 10) - (warnings × 2))
```

**Data source:** ESLint, Biome, Pylint, or equivalent configured linter.

**Notes:** Lint errors are weighted 5× more heavily than warnings because errors typically indicate genuine issues (unused variables, unreachable code, type mismatches) while warnings are often stylistic. Projects should pin their linter config so all agents are scored against the same rules.

### 6.4 Code Coverage (Weight: 10%)

**What it measures:** The percentage of implementation lines exercised by the test suite.

**How to compute:**
```
score = (covered_lines / total_lines) × 100
```

**Data source:** Istanbul (V8 coverage), coverage.py, or equivalent.

**Notes:** This criterion rewards implementations that write tests alongside the implementation, not just implementations with less code. A 100-line implementation with 95% coverage scores higher than a 50-line implementation with 80% coverage on this criterion.

### 6.5 Spec Compliance Percentage (Weight: 15%)

**What it measures:** How many of the stated requirements in the spec are demonstrably satisfied.

**How to compute:** This requires a structured requirements list where each requirement is tagged and linked to at least one test or verifiable artifact. The spec compliance score is computed as:

```
score = (satisfied_requirements / total_requirements) × 100
```

**Data source:** The MaxsimCLI verification system (see Section 13) traces requirement tags to test results and static analysis outputs.

**Notes:** Requirements marked `must` carry a 3× multiplier in the compliance calculation. A `must` requirement that is not satisfied is effectively a disqualifier.

### 6.6 Code Complexity (Weight: 5%)

**What it measures:** Structural simplicity of the implementation, as a proxy for maintainability.

**How to compute:** Two sub-metrics:

**Cyclomatic complexity:**
The number of linearly independent paths through the code. Computed per function. Scores are bucketed:
- CC ≤ 5: 100 (excellent)
- CC 6–10: 80 (acceptable, per McCabe's original threshold)
- CC 11–15: 50 (concerning)
- CC > 15: 20 (high risk for defects)

The implementation score is the average across all functions, weighted by lines of code.

**Lines of code:**
Normalized against a baseline (the simplest correct implementation from prior similar tasks, or the median of the current candidate set). Prefer smaller implementations when functionality is equal:
- Within 20% of minimum: 100
- 20–50% above minimum: 80
- 50–100% above minimum: 60
- More than 100% above minimum: 40

**Notes:** Complexity is the lowest-weighted criterion because it is a proxy, not a direct measure of correctness or maintainability. A complex implementation that passes all tests is preferable to a simple one that does not. The weight exists to break ties and to flag implementations that are likely to become maintenance burdens.

### 6.7 Performance Benchmarks (Weight: 5%, conditional)

**When to apply:** Only for tasks with explicit performance requirements in the spec (e.g., "must process 10,000 items in under 100ms").

**How to compute:** Run the benchmark suite (using Vitest bench, hyperfine, criterion, or equivalent) and score relative to the specified target:
- Meets target: 100
- Within 20% of target: 80
- Within 50% of target: 50
- Misses by more than 50%: 20

**Notes:** When performance benchmarks are not specified, this weight is redistributed proportionally across the other criteria.

### 6.8 Criteria Summary Table

| Criterion | Default Weight | Disqualifier Threshold |
|---|---|---|
| Test pass rate | 35% | Any `must-pass` test failing |
| Build success | 15% | Build failure |
| Lint score | 15% | None (contributes to score) |
| Code coverage | 10% | None |
| Spec compliance | 15% | Any `must` requirement unsatisfied |
| Code complexity | 5% | None |
| Performance benchmarks | 5% (conditional) | Explicit perf requirement missed by >50% |

---

## 7. Scoring and Ranking System

### 7.1 Computing the Composite Score

Each criterion `i` has a raw score `s_i` (0–100) and weight `w_i`. The composite score is:

```
composite = Σ(s_i × w_i) / Σ(w_i)
```

When performance benchmarks do not apply, `w_perf = 0` and the other weights are re-normalized proportionally.

### 7.2 Disqualification Pass

Before computing composite scores, run a disqualification pass:

1. Build fails → disqualified.
2. Any `must-pass` test fails → disqualified.
3. Any `must` requirement is unsatisfied → disqualified.

Disqualified implementations are removed from ranking. If all implementations are disqualified, the competitive run fails and falls back to the retry strategy (see Section 15).

### 7.3 Tie Breaking

Ties in composite score (within 2 points) are broken in this order:

1. Higher test pass rate wins.
2. Higher spec compliance wins.
3. Lower cyclomatic complexity wins.
4. Earlier completion time wins (rewarding the faster agent, all else equal).

### 7.4 Score Report Format

The scoring system must produce a machine-readable report for each candidate:

```json
{
  "agent_id": "agent-b",
  "branch": "competitive/feature-auth-b",
  "disqualified": false,
  "scores": {
    "test_pass_rate": { "raw": 100, "weighted": 35.0 },
    "build_success": { "raw": 90, "weighted": 13.5 },
    "lint_score": { "raw": 84, "weighted": 12.6 },
    "code_coverage": { "raw": 91, "weighted": 9.1 },
    "spec_compliance": { "raw": 100, "weighted": 15.0 },
    "code_complexity": { "raw": 80, "weighted": 4.0 }
  },
  "composite": 89.2,
  "rank": 1
}
```

---

## 8. Handling Partial Successes

### 8.1 The Core Problem

In practice, clean winners are rare. The common case is:

- Implementation A: passes 8/10 tests, lint clean, 100% spec compliance
- Implementation B: passes 10/10 tests, 3 lint warnings, 85% spec compliance

Neither is strictly dominant.

### 8.2 The Weighted Score Resolves Most Cases

The weighted scoring system in Section 7 handles this automatically. In the example above:

**Implementation A:**
- Test pass rate: 80 × 0.35 = 28.0
- Lint score: 100 × 0.15 = 15.0
- Spec compliance: 100 × 0.15 = 15.0
- Build/coverage/complexity: assume equal at 85 each → (85×0.15) + (85×0.10) + (85×0.05) = 25.5
- Composite: 83.5

**Implementation B:**
- Test pass rate: 100 × 0.35 = 35.0
- Lint score: (100 - 6) × 0.15 = 14.1 (3 warnings at 2 points each)
- Spec compliance: 85 × 0.15 = 12.75
- Build/coverage/complexity: same as A → 25.5
- Composite: 87.35

Implementation B wins on composite, which is the correct answer: 10/10 tests passing is a stronger signal than lint cleanliness.

### 8.3 When the Score Difference is Small

When the top two candidates are within 5 composite points, trigger the "close competition" protocol:

1. **Review the delta.** Identify which specific criteria differentiate them. Log this for human visibility.
2. **Apply the must-first rule.** If either candidate fails a `must` criterion the other satisfies, the latter wins regardless of composite.
3. **Select the higher test pass rate.** Functional correctness is the most reliable signal. If equal, select the lower lint error count (not warning count).
4. **Flag for human review.** Surface the score report and the delta analysis to the operator. The operator may override the automatic selection.

### 8.4 Partial Credit in Spec Compliance

When Spec Compliance scores differ, decompose by requirement priority:

```
weighted_compliance = (must_satisfied × 3 + should_satisfied × 1) /
                      (must_total × 3 + should_total × 1) × 100
```

This ensures that an implementation satisfying all `must` requirements at the expense of some `should` requirements is ranked above one that satisfies all `should` requirements but misses a `must`.

### 8.5 Salvage: Borrowing from Losers

In rare cases, the winner has one clear deficiency that a losing implementation handles correctly. For example:

- Winner: passes all tests except one edge case test for empty input
- Loser: passes all tests, but fails on a different integration test

If the specific code path handling empty input in the loser is isolatable (a single function, a guard clause), a human operator may elect to cherry-pick that path into the winner rather than discarding it entirely.

This is a human-in-the-loop decision, not an automated one. The system should surface the opportunity (log that Agent B handles the empty-input case correctly) but should not attempt automated cherry-picking.

---

## 9. Git Worktree Setup

### 9.1 Why Worktrees

Git worktrees allow multiple branches to be checked out simultaneously in different filesystem directories, all sharing the same `.git` history, refs, and objects. For competitive implementation:

- Each agent needs its own isolated working directory to avoid file conflicts.
- Worktrees use a fraction of the disk space of full clones (shared git objects).
- Worktrees can be created, checked out, and deleted programmatically.
- Each worktree can have its own `node_modules` or build outputs without interfering with others.

### 9.2 Branch Naming Convention

```
competitive/<task-id>/<variant>
```

Examples:
- `competitive/auth-refresh-token/a`
- `competitive/auth-refresh-token/b`
- `competitive/auth-refresh-token/c`

The task ID should match the phase plan task identifier. The variant is a single letter (a, b, c…) corresponding to the agent number.

### 9.3 Worktree Setup Script

```bash
# Called by MaxsimCLI before launching competitive agents
setup_competitive_worktrees() {
  local task_id="$1"
  local n_agents="$2"
  local base_branch="${3:-main}"
  local repo_root="$4"

  local variants=("a" "b" "c" "d" "e")

  for i in $(seq 0 $((n_agents - 1))); do
    local variant="${variants[$i]}"
    local branch="competitive/${task_id}/${variant}"
    local worktree_path="${repo_root}/.worktrees/${task_id}-${variant}"

    # Create branch from base
    git -C "$repo_root" branch "$branch" "$base_branch"

    # Create worktree
    git -C "$repo_root" worktree add "$worktree_path" "$branch"

    echo "Created worktree: $worktree_path on branch $branch"
  done
}
```

### 9.4 Per-Worktree Initialization

After creating worktrees, each must be initialized for the agent:

```bash
initialize_worktree() {
  local worktree_path="$1"

  # Install dependencies (each worktree gets its own node_modules)
  cd "$worktree_path" && npm install --silent

  # Copy any environment files that are not tracked in git
  # (e.g., .env.test, test fixtures)
  cp "$REPO_ROOT/.env.test" "$worktree_path/.env.test" 2>/dev/null || true
}
```

### 9.5 Agent Assignment

Each agent is assigned its worktree as its working directory:

```
Agent A → .worktrees/<task-id>-a/  (branch: competitive/<task-id>/a)
Agent B → .worktrees/<task-id>-b/  (branch: competitive/<task-id>/b)
Agent C → .worktrees/<task-id>-c/  (branch: competitive/<task-id>/c)
```

The agent's system prompt includes:
```
Your working directory is: /path/to/.worktrees/<task-id>-<variant>
Your branch is: competitive/<task-id>/<variant>
Commit your changes to this branch only.
Do not modify files outside your working directory.
```

### 9.6 Preventing Cross-Contamination

Agents must not share state. The following safeguards apply:

1. Each worktree has its own installed dependencies.
2. Agents do not share environment variables containing in-progress state.
3. No agent reads from another agent's worktree directory.
4. Build outputs and test caches are local to each worktree.

---

## 10. Merging the Winner and Cleaning Up Losers

### 10.1 Winner Merge Process

Once a winner is selected:

```bash
merge_winner() {
  local task_id="$1"
  local winner_variant="$2"
  local target_branch="${3:-main}"
  local repo_root="$4"

  local winner_branch="competitive/${task_id}/${winner_variant}"

  # Ensure the winner branch is up to date
  git -C "$repo_root" fetch origin "$target_branch"

  # Merge the winner into the target branch
  git -C "$repo_root" checkout "$target_branch"
  git -C "$repo_root" merge --no-ff "$winner_branch" \
    -m "feat: implement ${task_id} (competitive winner: ${winner_variant})

Competitive implementation: ${winner_variant} selected from $(ls .worktrees | grep $task_id | wc -l) candidates.
Composite score: [SCORE]
See .competitive-results/${task_id}.json for full ranking."

  echo "Merged $winner_branch into $target_branch"
}
```

The `--no-ff` flag is required. Competitive implementation merges should always produce a merge commit so the competitive branch is visible in the history. This preserves traceability.

### 10.2 Archiving the Score Report

Before cleanup, archive the score report:

```bash
mkdir -p "${repo_root}/.competitive-results"
cp "${scoring_output}" "${repo_root}/.competitive-results/${task_id}.json"
git -C "$repo_root" add ".competitive-results/${task_id}.json"
git -C "$repo_root" commit -m "chore: archive competitive results for ${task_id}"
```

`.competitive-results/` should be in `.gitignore` if these reports are not wanted in the project history, or committed if audit trails are desired.

### 10.3 Cleanup

After merging:

```bash
cleanup_competitive_worktrees() {
  local task_id="$1"
  local repo_root="$2"

  for worktree_path in "${repo_root}/.worktrees/${task_id}-"*; do
    if [ -d "$worktree_path" ]; then
      git -C "$repo_root" worktree remove "$worktree_path" --force
    fi
  done

  # Delete competitive branches (losers only; winner already merged)
  for branch in $(git -C "$repo_root" branch | grep "competitive/${task_id}/"); do
    # Skip if branch is merged
    if git -C "$repo_root" branch --merged "$target_branch" | grep -q "$branch"; then
      git -C "$repo_root" branch -d "$branch"
    else
      git -C "$repo_root" branch -D "$branch"
      echo "Deleted losing branch: $branch"
    fi
  done
}
```

### 10.4 Preserving Loser Insights

Even though losing implementations are deleted, their key insights should be preserved in a structured note:

```json
{
  "task_id": "auth-refresh-token",
  "winner": "b",
  "notable_approaches": {
    "a": "Used functional approach with Result types — clean but verbose",
    "c": "Performance-optimized but over-engineered for current load"
  },
  "edge_cases_found": [
    "Agent B caught empty token case, agents A and C missed it"
  ]
}
```

This is appended to the archived results file and can inform future task planning.

---

## 11. When to Use Competitive Implementation

### 11.1 Strong Signals for Competitive Mode

**Complexity:** Tasks involving non-trivial algorithms, state machines, or multiple interacting components where there are genuinely multiple valid design approaches.

**Critical path:** Features that, if implemented incorrectly, would require significant downstream rework. Authentication flows, data migration scripts, API contracts.

**Historical failure:** A task type where previous single-agent attempts have failed at a rate above 30%. Competitive implementation is a direct response to demonstrated unreliability.

**High test coverage requirement:** When the task requires >85% test coverage and the test suite is comprehensive, the automated selection criteria are reliable enough to pick a clear winner.

**Multiple valid approaches exist:** When the spec admits several valid implementations with different trade-off profiles and it is not clear a priori which will score best.

**Novel domain:** When the agent is working in a codebase area it has not previously touched, or with a library it has not previously used. Novel domains increase per-sample variance, making BoN more valuable.

### 11.2 Specific Task Tags That Trigger Competitive Mode

In MaxsimCLI phase plans, the following tags should automatically trigger competitive mode at the default N:

| Tag | Minimum N |
|---|---|
| `complexity: high` | 3 |
| `critical: true` | 3 |
| `domain: new` | 3 |
| `risk: high` | 3 |
| `retry-count: >1` | 3 (escalate from current single-agent) |
| `complexity: high` + `critical: true` | 5 |

---

## 12. When to Skip It

Competitive implementation is not free. The following cases do not justify the cost.

### 12.1 Simple Tasks

**Configuration changes:** Modifying a config file, updating an environment variable, changing a timeout value. These tasks have one correct answer. Running them competitively produces N identical or near-identical results.

**Documentation:** Writing or updating documentation. There is no objective test suite for prose quality. The selection criteria do not apply.

**Trivial refactors:** Renaming a variable, extracting a small helper function with no behavioral change, reformatting code. The single-agent pass rate for these tasks approaches 1.0, making BoN's benefit negligible.

**Dependency updates:** Bumping a package version follows a deterministic process (update version, run tests, check for breaking changes). A single agent suffices.

### 12.2 Tasks Where Selection Criteria Are Unreliable

**No test suite:** If the task has no automated tests, the primary selection criterion (test pass rate) is unavailable. The remaining criteria (lint, complexity) are insufficient to reliably rank implementations.

**Underspecified requirements:** If the spec is ambiguous, agents will interpret it differently. The resulting implementations may be incomparable because they are solving different problems. Fix the spec first.

**Snapshot-test-heavy:** If the test suite consists primarily of snapshot tests, a first-run agent will generate new snapshots (100% pass) while subsequent agents inherit snapshots from an earlier run (potentially 0% pass). The comparison is meaningless.

### 12.3 Time-Constrained Situations

When a fix is urgent (production incident, security patch), the overhead of spinning up 3 agents and waiting for all to complete is not acceptable. In these cases, use single-agent with an immediate retry if the first attempt fails.

### 12.4 Decision Heuristic

```
If task.complexity == "low" AND task.risk == "low":
    → Single agent
Elif task.has_tests == false:
    → Single agent (fix spec first if possible)
Elif task.is_config_or_docs:
    → Single agent
Elif task.complexity == "medium" OR task.risk == "medium":
    → N=2 or N=3
Elif task.complexity == "high" OR task.risk == "high" OR task.critical == true:
    → N=3 or N=5
```

---

## 13. Integration with the Verification System

### 13.1 How Competitive Mode Plugs Into Verification

The MaxsimCLI verification system is the authoritative source for determining whether an implementation satisfies its spec. In competitive mode, verification runs once per agent candidate rather than once for the task.

The integration points are:

1. **Pre-scoring disqualification:** The verification system's `must` checks (test pass, build success, required spec items) run first. Any failure is a disqualification, not a scoring input.

2. **Spec compliance scoring:** The verification system's requirement-level results (which requirements are satisfied, which are not) are the input to the spec compliance criterion (Section 6.5).

3. **Post-selection re-verification:** After the winner is selected, a final full verification pass runs against the merged result on the target branch. This catches any regression introduced by the merge itself.

### 13.2 Verification Run Parallelism

All N verification runs should execute in parallel. The total wall-clock time for competitive verification is the time of the slowest single verification run, not N × single run time.

This requires that:
- Each verification run operates in its own worktree (already ensured by Section 9).
- Test runners do not share port numbers, temporary files, or database state between runs.
- CI resources (GitHub Actions runners, local CPU cores) are sufficient to run N verification pipelines simultaneously.

For local development with N=3 on a machine with 8+ cores, full parallelism is achievable. For N=5, consider whether the test suite is CPU-bound before scheduling all 5 simultaneously.

### 13.3 Verification Artifact Format

Each verification run produces an artifact that the scoring system consumes:

```json
{
  "agent_id": "agent-a",
  "branch": "competitive/task-id/a",
  "timestamp": "2026-03-22T14:30:00Z",
  "build": {
    "success": true,
    "warnings": 1,
    "errors": 0
  },
  "tests": {
    "total": 42,
    "passed": 40,
    "failed": 2,
    "skipped": 0,
    "must_pass_failed": []
  },
  "lint": {
    "errors": 0,
    "warnings": 3
  },
  "coverage": {
    "lines": 88.4,
    "branches": 82.1,
    "functions": 91.0
  },
  "spec_compliance": {
    "must_satisfied": 6,
    "must_total": 6,
    "should_satisfied": 3,
    "should_total": 4,
    "unsatisfied_requirements": ["REQ-7"]
  }
}
```

### 13.4 Feedback Loop to Phase Planning

The score reports from competitive runs should feed back into the MaxsimCLI phase plan database:

- Tasks where all N agents are disqualified indicate a spec problem (requirements are too strict, tests are wrong, the task is under-scoped).
- Tasks where N=2 produces consistent high-scoring winners indicate the task could have been single-agent.
- Tasks where the winner's composite score is below 70 despite competitive selection indicate the task needs decomposition.

These signals inform future phase plan generation: tasks similar to historically hard ones get higher default N values; tasks similar to consistently easy ones get downgraded to single-agent.

---

## 14. Cost Analysis

### 14.1 The Naive Calculation

For N competitive agents each generating M tokens:

```
competitive_cost = N × M × price_per_token
```

For a single agent with R retries on failure:

```
retry_cost = (1 + R) × M × price_per_token
```

If `N = 1 + R` and all retries are triggered, the costs are equal. The question is whether competitive implementation produces better outcomes for the same budget.

### 14.2 Why Competitive is Cheaper Than Retries in Practice

**Retries have superlinear token growth.** Each retry in a single-agent context appends the failure to the context window. By the third retry, the context includes the original prompt plus two failed attempts plus error messages. Input tokens (which are charged at reading) grow with each retry, often doubling or tripling the effective cost.

**Retries are sequential.** The wall-clock time for 3 retries is at least 3× the time for a single attempt. Competitive agents run in parallel; wall-clock time is approximately 1× (the time of the slowest agent).

**Retries anchor on the wrong approach.** A retry that fails for structural reasons (the approach is wrong) does not recover; it consumes tokens until it hits a retry limit. Competitive agents do not share this failure mode.

Empirical data from multi-agent LLM research shows that retry loops are a "major driver of cost where failed tool calls trigger repeated LLM invocations," while parallel multi-agent approaches with proper isolation can be more cost-effective even at 3–5× the token budget of a single attempt.

### 14.3 Concrete Cost Model

Assumptions:
- Task requires ~40,000 output tokens per agent (medium-complexity feature)
- Model: claude-sonnet-4-6 (used in this environment)
- Price: approximate industry rates as of early 2026
- Single-agent retry: 30% first-pass success rate on medium-complexity tasks (failure requires retry)
- Expected retries on failure: 2.3 (empirical for the task class)

**Single-agent with retries (medium complexity, 30% first-pass rate):**
```
Expected cost = (0.30 × 1 + 0.70 × 3.3) attempts × base_cost
              = (0.30 + 2.31) × base_cost
              = 2.61 × base_cost
```
(With context growth on retries, actual token cost is 1.4–1.8× this.)

**N=3 competitive:**
```
Cost = 3 × base_cost
```

**Quality difference:** N=3 competitive with 30% per-agent pass rate yields ~65.7% of runs producing at least one passing implementation, versus the retry chain that also eventually succeeds but at the cost of accumulated context drift, sequential time, and degraded output quality.

For tasks with p > 0.6 per agent, N=3 competitive nearly always produces a winner (>93.6% of runs) with deterministic, parallel execution and no context contamination.

### 14.4 When Cost is Prohibitive

For very long-context tasks (full-file rewrites, large refactors) where M is very large, N=5 becomes expensive. In these cases:

1. Use N=2 as the minimum competitive run.
2. Structure the task to reduce per-agent token consumption (provide more context upfront, narrow the scope).
3. Use the hybrid strategy (Section 15): competitive for the first pass, focused retries on the winner only.

### 14.5 Cost vs Quality Summary

| Strategy | Relative cost | Expected quality | Wall-clock time |
|---|---|---|---|
| Single agent, no retry | 1× | Low (high variance) | 1× |
| Single agent, 2 retries | ~3–4× (with context growth) | Medium | 3× |
| N=2 competitive | 2× | Medium-high | 1× (parallel) |
| N=3 competitive | 3× | High | 1× (parallel) |
| N=5 competitive | 5× | Very high | 1× (parallel) |
| N=3 competitive + hybrid retry | 3.5–4× | Very high | 1.3× |

---

## 15. Hybrid Strategy

### 15.1 Overview

The hybrid strategy applies competitive implementation for the first attempt, then focuses retries exclusively on the winner. This combines the variance-reduction benefit of competitive selection with the efficiency of targeted refinement.

### 15.2 Phase 1: Competitive Selection

Run N agents in parallel. Score and rank. Select the winner. If the winner's composite score is ≥ 90, the task is complete. If the winner's composite score is between 70 and 90, proceed to Phase 2.

### 15.3 Phase 2: Focused Retry on the Winner

The winner's implementation is the starting point for Phase 2. A single focused agent is given:

1. The winner's full implementation as context.
2. The specific failing tests or lint errors (the delta from a perfect score).
3. A targeted prompt: "The implementation is 87% complete. The following specific issues remain: [list]. Fix only these issues without changing passing behavior."

This is fundamentally different from a cold retry. The agent is not starting from scratch; it is refining a known-good implementation. The context is clean and focused.

### 15.4 Phase 2 Termination

Phase 2 runs at most 2 focused retry attempts. If the score after Phase 2 retries is:
- ≥ 90: Accept and merge.
- 80–89: Accept with flagging for human review.
- < 80: Escalate to human. The task requires decomposition or spec revision.

### 15.5 When to Skip Phase 2

If the winner's composite score after Phase 1 is ≥ 90, skip Phase 2. The overhead of a focused retry on an already-passing implementation is not justified.

If Phase 1 produces zero qualifying implementations (all disqualified), skip Phase 2 entirely. This signals a spec or tooling problem, not an implementation problem. Retrying will not help.

### 15.6 Hybrid Strategy Flow

```
START
  │
  ├─ N agents run in parallel (Phase 1)
  │
  ├─ All disqualified? → ESCALATE: spec/tooling problem
  │
  ├─ Winner score ≥ 90? → MERGE winner → END
  │
  ├─ Winner score 70–89?
  │    │
  │    └─ Phase 2: focused retry on winner (max 2 attempts)
  │         │
  │         ├─ Score ≥ 90? → MERGE → END
  │         ├─ Score 80–89? → MERGE with flag → END
  │         └─ Score < 80? → ESCALATE to human
  │
  └─ Winner score < 70? → ESCALATE: task needs decomposition
```

---

## 16. Reference Architecture

### 16.1 Component Diagram

```
MaxsimCLI Orchestrator
│
├── Phase Plan Parser
│   └── Reads task metadata (complexity, risk, critical flags)
│       → Determines N (0=single, 2/3/5=competitive)
│
├── Competitive Mode Controller
│   ├── Worktree Manager
│   │   ├── git worktree add × N
│   │   └── git worktree remove × N (cleanup)
│   │
│   ├── Prompt Builder
│   │   ├── Canonical prompt (from spec)
│   │   └── Variation prefix (per agent, from strategy table)
│   │
│   ├── Agent Launcher (parallel)
│   │   ├── Agent A → Worktree A → Branch competitive/<id>/a
│   │   ├── Agent B → Worktree B → Branch competitive/<id>/b
│   │   └── Agent C → Worktree C → Branch competitive/<id>/c
│   │
│   └── Result Collector
│       └── Waits for all agents to commit or timeout
│
├── Verification Runner (parallel × N)
│   ├── Build checker × N
│   ├── Test runner × N
│   ├── Lint runner × N
│   ├── Coverage collector × N
│   └── Spec compliance checker × N
│
├── Scoring Engine
│   ├── Disqualification pass
│   ├── Weighted composite score × N
│   ├── Tie-breaking logic
│   └── Score report generator
│
├── Merge Controller
│   ├── Winner selection
│   ├── git merge --no-ff
│   └── Score report archival
│
└── Cleanup Controller
    ├── Worktree removal × N
    └── Branch deletion × (N-1) losers
```

### 16.2 MaxsimCLI Configuration

The following configuration keys govern competitive mode behavior:

```yaml
competitive:
  enabled: true
  default_n: 3

  # Task conditions that trigger competitive mode
  triggers:
    complexity_high: true
    complexity_medium: false     # Use single agent for medium by default
    critical: true
    risk_high: true
    domain_new: true
    retry_count_exceeds: 1       # Escalate to competitive after 1 failed retry

  # N override per trigger combination
  n_overrides:
    critical_and_complexity_high: 5
    critical_only: 3
    complexity_high_only: 3

  # Scoring weights (must sum to 1.0)
  scoring:
    test_pass_rate: 0.35
    build_success: 0.15
    lint_score: 0.15
    code_coverage: 0.10
    spec_compliance: 0.15
    code_complexity: 0.05
    performance_benchmarks: 0.05

  # Hybrid strategy thresholds
  hybrid:
    enabled: true
    phase2_trigger_below: 90       # Score below this triggers Phase 2
    phase2_max_retries: 2
    escalate_below: 70             # Score below this escalates to human

  # Worktree configuration
  worktrees:
    base_path: ".worktrees"
    cleanup_on_success: true
    cleanup_on_failure: false      # Keep worktrees for debugging on failure
    archive_results: true
    results_path: ".competitive-results"
```

### 16.3 Invocation Examples

**Explicit competitive run (N=3):**
```
maxsim execute-phase --task auth-refresh-token --competitive --n=3
```

**Automatic competitive mode (determined from task tags):**
```
maxsim execute-phase --task auth-refresh-token
# → reads task metadata, determines N=3 from complexity:high tag
```

**Hybrid mode (explicit):**
```
maxsim execute-phase --task auth-refresh-token --competitive --n=3 --hybrid
```

**Dry run (shows what would happen without executing):**
```
maxsim execute-phase --task auth-refresh-token --competitive --dry-run
# → outputs: "Would run N=3 competitive implementation with variants a, b, c
#              Prompt variations: architectural, error-handling, chain-of-thought
#              Estimated cost: 3× base (~120k tokens total)"
```

---

## References

- [AlphaCode: Competition-Level Code Generation — Google DeepMind](https://deepmind.google/discover/blog/competitive-programming-with-alphacode/) — Source for large-scale sampling and clustering strategy
- [Competitive Programming with Large Reasoning Models — arXiv](https://arxiv.org/html/2502.06807v1) — OpenAI's approach to BoN in competitive programming
- [Best-of-N Sampling — Hugging Face TRL](https://huggingface.co/docs/trl/main/en/best_of_n) — Formal BoN definition and reward model integration
- [Arena-Lite: Tournament-Based LLM Evaluation — arXiv](https://arxiv.org/html/2411.01281v4) — Tournament selection applied to LLM ranking
- [Creative and Correct: Requesting Diverse Code Solutions — arXiv](https://arxiv.org/abs/2403.13259) — Prompt variation for diverse code generation
- [Prompting Diverse Ideas: Increasing AI Idea Variance — arXiv](https://arxiv.org/abs/2402.01727) — DiVeRSe prompting strategy
- [Git Worktrees for AI Coding: Run Multiple Agents in Parallel — DEV Community](https://dev.to/mashrulhaque/git-worktrees-for-ai-coding-run-multiple-agents-in-parallel-3pgb) — Practical worktree setup for parallel agents
- [How Git Worktrees Changed My AI Agent Workflow — Nx Blog](https://nx.dev/blog/git-worktrees-ai-agents) — Nx team's production experience with worktrees and AI agents
- [Git Worktrees: The Secret Weapon for Running Multiple AI Coding Agents — Medium](https://medium.com/@mabd.dev/git-worktrees-the-secret-weapon-for-running-multiple-ai-coding-agents-in-parallel-e9046451eb96) — Space efficiency and isolation benefits
- [Measuring AI Code Generation Quality — Walturn](https://www.walturn.com/insights/measuring-the-performance-of-ai-code-generation-a-practical-guide) — pass@k and code quality metrics
- [AI Code Quality Metrics — CodeIntelligently](https://codeintelligently.com/blog/ai-code-quality-metrics) — Comprehensive metric framework
- [Cyclomatic Complexity Guide — Sonar](https://www.sonarsource.com/resources/library/cyclomatic-complexity/) — Complexity scoring thresholds
- [BudgetMLAgent: Cost-Effective LLM Multi-Agent System — arXiv](https://arxiv.org/html/2411.07464v1) — Multi-agent cost analysis and cascade strategies
- [Parallelizing AI Coding Agents — AI Native Dev](https://ainativedev.io/news/how-to-parallelize-ai-coding-agents) — Parallel agent workflow patterns
- [Beyond Benchmarks: Parallel Execution Model Experimentation — Zencoder](https://zencoder.ai/blog/practical-model-experimentation-with-parallel-execution) — Cost and quality comparison of parallel vs serial execution
