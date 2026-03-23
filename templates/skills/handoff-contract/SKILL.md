---
name: handoff-contract
description: >-
  Standardizes agent output format with key decisions, artifacts, status, and
  deferred items. Use when any agent completes a task and needs to report
  results to the orchestrator.
---

# Handoff Contract

Every agent output includes exactly four sections. The orchestrator reads these sections for state tracking, artifact management, and pipeline decisions. Missing sections break the pipeline.

## Required Sections

### Key Decisions

What was decided during execution and why. Downstream agents depend on this context.

```markdown
### Key Decisions
- Chose X over Y because [reason with evidence]
- Deferred Z to [phase/plan] because [scope constraint]
- Interpreted ambiguous requirement as [interpretation] because [reasoning]
```

Include: technology choices, scope adjustments, interpretations of ambiguous requirements, tradeoffs made.

Omit: routine implementation steps, decisions with no downstream impact.

### Artifacts

All files created or modified, grouped by action.

```markdown
### Artifacts
- Created: /absolute/path/to/new-file.ts
- Created: /absolute/path/to/another-file.md
- Modified: /absolute/path/to/existing-file.ts
- Deleted: /absolute/path/to/removed-file.ts
```

Use absolute paths. Include every file touched — not just primary deliverables. Config changes, test files, and generated files all count.

### Status

One of three values with supporting evidence:

| Status | Meaning | Required Evidence | Orchestrator Action |
|--------|---------|-------------------|-------------------|
| `PASS` | All tasks done, verification passed | Test output, build output, or explicit verification | Advance to next stage |
| `FAIL` | Could not complete; stopped | What failed, what was attempted | Escalate to user |
| `PARTIAL` | Some tasks done; stopped at checkpoint | Which tasks passed, which remain | Resume from checkpoint |

```markdown
### Status
PASS

Evidence:
- Tests: 47 passed, 0 failed (npm test output)
- Build: exit code 0
- All 4 plan tasks completed
```

Evidence is not optional. A status claim without evidence is treated as FAIL.

### Deferred Items

Work discovered but not implemented. Captures scope that would otherwise be lost.

```markdown
### Deferred Items
- [feature] Add caching layer -- not in current plan scope
- [bug] Race condition in parallel writes -- needs investigation in Phase 5
- [refactor] Extract shared validation logic -- deferred to cleanup phase
- [investigation] Memory growth after 100+ concurrent connections -- repro needed
```

Categories: `feature`, `bug`, `refactor`, `investigation`

If none: write `### Deferred Items\nNone`

## Complete Output Template

```markdown
### Key Decisions
- [decision]: [reason]

### Artifacts
- Created: /path/to/file
- Modified: /path/to/file

### Status
PASS | FAIL | PARTIAL

Evidence:
- [verification output or description]

### Deferred Items
- [category] [description] -- [reason deferred]
```

## Enforcement

An orchestrator receiving output without all four sections treats the result as PARTIAL and requests re-submission. Agents cannot mark a task complete without producing a conforming handoff.
