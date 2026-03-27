# Agent Teams Patterns (Tier 2) — Reference

This file contains the full Tier 2 Agent Teams patterns extracted from the `maxsim-batch` skill. For executable workflow details, see the `agent-teams` skill.

## Tier Selection Logic

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

## Graceful Degradation Rules

If Agent Teams are unavailable (env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. Inform the user with this exact message:

> "Competitive mode: using Tier 1 subagents (Agent Teams not available or not required for this strategy). Each executor works independently; verifier selects the best result."

The user is informed but not blocked. All workflows remain fully functional via Tier 1. Each pattern includes a specific Tier 1 fallback that preserves the core workflow (parallel execution + verifier selection) without inter-agent messaging.

### Per-Pattern Tier 1 Fallbacks

**Competitive Implementation:** Spawn 2 independent executor subagents via `Agent(isolation: "worktree", run_in_background: true)` with different approach prompts. After both complete, spawn a verifier to compare. No inter-agent messaging -- the verifier reads both outputs directly.

**Multi-Reviewer Code Review:** Spawn 3 independent reviewer subagents via `Agent(run_in_background: true)`. Each produces its own report. The orchestrator merges reports manually -- no cross-checking between reviewers. Less thorough but fully functional.

**Collaborative Debugging:** Spawn 2-3 independent debugging subagents via `Agent(isolation: "worktree", run_in_background: true)`. Each investigates a different hypothesis and reports findings. The orchestrator compares reports without inter-agent debate. Less adversarial but still tests multiple hypotheses in parallel.
