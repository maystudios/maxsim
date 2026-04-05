---
name: project-memory
description: GitHub-native persistence for project learnings, decisions, and patterns using issue labels and structured comments. Used when recording what worked, what failed, or architectural decisions that should persist across sessions.
---

# Project Memory Skill

Claude Code sessions are stateless. This skill uses GitHub Issues as a persistent, searchable memory store so that learnings, decisions, and patterns survive across sessions and agents.

---

## What to Persist

Not everything is worth recording. Persist only information that would change behaviour in a future session.

**Persist:**
- Successful patterns discovered during implementation (things that worked and why)
- Failed approaches and the reason they failed (prevents re-trying dead ends)
- Performance insights with measured baselines (e.g., "query X takes 800ms without index Y")
- Architectural decisions and the trade-offs considered
- Non-obvious constraints (environment limits, API quirks, team conventions not in docs)

**Do not persist:**
- Transient debug output
- Work-in-progress notes
- Information already captured in code comments or documentation

**Before writing:** Check existing entries in MEMORY.md and GitHub Issues for duplicates. If a similar learning already exists, update the existing entry with new evidence rather than creating a duplicate.

---

## Storage: GitHub Issues

All project memory lives as GitHub Issues in the project repository. Use structured issue comments with `type:task` or `type:phase` labels to capture learnings and decisions inline within the relevant issue context.

Create issues with `gh issue create`. Query them with `gh issue list --label type:task`.

---

## Lesson Issue Format

```
Title: LESSON: <short description of what was learned>

## What Happened
<1–3 sentences describing the situation>

## What Worked / What Failed
<specific outcome>

## Why
<root cause or reason, if known>

## Applies To
<file paths, modules, or domains this lesson is relevant to>

## Confidence
[HIGH|MEDIUM|LOW]
```

---

## Decision Issue Format

```
Title: DECISION: <short description of the decision>

## Context
<what problem prompted this decision>

## Decision
<what was decided>

## Alternatives Considered
- <option A> — rejected because <reason>
- <option B> — rejected because <reason>

## Trade-offs Accepted
<what is worse as a result of this decision>

## Revisit When
<condition that should trigger re-evaluation>
```

---

## When to Create a Memory Issue

| Trigger | Action |
|---------|--------|
| Phase completion | Create a lesson issue summarising what worked and what did not |
| 3 or more retries on the same problem | Create a lesson issue before attempting again |
| A pattern is discovered that could apply elsewhere | Create a lesson issue tagged with relevant modules |
| A significant architectural choice is made | Create a decision issue immediately |
| An approach is abandoned mid-phase | Create a lesson issue explaining why |

---

## Git as Memory

At the start of a session working on an existing project, read recent git history before planning:

```bash
git log --oneline -20
git log --oneline --since="7 days ago"
```

This surfaces what changed recently without opening every file. Combine with `gh issue list --label maxsim:auto` to get both code history and recorded learnings.

---

## Agent-Memory Storage Layer

MaxsimCLI maintains an automated local memory store for learnings captured by the agent itself. The storage path is `.claude/agent-memory/maxsim-learner/MEMORY.md`. This file is written automatically at session end by the `maxsim-capture-learnings` Stop hook (per PROJECT.md section 12.1 (hooks table)), which extracts key lessons from the session transcript and appends them to the file. Agents should read this file at session start alongside GitHub Issues to surface recently captured patterns before planning.

**Note:** The local agent-memory file complements GitHub-native storage. It provides fast session-start context while GitHub Issues remain the authoritative long-term store. This file may not exist on fresh installations until the first session completes.

---

## Memory Consolidation

Over time, MEMORY.md and issue-based memory accumulate redundant, outdated, or conflicting entries. Consolidation prevents context rot and keeps memory within usable token limits.

### When to Consolidate

| Trigger | Action |
|---------|--------|
| Phase completion | Run consolidation pass on all memory added during the phase |
| MEMORY.md exceeds 50KB | Mandatory consolidation before next session |
| Session start warning (context budget tight) | Quick prune of low-confidence and stale entries |

### Consolidation Process

1. **Read** — Load all entries from MEMORY.md and recent GitHub Issue memories
2. **Categorize** — Group entries by domain (patterns, decisions, constraints, failures)
3. **Merge** — Combine entries that describe the same learning with different evidence
4. **Archive** — Move entries older than 90 days with no recent references to an archive section
5. **Prune** — Remove entries that are:
   - Superseded by a newer decision
   - No longer applicable (deleted module, changed API)
   - Low confidence with no corroborating evidence
6. **Target** — Resulting MEMORY.md should be under 50KB

### Consolidation Output Format

After consolidation, MEMORY.md follows this structure:

```markdown
# Consolidated Patterns
<!-- Active, high-confidence learnings grouped by domain -->

# Active Decisions
<!-- Current architectural decisions with status and revisit conditions -->

# Archive
<!-- Older entries preserved for reference, collapsed by default -->
<!-- Entries here are candidates for removal on next consolidation -->
```

### Context Rot Prevention

Large memory files degrade agent performance. The Chroma study on retrieval-augmented generation found significant quality drops above 50K tokens of injected context. To prevent this:

- **50K token threshold** — Consolidate when MEMORY.md approaches this limit (roughly 50KB of text)
- **Staleness decay** — Entries not referenced in 90 days lose priority during consolidation
- **Confidence weighting** — HIGH confidence entries survive pruning; LOW confidence entries are pruned first
- **Domain balance** — No single domain should consume more than 40% of total memory budget

---

## Claude Code Memory Integration

When operating as a sub-agent within a MaxsimCLI workflow, scope memory to the project:

- Read existing lesson and decision issues at session start before beginning research or planning
- Write new issues at session end or at phase boundaries, not mid-task
- Reference issue numbers in commit messages when a commit directly relates to a recorded decision (e.g., `closes #42` or `see DECISION #38`)
