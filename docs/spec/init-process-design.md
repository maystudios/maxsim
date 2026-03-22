# MaxsimCLI Init Process Design

**Status:** Design Specification
**Author:** Research synthesis via Claude Code
**Date:** 2026-03-22
**Scope:** Complete initialization workflow for `/maxsim:init`

---

## Executive Summary

The `/maxsim:init` command is the highest-leverage moment in any project's lifecycle. Everything downstream — plans, execution, verification — runs on the context created here. A vague or shallow init produces a project that requires constant correction. A deep init produces a project that practically runs itself.

This document designs the complete init process end-to-end: parallel scanning, adaptive interviewing, GitHub scaffolding, local file setup, and optional roadmap generation.

---

## Design Principles

Before specifying mechanics, establish the principles that govern every decision:

**1. Scan before asking.** Never ask a user what language they use when we can read `package.json`. Never ask about test setup when `jest.config.ts` exists. Questions should extend understanding, not discover what tools can find.

**2. Questions are dream extraction, not requirements gathering.** The user has a fuzzy idea. Our job is to sharpen it. We are a thinking partner, not an interviewer executing a checklist.

**3. Parallel everything that can be parallel.** The scan phase has zero dependencies between agents. Run all simultaneously. Time is the most visible quality signal to a user.

**4. Fail fast on prerequisites.** If GitHub remote is missing or `gh` is not authenticated, stop immediately with a clear fix. Do not degrade gracefully into local-only mode — that creates a false sense of completion.

**5. The init output is the source of truth.** Every planning document created here becomes the canonical reference for all downstream phases. Invest depth here, reap compounding returns throughout the project.

**6. Adaptive, not scripted.** Greenfield and brownfield projects have fundamentally different information needs. The process must branch meaningfully at every stage, not merely display different banners.

---

## Routing: The Thin Router Pattern

The `/maxsim:init` command is a router, not a monolith. It detects project state and delegates to the appropriate sub-workflow. This separation keeps each sub-workflow focused and testable.

### State Detection Matrix

```bash
PLANNING_EXISTS=$(test -d .planning && echo "true" || echo "false")
ROADMAP_EXISTS=$(test -f .planning/ROADMAP.md && echo "true" || echo "false")
```

| `.planning/` exists | `ROADMAP.md` exists | Route |
|---------------------|---------------------|-------|
| false | — | **Scenario A:** New Project (greenfield) |
| true | false | **Scenario B:** Existing Project (brownfield init) |
| true | true | **Scenario C/D:** Active or complete milestone |

For Scenario C vs D: check if all phases show `status: complete`. If yes → Scenario D (Milestone Complete). Otherwise → Scenario C (Active Milestone).

### Brownfield Detection Signals

Before routing, examine the working directory for brownfield indicators. These signals inform the router whether to suggest codebase mapping:

| Signal | Weight | Detection |
|--------|--------|-----------|
| Source files exist (`.js`, `.ts`, `.py`, `.go`, `.rs`, etc.) | High | `find . -name "*.ext" -not -path "*/node_modules/*"` |
| `package.json` or `pyproject.toml` or `go.mod` present | High | File existence check |
| `src/` or `lib/` or `app/` directories | Medium | Directory existence |
| `.git/` with commits beyond initial | Medium | `git log --oneline -5` |
| Existing `README.md` with content | Low | File size check |
| CI config present (`.github/workflows/`, `.gitlab-ci.yml`) | Medium | File existence |
| Test directories (`__tests__/`, `spec/`, `tests/`) | Medium | Directory existence |

A score of 3+ high or 5+ any signals → set `is_brownfield=true` → suggest codebase mapping before init.

---

## Phase 1: SCAN (Parallel Researcher Agents)

### Purpose

Extract everything knowable from the filesystem before asking a single question. This transforms the interview from discovery to confirmation and extension. It also catches contradictions (README says React, code is Angular) that the user may not even know about.

### When to Run

- **Brownfield always:** The scan is mandatory for `init-existing`.
- **Greenfield optionally:** If brownfield signals detected, offer scan. Skip for true greenfield (empty repo).
- **Auto mode:** Always run if any code detected.

### Agent Architecture: 30+ Parallel Researchers

The scan uses specialized agents that run simultaneously. Each agent has a narrow focus — this is why 30 agents outperforms 4 generalists. Narrow focus means the agent can go deep without running out of context capacity.

**Agent grouping strategy:** Spawn in waves of 5-8 agents using `Task(run_in_background=true)`. More than 8 simultaneous agents risks API rate limits; batching 3-5 concurrent is the most reliable pattern per current Claude Code sub-agent best practices.

#### Wave 1: Foundation (run first, others may depend on findings)

| Agent | Output File | Focus |
|-------|-------------|-------|
| `stack-detector` | `STACK.md` | Languages, runtimes, frameworks, package managers |
| `manifest-reader` | `MANIFESTS.md` | package.json, pyproject.toml, go.mod, Cargo.toml — all deps with versions |
| `structure-mapper` | `STRUCTURE.md` | Directory tree, entry points, module boundaries |
| `readme-parser` | `README-ANALYSIS.md` | What the README claims, how complete it is |
| `git-historian` | `GIT-HISTORY.md` | Commit frequency, contributors, branch patterns, last active areas |

#### Wave 2: Architecture (after Wave 1 completes)

| Agent | Output File | Focus |
|-------|-------------|-------|
| `arch-detective` | `ARCHITECTURE.md` | Patterns (MVC, hexagonal, microservices, monolith), layers, data flow |
| `api-scanner` | `API-SURFACE.md` | Exposed endpoints, GraphQL schema, tRPC routers, WebSocket handlers |
| `data-model-reader` | `DATA-MODEL.md` | DB schema, ORM models, migration files, data relationships |
| `auth-detector` | `AUTH.md` | Authentication mechanism (JWT, sessions, OAuth), authorization approach |
| `config-reader` | `CONFIG.md` | Environment variables, `.env.example`, feature flags, secrets patterns |

#### Wave 3: Quality & Operations

| Agent | Output File | Focus |
|-------|-------------|-------|
| `test-scanner` | `TESTING.md` | Test frameworks, coverage config, test patterns, what's covered |
| `ci-reader` | `CI-CD.md` | CI pipelines, deployment steps, environments (dev/staging/prod) |
| `lint-formatter` | `CODE-STYLE.md` | ESLint/Prettier/Ruff/golangci config, formatting rules |
| `error-handler-detector` | `ERROR-HANDLING.md` | How errors propagate, logging patterns, error boundaries |
| `perf-scanner` | `PERFORMANCE.md` | Caching layers, CDN config, bundle analysis config, DB indexing |

#### Wave 4: Security & Concerns

| Agent | Output File | Focus |
|-------|-------------|-------|
| `security-scanner` | `SECURITY.md` | Dependency vulnerabilities (audit), secrets in code, auth gaps |
| `debt-detector` | `TECH-DEBT.md` | TODO/FIXME/HACK comments, deprecated APIs in use, outdated deps |
| `dependency-graph` | `DEPENDENCIES.md` | Internal module dependencies, circular dependencies |
| `bundle-analyzer` | `BUILD.md` | Build tooling (Webpack/Vite/esbuild), build output size, optimization |
| `monitoring-scanner` | `OBSERVABILITY.md` | Logging setup, error tracking (Sentry), APM, analytics |

#### Wave 5: Product & Domain

| Agent | Output File | Focus |
|-------|-------------|-------|
| `feature-lister` | `FEATURES.md` | What the app actually does (inferred from routes, components, models) |
| `ui-scanner` | `UI-PATTERNS.md` | Component library, design system, UI patterns, accessibility config |
| `i18n-detector` | `INTERNATIONALIZATION.md` | i18n setup, supported locales, translation files |
| `notification-scanner` | `NOTIFICATIONS.md` | Email, push, in-app, WebSocket notification setup |
| `file-upload-scanner` | `FILE-HANDLING.md` | File upload patterns, storage (S3, local, CDN), image processing |

#### Wave 6: Scale & Infrastructure

| Agent | Output File | Focus |
|-------|-------------|-------|
| `infra-scanner` | `INFRASTRUCTURE.md` | Docker, Kubernetes, Terraform, cloud provider config |
| `cache-detector` | `CACHING.md` | Redis, memcached, CDN, service worker, in-memory cache |
| `search-scanner` | `SEARCH.md` | Elasticsearch, Algolia, vector search, full-text search setup |
| `queue-scanner` | `QUEUES.md` | Job queues (Bull, Sidekiq, Celery), background workers |
| `third-party-scanner` | `INTEGRATIONS.md` | Stripe, SendGrid, Twilio, Cloudinary, and other external services |

#### Wave 7: Conventions & Patterns (depth pass)

| Agent | Output File | Focus |
|-------|-------------|-------|
| `naming-convention-agent` | `NAMING.md` | File naming, variable naming, function naming patterns in actual code |
| `import-pattern-agent` | `IMPORTS.md` | Import organization, path aliases, barrel files |
| `testing-pattern-agent` | `TEST-PATTERNS.md` | How tests are structured, mock patterns, test data factories |
| `documentation-scanner` | `DOCUMENTATION.md` | JSDoc, inline docs, external docs, documentation coverage |
| `migration-scanner` | `MIGRATIONS.md` | DB migration history, migration strategy, pending migrations |

### Aggregation: Synthesizer Agent

After all waves complete, a single synthesizer agent reads all output files and produces:

```
.planning/codebase/SYNTHESIS.md
```

Synthesis format:

```markdown
# Codebase Synthesis

**Scanned:** [date]
**Agents run:** [count]
**Files analyzed:** [count]

## Project Identity

[1-2 sentence description of what the project is and does]

## Tech Stack (Confirmed)

- **Language:** TypeScript 5.4
- **Runtime:** Node.js 20 LTS
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL 15 via Prisma ORM
- **Auth:** NextAuth.js with GitHub OAuth
- **Testing:** Vitest + React Testing Library (62% coverage)
- **CI/CD:** GitHub Actions → Vercel

## Architecture Pattern

[Pattern name] — [1-2 sentence description]

## Project Stage Assessment

| Indicator | Finding |
|-----------|---------|
| Commit count | [N] commits, [N] months active |
| Test coverage | [N]% |
| Documentation | [assessment] |
| Technical debt | [Low/Medium/High] — [key items] |
| Production readiness | [assessment] |

## Key Findings for Interview

These are the things the agent scan found that should inform or skip interview questions:

- Auth approach: CONFIRMED (NextAuth GitHub OAuth) — skip auth question
- Database: CONFIRMED (PostgreSQL/Prisma) — skip data model question
- Testing: PARTIALLY COVERED — ask about coverage targets and testing philosophy
- Deployment: INFERRED (Vercel config detected) — confirm in interview
- Monitoring: NOT FOUND — ask about observability strategy

## Concerns & Risks

1. [Critical concern] — [evidence]
2. [High concern] — [evidence]
3. [Medium concern] — [evidence]

## README Discrepancies

- [Discrepancy 1]: README claims X, code shows Y
- (None detected)
```

### Aggregation Pattern

The synthesizer agent operates after all wave agents report completion. Implementation:

```
// After all Task() calls with run_in_background=true complete:
Task(
  subagent_type="synthesizer",
  model="{synthesizer_model}",
  run_in_background=false,  // Wait for this one
  description="Synthesize codebase scan results",
  prompt="Read all files in .planning/codebase/.
  Write .planning/codebase/SYNTHESIS.md using the synthesis template.
  Your job is to produce a structured overview that an AI interview agent
  can use to skip redundant questions and focus on what's actually unknown.
  Be specific. Cite file paths as evidence. Flag contradictions."
)
```

### Progress Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► SCANNING CODEBASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Wave 1: Foundation (5 agents)...
◆ Wave 2: Architecture (5 agents)...
◆ Wave 3: Quality & Operations (5 agents)...
◆ Wave 4: Security & Concerns (5 agents)...
◆ Wave 5: Product & Domain (5 agents)...
◆ Wave 6: Infrastructure (5 agents)...
◆ Wave 7: Conventions (5 agents)...

◆ Synthesizing results...

✓ Scan complete. 35 agents, [N] files analyzed in [T]s.
  Findings: [N] confirmed, [N] inferred, [N] unknown
```

---

## Phase 2: INTERVIEW (Adaptive Questioning)

### Philosophy

The interview is not a form. It is a conversation with a purpose: extract enough clarity to write planning documents that downstream phases can execute without guessing.

The scan tells us what exists. The interview tells us:
- Where the project is going (goals, vision)
- What success looks like (acceptance criteria)
- What to explicitly avoid (no-gos)
- What the user values most (priorities)
- What would make it fail (risks)

### Pre-Interview: Loading Scan Context

Before asking any question, the interview agent reads `SYNTHESIS.md` and builds an internal map:

```
CONFIRMED domains: [list from synthesis "Key Findings for Interview"]
INFERRED domains: [list] — confirm rather than re-discover
UNKNOWN domains: [list] — these drive the questions
CONCERNS: [list] — these should be raised as risks
```

This map prevents the interview from asking what we already know.

### Interview Structure

#### Opening (freeform, no AskUserQuestion)

For **greenfield projects:**
```
"What do you want to build?"
```
Wait. Let them dump their mental model. This is the most important input.

For **brownfield projects:**
```
"I've scanned the codebase. Here's what I found:

[Synthesis summary — 5-8 bullet points from SYNTHESIS.md]

A few things jumped out: [key concerns or discrepancies]

What are you trying to accomplish with this codebase next?"
```

The brownfield opening serves dual purpose: validates the scan (user corrects misunderstandings) and pivots to future direction.

#### Question Categories (Adaptive)

Questions are organized by domain. Each domain is marked as COVERED (skip), INFERRED (confirm only), or UNKNOWN (ask fully) based on scan results.

**Domain 1: Identity & Vision**

Purpose: Establish what this project is and why it exists. The scan knows *what* but not *why*.

| Question | When to ask | AskUserQuestion? |
|----------|-------------|-----------------|
| "What do you want to build?" | Always (greenfield opening) | No — freeform |
| "What problem does this solve?" | After initial dump | No — follow thread |
| "Who is this for?" | When user is vague about audience | Yes — options: "Myself", "Small team", "Paying customers", "Let me explain" |
| "What's the core value this delivers?" | When motivation is unclear | No — follow thread |
| "What does the current workflow look like without this?" | To make the problem concrete | No — follow thread |

**Domain 2: Goals & Milestones**

Purpose: Understand what "done" looks like at different timescales.

| Question | When to ask | AskUserQuestion? |
|----------|-------------|-----------------|
| "What does v1 look like?" | Always | No — follow thread |
| "What does 'done' look like for this milestone?" | After vision established | Yes — confirm scope |
| "What would you cut if you had to ship in half the time?" | To reveal priorities | Yes — options from described features |
| "Is there a deadline or forcing function?" | When scope feels unbounded | No — direct question |

**Domain 3: Tech Stack**

Purpose: Confirm inferred stack choices and fill gaps.

For CONFIRMED items from scan: "I see you're using [X]. Any plans to change that?" (quick confirm)

For INFERRED items: "I detected what looks like [X] — is that the primary [category]?"

For UNKNOWN items: Ask directly with options.

Full question list for unknown stack:

| Question | Options |
|----------|---------|
| Frontend framework | "React", "Vue", "Svelte", "Angular", "None (server-rendered)", "Let me explain" |
| State management | "React Query / SWR", "Redux / Zustand", "Server state only", "Let me explain" |
| Database | "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Multiple", "Let me explain" |
| Auth approach | "OAuth (GitHub/Google)", "Email+password", "Magic links", "API keys", "None", "Let me explain" |
| Deployment target | "Serverless (Vercel/Lambda)", "Container (Docker/K8s)", "VPS", "Edge", "Let me explain" |
| API style | "REST", "GraphQL", "tRPC", "gRPC", "None (internal)", "Let me explain" |

**Domain 4: Conventions & Standards**

Purpose: Establish rules that planning agents must follow.

| Question | When to ask | AskUserQuestion? |
|----------|-------------|-----------------|
| "What naming convention do you use for files?" | Always (brownfield: confirm from scan) | Yes — options from detected pattern |
| "What's your test philosophy?" | Always | Yes — "TDD (test first)", "Test alongside", "Test after", "Minimal tests", "No tests" |
| "Any code style rules I should know?" | When scan found linting but no config | No — direct |
| "Are there patterns you want agents to always follow?" | After stack confirmed | No — open-ended |
| "Are there patterns you want agents to never use?" | After conventions established | No — open-ended (feeds no-gos) |

**Domain 5: Testing Strategy**

Purpose: Define what testing completeness looks like for this project.

| Question | When to ask | AskUserQuestion? |
|----------|-------------|-----------------|
| "Coverage target?" | After test philosophy established | Yes — "None", ">50%", ">80%", "100% critical paths" |
| "Which tests are mandatory per feature?" | When scan shows inconsistent coverage | Yes — "Unit", "Integration", "E2E", "All of these" |
| "Do you do TDD?" | Follow-up after philosophy | No — direct confirm |
| "Any tests I should never delete or skip?" | Brownfield: highlight high-value existing tests | No — open-ended |

**Domain 6: Deployment & Environments**

Purpose: Understand the deployment model so phase plans can include the right steps.

| Question | When to ask | AskUserQuestion? |
|----------|-------------|-----------------|
| "How many environments?" | When CI not found or unclear | Yes — "Dev only", "Dev + Prod", "Dev + Staging + Prod" |
| "Who owns deployment?" | When CI exists but process unclear | Yes — "Manual (I deploy)", "CI/CD auto-deploy", "Separate ops team" |
| "Any environment-specific behavior?" | After environments established | No — follow thread |
| "Any external services that need staging equivalents?" | When integrations detected | No — confirm list from scan |

**Domain 7: Acceptance Criteria**

Purpose: Define measurable "done" so agents can verify their own work.

This is always asked because the scan cannot infer what "working correctly" means.

AskUserQuestion pattern:
- header: "Done"
- question: "How will you know when this phase/project is working correctly?"
- options: [project-specific examples of observable outcomes]

Follow-up if answer is vague:
- "You said 'it works' — what would you actually click or call to verify that?"
- "What's the minimum observable behavior that would let you ship with confidence?"

**Domain 8: No-Gos & Anti-Patterns**

Purpose: Capture explicit exclusions and forbidden patterns.

These are gathered as a side channel throughout the conversation, not as a dedicated question block. Watch for:
- "I don't want X"
- "We burned on Y before"
- "Absolutely not Z"
- "That's an anti-pattern in this codebase"
- "The last developer did X and it was a disaster"

After 5+ questioning rounds, weave challenge probes:
- "What would make this project fail?"
- "What's the one decision you'd regret in 6 months?"
- "If a new developer joined tomorrow, what mistakes would you warn them about?"
- "What shortcuts are tempting but dangerous for this kind of project?"

Domain-aware anti-pattern suggestions (offer as food for thought, not checklist):
- SaaS: shared-DB multi-tenancy without isolation, secrets in code, vendor lock-in, skipping audit logging
- CLI tool: global mutable state, implicit env dependencies, silent failures with zero exit code
- API/backend: N+1 queries, unbounded response sizes, missing rate limits, missing idempotency keys
- Mobile: assuming always-online, blocking main thread, ignoring battery impact

**Domain 9: Risks & Unknowns**

Purpose: Surface what the user knows they don't know.

| Question | When to ask |
|----------|------------|
| "What's the biggest technical risk in this project?" | After core design established |
| "What have you tried before that didn't work?" | When brownfield or repeat attempt |
| "What would cause you to stop this project?" | When scope feels uncertain |
| "What do you need to learn or research before this can succeed?" | When technology choices are speculative |

Concerns from the scan (in `SYNTHESIS.md`) are raised here:
"I noticed [specific concern from scan]. Is that something we need to address in this milestone?"

### Greenfield vs. Brownfield Adaptive Differences

| Aspect | Greenfield | Brownfield |
|--------|------------|------------|
| Opening question | "What do you want to build?" | Scan summary + "What's next?" |
| Tech stack questions | Full discovery | Confirm/correct scan findings |
| Conventions questions | Establish from scratch | Confirm inferred patterns |
| Existing capabilities | None | Listed as "Validated" in requirements |
| Concern questions | Anticipatory risks | Specific findings from scan |
| Acceptance criteria | Hypotheses until shipped | Differentiated: existing vs. new behavior |
| No-gos | Speculative ("avoid X") | Specific ("the existing X approach breaks") |

### Voice Input Considerations

Questions asked via AskUserQuestion support voice input naturally when the Claude Code client has voice enabled. Design choices that optimize for voice:

- Options should be pronounceable without confusion ("YOLO mode" is fine; "TRPCv4-gRPC" is not)
- Question text should work as spoken questions, not command prompts
- Headers (max 12 characters enforced) must be meaningful when announced: "Mode", "Depth", "Auth" — not "CFG-A", "OPT3"
- Provide "Let me explain" as an escape hatch for every option question — this handles the case where no option fits and the user wants to speak freely
- After voice input, the agent should read back the understood answer before proceeding: "Got it — you want OAuth via GitHub. Moving on."

### AskUserQuestion Usage Rules

**Batching:** Group related questions (same domain, same decision area) into a single AskUserQuestion call. Maximum 4 questions per call — beyond that, cognitive load increases and answers become less reliable.

**Option count:** 2-4 options per question. Never more than 5. Two-option questions (binary choices) work best for voice.

**"Let me explain" escape:** Always include when the question has options. This prevents forcing a user into an ill-fitting answer and produces richer freeform responses.

**Headers:** Max 12 characters, enforced by validation. Must be meaningful standalone: "Auth", "Testing", "Deploy" — not abbreviations or codes.

**Never ask about:** The user's technical experience level. Claude builds. The user directs. This distinction matters.

### Gate Logic: When to Offer "Create PROJECT.md"

Two conditions must both be true:

1. **Minimum rounds:** 10 AskUserQuestion calls completed
2. **Domain coverage:** 80% of relevant domains covered (COVERED or N/A)

Before presenting the gate, display a coverage summary:

```
I think I have a solid picture. Here's what we've covered:

**Core:** Auth (confirmed), Data model (confirmed), API style (N/A), Deployment (confirmed), Error handling (covered), Testing (covered)
**Infrastructure:** CI/CD (confirmed), Environments (confirmed), Caching (N/A), Search (N/A), Monitoring (covered)
**UX/Product:** Roles (covered), Notifications (N/A), Uploads (N/A), i18n (N/A), Accessibility (N/A)
**Scale/Ops:** Performance (covered), Concurrency (N/A), Migration (covered), Backup (N/A), Rate limiting (N/A)

Coverage: 14/16 relevant domains (88%) — 11 rounds
```

Then offer the gate via AskUserQuestion:
- header: "Ready?"
- question: "Ready to write the project documents?"
- options: ["Write documents", "Keep exploring"]

---

## Phase 3: GITHUB SETUP

### Prerequisites Gate (Mandatory)

The GitHub setup is not optional. MaxsimCLI uses GitHub Issues to track phases. Without a GitHub remote and authenticated `gh` CLI, the workflow must stop. There is no local-only fallback.

```bash
# Check 1: GitHub remote
REMOTE=$(git remote get-url origin 2>/dev/null)
if [ -z "$REMOTE" ]; then
  echo "NO_REMOTE"
fi

# Check 2: gh authentication
gh auth status 2>/dev/null | grep -q "Logged in" || echo "NOT_AUTHENTICATED"

# Check 3: Verify remote is GitHub
echo "$REMOTE" | grep -q "github.com" || echo "NOT_GITHUB"
```

Failure messages are actionable, not apologetic:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► NO GITHUB REMOTE FOUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAXSIM requires a GitHub remote to track phases as Issues.

Fix:
  git remote add origin https://github.com/your-org/your-repo.git

Then re-run /maxsim:init.
```

### Creating a Repo (New Projects Only)

If the project has no GitHub remote at all (true greenfield), offer to create one:

```
AskUserQuestion:
- header: "GitHub Repo"
- question: "Create a new GitHub repository?"
- options:
  - "Yes, private (Recommended)" — Create private repo under your account
  - "Yes, public" — Create public repo
  - "No, I'll set it up manually" — Exit and return when remote is configured
```

If creating:

```bash
# Derive repo name from directory name
REPO_NAME=$(basename $(pwd) | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

# Create private repo
gh repo create "$REPO_NAME" --private --source=. --remote=origin --push

# Or public
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
```

### GitHub Project Board

Create a Projects v2 board for the milestone. Uses GraphQL API via `gh api`:

```bash
# Get owner and repo
OWNER=$(gh repo view --json owner --jq '.owner.login')
REPO=$(gh repo view --json name --jq '.name')

# Create project
gh api graphql -f query='
  mutation {
    createProjectV2(input: {
      ownerId: "[owner-id]"
      title: "[Project Name] — Milestone 1"
    }) {
      projectV2 { id number url }
    }
  }
'
```

**Kanban columns to create:**

| Column | Purpose |
|--------|---------|
| Backlog | Phases not yet started |
| In Planning | Phase currently being planned |
| In Progress | Phase actively being executed |
| In Review | Phase waiting for verification |
| Done | Phase verified and complete |
| Blocked | Phase paused waiting for external input |

**Required fields to add to the board:**

| Field | Type | Values |
|-------|------|--------|
| Status | Single select | Backlog, Planning, In Progress, Review, Done, Blocked |
| Phase | Number | 1-N |
| Priority | Single select | Critical, High, Medium, Low |
| Effort | Single select | Small (< 1 day), Medium (1-3 days), Large (3-7 days) |
| Sprint | Iteration | Auto-created |

### Labels

Create a standard label set for the repository. These labels structure all Issues created during the project lifecycle:

```bash
# Phase labels
gh label create "phase" --color "0052cc" --description "Phase tracking issue"
gh label create "plan" --color "1d76db" --description "Execution plan within a phase"
gh label create "milestone" --color "e4e669" --description "Milestone tracking"

# Status labels
gh label create "status: backlog" --color "d3d3d3" --description "Not yet started"
gh label create "status: in-progress" --color "0075ca" --description "Currently being worked on"
gh label create "status: blocked" --color "e11d48" --description "Blocked, needs attention"
gh label create "status: done" --color "2da44e" --description "Complete and verified"

# Type labels
gh label create "type: feature" --color "5319e7" --description "New feature or capability"
gh label create "type: fix" --color "d93f0b" --description "Bug fix"
gh label create "type: refactor" --color "f9d0c4" --description "Code improvement without behavior change"
gh label create "type: docs" --color "fef2c0" --description "Documentation"
gh label create "type: test" --color "c2e0c6" --description "Test coverage"
gh label create "type: chore" --color "bfd4f2" --description "Maintenance, tooling, dependencies"

# Priority labels
gh label create "priority: critical" --color "b60205" --description "Must be done immediately"
gh label create "priority: high" --color "e11d48" --description "Important, do next"
gh label create "priority: medium" --color "fbca04" --description "Normal priority"
gh label create "priority: low" --color "0e8a16" --description "Nice to have"

# Maxsim-specific labels
gh label create "maxsim: generated" --color "6f42c1" --description "Created by Maxsim automation"
gh label create "maxsim: phase-issue" --color "6f42c1" --description "Maxsim phase tracking issue"
```

### Initial Milestone

Create the first GitHub milestone representing the current planning scope:

```bash
MILESTONE_TITLE="Milestone 1: [Project Name] v1"
MILESTONE_DUE="" # Only set if user specified a deadline

gh api repos/:owner/:repo/milestones \
  --method POST \
  --field title="$MILESTONE_TITLE" \
  --field description="Initial milestone created by /maxsim:init. Contains Phase 1 through Phase N." \
  --field state="open"
```

### Pinned Issue: Project Overview

Create a pinned issue that serves as the project's permanent reference document. This is the canonical "what is this project and why" document visible without cloning.

```bash
gh issue create \
  --title "📋 Project Overview: [Project Name]" \
  --label "milestone,maxsim: generated" \
  --body "$(cat <<'EOF'
## What Is This?

[1-2 sentence description from PROJECT.md]

## Why It Exists

[Problem statement from questioning]

## Who It's For

[User/audience description]

## What "Done" Looks Like

[Acceptance criteria — top 3-5 from ACCEPTANCE-CRITERIA.md]

## Key Decisions

[Table of major decisions from DECISIONS.md — top 5]

## Explicit No-Gos

[List from NO-GOS.md — top items]

## Tech Stack

[Summary from SYNTHESIS.md or STACK.md]

## Resources

- [Roadmap](#) — link to ROADMAP.md or GitHub Project board
- [Requirements](#) — link to GitHub Wiki
- [Conventions](#) — link to GitHub Wiki

---
*Created by /maxsim:init on [date]. Update by editing .planning/PROJECT.md and running /maxsim:sync.*
EOF
)"
```

Pin the issue via GitHub API:

```bash
# Pin the issue (requires GraphQL)
gh api graphql -f query='
  mutation PinIssue($issueId: ID!) {
    pinIssue(input: { issueId: $issueId }) {
      issue { number title }
    }
  }
' -f issueId="[issue node id]"
```

### GitHub Wiki: Conventions

Create the Wiki and write conventions as a reference for the team:

```bash
# Clone wiki repo
git clone "https://github.com/$OWNER/$REPO.wiki.git" /tmp/wiki-$REPO 2>/dev/null || {
  # Wiki not initialized — create first page via API
  gh api repos/$OWNER/$REPO/git/refs --method GET
  # First page creation initializes the wiki
}

# Write Conventions page
cat > /tmp/wiki-$REPO/Conventions.md << 'EOF'
# Project Conventions

[Content from .planning/codebase/CONVENTIONS.md or .planning/CONVENTIONS.md]

## File Naming

[From scan or questioning]

## Code Style

[From scan or questioning]

## Error Handling

[From scan or questioning]

## Testing

[From scan or questioning]

## Branching Strategy

[From config questions]

---
*Managed by MaxsimCLI. Source of truth: `.planning/` directory.*
EOF

cd /tmp/wiki-$REPO && git add . && git commit -m "Initialize conventions (via maxsim:init)" && git push
```

### GitHub Wiki: Requirements

Write project requirements to the Wiki for team visibility:

```bash
cat > /tmp/wiki-$REPO/Requirements.md << 'EOF'
# Project Requirements

[Content from .planning/REQUIREMENTS.md]

---
*Managed by MaxsimCLI. Source of truth: `.planning/REQUIREMENTS.md`*
EOF
```

---

## Phase 4: LOCAL SETUP

### Write CLAUDE.md

`CLAUDE.md` is the primary context file that Claude Code reads at the start of every conversation. It must be concise (target 50-150 lines), focused, and contain only information that would cause mistakes if absent.

Write to project root as `CLAUDE.md`:

```markdown
# [Project Name]

[1-2 sentence description]

## Commands

```bash
# Development
[dev command from scan]

# Test
[test command from scan]

# Build
[build command from scan]

# Lint / Format
[lint command from scan]
```

## Architecture

[2-4 sentences from ARCHITECTURE.md — pattern, key layers, data flow]

## Key Files & Directories

| Path | Purpose |
|------|---------|
| [entry point] | Application entry |
| [config dir] | Configuration |
| [key module] | [description] |

## Conventions

- [Most important convention from CONVENTIONS.md]
- [Second most important]
- [Third most important]

See `.planning/codebase/CONVENTIONS.md` for full conventions.

## Testing

- Framework: [from scan]
- Run: `[test command]`
- Coverage target: [from questioning]
- Test files live next to source files / in `tests/` directory

## No-Gos

[Top 3-5 from NO-GOS.md — the ones that would affect day-to-day coding]

## Working with MaxsimCLI

- Current phase: See `.planning/STATE.md`
- Roadmap: See `.planning/ROADMAP.md`
- Requirements: See `.planning/REQUIREMENTS.md`
- Run `/maxsim:progress` to see full project status

## Context

- Stack: [from STACK.md]
- Deployment: [from scan]
- Auth: [from scan]
```

CLAUDE.md philosophy:
- Include only information that would cause mistakes if missing
- Do not include information the AI can trivially infer from files
- Keep it under 150 lines; every line competes with actual work context
- Use `@imports` for detailed sections rather than inlining

### Configure .claude/settings.json

Create `.claude/settings.json` with project-specific Claude Code settings:

```json
{
  "model": "claude-sonnet-4-5",
  "permissions": {
    "allow": [
      "Bash(git:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(gh:*)",
      "Bash(mkdir:*)",
      "Bash(rm:*)",
      "Bash(cp:*)",
      "Bash(mv:*)",
      "Bash(cat:*)",
      "Bash(ls:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Write(**/.planning/*)",
      "Write(**/CLAUDE.md)",
      "Read(**)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(sudo:*)"
    ]
  },
  "env": {
    "MAXSIM_PROJECT_NAME": "[project name]",
    "MAXSIM_VERSION": "1.0.0",
    "MAXSIM_INITIALIZED": "true"
  }
}
```

Permissions are scoped to what MaxsimCLI actually needs. The `allow` list prevents Claude Code from asking permission on every git, npm, or gh command — which would create friction during plan execution.

### Install MaxsimCLI Files to .claude/

Copy MaxsimCLI commands, workflows, and references into the project's `.claude/` directory. This makes the project self-contained — the MaxsimCLI commands work even without the global installation.

```bash
# Create .claude/ structure
mkdir -p .claude/commands/maxsim
mkdir -p .claude/maxsim/workflows
mkdir -p .claude/maxsim/references
mkdir -p .claude/maxsim/templates
mkdir -p .claude/agents

# Copy commands
cp ~/.claude/commands/maxsim/*.md .claude/commands/maxsim/

# Copy workflows
cp ~/.claude/maxsim/workflows/*.md .claude/maxsim/workflows/

# Copy references
cp ~/.claude/maxsim/references/*.md .claude/maxsim/references/

# Copy templates
cp ~/.claude/maxsim/templates/*.md .claude/maxsim/templates/

# Copy agents
cp ~/.claude/agents/*.md .claude/agents/
```

**Note:** The `.claude/` directory should be committed to git so the project carries its MaxsimCLI configuration with it. Team members who clone the repo get the same behavior without global installation.

Update `.gitignore` to track `.claude/` but ignore secrets:

```gitignore
# MaxsimCLI
.planning/         # Tracked if commit_docs=true, excluded if false
!.claude/          # Always track .claude/
.claude/*.env      # But not any env files in .claude/
```

### Register Hooks

Claude Code hooks run shell commands at specific points in the workflow. MaxsimCLI registers hooks that automate state tracking.

Write `.claude/settings.json` hooks section:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/maxsim/bin/maxsim-tools.cjs hook pre-bash \"$CLAUDE_TOOL_INPUT\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/maxsim/bin/maxsim-tools.cjs hook post-bash \"$CLAUDE_TOOL_INPUT\" \"$CLAUDE_TOOL_OUTPUT\""
          }
        ]
      },
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/maxsim/bin/maxsim-tools.cjs hook post-write \"$CLAUDE_TOOL_INPUT\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/maxsim/bin/maxsim-tools.cjs hook session-end"
          }
        ]
      }
    ]
  }
}
```

Hook purposes:
- `pre-bash`: Log command intent to STATE.md for session continuity
- `post-bash`: Detect failures, update STATE.md activity log
- `post-write`: Track which planning documents were modified
- `session-end`: Write session summary to STATE.md for `/maxsim:resume-work`

---

## Phase 5: ROADMAP (Optional)

### The Offer

After local setup completes, offer roadmap generation. This is the bridge between initialization and active development.

```
AskUserQuestion:
- header: "Roadmap"
- question: "Want an initial roadmap? I can break down the project into phases now."
- options:
  - "Yes, generate roadmap" — Create phases based on requirements and constraints
  - "No, I'll plan phases manually" — Ready for /maxsim:plan 1
  - "Skeleton only" — Create phases with titles, I'll fill in details
```

### If Yes: Generate Full Roadmap

The roadmap agent reads:
- `.planning/PROJECT.md` — vision and requirements
- `.planning/REQUIREMENTS.md` — full requirements list
- `.planning/ACCEPTANCE-CRITERIA.md` — success criteria
- `.planning/DECISIONS.md` — locked decisions
- `.planning/NO-GOS.md` — exclusions
- `.planning/codebase/SYNTHESIS.md` — existing state (brownfield)
- `config.json` — depth setting (quick/standard/comprehensive)

Phase count by depth setting:
- Quick: 3-5 phases
- Standard: 5-8 phases
- Comprehensive: 8-12 phases

**Phase structure:**

```markdown
# Roadmap

**Project:** [Name]
**Milestone:** 1
**Generated:** [date]
**Depth:** Standard

## Phase 1: [Name]

**Goal:** [Single sentence — what does this phase achieve?]

**Deliverables:**
- [ ] [Concrete, testable deliverable]
- [ ] [Concrete, testable deliverable]

**Acceptance Criteria:**
- [ ] [Observable, verifiable outcome]
- [ ] [Observable, verifiable outcome]

**Dependencies:** None (or Phase N)

**Estimated Effort:** [Small/Medium/Large]

---
```

### Create GitHub Milestones and Phase Issues

For each phase, create a GitHub Issue:

```bash
for PHASE_NUM in $(seq 1 $TOTAL_PHASES); do
  gh issue create \
    --title "Phase $PHASE_NUM: [Phase Name]" \
    --label "phase,status: backlog,maxsim: phase-issue" \
    --milestone "Milestone 1: [Project Name] v1" \
    --body "$(cat <<EOF
## Goal

[Phase goal]

## Deliverables

[Deliverables list]

## Acceptance Criteria

[Criteria list]

## Execution

Plan this phase: \`/maxsim:plan $PHASE_NUM\`
Execute this phase: \`/maxsim:execute-phase $PHASE_NUM\`

---
*Created by /maxsim:init. Managed by MaxsimCLI.*
EOF
)"

  # Add issue to project board
  ISSUE_ID=$(gh issue view --json id --jq '.id' "$ISSUE_NUMBER")
  gh api graphql -f query="mutation { addProjectV2ItemById(input: { projectId: \"$PROJECT_ID\", contentId: \"$ISSUE_ID\" }) { item { id } } }"
done
```

### If Skeleton Only: Titles Without Detail

Generate phases with names and single-sentence goals only. The user will flesh them out with `/maxsim:plan N`.

```markdown
# Roadmap

**Project:** [Name]
**Milestone:** 1

## Phase 1: Foundation
*Scaffold the core architecture and establish development patterns.*

## Phase 2: Authentication
*Implement user auth and session management.*

## Phase 3: Core Features
*Build the primary user-facing functionality.*

## Phase 4: Testing & Quality
*Achieve coverage targets and fix identified issues.*

## Phase 5: Deployment
*Configure production environment and ship.*
```

### Completion Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: [Name]
Phases: [N]
GitHub: [repo URL]
Board: [project board URL]

Documents created:
  ✓ .planning/config.json
  ✓ .planning/PROJECT.md
  ✓ .planning/REQUIREMENTS.md
  ✓ .planning/ROADMAP.md
  ✓ .planning/STATE.md
  ✓ .planning/DECISIONS.md
  ✓ .planning/ACCEPTANCE-CRITERIA.md
  ✓ .planning/NO-GOS.md
  ✓ .planning/CONVENTIONS.md
  ✓ CLAUDE.md
  ✓ .claude/settings.json

Next step:
  /maxsim:plan 1     — Plan Phase 1 in detail
  /maxsim:go         — Start executing (YOLO mode)
```

---

## Complete Execution Sequence

### Greenfield Project (no existing code)

```
1. Router: detect state → Scenario A (New Project)
2. Router: run `maxsim-tools init new-project` → load INIT_CONTEXT
3. Router: delegate to new-project.md workflow
4. [new-project.md]: GitHub prerequisites gate
5. [new-project.md]: Brownfield offer (skip — no code detected)
6. [new-project.md]: Open question "What do you want to build?"
7. [new-project.md]: Deep questioning loop (10+ rounds, 80%+ coverage)
8. [new-project.md]: No-gos confirmation
9. [new-project.md]: Write PROJECT.md
10. [new-project.md]: Generate artefakte (DECISIONS, ACCEPTANCE-CRITERIA, NO-GOS, CONVENTIONS)
11. [new-project.md]: Workflow preferences (config.json)
12. [new-project.md]: Optional: domain research agents
13. [new-project.md]: Write REQUIREMENTS.md
14. [Phase 3]: GitHub setup (labels, board, milestone, pinned issue, wiki)
15. [Phase 4]: Write CLAUDE.md
16. [Phase 4]: Configure .claude/settings.json
17. [Phase 4]: Install MaxsimCLI files to .claude/
18. [Phase 4]: Register hooks
19. [Phase 5]: Roadmap offer → generate if yes → create GitHub issues
20. Display completion banner
```

### Brownfield Project (existing codebase, no .planning/)

```
1. Router: detect state → Scenario B (Existing Project)
2. Router: run `maxsim-tools init init-existing` → load INIT_CONTEXT
3. Router: delegate to init-existing.md workflow
4. [init-existing.md]: GitHub prerequisites gate
5. [init-existing.md]: Conflict resolution (no conflict — fresh init)
6. [init-existing.md]: SCAN PHASE — Wave 1 through Wave 7 (30+ parallel agents)
7. [init-existing.md]: Synthesizer agent → SYNTHESIS.md
8. [init-existing.md]: README validation — compare claims vs. findings
9. [init-existing.md]: Config questions (workflow preferences)
10. [init-existing.md]: Existing state confirmation (show scan findings)
11. [init-existing.md]: INTERVIEW PHASE — scan-informed adaptive questioning
12. [init-existing.md]: No-gos confirmation
13. [init-existing.md]: Write PROJECT.md (with Validated requirements from existing code)
14. [init-existing.md]: Generate artefakte
15. [Phase 3]: GitHub setup
16. [Phase 4]: Write CLAUDE.md (includes scan findings)
17. [Phase 4]: Configure .claude/settings.json
18. [Phase 4]: Install MaxsimCLI files
19. [Phase 4]: Register hooks
20. [Phase 5]: Roadmap offer
21. Display completion banner
```

---

## State Management

All init state is written to `.planning/STATE.md` with checkpoints. If the init process is interrupted (context overflow, user abandons), the next run of `/maxsim:init` detects the partial state via the conflict resolution step and offers to resume.

Checkpoint format:

```json
{
  "init_stage": "github_setup",
  "init_started": "2026-03-22T14:30:00Z",
  "scan_complete": true,
  "interview_complete": true,
  "github_setup_complete": false,
  "local_setup_complete": false,
  "roadmap_complete": false,
  "last_checkpoint": "2026-03-22T15:45:00Z"
}
```

On resume, the init detects the last completed checkpoint and skips to the appropriate step.

---

## Design Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| 30+ agents vs 4 | Narrow focus per agent enables deeper analysis within context limits | 4 broad agents: faster but shallower, misses domain-specific patterns |
| Wave batching (5-8 per wave) | Avoids API rate limits while maximizing parallelism | All 30 at once: risks rate limit failures; sequential: 8x slower |
| Hard GitHub prerequisite | Forces correct setup before any work, avoids "almost initialized" state | Local-only fallback: produces incomplete init that fails later |
| 10 round minimum interview | Ensures sufficient depth; prevents premature proceed | 5 rounds: too shallow for complex projects; no minimum: users rush through |
| Synthesizer agent after scan | Single agent creates coherent view; prevents interview agent needing to read 30 files | Interview agent reads all files: context overflow on large repos |
| CLAUDE.md target 50-150 lines | Balances context richness vs. token cost per conversation | Comprehensive CLAUDE.md: too much competing context; minimal: agents miss conventions |
| Pinned GitHub issue | Makes project overview visible without dev tools | Wiki homepage: less visible; README: conflicts with public documentation |
| Adaptive interview (scan-informed) | Eliminates questions we can answer from code; makes interview about what matters | Same interview for all projects: wastes time, annoys users with known answers |

---

## Anti-Patterns to Avoid in Implementation

- **Do not ask questions the scan already answered.** "What language are you using?" when `package.json` is present is insulting.
- **Do not batch more than 4 questions in a single AskUserQuestion call.** Cognitive overload degrades answer quality.
- **Do not degrade to local-only mode.** A partial init is worse than a failed init with a clear error.
- **Do not write CLAUDE.md > 300 lines.** Context is precious. Beyond 300 lines, the file competes with the actual work.
- **Do not skip the No-Gos confirmation step.** Silently-accumulated no-gos that the user never confirmed will produce wrong outputs.
- **Do not show domain coverage during questioning.** It makes the interview feel like a form. Only show coverage at the "Ready?" gate.
- **Do not fire challenge probes before 5 rounds.** Trust has not been established; they feel like interrogation.
- **Do not spawn all 30 agents simultaneously.** Wave them in groups of 5-8 to respect API rate limits.

---

## References

### Local Reference Files

- `/c/Development/cli/maxsim/templates/commands/maxsim/init.md` — Init command definition
- `/c/Development/cli/maxsim/templates/workflows/init.md` — Router workflow
- `/c/Development/cli/maxsim/templates/workflows/new-project.md` — Greenfield sub-workflow
- `/c/Development/cli/maxsim/templates/workflows/init-existing.md` — Brownfield sub-workflow
- `/c/Development/cli/maxsim/templates/references/questioning.md` — Interview philosophy and domain checklist
- `/c/Development/cli/maxsim/templates/references/thinking-partner.md` — Conversation principles

### External Research

- [Best Practices for Claude Code](https://code.claude.com/docs/en/best-practices) — Official Claude Code documentation
- [Claude Code Project Structure Best Practices](https://uxplanet.org/claude-code-project-structure-best-practices-5a9c3c97f121) — UX Planet guide
- [Claude Code Sub-Agents: Parallel vs Sequential Patterns](https://claudefa.st/blog/guide/agents/sub-agent-best-practices) — Sub-agent orchestration guide
- [How to Use Sub-Agents for Codebase Analysis Without Hitting Rate Limits](https://www.mindstudio.ai/blog/how-to-use-sub-agents-for-codebase-analysis) — Rate limit management
- [Claude Opus 4.6 Agent Teams: How to Set Up Parallel AI Coding Agents](https://www.nxcode.io/resources/news/claude-agent-teams-parallel-ai-development-guide-2026) — Parallel agent architecture
- [GitHub: Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — CLI UX guidelines
- [Using the API to manage Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects) — GitHub Projects GraphQL API
- [Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) — CLAUDE.md best practices
- [AI-Assisted Development Workflows in 2026](https://dasroot.net/posts/2026/03/ai-assisted-development-workflows-2026-transforming-software-engineering/) — Current AI workflow patterns
- [Beyond Greenfield: The D³ Framework for AI-Driven Productivity in Brownfield](https://arxiv.org/pdf/2512.01155) — Brownfield AI onboarding research
