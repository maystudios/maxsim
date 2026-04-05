# MAXSIM Conventions

These conventions apply to all MAXSIM-managed work. Follow them alongside project-specific CLAUDE.md conventions.

## Commit Messages

Use conventional commits with scope:

| Prefix | When |
|--------|------|
| `fix(scope):` | Bug fix |
| `feat(scope):` | New feature |
| `chore(scope):` | Build, deps, maintenance |
| `docs(scope):` | Documentation only |
| `test(scope):` | Adding or fixing tests |
| `refactor(scope):` | Neither fix nor feature |
| `style(scope):` | Formatting, whitespace, no logic change |
| `perf(scope):` | Performance improvement |
| `ci(scope):` | CI/CD pipeline changes |
| `fix!(scope):` / `feat!(scope):` | Breaking change |

Scope reflects the area of change: `fix(install):`, `feat(phase-04):`, `refactor(core):`.

Atomic commits: one logical change per commit. Do not bundle unrelated changes.

Co-author line when AI-assisted: value comes from the `co_author` key in `.claude/maxsim/config.json` (default: `Co-Authored-By: Claude <noreply@anthropic.com>`).

## File Naming

| Type | Path Pattern |
|------|-------------|
| Skills | `.claude/skills/<kebab-case>/SKILL.md` |
| Agents | `.claude/agents/<simple-name>.md` |
| Rules | `.claude/rules/<topic>.md` |
| Plans | GitHub Sub-Issues on the phase Issue |

Use kebab-case for directory names. Use UPPER_CASE for protocol files (AGENTS.md).

## Code Style

- Follow the project CLAUDE.md for language-specific conventions
- TypeScript: async-only functions (no sync duplicates)
- Markdown: ATX headers (`#`), no trailing whitespace, blank line before headers
- Keep files focused: one responsibility per module

## Anthropic Conformity

- Tool name is `Agent` (NOT `Task`).
- YAML frontmatter: `name` and `description` are required fields.
- Skill descriptions use third-person voice (e.g., "Runs verification..." not "Run verification...").
- No `@` imports inside skill files.
- Planner agents set `permissionMode: plan`.

## Maximum Parallelism

Use as many parallel agents as the task allows. When 3 or more independent units of work exist, prefer batch execution over sequential execution. Idle agents are wasted throughput.

## Full Automation

Commits, merges, and pushes happen automatically as part of execution — no manual git steps. Human gates are limited to discussion threads and plan approval (`ExitPlanMode`) ONLY. Everything else runs unattended. The `auto_advance` workflow setting (default: `true`) controls whether execution proceeds automatically between waves without waiting for user confirmation.

## Verification Model

MaxsimCLI uses a 2-gate verification model. All verification passes through these gates in order:

| Gate | Name | When | What it checks |
|------|------|------|----------------|
| 1 | Pre-Check | Before execution begins | Spec exists, acceptance criteria stated, git clean, deps installed |
| 2 | Post-Check | After implementation, before done | Tests pass, build exits 0, lint clean, all criteria addressed, no regressions |

Verification is continuous — the executor verifies after each task, not in a separate phase after all tasks complete. The orchestrator may also run per-wave verification between execution waves.

**Retry escalation:** Quick Fix (attempt 1) -> Deeper Analysis (attempt 2, fresh agent) -> Codex Rescue (attempt 3, alternate model). After 3 failures, auto-reopen the GitHub Issue with a diagnostic comment.

**Profiles:** Three verification profiles control strictness:

| Profile | Gates | Code Review | GUARD Check |
|---------|-------|-------------|-------------|
| strict | Both (Pre-Check + Post-Check) | Required | Required |
| standard | Both (Pre-Check + Post-Check) | Optional | Required |
| fast | Post-Check only | No | Recommended |

Default profile: `standard`. Set via `config.execution.verification.verification_profile`.

## GitHub-First

GitHub is the single source of truth. No local `.planning/` directory. All state lives on GitHub Issues, Projects, Milestones, and Wiki.

## Plan Mode

Every MaxsimCLI command starts in Plan Mode (`EnterPlanMode`). The user approves the plan via `ExitPlanMode` before any execution begins. Exempt commands that skip Plan Mode: `security`, `progress`, `help`.

## Deferred Items

When encountering work outside current scope, log it instead of implementing it:

```
- [{category}] {description} -- {why deferred}
```

Categories: `feature`, `bug`, `refactor`, `investigation`, `improvement`
