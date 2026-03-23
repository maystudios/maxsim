---
name: commit-conventions
description: >-
  Enforces conventional commit format with atomic changes and co-author
  attribution. Use when committing code changes to maintain consistent git
  history.
---

# Commit Conventions

Consistent commit messages enable automated versioning, changelogs, and clear project history. Every commit follows this format.

## Format

```
type(scope): description

- key change 1
- key change 2

Co-Authored-By: Claude <noreply@anthropic.com>
```

Subject line under 72 characters. Body bullet points are optional for trivial commits. Co-author line always present for AI-assisted work.

## Types

| Type | When to Use | Version Impact |
|------|-------------|---------------|
| `feat` | New feature or capability | Minor bump |
| `fix` | Bug fix | Patch bump |
| `refactor` | Code restructure with no behavior change | No bump |
| `test` | Adding or correcting tests | No bump |
| `docs` | Documentation only | No bump |
| `chore` | Build, deps, config, tooling, maintenance | No bump |
| `style` | Formatting, whitespace, no logic change | No bump |
| `perf` | Performance improvement | No bump |
| `ci` | CI/CD pipeline changes | No bump |

## Breaking Changes

Append `!` after the type for breaking changes:

```
feat!(api): require authentication on all endpoints
fix!(config): rename model_profile to profile
```

Breaking changes trigger a major version bump. Always explain what breaks and the migration path in the commit body.

## Scope

Scope identifies the affected area:

- Module or package: `fix(install):`, `refactor(core):`
- Component: `feat(dashboard):`, `test(cli):`
- Phase work: `feat(04-01):`, `fix(phase-04):`

Scope is required when the change is not project-wide.

## Atomic Commits

One logical change per commit. The diff and message should describe a single coherent unit of work.

Do:
- Separate feature implementation from test additions
- Commit each task in a plan individually
- Commit a refactor separately from a bug fix found during refactor

Do not:
- Bundle unrelated changes in one commit
- Mix "fix typo" with feature work
- Commit "work in progress" or partial implementations

## Co-Author Attribution

All AI-assisted commits include the co-author line:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| `fix: fixed stuff` | `fix(auth): handle expired token on refresh` |
| `update things` | Missing type prefix entirely -- add `chore:` or appropriate type |
| `feat: add feature and also fix bug` | Two commits: one `feat`, one `fix` |
| `WIP` | Never commit WIP to main; finish the unit of work |
| Past tense: "added validation" | Imperative mood: "add validation" |

## Examples

```
feat(api): add rate limiting to public endpoints

- Default: 100 requests per minute per IP
- Configurable via RATE_LIMIT_RPM env var
- Returns 429 with Retry-After header

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix(install): resolve path resolution failure on Windows

Co-Authored-By: Claude <noreply@anthropic.com>
```
