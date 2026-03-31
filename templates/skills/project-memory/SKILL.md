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

## Claude Code Memory Integration

When operating as a sub-agent within a MaxsimCLI workflow, scope memory to the project:

- Read existing lesson and decision issues at session start before beginning research or planning
- Write new issues at session end or at phase boundaries, not mid-task
- Reference issue numbers in commit messages when a commit directly relates to a recorded decision (e.g., `closes #42` or `see DECISION #38`)
