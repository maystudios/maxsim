---
name: roadmap-writing
description: Creates phased project roadmaps with dependency graphs, success criteria, and GitHub Milestone structure. Used when planning new projects, creating milestones, or breaking work into phases.
---

# Roadmap Writing

A roadmap without success criteria is a wish list. Define what done looks like for every phase.

## Process

### 1. SCOPE — Understand the Project

Before writing phases:

- Identify the delivery target: MVP, v1, v2, specific feature set.
- Clarify constraints: timeline, team size, known blockers.
- Gather existing requirements or acceptance criteria.
- Ask ONE clarifying question at a time if the scope is unclear.

### 2. DECOMPOSE — Break Into Phases

Each phase must be:

| Property | Requirement |
|----------|-------------|
| **Independently deliverable** | Produces a working increment, not a half-built feature |
| **1–3 days of work** | Larger phases should be split; smaller ones should be merged |
| **Clear boundary** | Determinable when done without ambiguity |
| **Ordered by dependency** | No phase depends on a later phase |

Phase numbering convention:

| Format | When to Use |
|--------|-------------|
| `01`, `02`, `03` | Standard sequential phases |
| `01A`, `01B` | Parallel sub-phases that can execute concurrently (same wave) |
| `01.1`, `01.2` | Sequential sub-phases within a parent phase |

### 3. DEFINE — Write Each Phase

Every phase must include:

```markdown
### Phase {N}: {name}
**Goal**: {one sentence — what this phase achieves}
**Depends on**: {phase numbers, or "Nothing" for the first phase}
**Wave**: {wave number for parallel execution planning}
**Success Criteria** (what must be TRUE when this phase is done):
  1. {Observable truth — verifiable by command, test, or inspection}
  2. {Observable truth}
```

Success criteria rules:
- Each criterion must be testable — "code is clean" fails; "no lint warnings on `npm run lint`" passes.
- At least 2 criteria per phase.
- At least one criterion verifiable by running a command.
- Criteria describe the end state, not the process ("tests pass" not "write tests").

### 4. CONNECT — Map Dependencies and Waves

- Which phases can run in parallel? Assign the same wave number.
- Which phases are strictly sequential? Use incrementing wave numbers.
- Check for circular dependencies — this is a design error. Restructure if found.
- Every phase except the first must declare at least one dependency.

Wave assignment example:

| Wave | Phases | Notes |
|------|--------|-------|
| 1 | 01 | Foundation — nothing depends on nothing |
| 2 | 02A, 02B | Parallel — both depend on Phase 01 |
| 3 | 03 | Depends on both 02A and 02B |

### 5. GITHUB MILESTONE STRUCTURE

All roadmap artifacts live in GitHub — not in local planning files.

**Milestones** map to user-visible releases:

```markdown
## Milestones
- **v1.0 MVP** — Phases 01–04
- **v1.1 Polish** — Phases 05–07
```

**GitHub Issue format** for each phase:

```markdown
Title: [Phase {N}] {Phase name}
Body:
**Goal**: {one sentence}
**Depends on**: #{issue numbers}
**Wave**: {number}
**Success Criteria**:
- [ ] {criterion 1}
- [ ] {criterion 2}
```

Assign each issue to the corresponding GitHub Milestone. Use issue references (`#N`) for dependency tracking, not free-form text.

### 6. VALIDATE — Check the Roadmap

| Check | How to Verify |
|-------|---------------|
| Every phase has success criteria | Read each phase detail section |
| Dependencies are acyclic | Trace the dependency chain — no loops |
| Phase numbering is sequential | Numbers increase, no gaps larger than 1 |
| Milestones cover all phases | Every phase appears in exactly one milestone |
| Success criteria are testable | Each criterion verifiable by command, test, or inspection |
| Wave assignments are consistent | Parallel phases share a wave; sequential phases do not |

## Roadmap Format

```markdown
# Roadmap: {project name}

## Overview
{2–3 sentences: what the project is, what this roadmap covers}

## Milestones
- **{milestone name}** — Phases {range}

## Phase Index
- [ ] **Phase {N}: {name}** — {one-line summary} (Wave {W})

## Phase Details

### Phase {N}: {name}
**Goal**: ...
**Depends on**: ...
**Wave**: ...
**Success Criteria** (what must be TRUE):
  1. ...
  2. ...
```

## Common Pitfalls

| Pitfall | Why It Fails |
|---------|-------------|
| "We don't know enough to plan" | Plan what you know. Unknown phases get a research spike first. |
| "Success criteria are too rigid" | Vague criteria are useless. Rigid criteria are adjustable. Update them when scope changes. |
| "One big phase is simpler" | Big phases hide complexity and delay feedback. Split them. |
| "Dependencies are obvious" | Obvious to you now. Not obvious three weeks from now. |
| "We'll add details later" | Later never comes. Write the details while context is fresh. |
| "I'll track this in a local file" | Everything goes to GitHub. Local planning files do not survive context resets. |

Stop if you catch yourself writing a phase without success criteria, creating phases longer than 3 days of work, skipping dependency declarations, writing vague criteria like "code is good", or storing roadmap data outside of GitHub.
