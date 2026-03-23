# Self-Improvement System

MaxsimCLI introduces an autoresearch-inspired feedback loop that lets the agent
learn from previous sessions rather than starting cold every time.

---

## 1. Git-as-Memory

At the start of each session the agent reads recent history directly from the repo:

```
git log --oneline -20
```

This gives an immediate, zero-overhead summary of what changed, what was shipped,
and which tasks were completed. No external database required.

**When to use it:**
- Orient quickly at session start before reading any other file.
- Detect whether a previous phase was committed or abandoned.
- Spot regressions (a feature that was added and later reverted).

---

## 2. Agent Memory File

Persistent learnings are stored in:

```
.claude/agent-memory/maxsim-learner/MEMORY.md
```

This file is appended automatically by the `maxsim-capture-learnings` Stop hook
at the end of every session in a MaxsimCLI project. Each entry records:

- The session date and ID.
- How many commits were made.
- The exact commit messages (oneline format).

**Reading the file at session start** lets the agent recall:
- Which approaches worked and were committed.
- Which tasks were attempted repeatedly without a commit (likely failed).
- Long-term trends across many sessions.

---

## 3. Results Tracking

Track two categories explicitly in task notes or phase plans:

| Category | Definition |
|---|---|
| Worked | Approach produced a commit or a passing test run. |
| Failed | Approach was retried or abandoned without a commit. |

Patterns that appear in the "Worked" column three or more times should be
promoted to templates or standard operating procedures. Patterns that appear in
the "Failed" column should be flagged before attempting again.

Structured results are persisted to `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`
(tab-separated: `date`, `task`, `approach`, `outcome`, `commit`). This file feeds the
autoresearch feedback loop and enables cross-session pattern analysis without requiring
MEMORY.md parsing.

---

## 4. Verify + Guard Pattern

Every self-improvement cycle must include a guard step to prevent regression:

1. **Implement** — make the change.
2. **Verify** — run the relevant test, build, or lint command and confirm it passes.
3. **Guard** — if verification fails, revert immediately and record the failure.
   Do not proceed to the next task with a broken baseline.

This pattern keeps the main branch always green regardless of how many
improvement iterations run.

---

## 5. Bounded Iterations

To avoid infinite loops on hard problems, apply strict iteration limits:

- **Max 3 retries per task.** After the third failure, escalate or skip.
- Each retry must use a meaningfully different approach — no copy-paste retries.
- Record the approach variation in the task log so the next session can
  distinguish them.

---

## 6. Stuck Detection and Recovery

If the agent records **5 consecutive failures** across sessions (i.e. 5 sessions
with no new commit on a given task), the recovery protocol activates:

1. **Stop** working on the task directly.
2. **Decompose** — break the task into smaller, verifiable sub-tasks.
3. **Ask** — surface the blocker explicitly in the next session's opening message.
4. **Document** — add a `## Blocked` section to MEMORY.md describing what was
   tried and what the error state is.

Stuck detection relies on scanning MEMORY.md for repeated session entries that
reference the same task with no intervening commit.

---

## Hook Integration

The capture-learnings hook is registered as a `Stop` event hook during
`npx maxsimcli@latest`. It only writes to MEMORY.md when `.claude/maxsim/config.json`
exists, so it is a no-op in non-MaxsimCLI projects.

To inspect accumulated learnings:

```
cat .claude/agent-memory/maxsim-learner/MEMORY.md
```

To reset learnings for a fresh start:

```
rm .claude/agent-memory/maxsim-learner/MEMORY.md
```
