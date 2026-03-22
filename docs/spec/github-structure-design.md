# GitHub Structure Design for MaxsimCLI

> **Purpose:** Authoritative reference for how MaxsimCLI uses GitHub as its single source of truth.
> Every GitHub artifact — Issues, Projects, Milestones, Labels, Wiki, Discussions — is specified here.
> The implementation in `packages/cli/src/github/` must conform to this document.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Project Board Design](#2-project-board-design)
3. [Issue Hierarchy](#3-issue-hierarchy)
4. [Issue Title Conventions](#4-issue-title-conventions)
5. [Issue Body Structure](#5-issue-body-structure)
6. [Comment Conventions](#6-comment-conventions)
7. [HTML Comment Markers](#7-html-comment-markers)
8. [Label Taxonomy](#8-label-taxonomy)
9. [Milestone Structure](#9-milestone-structure)
10. [Issue Dependencies](#10-issue-dependencies)
11. [User-Created Issues](#11-user-created-issues)
12. [Project Overview Pinned Issue](#12-project-overview-pinned-issue)
13. [GitHub Wiki Structure](#13-github-wiki-structure)
14. [GitHub Discussions (ADRs)](#14-github-discussions-adrs)
15. [GitHub Actions Automation](#15-github-actions-automation)
16. [GraphQL Query Patterns](#16-graphql-query-patterns)
17. [Rate Limiting Strategy](#17-rate-limiting-strategy)
18. [Roadmap as Milestones](#18-roadmap-as-milestones)
19. [Querying Project State](#19-querying-project-state)
20. [IssueOps Patterns](#20-issueops-patterns)

---

## 1. Design Philosophy

MaxsimCLI treats GitHub as its **exclusive** persistence layer. There are no local planning files, no local state, no sync mechanisms. The GitHub Project Board IS the project state. Closing an issue IS completing a task. The milestone completion percentage IS the roadmap progress.

This design has three requirements:

1. **Machine-readable** — Every artifact must be parseable by MaxsimCLI automation without ambiguity. Structured HTML comments, consistent title conventions, and typed fields make this possible.
2. **Human-readable** — The same artifacts must be immediately useful to a developer browsing GitHub. Structured data must not obscure human-readable content.
3. **Authoritative** — Any conflict between a local file and GitHub is resolved in GitHub's favor. MaxsimCLI never maintains a local copy of project state.

### What Goes Where

| Information Type | GitHub Location |
|-----------------|-----------------|
| Project roadmap | Milestones |
| Phase definition | Phase Issue (Issue Type: Feature) |
| Task breakdown | Sub-issues of the Phase Issue |
| Plan details | Structured comment on Phase Issue |
| Research findings | Structured comment on Phase Issue or Task |
| Execution context | Structured comment on Task sub-issue |
| Verification results | Structured comment on Task sub-issue |
| Session summaries | Structured comment on Phase Issue |
| Architecture decisions | GitHub Discussions |
| Project conventions | GitHub Wiki |
| User-visible progress | GitHub Projects v2 Board |

---

## 2. Project Board Design

### 2.1 Board Identity

Each MaxsimCLI-managed project gets **one** GitHub Projects v2 board, created during `/maxsim:init`.

- **Name:** `{Project Name} — MaxsimCLI`
- **Description:** Brief project description + link to Project Overview issue
- **Visibility:** Private by default (configurable to public for open-source projects)

### 2.2 Status Column Definitions

The board uses a **Status** single-select field as the column grouping. Exactly five values are defined:

| Column | Meaning | Who Moves Items Here |
|--------|---------|----------------------|
| **Backlog** | Defined but not scheduled for current execution | Planner, on creation of future-phase issues |
| **To Do** | Scheduled for the current phase; ready to execute | Planner, on phase planning approval |
| **In Progress** | Actively being worked on by an executor agent | Automation (GitHub Actions on issue assignment) |
| **In Review** | Implementation complete; undergoing verification | Automation (GitHub Actions on PR open or comment trigger) |
| **Done** | Verified and merged | Automation (GitHub Actions on issue close) |

**Implementation note:** The built-in GitHub Projects automation handles `Closed → Done` automatically. The `In Progress` and `In Review` transitions require GitHub Actions workflows (see Section 15).

### 2.3 Custom Fields

The following custom fields are created on every MaxsimCLI board:

| Field Name | Field Type | Values / Format | Purpose |
|------------|-----------|-----------------|---------|
| **Status** | Single Select | Backlog, To Do, In Progress, In Review, Done | Column grouping |
| **Priority** | Single Select | P0 Critical, P1 High, P2 Medium, P3 Low | Execution ordering |
| **Phase** | Number | Integer ≥ 1 | Which phase this belongs to |
| **Wave** | Number | Integer ≥ 1 | Which execution wave within a phase |
| **Estimate** | Number | Story points (1, 2, 3, 5, 8, 13) | Complexity estimate |
| **Type** | Single Select | Phase, Task, Bug, Quick, User Issue | Issue classification |
| **Iteration** | Iteration | Weekly iterations | Sprint planning (optional, enabled per project) |

**Creating fields via GraphQL:**

```graphql
mutation CreateField($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!) {
  createProjectV2Field(input: {
    projectId: $projectId
    name: $name
    dataType: $dataType
  }) {
    projectV2Field {
      ... on ProjectV2SingleSelectField {
        id
        name
        options { id name }
      }
    }
  }
}
```

### 2.4 Board Views

MaxsimCLI creates three views during `/maxsim:init`:

| View Name | Layout | Grouped By | Filtered By | Purpose |
|-----------|--------|-----------|-------------|---------|
| **Board** | Board | Status | — | Primary Kanban view |
| **Phase Breakdown** | Table | Phase | Type = Task | Shows all tasks per phase |
| **Roadmap** | Roadmap | Milestone | — | Timeline view of milestones |

### 2.5 Sub-Issue Progress Field

Enable the built-in **Sub-issue progress** field on Phase Issues to show a progress bar directly on the board. This field is automatically updated by GitHub as sub-issues are closed.

In the Board view, Phase Issues display their sub-issue completion percentage as a progress pill, providing at-a-glance phase status without querying individual sub-issues.

---

## 3. Issue Hierarchy

MaxsimCLI uses a three-level hierarchy: **Milestone → Phase Issue → Task Sub-Issues**.

```
Milestone: "v1.0 — Core Infrastructure"
│
├── Phase Issue #12: "[Phase 1] Authentication System"
│   ├── Sub-Issue #13: "[Task 1.1] JWT token generation"
│   ├── Sub-Issue #14: "[Task 1.2] OAuth provider integration"
│   ├── Sub-Issue #15: "[Task 1.3] Session management middleware"
│   └── Sub-Issue #16: "[Task 1.4] Auth unit tests"
│
└── Phase Issue #20: "[Phase 2] User Profile CRUD"
    ├── Sub-Issue #21: "[Task 2.1] Profile schema definition"
    └── Sub-Issue #22: "[Task 2.2] Profile API endpoints"
```

### 3.1 GitHub Limitations and Solutions

GitHub allows up to **100 sub-issues per parent** and **8 levels of nesting**. MaxsimCLI uses a maximum of 2 levels (Phase → Task), leaving ample headroom.

GitHub's native Issue Types (GA April 2025) classify issues as `Task`, `Bug`, or `Feature`. MaxsimCLI maps:
- Phase Issues → `Feature` type
- Task Sub-Issues → `Task` type
- Bug Issues → `Bug` type
- Quick Issues → `Task` type

The board's custom **Type** field provides additional MaxsimCLI-specific classification that complements GitHub's native types.

### 3.2 Hierarchy Enforcement Rules

1. A Phase Issue **must** belong to exactly one Milestone.
2. A Task Sub-Issue **must** be a sub-issue of exactly one Phase Issue.
3. A Task Sub-Issue **must not** have sub-issues of its own (two levels maximum).
4. A Phase Issue **must not** be a sub-issue of another issue.
5. Standalone User Issues (Section 11) are the exception: they can exist without a parent Phase Issue until the Planner integrates them.

---

## 4. Issue Title Conventions

Consistent, parseable titles are critical for machine identification. MaxsimCLI parses titles to determine issue type and extract metadata.

### 4.1 Phase Issue Titles

Format: `[Phase {N}] {Descriptive Title}`

```
[Phase 1] Authentication System
[Phase 2] User Profile CRUD Operations
[Phase 3] Real-Time Notification Engine
```

Rules:
- `N` is always a positive integer, zero-padded to 2 digits for phases > 9
- The descriptive title uses Title Case
- No trailing punctuation
- The `[Phase N]` prefix is **required** and **machine-parsed**

### 4.2 Task Sub-Issue Titles

Format: `[Task {N}.{M}] {Descriptive Title}`

```
[Task 1.1] JWT token generation and validation
[Task 1.2] OAuth provider integration (GitHub, Google)
[Task 1.3] Session management middleware
[Task 2.1] User profile database schema
```

Rules:
- `N` is the parent phase number
- `M` is the sequential task number within that phase
- The descriptive title uses sentence case
- The `[Task N.M]` prefix is **required** and **machine-parsed**

### 4.3 Bug Issue Titles

Format: `[Bug] {Short description of the problem}`

```
[Bug] OAuth callback fails on redirect with state mismatch
[Bug] Session expires prematurely under concurrent requests
```

### 4.4 Quick Issue Titles

Format: `[Quick] {Short description}`

```
[Quick] Update README installation instructions
[Quick] Add .env.example file
```

### 4.5 User Issue Titles

User-created issues have **no enforced format**. MaxsimCLI detects user issues by the absence of any `[Phase N]`, `[Task N.M]`, `[Bug]`, or `[Quick]` prefix. See Section 11.

### 4.6 Title Parsing Regex

```typescript
const PHASE_TITLE_RE   = /^\[Phase\s+(\d+)\]\s+(.+)$/i;
const TASK_TITLE_RE    = /^\[Task\s+(\d+)\.(\d+)\]\s+(.+)$/i;
const BUG_TITLE_RE     = /^\[Bug\]\s+(.+)$/i;
const QUICK_TITLE_RE   = /^\[Quick\]\s+(.+)$/i;
// No prefix = user issue
```

---

## 5. Issue Body Structure

Every MaxsimCLI-created issue has a structured body. The structure consists of three zones:

1. **Machine-readable frontmatter** — HTML comment block at the very top. Hidden in GitHub UI, readable by the API.
2. **Human-readable content** — Standard Markdown. Visible in GitHub UI.
3. **Machine-readable footer** — HTML comment block at the very bottom. Stores mutable state metadata.

### 5.1 Phase Issue Body Template

```markdown
<!-- maxsim:meta
type: phase
phase: 1
milestone: "v1.0 — Core Infrastructure"
status: planning
created_at: 2026-03-22T10:00:00Z
created_by: maxsim-init
wave_count: 0
task_count: 0
-->

## Phase 1 — Authentication System

**Goal:** Implement a complete authentication system supporting JWT tokens and OAuth providers (GitHub, Google), with session management middleware and full unit test coverage.

### Acceptance Criteria

- [ ] JWT tokens are generated and validated correctly
- [ ] GitHub and Google OAuth flows complete without error
- [ ] Session middleware correctly identifies authenticated requests
- [ ] All auth endpoints have ≥ 90% unit test coverage
- [ ] No security vulnerabilities detected by static analysis

### Dependencies

- Requires: Phase 0 (Project Setup) to be complete
- Blocks: Phase 3 (User Profiles) — profiles require authenticated users

### Technical Constraints

- Use `jose` library for JWT (already in dependency list)
- OAuth callback URLs must be configurable via environment variables
- Session store must support Redis (production) and in-memory (testing)

### Out of Scope

- Two-factor authentication (planned for Phase 7)
- Social login beyond GitHub and Google

<!-- maxsim:state
task_ids: []
planned_at: null
executed_at: null
verified_at: null
executor_branches: []
-->
```

### 5.2 Task Sub-Issue Body Template

```markdown
<!-- maxsim:meta
type: task
phase: 1
task: 1
parent_issue: 12
status: todo
estimate: 3
wave: 1
created_at: 2026-03-22T10:05:00Z
created_by: maxsim-plan
-->

## Task 1.1 — JWT token generation and validation

**What to build:** A `JwtService` class that generates signed JWT access tokens and refresh tokens, and a validation function that verifies signatures and expiry.

### Implementation Notes

- Use RS256 algorithm (asymmetric, safer than HS256 for public APIs)
- Access token TTL: 15 minutes
- Refresh token TTL: 7 days
- Key pair loaded from `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` environment variables
- Export: `generateAccessToken(userId, claims)`, `generateRefreshToken(userId)`, `validateToken(token)`

### Verification Criteria

- [ ] Unit tests pass for generate and validate functions
- [ ] Expired tokens are rejected with correct error code
- [ ] Tampered tokens are rejected
- [ ] TypeScript types are correct throughout

### Files to Create/Modify

- `src/auth/jwt.service.ts` (create)
- `src/auth/jwt.service.test.ts` (create)
- `src/auth/index.ts` (export new service)

<!-- maxsim:state
assigned_to: null
worktree_branch: null
started_at: null
completed_at: null
verified_at: null
verification_passed: null
retry_count: 0
-->
```

### 5.3 Frontmatter Field Reference

#### `<!-- maxsim:meta ... -->` Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `phase` \| `task` \| `bug` \| `quick` \| `user` | Issue classification |
| `phase` | integer | Phase number (null for non-phase issues) |
| `task` | integer | Task number within phase (task issues only) |
| `parent_issue` | integer | GitHub issue number of parent Phase Issue (task issues only) |
| `milestone` | string | Milestone title this issue belongs to |
| `status` | string | Current lifecycle status (see below) |
| `estimate` | integer | Story points: 1, 2, 3, 5, 8, or 13 |
| `wave` | integer | Execution wave number (task issues only) |
| `created_at` | ISO 8601 | Creation timestamp |
| `created_by` | string | Which command created this issue |
| `wave_count` | integer | Total waves planned (phase issues only) |
| `task_count` | integer | Total tasks under this phase (phase issues only) |

#### `<!-- maxsim:state ... -->` Fields (mutable, updated during lifecycle)

| Field | Type | Description |
|-------|------|-------------|
| `task_ids` | integer[] | GitHub issue numbers of task sub-issues |
| `planned_at` | ISO 8601 \| null | When plan was approved |
| `executed_at` | ISO 8601 \| null | When execution completed |
| `verified_at` | ISO 8601 \| null | When verification passed |
| `executor_branches` | string[] | Git branches used by executor agents |
| `assigned_to` | string \| null | GitHub username of assigned executor |
| `worktree_branch` | string \| null | Git branch for this task's worktree |
| `started_at` | ISO 8601 \| null | When execution began |
| `completed_at` | ISO 8601 \| null | When implementation completed |
| `verified_at` | ISO 8601 \| null | When verification passed |
| `verification_passed` | boolean \| null | Result of latest verification run |
| `retry_count` | integer | Number of retry attempts (max 3) |

#### Lifecycle Status Values

```
planning → planned → in_progress → in_review → done
                                 ↘ failed → retrying → in_progress (up to 3 times)
                                            → escalated
```

---

## 6. Comment Conventions

Issue comments are MaxsimCLI's primary mechanism for storing plans, research, context, and summaries. Each comment has a **type** and follows a defined template. Comments are posted by MaxsimCLI automation, not by human collaborators (human comments are always preserved and treated as context).

### 6.1 Comment Types

| Comment Type | Posted By | Trigger | Contains |
|-------------|-----------|---------|----------|
| `plan` | Planner agent | After plan approval | Full phase/task plan, wave breakdown, task list |
| `research` | Researcher agent | After research stage | Findings, sources, key decisions |
| `context` | Executor agent | At task start | What will be done, approach, files to touch |
| `progress` | Executor agent | During execution | Mid-task updates for long-running tasks |
| `verification` | Verifier agent | After verification | Evidence block, pass/fail verdict |
| `summary` | Planner/Executor | Phase complete | What was accomplished, what changed |
| `error` | Automation | On failure | Error details, diagnostic info, retry plan |
| `escalation` | Automation | After 3 failures | Full diagnostic, asks user for guidance |
| `handoff` | Executor agent | At task end | Handoff contract output (per handoff-contract skill) |

### 6.2 Plan Comment Template

```markdown
<!-- maxsim:type=plan phase=1 version=1 approved_at=2026-03-22T10:15:00Z -->

## Phase 1 Plan — Authentication System

**Approved:** 2026-03-22 10:15 UTC
**Total Tasks:** 4
**Waves:** 2 (Wave 1: tasks 1.1–1.3 in parallel; Wave 2: task 1.4 after Wave 1)
**Estimate:** 11 story points

### Wave 1 (Parallel Execution)

| Task | Title | Estimate | Assignee |
|------|-------|----------|----------|
| 1.1 | JWT token generation and validation | 3 | Executor A |
| 1.2 | OAuth provider integration | 5 | Executor B |
| 1.3 | Session management middleware | 3 | Executor C |

### Wave 2 (Sequential — requires Wave 1 complete)

| Task | Title | Estimate | Assignee |
|------|-------|----------|----------|
| 1.4 | Authentication unit test suite | 8 | Executor A |

### Acceptance Criteria (Phase Level)

Identical to Phase Issue body. Reproduced here for planner agent context.

### Risk Notes

- Task 1.2 (OAuth) may require provider-specific edge case handling.
  If it exceeds 8 story points, split into separate provider sub-tasks.
- Task 1.4 depends on stable interfaces from Wave 1 — late changes to
  function signatures will require test updates.
```

### 6.3 Research Comment Template

```markdown
<!-- maxsim:type=research phase=1 task=2 researcher=researcher-agent-a -->

## Research: OAuth Provider Integration

**Researched:** 2026-03-22 10:20 UTC
**Scope:** OAuth 2.0 flow for GitHub and Google providers

### Key Findings

1. **Library:** `passport.js` with `passport-github2` and `passport-google-oauth20`
   is the established Node.js solution. Alternatively, `arctic` is a lightweight
   zero-dependency OAuth client gaining adoption in 2025.

2. **Callback URL Pattern:** GitHub requires callback URLs to be pre-registered.
   Use `{BASE_URL}/auth/callback/{provider}` pattern for consistency.

3. **State Parameter:** CSRF protection via `state` parameter is mandatory.
   Both providers validate it. Use `crypto.randomBytes(32).toString('hex')`.

4. **Token Storage:** Never store access tokens in JWT payloads. Store in
   session or Redis, reference by session ID only.

### Decision

Use `arctic` (v2.x) for its zero-dependency footprint and clean TypeScript types.
Avoids `passport.js` middleware complexity for this use case.

### Sources

- arctic GitHub: https://github.com/pilcrowonpaper/arctic
- GitHub OAuth docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
```

### 6.4 Verification Comment Template

```markdown
<!-- maxsim:type=verification task=1 verdict=PASS retries=0 -->

## Verification: Task 1.1 — JWT Token Generation

**Verified:** 2026-03-22 11:45 UTC
**Verdict:** PASS

### Evidence

```
CLAIM: JWT service generates valid, signed access and refresh tokens.

EVIDENCE:
  Tests run: vitest run src/auth/jwt.service.test.ts
  Test results:
    ✓ generates access token with correct claims (12ms)
    ✓ generates refresh token with correct TTL (8ms)
    ✓ validateToken rejects expired token (5ms)
    ✓ validateToken rejects tampered signature (6ms)
    ✓ validateToken returns claims for valid token (4ms)
  Tests: 5 passed, 0 failed

  Build: tsc --noEmit → 0 errors
  Lint: biome check src/auth/ → 0 errors, 0 warnings

VERDICT: PASS — All criteria satisfied. Implementation is complete.
```

### Files Changed

- `src/auth/jwt.service.ts` (created, 87 lines)
- `src/auth/jwt.service.test.ts` (created, 156 lines)
- `src/auth/index.ts` (modified, added export)
```

### 6.5 Summary Comment Template

```markdown
<!-- maxsim:type=summary phase=1 -->

## Phase 1 Complete — Authentication System

**Completed:** 2026-03-22 14:30 UTC
**Duration:** 4 hours 15 minutes
**Tasks Completed:** 4/4

### What Was Built

- JWT service with RS256 signing, 15-min access tokens, 7-day refresh tokens
- OAuth integration for GitHub and Google using arctic v2.1
- Session middleware with Redis adapter and in-memory fallback
- 47 unit tests covering all auth components, 94% coverage

### Key Decisions Made

1. Chose `arctic` over `passport.js` for OAuth (see research comment)
2. Used RS256 instead of HS256 for JWT (asymmetric keys, safer for public API)
3. Session store abstracted behind interface to support Redis/memory swap

### What Changed from Plan

- Task 1.2 (OAuth) required an additional 2 hours due to Google's consent
  screen configuration requirements in test environment. No scope change.

### Known Gaps / Next Phase Notes

- Refresh token rotation not implemented (deferred to Phase 4)
- Rate limiting on auth endpoints not implemented (Phase 5 scope)
```

---

## 7. HTML Comment Markers

All machine-readable data in issue bodies and comments is wrapped in HTML comments. GitHub renders Markdown and strips unknown HTML tags, but the raw body is served through the API. MaxsimCLI reads raw issue bodies and comments via the API, never relying on rendered HTML.

### 7.1 Marker Format

```
<!-- maxsim:{key}={value} {key}={value} ... -->
```

For multi-line structured data (YAML-like):

```
<!-- maxsim:{block-type}
key: value
key: value
list:
  - item1
  - item2
-->
```

### 7.2 Marker Registry

| Marker | Location | Purpose |
|--------|---------|---------|
| `<!-- maxsim:meta ... -->` | Issue body (top) | Immutable issue metadata |
| `<!-- maxsim:state ... -->` | Issue body (bottom) | Mutable lifecycle state |
| `<!-- maxsim:type=plan ... -->` | Comment body (top) | Marks comment as a plan |
| `<!-- maxsim:type=research ... -->` | Comment body (top) | Marks comment as research |
| `<!-- maxsim:type=context ... -->` | Comment body (top) | Marks comment as executor context |
| `<!-- maxsim:type=progress ... -->` | Comment body (top) | Marks comment as progress update |
| `<!-- maxsim:type=verification ... -->` | Comment body (top) | Marks comment as verification result |
| `<!-- maxsim:type=summary ... -->` | Comment body (top) | Marks comment as phase/task summary |
| `<!-- maxsim:type=error ... -->` | Comment body (top) | Marks comment as error report |
| `<!-- maxsim:type=escalation ... -->` | Comment body (top) | Marks comment as escalation to user |
| `<!-- maxsim:type=handoff ... -->` | Comment body (top) | Marks comment as handoff contract |
| `<!-- maxsim:type=user-intent ... -->` | Comment body | Added by MaxsimCLI when integrating user issues |

### 7.3 Parsing Rules

1. Markers are **always** on their own line(s).
2. Single-line markers: `<!-- maxsim:{key}={value} -->` — use regex: `/<!--\s*maxsim:(\S+)\s*-->/`
3. Multi-line markers: content between `<!-- maxsim:{block}` and `-->` is parsed as YAML.
4. If a marker is malformed, MaxsimCLI logs a warning and treats the issue as unstructured.
5. Multiple markers of the same type in one issue/comment: only the **first** is authoritative.
6. The `<!-- maxsim:state ... -->` block is the only marker MaxsimCLI **rewrites** in-place during issue lifecycle updates.

### 7.4 Updating the State Block

When MaxsimCLI needs to update issue state (e.g., set `verification_passed: true`), it:

1. Fetches the raw issue body via `gh api /repos/{owner}/{repo}/issues/{number}`.
2. Locates the `<!-- maxsim:state` block using regex.
3. Parses the YAML content.
4. Modifies the target fields.
5. Re-serializes the YAML.
6. Replaces the block in the body string.
7. Updates the issue via `gh api PATCH /repos/{owner}/{repo}/issues/{number}`.

This is a targeted string replacement, not a full body rewrite, to avoid overwriting human edits to the human-readable section.

---

## 8. Label Taxonomy

Labels serve two purposes: human categorization and machine filtering. MaxsimCLI creates a complete label set during `/maxsim:init` using `gh label create`.

### 8.1 Label Categories

Labels are organized by **color-coded category prefix**. Each category has a distinct hue.

#### Category: Type (Blue family — #0075ca)

| Label | Color | Description |
|-------|-------|-------------|
| `type:phase` | `#0075ca` | A Phase Issue representing a major deliverable |
| `type:task` | `#1d76db` | A Task sub-issue within a phase |
| `type:bug` | `#d73a4a` | Something is broken |
| `type:quick` | `#5319e7` | A quick, self-contained task |
| `type:user-issue` | `#0e8a16` | Created by the user, not by MaxsimCLI |

#### Category: Priority (Red/Orange family)

| Label | Color | Description |
|-------|-------|-------------|
| `priority:p0-critical` | `#b60205` | Blocks all other work; must fix immediately |
| `priority:p1-high` | `#e4e669` | Important; schedule for next execution window |
| `priority:p2-medium` | `#fbca04` | Standard priority |
| `priority:p3-low` | `#c5def5` | Nice to have; deferred if needed |

#### Category: Status (Green family — lifecycle tracking)

| Label | Color | Description |
|-------|-------|-------------|
| `status:planning` | `#bfd4f2` | In the planning stage |
| `status:planned` | `#0e8a16` | Plan approved, ready to execute |
| `status:in-progress` | `#e4e669` | Execution underway |
| `status:in-review` | `#d4c5f9` | Undergoing verification |
| `status:blocked` | `#ee0701` | Cannot proceed; dependency not met |
| `status:escalated` | `#b60205` | Failed 3 retries; needs human intervention |

#### Category: Phase (Purple family — cross-reference)

| Label | Color | Description |
|-------|-------|-------------|
| `phase:1` through `phase:N` | `#7057ff` | Which phase this issue belongs to |

These are created dynamically as phases are defined. A maximum of 20 phase labels are pre-created; additional ones are created on demand.

#### Category: Domain (Teal family — component area)

Created per-project during init based on codebase analysis. Common examples:

| Label | Color | Description |
|-------|-------|-------------|
| `area:auth` | `#006b75` | Authentication and authorization |
| `area:api` | `#006b75` | API layer |
| `area:database` | `#006b75` | Database schema and queries |
| `area:frontend` | `#006b75` | UI components |
| `area:infrastructure` | `#006b75` | CI/CD, deployment, configuration |
| `area:testing` | `#006b75` | Test infrastructure and coverage |

#### Category: Meta (Gray family)

| Label | Color | Description |
|-------|-------|-------------|
| `maxsim:auto-created` | `#ededed` | Created by MaxsimCLI automation |
| `maxsim:needs-triage` | `#ededed` | User issue awaiting integration into plan |
| `maxsim:wont-fix` | `#ededed` | Closed as won't fix |
| `maxsim:duplicate` | `#ededed` | Duplicate of another issue |
| `good-first-issue` | `#7057ff` | Good for new contributors (open-source projects) |
| `help-wanted` | `#008672` | Community help welcome |

### 8.2 Label Application Rules

1. Every MaxsimCLI-created issue has **exactly one** `type:*` label.
2. Every issue has **exactly one** `priority:*` label (default: `priority:p2-medium`).
3. Every issue has **at most one** `status:*` label (updated as the issue progresses).
4. Phase Issues also have the corresponding `phase:N` label.
5. Task sub-issues also have the same `phase:N` label as their parent.
6. User issues start with `type:user-issue` and `maxsim:needs-triage`.
7. The `area:*` labels are optional but encouraged; apply the most specific applicable label.
8. `maxsim:auto-created` is applied to every MaxsimCLI-created issue for auditing.

### 8.3 Label Creation Command

```bash
gh label create "type:phase" \
  --color "0075ca" \
  --description "A Phase Issue representing a major deliverable" \
  --repo {owner}/{repo}
```

MaxsimCLI's `github/labels.ts` module contains the full label manifest and creates all labels idempotently (skips existing ones).

---

## 9. Milestone Structure

### 9.1 Milestone Purpose

Milestones group Phase Issues into deliverable units. A milestone represents a meaningful, releasable increment of the project — not a sprint. Milestones map directly to the project roadmap.

### 9.2 Milestone Naming Convention

```
v{major}.{minor} — {Human-Readable Title}
```

Examples:
```
v0.1 — Proof of Concept
v0.5 — Alpha Release
v1.0 — Initial Release
v1.5 — Performance Optimization
v2.0 — Enterprise Features
```

For projects without semantic versioning, use:
```
{Quarter} {Year} — {Theme}
```

Examples:
```
Q1 2026 — Foundation
Q2 2026 — Growth Features
```

### 9.3 Milestone Body Structure

```markdown
<!-- maxsim:meta
type: milestone
version: "1.0"
target_date: 2026-06-30
theme: "Initial public release with core features"
phases: [1, 2, 3, 4, 5]
-->

## v1.0 — Initial Release

**Target Date:** 2026-06-30
**Theme:** Initial public release with all core features

### Scope

This milestone covers the minimum viable product:

- Phase 1: Authentication System
- Phase 2: User Profile Management
- Phase 3: Real-Time Notifications
- Phase 4: Payment Integration
- Phase 5: Admin Dashboard

### Success Criteria

- All 5 phases verified and merged to main
- Full test suite passing (target: ≥ 85% coverage)
- Documentation complete (Wiki and API reference)
- Deployment pipeline verified on staging environment

### Out of Scope

- Multi-tenant support (v2.0)
- Mobile applications (v1.5)
- Analytics dashboard (v1.5)
```

### 9.4 Milestone Completion

A milestone is closed (and a GitHub Release may be created) when:
1. All associated Phase Issues are closed.
2. The integration test suite passes on the merged main branch.
3. `/maxsim:progress` confirms 100% completion.

### 9.5 Milestone Due Dates

Always set a due date on milestones. GitHub displays overdue milestones prominently, providing natural accountability. MaxsimCLI warns when a milestone is at risk based on remaining estimate versus time remaining.

---

## 10. Issue Dependencies

### 10.1 Native GitHub Dependencies

As of August 2025, GitHub supports native issue dependencies via the **Relationships** sidebar. MaxsimCLI uses both native dependencies and textual conventions.

**Relationship types:**
- **Blocked by:** Issue A cannot proceed until Issue B is closed.
- **Blocking:** Issue A prevents Issue B from proceeding.

MaxsimCLI applies dependencies during the planning phase:
1. Planner agent identifies inter-phase and inter-task dependencies.
2. Native `blocked-by` relationships are set via GraphQL.
3. The Phase Issue body documents dependencies textually in the **Dependencies** section.

### 10.2 Cross-Phase Dependencies

Phase Issues are linked using native dependency relationships AND textual references:

In Phase Issue body:
```markdown
### Dependencies

- **Requires:** #5 (Phase 0 — Project Setup) must be complete before this phase begins
- **Blocks:** #23 (Phase 3 — User Profiles) — profile features require authenticated users
```

### 10.3 Cross-Repository Dependencies

For multi-repo projects, use the `owner/repo#number` syntax in textual references. Native GitHub dependencies as of March 2026 support cross-repository dependencies if both repos are within the same organization.

### 10.4 Dependency Detection in `/maxsim:go`

When `/maxsim:go` reads the project board, it checks each `In Progress` and `To Do` item for `blocked-by` relationships. If any dependency issue is still open, the blocked item is skipped in the execution queue and its status label is set to `status:blocked`.

---

## 11. User-Created Issues

Users may create GitHub Issues directly, bypassing MaxsimCLI. This is intentional and supported. MaxsimCLI detects and integrates these issues.

### 11.1 Detection

A user issue is any issue that:
1. Lacks a `[Phase N]`, `[Task N.M]`, `[Bug]`, or `[Quick]` prefix in the title.
2. Lacks the `maxsim:auto-created` label.
3. Is open (closed issues are ignored).

Detection query:
```bash
gh issue list \
  --repo {owner}/{repo} \
  --state open \
  --json number,title,labels \
  | jq '[.[] | select(
      (.labels | map(.name) | contains(["maxsim:auto-created"]) | not) and
      (.title | test("^\\[(Phase|Task|Bug|Quick)") | not)
    )]'
```

### 11.2 Integration Flow

When `/maxsim:go` or `/maxsim:plan` detects unintegrated user issues:

1. **Triage** — Add `maxsim:needs-triage` label to the user issue.
2. **Surface** — Report detected user issues to the user in the plan proposal.
3. **Propose Integration** — Suggest options:
   - Create a `[Quick]` task for immediate execution
   - Integrate into the current Phase as a new sub-issue `[Task N.M]`
   - Defer to a future phase (add `status:planned` label and assign to future milestone)
   - Close as won't fix (add `maxsim:wont-fix` label)
4. **User Approval** — Present options in Plan Mode. User approves before any action.
5. **Execute Integration** — Based on user choice:
   - Add `maxsim:meta` frontmatter to the issue body
   - Apply appropriate type, priority, and phase labels
   - Optionally convert to sub-issue under a Phase Issue
   - Add issue to the project board with correct status

### 11.3 Intent Comment

When MaxsimCLI integrates a user issue, it posts an intent comment documenting what was done:

```markdown
<!-- maxsim:type=user-intent integrated_at=2026-03-22T11:00:00Z action=quick-task -->

## MaxsimCLI — Issue Integration

This issue was created directly and has been integrated into the MaxsimCLI workflow.

**Integration decision:** Converted to a Quick Task for immediate execution.
**Approved by:** User (via plan approval at 2026-03-22 11:00 UTC)

*This issue will be picked up by the next `/maxsim:go` invocation.*
```

---

## 12. Project Overview Pinned Issue

Every MaxsimCLI project has a pinned "Project Overview" issue (pinned at the top of the Issues list) that serves as the entry point for both human readers and AI agents.

### 12.1 Title

```
[Overview] {Project Name} — MaxsimCLI Project
```

### 12.2 Body Template

```markdown
<!-- maxsim:meta
type: overview
project_name: "My Project"
board_url: "https://github.com/orgs/owner/projects/42"
created_at: 2026-03-22T09:00:00Z
maxsim_version: "5.0.7"
-->

# My Project — MaxsimCLI Project Overview

> **This issue is the entry point for MaxsimCLI. It is pinned and should not be closed.**

## Quick Reference

| Item | Link |
|------|------|
| **Project Board** | [View Board](https://github.com/orgs/owner/projects/42) |
| **Current Milestone** | [v1.0 — Initial Release](link) |
| **Active Phase** | [Phase 2 — User Profiles](link) |
| **Wiki** | [Project Wiki](link) |
| **Architecture Discussions** | [GitHub Discussions](link) |

## Project Description

{Description from /maxsim:init interview}

## Technology Stack

{Auto-detected or user-provided stack}

## Roadmap Summary

| Milestone | Phases | Status | Target |
|-----------|--------|--------|--------|
| v0.1 — Proof of Concept | 1–2 | Done | 2026-02-28 |
| v1.0 — Initial Release | 3–7 | In Progress | 2026-06-30 |
| v2.0 — Enterprise | 8–12 | Planned | 2026-12-31 |

## MaxsimCLI Commands

Run these commands in Claude Code:

- `/maxsim:go` — Auto-detect state and do the right thing
- `/maxsim:plan [N]` — Plan a specific phase
- `/maxsim:execute [N]` — Execute a planned phase
- `/maxsim:progress` — Show current status

## Conventions

All project conventions are documented in the [Wiki](link/wiki).

<!-- maxsim:state
active_milestone: "v1.0 — Initial Release"
active_phase: 2
last_updated: 2026-03-22T09:00:00Z
-->
```

### 12.3 Maintenance

The Project Overview issue's `<!-- maxsim:state -->` block is updated by MaxsimCLI at the end of each phase execution, reflecting the latest active milestone and phase.

---

## 13. GitHub Wiki Structure

The Wiki stores **stable, human-authored documentation** — conventions that don't change session to session, architectural context, and decisions that don't warrant a Discussion thread. MaxsimCLI creates the Wiki structure during `/maxsim:init`.

### 13.1 Wiki Philosophy

- **Wiki:** High-level, frequently consulted reference. Project overview, conventions, requirements, decision log.
- **Docs folder in repo:** Technical, version-controlled content that must stay in sync with code (API references, configuration schema, release notes).
- **GitHub Discussions:** Architectural decision records (ADRs) — searchable, commentable, closeable.
- **Issue Comments:** Session-specific plans, research, and execution context.

### 13.2 Wiki Page Structure

```
Wiki Home (Home.md)
├── Project-Conventions.md       — Coding standards, commit conventions, naming
├── Requirements.md              — Functional and non-functional requirements
├── Architecture.md              — System design, component map, data flow
├── Decision-Log.md              — Index of ADRs with links to Discussions
├── Tech-Stack.md                — Technologies, versions, justifications
├── Testing-Strategy.md          — Coverage targets, test types, running tests
├── Deployment.md                — Environments, deployment process, rollback
├── MaxsimCLI-Config.md          — MaxsimCLI settings for this project
└── Glossary.md                  — Project-specific terminology
```

### 13.3 Home Page Template

```markdown
# {Project Name} Wiki

Welcome. This wiki is the authoritative reference for project conventions, requirements,
and architectural decisions.

## Navigation

| Page | Contents |
|------|---------|
| [Project Conventions](Project-Conventions) | Coding standards, commit format, naming |
| [Requirements](Requirements) | What the system must do and how well |
| [Architecture](Architecture) | System design and component map |
| [Decision Log](Decision-Log) | Index of all architectural decisions |
| [Tech Stack](Tech-Stack) | Technologies in use and why |
| [Testing Strategy](Testing-Strategy) | How we test and coverage targets |
| [Deployment](Deployment) | How to deploy and roll back |
| [MaxsimCLI Config](MaxsimCLI-Config) | AI orchestration settings |
| [Glossary](Glossary) | Project terminology |

## Project Status

- **Current Milestone:** v1.0 — Initial Release (target: 2026-06-30)
- **Board:** [View Project Board](link)
- **Active Phase:** Phase 2 — User Profile Management

*Last updated by MaxsimCLI on 2026-03-22*
```

### 13.4 Decision Log Page

The Decision Log Wiki page is an **index** — it lists decisions with links to their Discussion threads (ADRs) and provides a one-line summary. It does not contain the decision details (those live in Discussions).

```markdown
# Decision Log

All architectural and technical decisions are recorded as GitHub Discussions.
This page is the index.

| # | Date | Decision | Status | Discussion |
|---|------|----------|--------|-----------|
| ADR-001 | 2026-03-22 | Use arctic for OAuth | Accepted | #D1 |
| ADR-002 | 2026-03-23 | Use RS256 for JWT | Accepted | #D2 |
| ADR-003 | 2026-03-25 | Defer 2FA to Phase 7 | Accepted | #D3 |

## Status Values

- **Proposed** — Under discussion, not yet decided
- **Accepted** — Implemented or committed to
- **Superseded** — Replaced by a later decision (link to superseding ADR)
- **Deprecated** — No longer applicable
```

### 13.5 MaxsimCLI-Config Wiki Page

Documents the MaxsimCLI settings for this specific project so that any new AI session can read the Wiki and understand the configured behavior:

```markdown
# MaxsimCLI Configuration

## Profile

- **Default Profile:** balanced
- **Planner Model:** claude-opus-4
- **Executor Model:** claude-sonnet-4-5
- **Researcher Model:** claude-sonnet-4-5
- **Verifier Model:** claude-sonnet-4-5

## Verification Settings

- **Max Retries:** 3
- **Required Checks:** tests, build, lint, spec-compliance, code-review

## Parallelism

- **Max Parallel Executors:** 5
- **Competitive Implementation:** Enabled (2 executors per task for Phase 1 tasks)

## GitHub Project

- **Board Number:** 42
- **Board URL:** https://github.com/orgs/owner/projects/42

## Labels in Use

{Auto-generated list of project-specific labels}
```

---

## 14. GitHub Discussions (ADRs)

GitHub Discussions is MaxsimCLI's mechanism for **Architecture Decision Records (ADRs)**. Discussions are searchable, commentable, and provide a permanent record of the reasoning behind significant decisions.

### 14.1 Discussion Category Setup

MaxsimCLI creates one Discussion category during `/maxsim:init`:

| Category | Emoji | Format | Purpose |
|----------|-------|--------|---------|
| **Architecture Decisions** | 🏛️ | Q&A (allows marking answers) | ADRs — one Discussion per decision |

### 14.2 ADR Title Convention

```
ADR-{NNN}: {Present-tense imperative verb phrase}
```

Examples:
```
ADR-001: Use arctic for OAuth provider integration
ADR-002: Sign JWTs with RS256 asymmetric keys
ADR-003: Abstract session store behind interface for Redis/memory swap
```

Numbering is sequential, zero-padded to 3 digits. The number never changes after creation.

### 14.3 ADR Body Template

```markdown
## Context

{What situation or question prompted this decision? What are the forces at play?}

## Decision Drivers

- {Factor 1 that influenced the decision}
- {Factor 2 that influenced the decision}
- {Factor 3 that influenced the decision}

## Options Considered

### Option A: {Name}

**Pros:** {advantages}
**Cons:** {disadvantages}

### Option B: {Name}

**Pros:** {advantages}
**Cons:** {disadvantages}

## Decision

**Chosen:** Option {X} — {brief justification}

{One paragraph explaining why this option was chosen over the alternatives.}

## Consequences

**Positive:**
- {What becomes easier or possible}

**Negative:**
- {What becomes harder or is now a constraint}

**Risks:**
- {What might go wrong and how it would be mitigated}

## Status

Accepted — 2026-03-22

## Related

- Phase Issue: #{N}
- Task: #{N.M}
- Supersedes: None
- Superseded by: None
```

### 14.4 ADR Lifecycle

1. MaxsimCLI Researcher or Planner agent creates a Discussion during the planning stage when a significant decision must be made.
2. The Discussion is left open during planning so the user can comment.
3. After the plan is approved, the Discussion is **marked as answered** (using Q&A format) with the chosen option as the answer.
4. The Decision Log Wiki page is updated with the new entry.
5. ADRs are **never deleted**, only superseded.

### 14.5 When to Create an ADR

Create an ADR when:
- A library or framework is chosen over alternatives
- A significant architectural pattern is selected (e.g., event sourcing vs. CRUD)
- A non-obvious constraint is accepted (e.g., "no ORM, use raw SQL")
- A feature is explicitly deferred to a future phase and why
- A security decision is made (algorithm choice, key management approach)

Do NOT create an ADR for:
- Routine implementation choices (variable names, file organization within a module)
- Standard toolchain decisions already captured in `Tech-Stack.md`
- Bug fixes

---

## 15. GitHub Actions Automation

MaxsimCLI installs GitHub Actions workflows during `/maxsim:init` for board management automation. All workflows are created in `.github/workflows/maxsim-*.yml`.

### 15.1 Workflow: Auto-Add to Board

**File:** `.github/workflows/maxsim-add-to-board.yml`
**Trigger:** `issues.opened`, `issues.reopened`
**Purpose:** Automatically add any new issue to the project board with Status = Backlog.

```yaml
name: MaxsimCLI — Add Issue to Board
on:
  issues:
    types: [opened, reopened]
jobs:
  add-to-board:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/add-to-project@v1
        with:
          project-url: https://github.com/orgs/{owner}/projects/{number}
          github-token: ${{ secrets.MAXSIM_PROJECT_TOKEN }}
```

**Note:** Requires a PAT with `project` scope stored as `MAXSIM_PROJECT_TOKEN` (the default `GITHUB_TOKEN` does not have project write access).

### 15.2 Workflow: Status Transitions

**File:** `.github/workflows/maxsim-status-transitions.yml`
**Trigger:** `issues.assigned`, `pull_request.opened`, `pull_request.ready_for_review`, `issues.closed`
**Purpose:** Move issues through board columns automatically.

```yaml
name: MaxsimCLI — Status Transitions
on:
  issues:
    types: [assigned, closed, unassigned]
  pull_request:
    types: [opened, ready_for_review, closed]

jobs:
  transition-status:
    runs-on: ubuntu-latest
    steps:
      - name: Move to In Progress on assignment
        if: github.event_name == 'issues' && github.event.action == 'assigned'
        uses: github/update-project-action@v1
        with:
          field: Status
          value: In Progress
          github-token: ${{ secrets.MAXSIM_PROJECT_TOKEN }}

      - name: Move to In Review on PR open
        if: github.event_name == 'pull_request' && github.event.action == 'ready_for_review'
        uses: github/update-project-action@v1
        with:
          field: Status
          value: In Review
          github-token: ${{ secrets.MAXSIM_PROJECT_TOKEN }}

      - name: Move to Done on issue close
        if: github.event_name == 'issues' && github.event.action == 'closed'
        uses: github/update-project-action@v1
        with:
          field: Status
          value: Done
          github-token: ${{ secrets.MAXSIM_PROJECT_TOKEN }}
```

**Note:** GitHub's built-in project automation handles `closed → Done` natively. The custom workflow provides the `assigned → In Progress` and `PR opened → In Review` transitions not covered by built-in automation.

### 15.3 Workflow: Label Sync

**File:** `.github/workflows/maxsim-label-sync.yml`
**Trigger:** `workflow_dispatch` (manual), `schedule` (weekly)
**Purpose:** Ensure all required MaxsimCLI labels exist on the repository. Idempotent — skips existing labels.

### 15.4 Workflow: User Issue Detection

**File:** `.github/workflows/maxsim-user-issue-detect.yml`
**Trigger:** `issues.opened`
**Purpose:** Detect user-created issues (no MaxsimCLI prefix) and apply triage labels.

```yaml
name: MaxsimCLI — User Issue Detection
on:
  issues:
    types: [opened]
jobs:
  detect-user-issue:
    runs-on: ubuntu-latest
    steps:
      - name: Check if user issue
        id: check
        run: |
          TITLE="${{ github.event.issue.title }}"
          if [[ ! "$TITLE" =~ ^\[(Phase|Task|Bug|Quick|Overview) ]]; then
            echo "is_user_issue=true" >> $GITHUB_OUTPUT
          fi

      - name: Apply triage labels
        if: steps.check.outputs.is_user_issue == 'true'
        run: |
          gh issue edit ${{ github.event.issue.number }} \
            --add-label "type:user-issue,maxsim:needs-triage" \
            --repo ${{ github.repository }}
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 15.5 Workflow: Milestone Progress

**File:** `.github/workflows/maxsim-milestone-progress.yml`
**Trigger:** `issues.closed`
**Purpose:** Post a comment on the Project Overview issue when a milestone reaches 100% completion.

### 15.6 Required Secrets

| Secret | Purpose |
|--------|---------|
| `MAXSIM_PROJECT_TOKEN` | PAT with `project` + `repo` scopes for project field updates |
| `GITHUB_TOKEN` | Built-in token for issue/label operations (no special setup needed) |

---

## 16. GraphQL Query Patterns

MaxsimCLI uses GraphQL (via `gh api graphql`) for project state queries that REST cannot express efficiently.

### 16.1 Get Project Node ID

```graphql
query GetProjectId($owner: String!, $number: Int!) {
  organization(login: $owner) {
    projectV2(number: $number) {
      id
      title
      fields(first: 20) {
        nodes {
          ... on ProjectV2Field {
            id
            name
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}
```

**CLI usage:**
```bash
gh api graphql \
  -f query='...' \
  -f owner='{owner}' \
  -F number={project_number}
```

### 16.2 Get All Project Items with Custom Fields

```graphql
query GetProjectItems($projectId: ID!, $cursor: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          fieldValues(first: 15) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field { ... on ProjectV2SingleSelectField { name } }
                name
              }
              ... on ProjectV2ItemFieldNumberValue {
                field { ... on ProjectV2Field { name } }
                number
              }
              ... on ProjectV2ItemFieldTextValue {
                field { ... on ProjectV2Field { name } }
                text
              }
            }
          }
          content {
            ... on Issue {
              number
              title
              state
              labels(first: 10) {
                nodes { name }
              }
              assignees(first: 5) {
                nodes { login }
              }
              milestone {
                title
                dueOn
              }
              parent {
                number
                title
              }
            }
          }
        }
      }
    }
  }
}
```

**Pagination:** If `hasNextPage` is true, re-query with `cursor: endCursor` until `hasNextPage` is false.

### 16.3 Update a Field Value

```graphql
mutation UpdateStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId
    itemId: $itemId
    fieldId: $fieldId
    value: {
      singleSelectOptionId: $optionId
    }
  }) {
    projectV2Item {
      id
    }
  }
}
```

### 16.4 Add Issue to Project

```graphql
mutation AddIssueToProject($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {
    projectId: $projectId
    contentId: $contentId
  }) {
    item {
      id
    }
  }
}
```

### 16.5 Query Rate Limit Remaining

```graphql
query RateLimit {
  rateLimit {
    limit
    remaining
    used
    resetAt
  }
}
```

Always query rate limit at the start of any bulk operation and abort if remaining < 500.

### 16.6 TypeScript Query Helper

```typescript
// packages/cli/src/github/graphql.ts

export async function queryProjectItems(
  projectId: string,
  token: string
): Promise<ProjectItem[]> {
  const items: ProjectItem[] = [];
  let cursor: string | null = null;

  do {
    const result = await gh.graphql(GET_PROJECT_ITEMS_QUERY, {
      projectId,
      cursor,
    });
    items.push(...result.node.items.nodes);
    cursor = result.node.items.pageInfo.hasNextPage
      ? result.node.items.pageInfo.endCursor
      : null;
  } while (cursor !== null);

  return items;
}
```

---

## 17. Rate Limiting Strategy

### 17.1 Limits in Effect

| Context | Points/Hour | Notes |
|---------|-------------|-------|
| Personal Access Token | 5,000 | Default |
| GitHub Actions GITHUB_TOKEN | 1,000/repo | Per repository |
| GitHub App (org, non-enterprise) | Up to 12,500 | Scales with repos/users |

**Secondary limits:**
- GraphQL queries without mutations: 1 point each
- GraphQL requests with mutations: 5 points each
- Maximum 100 concurrent requests
- Minimum 1 second between mutative requests

### 17.2 Cost Estimation

A typical `/maxsim:go` read cycle costs approximately:

| Operation | Cost |
|-----------|------|
| Query rate limit | 1 |
| Get project node ID + fields | 2–5 |
| Get project items (paginated, 100/page) | 3–8 |
| Get issue bodies (REST, parallel) | 1/issue |
| Read issue comments | 1–3/issue |
| **Total (20-item board)** | ~30–50 points |

A `/maxsim:plan N` cycle (read + create issues + update fields):

| Operation | Cost |
|-----------|------|
| Read operations | ~30 |
| Create 5 sub-issues (REST) | 5 |
| Update project fields (mutations) | 5 × 5 = 25 |
| Add issues to project (mutations) | 5 × 5 = 25 |
| Post plan comment | 5 |
| **Total** | ~90 points |

This budget is well within limits for normal usage. Problems only arise with automated agents making hundreds of updates per hour.

### 17.3 Mitigation Strategies

1. **Check before bulk operations:** Always query `rateLimit` before any loop that makes >10 requests. Abort and wait if `remaining < 500`.
2. **Prefer REST for individual issue operations:** REST calls cost 1 point each (flat), while some GraphQL mutations cost 5 points. Use REST for simple CRUD, GraphQL for complex queries.
3. **Cache project structure:** Project ID, field IDs, and field option IDs don't change. Cache them in memory for the duration of a session. Never re-query these.
4. **Batch mutations:** When updating multiple items, batch within a single GraphQL request using aliases if the API supports it.
5. **1-second delay between mutations:** Required by GitHub's secondary rate limits. MaxsimCLI's GitHub client enforces this automatically.
6. **Exponential backoff:** If a 429 response is received, back off exponentially starting at 60 seconds.
7. **Webhooks over polling:** Use GitHub Actions webhooks for status-change reactions instead of polling the API in a loop.

### 17.4 GitHub Actions Token Note

The default `GITHUB_TOKEN` in GitHub Actions has only 1,000 points/hour per repository. For workflows that manage projects (which require a PAT with `project` scope anyway), use `MAXSIM_PROJECT_TOKEN` — a PAT which gets the full 5,000 point allowance.

---

## 18. Roadmap as Milestones

### 18.1 Roadmap Creation During Init

During `/maxsim:init`, if the user requests a roadmap:

1. Planner agent conducts the project interview.
2. Based on the project description, goals, and scope, the Planner proposes:
   - 3–5 Milestones representing major releases or quarterly goals
   - 15–30 Phases distributed across Milestones
3. User reviews and approves the roadmap proposal.
4. MaxsimCLI creates:
   - All Milestones via `gh milestone create`
   - All Phase Issues (with frontmatter, body template, labels)
   - Phase Issues added to Project Board with Status = Backlog
   - Phase Issues linked to their Milestone

### 18.2 Roadmap Visibility

The Roadmap view on the Project Board (configured during init) shows Milestones and their associated issues on a timeline. This provides the visual roadmap without any additional tooling.

For issue-level granularity, the **Phase Breakdown** table view groups all tasks by phase, showing wave assignments and estimates.

### 18.3 Roadmap Evolution

The roadmap is not static. As the project evolves:

- New phases can be added by the user (via GitHub Issues or via `/maxsim:plan` for a new phase number).
- Phase scope can be adjusted by editing the Phase Issue body.
- Milestones can be reordered by changing which Milestone a Phase Issue belongs to.
- New Milestones can be created for scope expansions.

MaxsimCLI does not prevent roadmap evolution — it tracks whatever GitHub contains.

### 18.4 Brownfield Projects

For existing projects (`/maxsim:init` on a codebase with existing code):

1. 30–40 parallel Researcher agents scan the codebase simultaneously.
2. Agents identify: existing features, tech stack, test coverage, architectural patterns, known issues.
3. Planner synthesizes findings into a proposed roadmap: remaining work, technical debt phases, enhancement phases.
4. User reviews and confirms before any GitHub artifacts are created.

---

## 19. Querying Project State

`/maxsim:go` must determine project state on every invocation to decide what action to take. The state query is designed to be fast and complete.

### 19.1 State Query Algorithm

```
1. Query rateLimit (1 point)
2. Query project items with field values and issue content (3–8 points, paginated)
3. Filter items by Status field:
   - In Progress items → extract phase, task, assignee, branch
   - In Review items → extract phase, task
   - To Do items → extract phase, task, estimate, wave
   - Blocked items → extract blocked-by relationships
4. Query open user issues (REST /issues?state=open, 1 point)
   - Filter to those missing maxsim:auto-created label
5. Determine state:
   - If In Progress items exist → continue execution monitoring
   - If In Review items exist → check verification status
   - If To Do items exist → ready to execute next wave
   - If user issues exist → surface for triage
   - If all Done → project complete (or next phase needs planning)
6. Propose action to user
```

### 19.2 State Representation

MaxsimCLI maintains an in-memory state object during a session:

```typescript
interface MaxsimProjectState {
  projectId: string;
  fieldIds: Record<string, string>;        // field name → field ID
  fieldOptionIds: Record<string, Record<string, string>>; // field → option → ID
  activeMilestone: string | null;
  activePhase: number | null;
  itemsByStatus: {
    backlog: ProjectItem[];
    todo: ProjectItem[];
    inProgress: ProjectItem[];
    inReview: ProjectItem[];
    done: ProjectItem[];
  };
  blockedItems: ProjectItem[];
  userIssues: GitHubIssue[];
  rateLimitRemaining: number;
  rateLimitResetAt: Date;
}
```

This object is built once per session from the full state query and updated incrementally as operations are performed.

### 19.3 gh CLI vs GraphQL

MaxsimCLI uses `gh` CLI for simplicity where possible:

| Operation | Method |
|-----------|--------|
| Create issue | `gh issue create` |
| Close issue | `gh issue close` |
| Add label | `gh issue edit --add-label` |
| Create milestone | `gh milestone create` |
| Read issue body | `gh api /repos/{r}/issues/{n}` |
| List issues | `gh issue list --json` |
| Query project | GraphQL (no REST equivalent) |
| Update project fields | GraphQL (required for ProjectV2) |
| Add to project | GraphQL (required for ProjectV2) |

---

## 20. IssueOps Patterns

MaxsimCLI uses IssueOps — GitHub Issues as a command interface — for specific workflows where asynchronous human approval is needed.

### 20.1 The Approval Gate Pattern

When MaxsimCLI needs user approval (e.g., plan approval during unattended execution), it posts a structured comment on the Phase Issue and waits for a triggering comment:

**MaxsimCLI posts:**
```markdown
<!-- maxsim:type=approval-request phase=2 expires=2026-03-23T10:00:00Z -->

## Approval Requested — Phase 2 Plan

The plan for Phase 2 (User Profile Management) is ready for your review.

**Summary:** 5 tasks, 2 waves, estimated 18 story points.

[View full plan](#comment-123456789)

To approve, comment: `/maxsim approve`
To reject and re-plan, comment: `/maxsim replan`
To abort, comment: `/maxsim abort`
```

**GitHub Actions workflow listens for:**
```yaml
on:
  issue_comment:
    types: [created]
```

**Workflow checks:**
1. Comment is on a MaxsimCLI-managed Phase Issue (has `type:phase` label)
2. Comment body matches `/maxsim (approve|replan|abort)`
3. Comment author has write access to the repository
4. A pending approval request exists (`approval-request` comment without a corresponding resolution)

**On match:** The workflow triggers the appropriate MaxsimCLI action (continue execution, re-run planning, or close the phase issue).

### 20.2 Error Escalation Pattern

When MaxsimCLI exhausts retries, it escalates to the user via an `escalation` comment:

```markdown
<!-- maxsim:type=escalation task=1.2 retries=3 -->

## Human Intervention Required — Task 1.2

Task 1.2 (OAuth provider integration) has failed 3 consecutive verification attempts.

### Failure Summary

**Attempt 1:** Type error in `GoogleStrategy` callback (fixed in retry 1)
**Attempt 2:** Missing `state` parameter validation (fixed in retry 2)
**Attempt 3:** Test suite expects mock that conflicts with live HTTP client

### Diagnostic Information

- Branch with latest attempt: `maxsim/phase-1-task-2-attempt-3`
- Test output: [see comment below]
- All code changes are preserved on the branch above

### Options

Comment with one of the following to continue:

- `/maxsim retry` — Try again (only useful if you've pushed changes to the branch)
- `/maxsim skip task-1.2` — Skip this task and continue with the rest of the phase
- `/maxsim manual` — Mark as manually resolved (closes this issue when done)
- `/maxsim abort phase-1` — Abort this phase entirely

**This phase is paused until you respond.**
```

### 20.3 IssueOps Security

All IssueOps commands require:
1. **Author verification:** The commenting user must have `write` or `admin` access to the repository.
2. **Context verification:** The command is only valid on an issue that has an active MaxsimCLI operation.
3. **Single execution:** Commands are idempotent and track whether they've been processed (via a reaction or status label) to prevent double-execution.

Verification is done within the GitHub Actions workflow using the GitHub API to check collaborator permission level before processing any command.

---

## Appendix A: Complete Init Checklist

During `/maxsim:init`, MaxsimCLI creates the following GitHub artifacts in order:

**Phase 1 — Labels (idempotent)**
- [ ] 5 `type:*` labels
- [ ] 4 `priority:*` labels
- [ ] 6 `status:*` labels
- [ ] 20 `phase:N` labels (1–20)
- [ ] 5 `area:*` labels (project-specific)
- [ ] 5 `maxsim:*` meta labels

**Phase 2 — Project Board**
- [ ] Create ProjectV2 named `{Project Name} — MaxsimCLI`
- [ ] Create 5 Status field options (Backlog, To Do, In Progress, In Review, Done)
- [ ] Create Priority single-select field with 4 options
- [ ] Create Phase number field
- [ ] Create Wave number field
- [ ] Create Estimate number field
- [ ] Create Type single-select field
- [ ] Enable Sub-issue progress field
- [ ] Create Board view (grouped by Status)
- [ ] Create Phase Breakdown table view
- [ ] Create Roadmap view
- [ ] Enable built-in automation: `closed → Done`

**Phase 3 — Wiki**
- [ ] Initialize Wiki (create Home.md)
- [ ] Create all 9 Wiki pages from templates
- [ ] Populate with project-specific content from init interview

**Phase 4 — Discussions**
- [ ] Create "Architecture Decisions" Discussion category

**Phase 5 — GitHub Actions**
- [ ] Create `.github/workflows/maxsim-add-to-board.yml`
- [ ] Create `.github/workflows/maxsim-status-transitions.yml`
- [ ] Create `.github/workflows/maxsim-label-sync.yml`
- [ ] Create `.github/workflows/maxsim-user-issue-detect.yml`
- [ ] Create `.github/workflows/maxsim-issueops.yml`
- [ ] Prompt user to add `MAXSIM_PROJECT_TOKEN` secret

**Phase 6 — Issues**
- [ ] Create Project Overview issue with pinned position
- [ ] If roadmap requested: create Milestones and Phase Issues

**Phase 7 — CLAUDE.md**
- [ ] Generate project-root CLAUDE.md with project name, board URL, active phase

---

## Appendix B: File and URL Reference

| Artifact | Location/URL Pattern |
|----------|---------------------|
| Project Board | `https://github.com/orgs/{owner}/projects/{N}` |
| Phase Issue | `https://github.com/{owner}/{repo}/issues/{N}` |
| Milestone | `https://github.com/{owner}/{repo}/milestone/{N}` |
| Wiki Home | `https://github.com/{owner}/{repo}/wiki` |
| Discussions | `https://github.com/{owner}/{repo}/discussions` |
| GitHub Actions | `https://github.com/{owner}/{repo}/actions` |
| Labels | `https://github.com/{owner}/{repo}/labels` |

---

## Appendix C: Related Files in MaxsimCLI Source

| File | Purpose |
|------|---------|
| `packages/cli/src/github/labels.ts` | Label manifest and creation |
| `packages/cli/src/github/project.ts` | ProjectV2 creation and field management |
| `packages/cli/src/github/issues.ts` | Issue creation, body templates, comment posting |
| `packages/cli/src/github/graphql.ts` | GraphQL query helpers with pagination |
| `packages/cli/src/github/milestones.ts` | Milestone creation and management |
| `packages/cli/src/github/wiki.ts` | Wiki initialization |
| `packages/cli/src/github/markers.ts` | HTML comment marker parsing/writing |
| `packages/cli/src/github/state.ts` | Project state querying and caching |
| `packages/cli/src/github/issueops.ts` | IssueOps command processing |
| `templates/workflows/` | GitHub Actions workflow templates |
| `templates/wiki/` | Wiki page templates |

---

*This document is authoritative for the MaxsimCLI GitHub structure. All implementation in `packages/cli/src/github/` must conform to the specifications defined here. Last updated: 2026-03-22.*
