# Core Principles

Seven universal principles for autonomous iteration, applicable to any task domain.

## 1. Constraint Equals Enabler

Autonomy succeeds through intentional constraint, not despite it. Bounded scope fits the agent context, fixed iteration cost enables rapid feedback, and a single mechanical metric eliminates ambiguity.

**Apply:** Before starting, define what files are in-scope, what the single metric is, and what the time budget per iteration is.

## 2. Separate Strategy from Tactics

Humans set direction. Agents execute iterations.

| Strategic (Human) | Tactical (Agent) |
|-------------------|------------------|
| "Improve page load speed" | "Lazy-load images, code-split routes" |
| "Increase test coverage" | "Add tests for uncovered edge cases" |
| "Refactor auth module" | "Extract middleware, simplify handlers" |

**Apply:** Get clear direction from the user. Then iterate autonomously on implementation.

## 3. Metrics Must Be Mechanical

If the agent cannot verify with a command, it cannot iterate autonomously. Valid metrics: tests pass/fail, benchmark time, coverage percentage, lighthouse score, file size, lines of code.

Anti-pattern: "Looks better", "probably improved", "seems cleaner" — these kill autonomous loops because there is no decision function.

**Apply:** Define the command that extracts the metric before starting.

## 4. Verification Must Be Fast

If verification takes longer than the work itself, incentives misalign.

| Fast (enables iteration) | Slow (kills iteration) |
|-------------------------|----------------------|
| Unit tests (seconds) | Full E2E suite (minutes) |
| Type check (seconds) | Manual QA (hours) |
| Lint check (instant) | Code review (async) |

**Apply:** Use the fastest verification that still catches real problems. Save slow verification for after the loop.

## 5. Iteration Cost Shapes Behavior

Cheap iteration leads to bold exploration and many experiments. Expensive iteration leads to conservative, few experiments.

**Apply:** Minimize iteration cost. Use fast tests, incremental builds, targeted verification. Every minute saved means more experiments run.

## 6. Git as Memory and Audit Trail

Every successful change is committed. This enables causality tracking (which change drove improvement), stacking wins (each commit builds on prior successes), pattern learning (the agent sees what worked in this codebase), and human review.

**Apply:** Commit before verify. Revert on failure. The agent reads its own git history to inform the next experiment.

Key commands every iteration:
- `git log --oneline -20` — see experiment sequence (kept vs reverted).
- `git diff HEAD~1` — inspect last kept change to understand why it worked.
- `git show <hash> --stat` — deep-dive a specific commit.

## 7. Honest Limitations

State what the system can and cannot do. If the agent hits a wall it cannot solve (missing permissions, external dependency, needs human judgment), it says so clearly instead of guessing.

**Apply:** At setup, explicitly state constraints.

## The Meta-Principle

Autonomy scales when scope is constrained, success is clarified, verification is mechanized, and agents optimize tactics while humans optimize strategy.
