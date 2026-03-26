# CLAUDE.md — The Definitive Guide for MaxsimCLI

> Comprehensive reference for generating, structuring, and maintaining CLAUDE.md files.
> Written for MaxsimCLI's `/maxsim:init` CLAUDE.md generation logic.

---

## Table of Contents

1. [What CLAUDE.md Is](#1-what-claudemd-is)
2. [Locations and Scoping](#2-locations-and-scoping)
3. [How CLAUDE.md Loads](#3-how-claudemd-loads)
4. [The 200-Line Limit](#4-the-200-line-limit)
5. [Import Syntax and Depth Limits](#5-import-syntax-and-depth-limits)
6. [CLAUDE.md vs .claude/rules/ vs Skills](#6-claudemd-vs-clauderules-vs-skills)
7. [What Information Helps Claude Most](#7-what-information-helps-claude-most)
8. [What to Avoid](#8-what-to-avoid)
9. [Path-Scoped Rules](#9-path-scoped-rules)
10. [CLAUDE.md for Monorepos](#10-claudemd-for-monorepos)
11. [CLAUDE.md and GitHub Integration](#11-claudemd-and-github-integration)
12. [CLAUDE.md and Skills/Agents](#12-claudemd-and-skillsagents)
13. [MaxsimCLI-Managed Project Structure](#13-maxsimcli-managed-project-structure)
14. [MaxsimCLI CLAUDE.md Template](#14-maxsimcli-claudemd-template)
15. [Keeping CLAUDE.md Updated](#15-keeping-claudemd-updated)
16. [Writing Effective Instructions](#16-writing-effective-instructions)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What CLAUDE.md Is

CLAUDE.md is Claude Code's **project memory file**. It is automatically read at the start of every session and loaded into the context window alongside every conversation. It is not enforced configuration — Claude treats it as context and follows it with high (but not absolute) reliability. The more specific and concise the instructions, the more consistently Claude follows them.

CLAUDE.md answers one question: **What does Claude need to know to work in this project without making mistakes?**

It is not a README. It is not documentation for humans. It is a living briefing document for Claude.

### What CLAUDE.md Is NOT

- A place for things Claude can discover by reading the code
- A replacement for linters, formatters, or type checkers
- A full architecture document
- A list of obvious best practices Claude already knows
- A permanent record — it must evolve with the project

---

## 2. Locations and Scoping

CLAUDE.md files can live in multiple locations. More specific locations take precedence over broader ones.

### Location Hierarchy

| Scope | Location | Shared With | Purpose |
|---|---|---|---|
| **Managed (org-wide)** | Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | All org users | Company-wide coding standards, compliance, security policies |
| **Project** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team (via source control) | Project architecture, conventions, shared workflows |
| **Personal (project)** | `./CLAUDE.local.md` | Just you | Local preferences, personal paths — auto-gitignored |
| **Personal (all projects)** | `~/.claude/CLAUDE.md` | Just you | Global tool preferences, personal style |
| **User-level rules** | `~/.claude/rules/*.md` | Just you | Personal defaults across all projects |

### Which File to Use

- `./CLAUDE.md` — The primary file. Commit it to git. Contains everything the whole team needs Claude to know.
- `./.claude/CLAUDE.md` — Equivalent to `./CLAUDE.md`. MaxsimCLI installs here to keep the project root clean.
- `~/.claude/CLAUDE.md` — Personal preferences that apply to ALL your projects. Keep it short.
- `./CLAUDE.local.md` — Personal overrides for this specific project. Gitignored automatically.

### MaxsimCLI Placement

MaxsimCLI installs its CLAUDE.md at `.claude/CLAUDE.md` and symlinks or copies it to the project root `CLAUDE.md`. This keeps the MaxsimCLI installation self-contained in `.claude/` while ensuring Claude Code picks it up at the project level.

---

## 3. How CLAUDE.md Loads

Understanding the load order prevents conflicts and missing context.

### Load Order

1. Claude Code walks **up** the directory tree from your working directory, loading every CLAUDE.md it finds along the way. If you run Claude Code from `packages/web/`, it loads `packages/web/CLAUDE.md`, then `packages/CLAUDE.md`, then the root `CLAUDE.md`.
2. CLAUDE.md files **above** the working directory are loaded in full at launch.
3. CLAUDE.md files in **subdirectories below** the working directory are loaded on demand — only when Claude reads files in those subdirectories.
4. `.claude/rules/*.md` files without `paths` frontmatter are loaded at launch with the same priority as `.claude/CLAUDE.md`.
5. `.claude/rules/*.md` files with `paths` frontmatter only load when Claude works on files matching those patterns.

### Priority Order (highest to lowest)

1. Your current message
2. CLAUDE.md (auto-included at session start)
3. Files you explicitly reference with `@` in your prompt
4. Earlier messages in the conversation

### Survival Through Compaction

When Claude Code runs `/compact` to manage context overflow, **CLAUDE.md fully survives**. After compaction, Claude re-reads CLAUDE.md from disk and re-injects it fresh. Instructions given only in chat do NOT survive compaction. This makes CLAUDE.md the only reliable place for persistent instructions.

---

## 4. The 200-Line Limit

**Target: under 200 lines per CLAUDE.md file.**

This is the single most important constraint. It derives from two realities:

1. **Context consumption**: CLAUDE.md is loaded into the context window on every session, consuming tokens alongside your conversation. Longer files leave less space for actual work.
2. **Adherence degradation**: Research shows Claude can follow approximately 150–200 instructions with reasonable consistency. Claude Code's system prompt already occupies ~50 of those slots. Your CLAUDE.md has roughly 150 slots. Bloated files cause Claude to ignore instructions.

### The Test for Every Line

Before keeping any line, ask: **"Would removing this cause Claude to make a mistake in this project?"**

If the answer is no, remove it. If Claude would do the right thing anyway without the instruction, the instruction wastes context and dilutes the ones that matter.

### What to Do When You Exceed 200 Lines

Split content across files using these strategies:

1. **Move topic-specific content to `.claude/rules/`** — rules load with the same priority as CLAUDE.md but are separated by concern.
2. **Use `@path/to/file` imports** — reference heavy reference documents from CLAUDE.md without embedding them.
3. **Use path-scoped rules** — content that only matters for certain file types doesn't need to be in the global CLAUDE.md.
4. **Delete ruthlessly** — if Claude already does it correctly without the instruction, delete it.

### Practical Size Targets

| File | Target | Hard Limit |
|---|---|---|
| Project CLAUDE.md | 80–120 lines | 200 lines |
| Any single `.claude/rules/` file | 50–150 lines | 200 lines |
| Personal `~/.claude/CLAUDE.md` | 30–60 lines | 100 lines |
| Imported reference files (`@path`) | unlimited | — |

---

## 5. Import Syntax and Depth Limits

### Syntax

Use `@path/to/file` anywhere in CLAUDE.md to import another file. The imported file's contents are expanded inline when CLAUDE.md loads.

```markdown
# CLAUDE.md

See @README for project overview and @package.json for available npm commands.

# Workflows
- Git workflow: @docs/git-workflow.md
- API conventions: @docs/api-conventions.md
```

### Path Resolution

- **Relative paths** resolve relative to the file containing the import, not the working directory.
- **Absolute paths** work as written.
- **Home directory paths** use `~`: `@~/.claude/my-personal-notes.md`

### Depth Limit

Imported files can recursively import other files. **Maximum depth: 5 hops.**

```
CLAUDE.md
  → @docs/architecture.md      (depth 1)
    → @docs/api-design.md      (depth 2)
      → @docs/error-codes.md   (depth 3)
        → @docs/http-spec.md   (depth 4)
          → @docs/status.md    (depth 5) ← maximum
```

Anything deeper than 5 levels is ignored. Design your import chains to stay within this limit.

### Security Notice

The first time Claude Code encounters external imports in a project, it shows an approval dialog listing the imported files. If the user declines, the imports stay disabled. This only happens once per project.

### When to Use Imports vs Rules

- Use **imports** for reference documents (README, package.json, API specs, architecture docs) that Claude should always have in context.
- Use **imports** for personal preferences you don't want to check into git (`@~/.claude/my-preferences.md`).
- Use **`.claude/rules/`** for topic-specific instructions that benefit from path-scoping or separation of concerns.

---

## 6. CLAUDE.md vs .claude/rules/ vs Skills

Understanding when to use each prevents duplication and context waste.

### Decision Matrix

| Content Type | Where It Goes | Why |
|---|---|---|
| Project identity, goals, GitHub links | `CLAUDE.md` | Every session needs this |
| Available commands (build, test, lint) | `CLAUDE.md` | Every session needs this |
| Core architectural decisions | `CLAUDE.md` | Every session needs this |
| Off-limits files or directories | `CLAUDE.md` | Non-negotiable global constraint |
| API-specific coding rules | `.claude/rules/api.md` with `paths: src/api/**` | Only needed when working on API files |
| Frontend component conventions | `.claude/rules/frontend.md` with `paths: src/components/**` | Only needed when working on components |
| Test writing conventions | `.claude/rules/testing.md` with `paths: **/*.test.*` | Only needed when writing tests |
| Commit conventions | `.claude/rules/commits.md` (no paths, always loaded) | Needed every session but separable |
| Security checklists | `.claude/rules/security.md` with `paths: src/auth/**` | Only needed for auth code |
| Reusable workflows (deploy, review, debug) | `.claude/skills/` | On-demand, not loaded every session |
| Project initialization workflows | `.claude/skills/` | Invoked explicitly, not background context |
| Cross-project personal preferences | `~/.claude/rules/` | Personal, not project-specific |

### The Key Distinction: Rules vs Skills

**Rules** (`.claude/rules/`) are always-on instructions. They load at session start (or when matching files are opened) and stay in context throughout the session. Use rules for standards, conventions, and constraints that apply to any work in that context.

**Skills** (`.claude/skills/`) are on-demand playbooks. They do not load into context unless invoked or matched by Claude's semantic understanding. Use skills for step-by-step workflows, specialized procedures, and cross-project patterns. Skills are the right choice for anything you don't need Claude to be aware of continuously.

**CLAUDE.md** is the minimal core. It contains only what Claude must know for every single task in this project, with no exceptions.

---

## 7. What Information Helps Claude Most

Listed in priority order. Put the highest-priority items in CLAUDE.md; the rest can go in rules or imported files.

### Tier 1 — CLAUDE.md Essential (put this here always)

**Project identity** — What is this project? One sentence. Without this, Claude may give generic advice not suited to the project's domain.

**Primary commands** — The exact commands to build, test, and lint. Not inferrable from package.json alone (which test runner? which flags? which order?).

```markdown
- Build: `pnpm build`
- Test: `pnpm test --run` (never use watch mode)
- Lint: `pnpm lint && pnpm typecheck`
```

**Architecture map** — Top-level directory roles. Without this, Claude explores blindly.

```markdown
- `src/api/` — Express route handlers
- `src/services/` — Business logic (no framework dependencies here)
- `src/db/` — Prisma schema and migration scripts
- `tests/` — Vitest tests, mirror the src/ structure
```

**Non-obvious conventions** — Things that differ from language/framework defaults.

```markdown
- Use named exports everywhere, no default exports
- All async functions must have explicit return types
- No `any` in TypeScript — use `unknown` and narrow it
```

**Hard constraints** — Files or patterns Claude must never modify.

```markdown
- Never modify `src/db/migrations/` — these are append-only
- Never commit secrets — check with `git diff --staged` before committing
```

**MaxsimCLI context** — If MaxsimCLI manages this project, Claude needs to know immediately.

### Tier 2 — Rules Files (separate by concern)

- Detailed code style rules for specific file types
- Testing conventions (mock strategy, assertion style, coverage requirements)
- Security requirements for sensitive subsystems
- API design patterns and error shapes

### Tier 3 — Imported Reference Documents (@imports)

- Full API specifications
- Database schema documentation
- Architecture decision records
- Dependency documentation

### Tier 4 — Skills (on-demand)

- Deployment procedures
- Database migration workflows
- PR review checklists
- Debug runbooks

---

## 8. What to Avoid

These are the most common CLAUDE.md mistakes, in order of damage caused.

### Over-Specification (Most Damaging)

A CLAUDE.md that says everything effectively says nothing. When every line competes for attention, Claude prioritizes unpredictably. **Every instruction added dilutes every existing instruction.**

Signs of over-specification:
- More than 200 lines
- Code style rules that a linter enforces (Claude shouldn't do a linter's job)
- Instructions Claude already follows by default (e.g., "write clean code")
- Step-by-step procedures that belong in skills
- Comprehensive API documentation

### Stale Information

CLAUDE.md that describes a project's old structure actively misleads Claude. A file listing `src/controllers/` that was refactored away six months ago causes Claude to look for nonexistent files.

Stale information is worse than no information. It creates confident-but-wrong behavior.

### Conflicting Instructions

If two rules in CLAUDE.md contradict each other, or if CLAUDE.md conflicts with a `.claude/rules/` file, Claude picks one arbitrarily. This is unpredictable and hard to debug.

Common conflicts to watch for:
- CLAUDE.md says "use tabs" and a rules file says "use spaces"
- Root CLAUDE.md says one thing and a package-level CLAUDE.md says another
- Auto-generated CLAUDE.md from `/init` contradicts manually written rules

Audit all CLAUDE.md files and rules files together. Run `/memory` in a session to see everything loaded.

### Generic Best Practices

"Write readable code," "use meaningful variable names," "add comments where helpful" — these waste context on things Claude already does. Every generic instruction displaces a project-specific one.

**Rule**: If the instruction would be equally valid in any project, it does not belong in this project's CLAUDE.md.

### Embedded Code Examples

Code examples in CLAUDE.md go stale fast. A function signature shown as an example breaks the moment the API changes. Reference specific files instead: "see `src/api/handlers/user.ts` for the standard handler pattern."

### Auto-Generated Without Review

`/init` generates a useful starting point. It is not a finished product. The generated file often includes:
- Obvious commands that Claude can discover
- Inferred conventions that are actually wrong
- Structural descriptions of directories Claude can read directly

After running `/init`, delete anything that passes the "would removing this cause a mistake?" test.

### Everything That Changes Frequently

If a piece of information changes monthly (dependency versions, API endpoints, configuration values), don't put it in CLAUDE.md. Point Claude to the authoritative source instead: "See `package.json` for current dependency versions."

---

## 9. Path-Scoped Rules

Path-scoped rules are the most powerful tool for keeping CLAUDE.md lean while giving Claude detailed context exactly when needed.

### How They Work

Place markdown files in `.claude/rules/`. Add YAML frontmatter with a `paths` field listing glob patterns. The rule only loads into context when Claude is working with files matching those patterns.

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Handler Rules

- All handlers must validate input with Zod before processing
- Return consistent error shapes: `{ error: string, code: number, details?: unknown }`
- Log all requests with a correlation ID from the request context
- Never return stack traces to the client
```

This rule does not consume context during frontend work, database migrations, or documentation edits. It activates precisely when editing API files.

### Rule Anatomy

```markdown
---
paths:
  - "src/components/**/*.tsx"
  - "src/hooks/**/*.ts"
---

# React Component Rules

[Instructions here — only loaded when editing matched files]
```

All frontmatter fields:

| Field | Required | Description |
|---|---|---|
| `paths` | No | Array of glob patterns. Omit for unconditional loading. |

Rules without `paths` frontmatter load at session start unconditionally, same priority as CLAUDE.md.

### Common Path Patterns

| Pattern | Matches |
|---|---|
| `src/api/**/*.ts` | All TypeScript files under `src/api/` |
| `**/*.test.ts` | All test files in any directory |
| `**/*.{ts,tsx}` | All TypeScript and TSX files |
| `src/components/*.tsx` | Direct children of components/, not subdirectories |
| `prisma/migrations/**` | Everything in migrations |
| `*.md` | Markdown files in the project root only |

### Recommended Rule Files for MaxsimCLI Projects

| File | Paths | Contains |
|---|---|---|
| `.claude/rules/testing.md` | `**/*.test.*`, `**/*.spec.*` | Test writing conventions, mock strategy, assertions |
| `.claude/rules/api.md` | `src/api/**`, `src/routes/**` | API design, validation, error shapes |
| `.claude/rules/frontend.md` | `src/components/**`, `src/pages/**` | Component patterns, styling approach |
| `.claude/rules/database.md` | `prisma/**`, `src/db/**` | Query patterns, migration rules, never-modify list |
| `.claude/rules/security.md` | `src/auth/**`, `src/middleware/**` | Security checklist, input validation, secret handling |
| `.claude/rules/commits.md` | _(no paths — always loaded)_ | Commit message format, atomic commits |

### Symlinks for Shared Rules

The `.claude/rules/` directory supports symlinks. Maintain company-wide or personal standards in one location and link them into projects:

```bash
ln -s ~/company-standards/security.md .claude/rules/security.md
ln -s ~/shared-claude-rules .claude/rules/shared
```

---

## 10. CLAUDE.md for Monorepos

Monorepos require CLAUDE.md at multiple levels. The load order is hierarchical and predictable.

### Load Behavior in Monorepos

When Claude Code runs from a package directory (e.g., `packages/web/`):

1. Loads `packages/web/CLAUDE.md` (package-level, most specific)
2. Loads `packages/CLAUDE.md` (intermediate, if it exists)
3. Loads root `CLAUDE.md` (org-level, most general)
4. Loads `packages/web/.claude/rules/*.md` (package rules)
5. Loads root `.claude/rules/*.md` (project-wide rules)

**Subdirectory CLAUDE.md files load on demand** — when Claude works in subdirectories below the working directory, their CLAUDE.md files are added to context as those directories are accessed.

### Recommended Structure

```
monorepo/
├── CLAUDE.md                    # Org-wide: monorepo commands, shared conventions
├── .claude/
│   └── rules/
│       ├── commits.md           # Commit conventions (all packages)
│       └── security.md          # Security requirements (all packages)
├── packages/
│   ├── web/
│   │   ├── CLAUDE.md            # Web package: Next.js patterns, component rules
│   │   └── .claude/
│   │       └── rules/
│   │           ├── components.md  # paths: src/components/**
│   │           └── api.md         # paths: src/app/api/**
│   └── api/
│       ├── CLAUDE.md            # API package: Express patterns, DB access
│       └── .claude/
│           └── rules/
│               └── routes.md      # paths: src/routes/**
```

### Root CLAUDE.md in a Monorepo

Focus on monorepo-specific concerns only:

```markdown
# ProjectName Monorepo

## Structure
- `packages/web/` — Next.js frontend (Vercel deployment)
- `packages/api/` — Express API (Railway deployment)
- `packages/shared/` — Shared types and utilities (not deployed)

## Commands (run from repo root)
- Install: `pnpm install`
- Build all: `pnpm build`
- Test all: `pnpm test`
- Test single package: `pnpm --filter @scope/package-name test`

## Cross-Package Rules
- Import shared types from `@scope/shared`, never copy-paste types between packages
- Breaking changes to `@scope/shared` require updating all consumers before merging
- All packages use the same TypeScript config from `tsconfig.base.json`
```

### Excluding Other Teams' CLAUDE.md Files

In large monorepos, ancestor CLAUDE.md files from unrelated teams may load automatically. Exclude them in `.claude/settings.local.json`:

```json
{
  "claudeMdExcludes": [
    "**/other-team/.claude/rules/**",
    "**/other-team/CLAUDE.md"
  ]
}
```

Patterns match against absolute file paths. Arrays merge across settings layers. Managed policy CLAUDE.md files cannot be excluded.

### Package-Level CLAUDE.md

Each package's CLAUDE.md should only contain what is unique to that package. Assume the root CLAUDE.md is already loaded.

```markdown
# packages/web

## Stack
- Next.js 15 App Router (not Pages Router)
- Tailwind CSS (utility-first, no custom CSS files)
- Radix UI primitives (see src/components/ui/)

## Commands
- Dev: `pnpm dev` (port 3000)
- Test: `pnpm test` (Vitest + Testing Library)

## Key Patterns
- Server Components by default; add 'use client' only when needed
- API calls go through `src/lib/api/` — never fetch directly from components
```

---

## 11. CLAUDE.md and GitHub Integration

CLAUDE.md is the bridge between Claude and your GitHub-based project state. It should tell Claude where to find authoritative information — not contain that information itself.

### Referencing GitHub as Source of Truth

For MaxsimCLI projects, GitHub holds all project state. CLAUDE.md should tell Claude this explicitly:

```markdown
## Project State
- GitHub Issues: active phases, tasks, blockers — always check before starting work
- GitHub Project Board: current status of all tasks
- GitHub Wiki: architecture decisions, requirements, team conventions
- GitHub Discussions: open design questions and proposals
```

This directs Claude to the right source rather than including stale information in CLAUDE.md itself.

### Linking to GitHub Wiki

The GitHub Wiki is the right place for documentation that changes frequently (API contracts, environment setup, deployment procedures). Reference it from CLAUDE.md:

```markdown
## Documentation
- Environment setup: [GitHub Wiki → Setup](https://github.com/org/repo/wiki/Setup)
- API design decisions: [GitHub Wiki → API](https://github.com/org/repo/wiki/API)
```

### GitHub Issues as Task Source

MaxsimCLI stores all plans, research, and context as GitHub Issue comments. CLAUDE.md should instruct Claude to read issues before starting any phase:

```markdown
## Before Starting Work
- Always check the current phase's GitHub Issue for the plan and context
- Sub-issues of the phase issue are the individual tasks
- Issue comments contain research, decisions, and prior context
```

### GitHub Actions Integration

If Claude Code runs in GitHub Actions (e.g., responding to `@claude` mentions in PRs), the CLAUDE.md in the repository applies automatically. This means your CLAUDE.md guides both interactive sessions and automated CI runs. Write instructions that work in both contexts — avoid instructions that assume an interactive terminal.

```markdown
## CI Behavior
- Claude Code runs in GitHub Actions for PR review when @claude is mentioned
- All instructions in this file apply to both interactive and CI contexts
- Never prompt for interactive input in automated workflows
```

### Importing from GitHub

CLAUDE.md can import files that are in the repository, which Claude Code resolves relative to the project root. You cannot import directly from GitHub URLs — import local files that are checked into the repo:

```markdown
# Import the OpenAPI spec that's checked in
API contract: @docs/openapi.yaml
```

---

## 12. CLAUDE.md and Skills/Agents

### How CLAUDE.md and Skills Interact

CLAUDE.md and skills are complementary, not competing. CLAUDE.md provides always-present context; skills provide on-demand playbooks.

**Skill descriptions are loaded into context** so Claude knows what's available — but the full skill content only loads when the skill is invoked. This makes skills far more context-efficient than embedding their content in CLAUDE.md.

Key behaviors:
- CLAUDE.md loads at every session start, unconditionally
- Skills load on-demand when invoked (`/skill-name`) or when Claude's semantic matching decides they're relevant
- Both CLAUDE.md and skills are loaded when a skill runs in a subagent (`context: fork`)
- Agent definitions can preload specific skills at startup

### What Goes in CLAUDE.md vs Skills

**Put in CLAUDE.md:**
- The fact that specific skills exist and when to reach for them
- A brief pointer to the most important skills

**Put in skills:**
- Step-by-step procedures (deploy, migrate, debug)
- Complex workflows with multiple phases
- Reference material that only matters for specific tasks
- Cross-project patterns

Example CLAUDE.md pointer to skills:
```markdown
## Available Skills
- `/maxsim:go` — Auto-detect project state and execute the right next action
- `/debug` — Systematic debugging workflow (use when tests fail or errors appear)
- `/code-review` — Full security + quality review before PRs
```

### Agent Definitions and CLAUDE.md

When MaxsimCLI spawns a subagent (Executor, Planner, Researcher, Verifier), the agent runs in a forked context. Both the agent's own definition and the project CLAUDE.md are loaded into that context. This means:

1. Write CLAUDE.md instructions that apply to agents, not just humans
2. Agent-facing instructions (commit format, evidence blocks, verification protocol) belong in CLAUDE.md or rules files — not only in agent definitions
3. Keep agent definitions focused on their role; rely on CLAUDE.md for project-wide standards

### Skills Referencing CLAUDE.md

Skills do not explicitly import CLAUDE.md — it is already in context when a skill runs. A skill can reference instructions from CLAUDE.md without repeating them:

```markdown
# index.md for deployment skill

Deploy following the project commit conventions (see CLAUDE.md) and the
verification protocol (see .claude/rules/verification-protocol.md).
```

---

## 13. MaxsimCLI-Managed Project Structure

For projects managed by MaxsimCLI, the full context structure is:

```
project-root/
├── CLAUDE.md                          # Auto-generated by /maxsim:init
│                                      # Brief: project name, MaxsimCLI info,
│                                      # GitHub links, commands, key conventions
└── .claude/
    ├── CLAUDE.md                      # Same content (symlink or copy of root)
    ├── settings.json                  # Claude Code settings (hooks, permissions)
    ├── settings.local.json            # Local overrides (gitignored)
    ├── rules/
    │   ├── conventions.md             # Commit conventions, file naming (always loaded)
    │   └── verification-protocol.md  # Evidence blocks, hard gates (always loaded)
    ├── skills/
    │   └── maxsim/                    # MaxsimCLI skill modules
    ├── agents/
    │   ├── executor.md
    │   ├── planner.md
    │   ├── researcher.md
    │   └── verifier.md
    └── agent-memory/                  # Auto-created per-agent persistent memory
```

### What MaxsimCLI's CLAUDE.md Does NOT Contain

- Phase plans (these live as GitHub Issues)
- Project state (this lives on the GitHub Project Board)
- Roadmap (this lives as GitHub Milestones)
- Task context (this lives as GitHub Issue comments)
- Architecture decisions (these live in the GitHub Wiki)

The project CLAUDE.md is intentionally minimal. All dynamic project information lives on GitHub.

---

## 14. MaxsimCLI CLAUDE.md Template

This is the template `/maxsim:init` uses to generate CLAUDE.md for managed projects. Variables in `{{double_braces}}` are filled during init.

```markdown
# {{project_name}}

{{project_description_one_sentence}}

## MaxsimCLI

This project is managed by MaxsimCLI. Use `/maxsim:go` to pick up where the project left off.

| Resource | Link |
|---|---|
| Project Board | {{github_project_url}} |
| Issues | {{github_issues_url}} |
| Wiki | {{github_wiki_url}} |

Current phase: check the Project Board. Plans and context live in GitHub Issue comments.

## Commands

```bash
{{build_command}}       # Build
{{test_command}}        # Run tests
{{lint_command}}        # Lint + typecheck
{{dev_command}}         # Start dev server (if applicable)
```

## Architecture

{{architecture_map}}

## Key Conventions

{{non_obvious_conventions}}

## Constraints

{{hard_constraints}}

## Available MaxsimCLI Commands

- `/maxsim:go` — Auto-detect state and execute next action (primary interface)
- `/maxsim:plan [N]` — Plan a specific phase
- `/maxsim:execute [N]` — Execute a planned phase
- `/maxsim:quick [desc]` — Quick task (no multi-phase overhead)
- `/maxsim:debug [desc]` — Systematic debugging
- `/maxsim:progress` — Show project status
- `/maxsim:help` — List all commands
```

### Template Filling Guidelines for `/maxsim:init`

| Variable | Source | Notes |
|---|---|---|
| `project_name` | User interview or README | Single line, the real project name |
| `project_description_one_sentence` | User interview or README | One sentence max. No adjectives like "powerful" or "robust". |
| `github_project_url` | GitHub API after project creation | Full URL |
| `github_issues_url` | GitHub repo URL + `/issues` | Full URL |
| `github_wiki_url` | GitHub repo URL + `/wiki` | Full URL |
| `build_command` | package.json scripts or discovered via research | Exact command with flags |
| `test_command` | package.json scripts or discovered | Include flags that matter (e.g., `--run` to disable watch) |
| `lint_command` | package.json scripts or discovered | Combine lint + typecheck if separate |
| `dev_command` | package.json scripts or `null` | Omit section if not applicable |
| `architecture_map` | Parallel research agents scan | Max 8 bullets. Directory → one-line description. |
| `non_obvious_conventions` | User interview + code scan | Only list things that differ from defaults |
| `hard_constraints` | User interview | Files never to modify, patterns never to use |

### Section Omission Rules

- Omit `dev_command` section if not a web/app project (library, CLI tool, etc.)
- Omit `Constraints` section if user provides none — do not fill with generic "best practices"
- Omit `Key Conventions` section if the project uses all defaults — do not fill with language defaults
- Never include sections that are empty or placeholder text

### Size Budget for Generated CLAUDE.md

| Section | Budget |
|---|---|
| Header (project name + description) | 3 lines |
| MaxsimCLI block (commands + GitHub links) | 15 lines |
| Commands block | 6 lines |
| Architecture map | max 10 lines |
| Key Conventions | max 8 lines |
| Constraints | max 6 lines |
| Available MaxsimCLI Commands | 9 lines |
| **Total** | **~57 lines** |

The generated CLAUDE.md should be approximately 50–70 lines. This leaves ample room for growth and user additions. The MaxsimCLI rules files (conventions.md, verification-protocol.md) handle the rest.

---

## 15. Keeping CLAUDE.md Updated

CLAUDE.md rots faster than code. Stale instructions are actively harmful.

### The Compounding Engineering Model

Every time Claude makes a mistake that shouldn't happen again, add a note to CLAUDE.md (or the appropriate rules file). This is called "compounding engineering" — each correction becomes permanent context, so Claude never makes that class of error again.

The correction cycle:
1. Claude makes a mistake
2. Identify whether this mistake would recur without instruction
3. If yes: add the specific corrective instruction to the right file
4. If a linter/hook could prevent it instead: add the tool, not the instruction

### When to Update CLAUDE.md

| Trigger | Action |
|---|---|
| New command added (build, test, deploy) | Update Commands section |
| Directory structure refactor | Update Architecture map |
| New convention established | Add to Conventions (if non-obvious) |
| Convention removed or changed | Remove or update the old entry |
| New hard constraint discovered | Add to Constraints |
| Claude repeatedly makes the same mistake | Add corrective instruction |
| A convention now has a linter rule | Remove from CLAUDE.md (the linter handles it) |
| New MaxsimCLI skill added | Add pointer if users should know about it |
| GitHub Project URL changes | Update links |

### Auditing CLAUDE.md

Run `/memory` in a Claude Code session to see all CLAUDE.md and rules files currently loaded. This is the audit view — use it to identify:
- Files that shouldn't be loading (wrong paths or wrong project)
- Instructions that are now redundant with linter rules
- Instructions that contradict each other across files

Schedule a CLAUDE.md audit at the end of each major phase or milestone.

### Using Auto Memory Alongside CLAUDE.md

Claude Code's auto memory (`~/.claude/projects/<project>/memory/MEMORY.md`) captures learnings Claude discovers during sessions. The first 200 lines of MEMORY.md load at every session start.

Auto memory and CLAUDE.md are complementary:
- CLAUDE.md: human-written, team-shared, committed to git
- Auto memory: Claude-written, machine-local, per-developer

For MaxsimCLI projects, auto memory captures debugging insights, discovered conventions, and workflow habits that don't need to be in the team-shared CLAUDE.md.

### Version Controlling CLAUDE.md

Always commit CLAUDE.md to git. This enables:
- Team contributions via PR review
- History of when conventions changed and why
- Revert if a change causes regressions
- Diffing to understand what Claude has been told over time

Write CLAUDE.md changes like code changes — commit messages, diffs, and review.

---

## 16. Writing Effective Instructions

Specific, verifiable instructions work better than vague guidance.

### The Specificity Test

| Instead of... | Write... |
|---|---|
| "Format code properly" | "Use 2-space indentation. Run `pnpm lint` to verify." |
| "Test your changes" | "Run `pnpm test --run` before every commit. All tests must pass." |
| "Keep files organized" | "API handlers live in `src/api/handlers/`. One handler per file." |
| "Use proper error handling" | "Return `{ error: string, code: number }` from all API handlers." |
| "Write good commit messages" | "Use conventional commits: `type(scope): description`. See `conventions.md`." |

### Instruction Structure

Use markdown headers and bullets. Claude scans structure the same way readers do — organized sections are easier to follow than dense paragraphs.

**Good structure:**
```markdown
## Commands
- Build: `pnpm build`
- Test: `pnpm test --run`

## Architecture
- `src/api/` — Route handlers (Express)
- `src/services/` — Business logic (no framework deps)
```

**Poor structure:**
```markdown
You should use pnpm build to build and pnpm test --run to test. The src/api directory has route handlers and the src/services directory has business logic and should not have framework dependencies.
```

### Negative Instructions

Tell Claude what NOT to do when the default behavior would be wrong:

```markdown
- Never modify files in `src/db/migrations/` — these are append-only
- Never use `any` in TypeScript — use `unknown` and narrow with type guards
- Never import from `src/services/` in route handlers — use the service layer only through controllers
```

### Behavioral Instructions vs Enforcement

CLAUDE.md is context, not enforcement. For true enforcement:
- Use linters for code style
- Use hooks to run linters automatically after edits
- Use TypeScript strict mode for type safety
- Use git hooks for pre-commit checks

Reserve CLAUDE.md instructions for behaviors that tools cannot enforce: architectural decisions, workflow steps, non-obvious patterns.

---

## 17. Troubleshooting

### Claude Is Not Following CLAUDE.md Instructions

1. Run `/memory` to verify your CLAUDE.md files are loaded. If a file isn't listed, Claude cannot see it.
2. Check that the file is in a location that loads for your session (see Section 2).
3. Make instructions more specific — vague instructions are ignored before specific ones.
4. Check for conflicting instructions across files. Use `/memory` to see all loaded files and audit for contradictions.
5. Check if the file exceeds 200 lines — over-long files reduce adherence.

### Instructions Disappear After Compaction

CLAUDE.md survives `/compact`. If an instruction disappeared after compaction, it was given only in conversation, not written to CLAUDE.md. Add it to CLAUDE.md.

### Path-Scoped Rule Not Triggering

1. Verify the file path glob pattern matches the actual file path being edited.
2. Use the `InstructionsLoaded` hook to log exactly which files load and when.
3. Check for YAML frontmatter syntax errors — invalid YAML causes the rule to be treated as unconditional.

### Too Many Files Loading in Monorepo

Use `claudeMdExcludes` in `.claude/settings.local.json` to exclude specific files:

```json
{
  "claudeMdExcludes": [
    "**/other-team/CLAUDE.md",
    "**/other-team/.claude/rules/**"
  ]
}
```

### CLAUDE.md Too Long

1. Delete everything Claude does correctly without being told.
2. Move topic-specific sections to `.claude/rules/` files.
3. Add `paths` frontmatter to rules that only apply to certain file types.
4. Move heavy reference content to separate files and import with `@path`.
5. Move step-by-step procedures to skills.

### Conflicting Instructions Across Files

Run `/memory` during a session to see all loaded files. Open each file and check for contradictions. Resolve by choosing one authoritative location per rule and removing duplicates. More specific file locations (package-level, path-scoped rules) take precedence over general ones (root CLAUDE.md).

---

## Summary: MaxsimCLI CLAUDE.md Generation Decision Tree

```
/maxsim:init generates CLAUDE.md:
│
├─ Scan project with research agents
│   └─ Identify: tech stack, commands, structure, conventions
│
├─ Interview user:
│   └─ Confirm/correct discovered info
│   └─ Add non-obvious conventions
│   └─ Add hard constraints
│
├─ Generate CLAUDE.md (target: 50-70 lines):
│   ├─ Project identity (name + one-sentence description)
│   ├─ MaxsimCLI block (commands + GitHub links)
│   ├─ Commands (build, test, lint, dev)
│   ├─ Architecture map (directories + roles, max 8 items)
│   ├─ Key conventions (non-obvious only, max 8 items)
│   └─ Constraints (hard rules only, max 6 items)
│
├─ Install rules files:
│   ├─ .claude/rules/conventions.md (commits, file naming — always loaded)
│   └─ .claude/rules/verification-protocol.md (evidence blocks, hard gates)
│
└─ As project evolves:
    ├─ Mistakes → add corrective instructions
    ├─ Refactors → update architecture map
    ├─ New linter rules → remove from CLAUDE.md
    └─ Audits at each milestone
```

---

*Sources: Anthropic Claude Code documentation (code.claude.com/docs/en/memory, code.claude.com/docs/en/skills), Anthropic course material (Claude Code in Action), community research from HumanLayer, Builder.io, ClaudeFast, MorphLLM, and Rick Hightower (Medium). Research conducted March 2026.*
