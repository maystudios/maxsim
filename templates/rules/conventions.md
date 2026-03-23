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
| `fix!(scope):` / `feat!(scope):` | Breaking change |

Scope reflects the area of change: `fix(install):`, `feat(phase-04):`, `refactor(core):`.

Atomic commits: one logical change per commit. Do not bundle unrelated changes.

Co-author line when AI-assisted: `Co-Authored-By: Claude <noreply@anthropic.com>`

## File Naming

| Type | Path Pattern |
|------|-------------|
| Skills | `.claude/skills/<kebab-case>/SKILL.md` |
| Agents | `.claude/agents/<simple-name>.md` |
| Rules | `.claude/rules/<topic>.md` |
| Plans | `phases/{phase}-{name}/{phase}-{plan}-PLAN.md` |

Use kebab-case for directory names. Use UPPER_CASE for protocol files (SKILL.md, PLAN.md, STATE.md).

## Code Style

- Follow the project CLAUDE.md for language-specific conventions
- TypeScript: async-only functions (no sync duplicates)
- Markdown: ATX headers (`#`), no trailing whitespace, blank line before headers
- Keep files focused: one responsibility per module

## Deferred Items

When encountering work outside current scope, log it instead of implementing it:

```
- [{category}] {description} -- {why deferred}
```

Categories: `feature`, `bug`, `refactor`, `investigation`
