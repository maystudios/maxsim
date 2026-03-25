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

**5. GitHub is the source of truth.** Every planning artifact — phases, tasks, requirements, status — lives on GitHub (Issues, Project Board, Milestones, Wiki). The only local artifact is `.claude/maxsim/config.json` and `CLAUDE.md`. Invest depth here, reap compounding returns throughout the project.

**6. Adaptive, not scripted.** Greenfield and brownfield projects have fundamentally different information needs. The process must branch meaningfully at every stage, not merely display different banners.

---

## Routing: The Thin Router Pattern

The `/maxsim:init` command is a router, not a monolith. It detects project state and delegates to the appropriate sub-workflow. This separation keeps each sub-workflow focused and testable.

### State Detection Matrix

```bash
INITIALIZED=$(test -f .claude/maxsim/config.json && echo "true" || echo "false")
```

Additionally, check GitHub for existing project state:

```bash
gh repo view --json name,url,isEmpty 2>/dev/null || echo "NO_REPO"
HAS_CODE=$(test -n "$(ls -A . 2>/dev/null | grep -v '^\.git$' | head -1)" && echo "true" || echo "false")
```

| Initialized | Repo exists | Has code | Route |
|-------------|-------------|----------|-------|
| false | false | — | **Scenario A:** New Project (greenfield) |
| false | true (empty) | false | **Scenario A:** New Project (greenfield) |
| false | true | true | **Scenario B:** Existing Project (brownfield init) |
| true | — | — | **Scenario C/D:** Already initialized — show status, offer reinit |

For Scenario C vs D: query the GitHub Project Board to check if all phase issues are in the "Done" column. If yes → Scenario D (Milestone Complete). Otherwise → Scenario C (Active Milestone).

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

**Agent grouping strategy:** Spawn in waves of 5-8 agents using `Agent(isolation:"worktree", run_in_background:true)`. More than 8 simultaneous agents risks API rate limits; batching 3-5 concurrent is the most reliable pattern per current Claude Code sub-agent best practices. Each agent returns a JSON object; no local files are written.

#### Wave 1: Foundation (run first, others may depend on findings)

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `stack-detector` | `stack` | Languages, runtimes, frameworks, package managers |
| `manifest-reader` | `manifests` | package.json, pyproject.toml, go.mod, Cargo.toml — all deps with versions |
| `structure-mapper` | `structure` | Directory tree, entry points, module boundaries |
| `readme-parser` | `readme_analysis` | What the README claims, how complete it is |
| `git-historian` | `git_history` | Commit frequency, contributors, branch patterns, last active areas |

#### Wave 2: Architecture (after Wave 1 completes)

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `arch-detective` | `architecture` | Patterns (MVC, hexagonal, microservices, monolith), layers, data flow |
| `api-scanner` | `api_surface` | Exposed endpoints, GraphQL schema, tRPC routers, WebSocket handlers |
| `data-model-reader` | `data_model` | DB schema, ORM models, migration files, data relationships |
| `auth-detector` | `auth` | Authentication mechanism (JWT, sessions, OAuth), authorization approach |
| `config-reader` | `config` | Environment variables, `.env.example`, feature flags, secrets patterns |

#### Wave 3: Quality & Operations

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `test-scanner` | `testing` | Test frameworks, coverage config, test patterns, what's covered |
| `ci-reader` | `ci_cd` | CI pipelines, deployment steps, environments (dev/staging/prod) |
| `lint-formatter` | `code_style` | ESLint/Prettier/Ruff/golangci config, formatting rules |
| `error-handler-detector` | `error_handling` | How errors propagate, logging patterns, error boundaries |
| `perf-scanner` | `performance` | Caching layers, CDN config, bundle analysis config, DB indexing |

#### Wave 4: Security & Concerns

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `security-scanner` | `security` | Dependency vulnerabilities (audit), secrets in code, auth gaps |
| `debt-detector` | `tech_debt` | TODO/FIXME/HACK comments, deprecated APIs in use, outdated deps |
| `dependency-graph` | `dependencies` | Internal module dependencies, circular dependencies |
| `bundle-analyzer` | `build` | Build tooling (Webpack/Vite/esbuild), build output size, optimization |
| `monitoring-scanner` | `observability` | Logging setup, error tracking (Sentry), APM, analytics |

#### Wave 5: Product & Domain

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `feature-lister` | `features` | What the app actually does (inferred from routes, components, models) |
| `ui-scanner` | `ui_patterns` | Component library, design system, UI patterns, accessibility config |
| `i18n-detector` | `i18n` | i18n setup, supported locales, translation files |
| `notification-scanner` | `notifications` | Email, push, in-app, WebSocket notification setup |
| `file-upload-scanner` | `file_handling` | File upload patterns, storage (S3, local, CDN), image processing |

#### Wave 6: Scale & Infrastructure

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `infra-scanner` | `infrastructure` | Docker, Kubernetes, Terraform, cloud provider config |
| `cache-detector` | `caching` | Redis, memcached, CDN, service worker, in-memory cache |
| `search-scanner` | `search` | Elasticsearch, Algolia, vector search, full-text search setup |
| `queue-scanner` | `queues` | Job queues (Bull, Sidekiq, Celery), background workers |
| `third-party-scanner` | `integrations` | Stripe, SendGrid, Twilio, Cloudinary, and other external services |

#### Wave 7: Conventions & Patterns (depth pass)

| Agent | JSON Output Key | Focus |
|-------|-----------------|-------|
| `naming-convention-agent` | `naming` | File naming, variable naming, function naming patterns in actual code |
| `import-pattern-agent` | `imports` | Import organization, path aliases, barrel files |
| `testing-pattern-agent` | `test_patterns` | How tests are structured, mock patterns, test data factories |
| `documentation-scanner` | `documentation` | JSDoc, inline docs, external docs, documentation coverage |
| `migration-scanner` | `migrations` | DB migration history, migration strategy, pending migrations |

### Aggregation: Synthesizer Agent

After all waves complete, a single synthesizer agent reads all JSON outputs from the wave agents and produces a unified `SCAN_FINDINGS` object in memory. This object is passed directly to the interview phase — no local files are written.

Synthesis format (structured as a single JSON object with the following conceptual sections):

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
// After all Agent() calls with run_in_background:true complete:
Agent(
  isolation: "worktree",
  run_in_background: false,  // Wait for this one
  description: "Synthesize codebase scan results",
  prompt: "You have the following JSON outputs from codebase scan agents:
  [all wave agent JSON outputs inlined].
  Synthesize these into a single SCAN_FINDINGS JSON object.
  Your job is to produce a structured overview that the interview phase
  can use to skip redundant questions and focus on what's actually unknown.
  Be specific. Cite file paths as evidence. Flag contradictions.
  Return the SCAN_FINDINGS JSON object."
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

Before asking any question, the interview agent reads the `SCAN_FINDINGS` object and builds an internal map:

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

[Synthesis summary — 5-8 bullet points from SCAN_FINDINGS]

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

Concerns from the scan (in `SCAN_FINDINGS`) are raised here:
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

### Gate Logic: When to Offer "Proceed to GitHub Setup"

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
- question: "Ready to set up GitHub and initialize the project?"
- options: ["Set up GitHub", "Keep exploring"]

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

**Kanban columns (v6 standard):**

| Column | Purpose |
|--------|---------|
| Backlog | Issues not yet prioritized |
| To Do | Issues ready to be worked on |
| In Progress | Issue actively being executed |
| In Review | Issue waiting for verification |
| Done | Issue verified and complete |

These columns map directly to v6 state tracking — the column an issue is in IS its status. No separate status labels needed.

### Labels

Create a standard label set for the repository. These labels structure all Issues created during the project lifecycle:

In v6, labels are managed via the maxsim-tools CLI to ensure consistency:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github ensure-labels
```

This creates the standard MAXSIM v6 label set — 6 labels in 2 namespaces:

| Label | Description |
|-------|-------------|
| `type:phase` | Phase tracking issue |
| `type:task` | Task within a phase (sub-issue) |
| `type:bug` | Bug fix |
| `type:quick` | Quick task (not part of a phase) |
| `maxsim:auto` | Created by MAXSIM automation |
| `maxsim:user` | Created by a human user |

Status is NOT tracked via labels in v6 — it is tracked via the GitHub Project Board columns (Backlog / To Do / In Progress / In Review / Done).

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

[1-2 sentence description from interview context]

## Why It Exists

[Problem statement from questioning]

## Who It's For

[User/audience description]

## What "Done" Looks Like

[Acceptance criteria — top 3-5 from interview responses]

## Key Decisions

[Table of major decisions from interview — top 5]

## Explicit No-Gos

[No-go items from interview responses]

## Tech Stack

[Summary from SCAN_FINDINGS or interview responses]

## Resources

- [Project Board](#) — GitHub Project Board (Kanban: Backlog / To Do / In Progress / In Review / Done)
- [Milestones](#) — GitHub Milestones for roadmap tracking
- [Conventions](#) — GitHub Wiki
- [Requirements](#) — GitHub Wiki

---
*Created by /maxsim:init on [date]. Managed via GitHub Issues and Project Board.*
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

[Content from scan findings and interview responses]

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
*Managed by MaxsimCLI. Source of truth: GitHub Issues and Project Board.*
EOF

cd /tmp/wiki-$REPO && git add . && git commit -m "Initialize conventions (via maxsim:init)" && git push
```

### GitHub Wiki: Requirements

Write project requirements to the Wiki for team visibility:

```bash
cat > /tmp/wiki-$REPO/Requirements.md << 'EOF'
# Project Requirements

[Content from interview responses and scan findings]

---
*Managed by MaxsimCLI. Source of truth: GitHub Issues and Wiki.*
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

[2-4 sentences from scan findings — pattern, key layers, data flow]

## Key Files & Directories

| Path | Purpose |
|------|---------|
| [entry point] | Application entry |
| [config dir] | Configuration |
| [key module] | [description] |

## Conventions

- [Most important convention from scan/interview]
- [Second most important]
- [Third most important]

See the GitHub Wiki Conventions page for full conventions.

## Testing

- Framework: [from scan]
- Run: `[test command]`
- Coverage target: [from questioning]
- Test files live next to source files / in `tests/` directory

## No-Gos

[Top 3-5 no-gos from interview — the ones that would affect day-to-day coding]

## Working with MaxsimCLI

- Current phase: Check the GitHub Project Board (Backlog / To Do / In Progress / In Review / Done)
- Roadmap: See GitHub Milestones and Phase Issues
- Requirements: See GitHub Wiki Requirements page
- Run `/maxsim:progress` to see full project status

## Context

- Stack: [from scan findings]
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
      "Write(**/.claude/*)",
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
!.claude/              # Always track .claude/
.claude/agent-memory/  # Per-machine agent memory — not tracked
.claude/*.env          # But not any env files in .claude/
autoresearch-results.tsv  # Metric data — not tracked
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
- `pre-bash`: Log command intent for session continuity
- `post-bash`: Detect failures, update activity log
- `post-write`: Track which files were modified
- `session-end`: Write session summary for `/maxsim:resume-work`

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

The roadmap agent reads from the `PROJECT_CONTEXT` object (gathered during interview) and `SCAN_FINDINGS` (from scan phase):
- Project vision, goals, and requirements — from interview responses
- Acceptance criteria — from interview responses
- Key decisions — from interview responses
- No-gos / exclusions — from interview responses
- Existing codebase state (brownfield) — from `SCAN_FINDINGS`
- `.claude/maxsim/config.json` — project config and depth setting

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

Artifacts created:
  ✓ .claude/maxsim/config.json
  ✓ CLAUDE.md
  ✓ GitHub Project Board ({project_name} — MAXSIM)
  ✓ GitHub Milestone (Milestone 1)
  ✓ GitHub Labels (type:phase, type:task, type:bug, type:quick, maxsim:auto, maxsim:user)
  ✓ GitHub Wiki (Conventions, Requirements)
  ✓ Pinned Project Overview Issue
  ✓ Phase Issues (if roadmap generated)

Next step:
  /maxsim:plan 1     — Plan Phase 1 in detail
  /maxsim:go         — Start executing
```

---

## Complete Execution Sequence

### Greenfield Project (no existing code)

```
1. Router: detect state → no config.json, no repo or empty repo → Scenario A (New Project)
2. Router: delegate to new-project.md workflow
3. [new-project.md]: GitHub prerequisites gate (gh auth, git remote)
4. [new-project.md]: EnterPlanMode
5. [new-project.md]: Open question "What do you want to build?"
6. [new-project.md]: Deep questioning loop (adaptive, scan-informed if code exists)
7. [new-project.md]: No-gos confirmation
8. [new-project.md]: Collect PROJECT_CONTEXT from all interview responses
9. [Phase 3]: GitHub setup (ensure labels, create project board, create milestone)
10. [Phase 4]: Write .claude/maxsim/config.json
11. [Phase 4]: Write CLAUDE.md (via maxsim-tools or direct)
12. [Phase 4]: Commit initialization files
13. [Phase 4]: ExitPlanMode
14. [Phase 5]: Roadmap offer → generate if yes → create GitHub phase issues + add to board
15. Display completion banner
```

### Brownfield Project (existing codebase, not yet initialized)

```
1. Router: detect state → no config.json, repo has code → Scenario B (Existing Project)
2. Router: delegate to init-existing.md workflow
3. [init-existing.md]: GitHub prerequisites gate (gh auth, git remote)
4. [init-existing.md]: EnterPlanMode
5. [init-existing.md]: SCAN PHASE — 10-12 parallel worktree agents returning JSON
6. [init-existing.md]: Synthesizer agent → SCAN_FINDINGS object (in memory)
7. [init-existing.md]: Present findings summary to user
8. [init-existing.md]: INTERVIEW PHASE — scan-informed adaptive questioning (confirm/correct scan, establish goals, no-gos)
9. [init-existing.md]: Collect PROJECT_CONTEXT from all responses
10. [Phase 3]: GitHub setup (ensure labels, create project board, create milestone)
11. [Phase 4]: Write .claude/maxsim/config.json (includes scan metadata)
12. [Phase 4]: Write CLAUDE.md (via maxsim-tools or direct, includes scan findings)
13. [Phase 4]: Commit initialization files
14. [Phase 4]: ExitPlanMode
15. [Phase 5]: Roadmap offer → generate if yes → create GitHub phase issues + add to board
16. Display completion banner
```

---

## State Management

Project state is tracked on the GitHub Project Board — not in local files. The board columns (Backlog / To Do / In Progress / In Review / Done) represent issue status. Milestone completion percentage represents roadmap progress. Issue comments store plans, research, context, and summaries.

If the init process is interrupted (context overflow, user abandons), the next run of `/maxsim:init` detects the partial state by checking:
1. Whether `.claude/maxsim/config.json` exists (local setup completed)
2. Whether the GitHub Project Board exists (GitHub setup completed)
3. Whether phase issues exist on the board (roadmap completed)

The router offers to resume or reinitialize based on these signals.

---

## Design Decisions

| Decision | Rationale | Alternative Considered |
|----------|-----------|----------------------|
| 10-12 parallel agents (v6) vs 30+ (earlier spec) | Practical concurrency that avoids API rate limits while still getting deep coverage | 30+ agents: risks rate limit failures and excessive API cost |
| Wave batching (5-8 per wave) | Avoids API rate limits while maximizing parallelism | All at once: risks rate limit failures; sequential: much slower |
| Hard GitHub prerequisite | Forces correct setup before any work, avoids "almost initialized" state | Local-only fallback: produces incomplete init that fails later |
| GitHub-first (no local .planning/) | Single source of truth eliminates sync issues; team members see state without cloning | Local .planning/ files: must be synced, can diverge, invisible to team |
| Synthesizer agent after scan | Single agent creates coherent SCAN_FINDINGS object; prevents interview agent needing to parse 10+ agent outputs | Interview agent reads all outputs: context overflow on large repos |
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
