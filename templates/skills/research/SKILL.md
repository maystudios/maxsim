---
name: research
description: Systematic investigation using parallel agents, source hierarchy, and Claude Code tool priority. Merges research methodology with tool selection best practices. Use when investigating codebase patterns, evaluating libraries, or gathering information before planning.
---

# Research Skill

Produces reliable, structured findings before planning or implementation begins. Combines investigation methodology with the right tool choices to avoid wasted effort.

---

## 5-Step Research Process

### Step 1 — Define Questions

Before searching anything, write down the specific questions this research must answer. Vague investigations produce vague results.

- One question per line
- Mark each as: factual (has a definite answer) or evaluative (requires judgment)
- Set a confidence threshold: what level of certainty is required before acting?

### Step 2 — Identify Sources

Map each question to its best source before opening any file.

**Source hierarchy (highest to lowest trust):**

1. Official documentation and specs
2. Source code and type definitions in the repo
3. Tests and usage examples in the codebase
4. Changelogs and release notes
5. Community discussions (Stack Overflow, GitHub issues)
6. Blog posts and tutorials

Always prefer sources higher in the hierarchy. Do not cite a tutorial when the source code is available.

### Step 3 — Gather Evidence

Use the correct tool for each task. Using the wrong tool produces slower or incomplete results.

**Claude Code Tool Priority:**

| Task | Use | Never Use |
|------|-----|-----------|
| Read a known file path | `Read` | `cat`, `head`, `tail` |
| Search file contents | `Grep` | `grep`, `rg` in Bash |
| Find files by name/pattern | `Glob` | `find`, `ls` |
| Multi-step investigation across many files | `Agent` | Sequential Bash loops |
| Single shell command or script | `Bash` | — |
| Discover external docs, packages, or resources | `WebSearch` | Guessing URLs |
| Read a specific external URL or documentation page | `WebFetch` | `curl` in Bash |

**Parallelise where possible.** When multiple files or sources are independent, read or search them in the same tool call batch rather than sequentially.

**Time-box each source:** If a source has not yielded useful signal within 10 minutes of investigation, move on and flag it as inconclusive.

### Step 4 — Cross-Reference

Do not trust a single source. For any finding that will influence a decision:

- Confirm in at least two independent sources
- Note where sources disagree and record both positions
- Flag anything that changed recently (check git log or changelog dates)

### Step 5 — Structure Output

Findings must be in a form that another agent or a human can act on without re-reading all the evidence.

---

## Confidence Tags

Attach one tag to every finding:

- `[HIGH]` — confirmed in authoritative source, cross-referenced
- `[MEDIUM]` — single source, plausible but not verified
- `[LOW]` — inferred or community-sourced, treat as hypothesis

Never promote a `[LOW]` finding to a decision without additional verification.

---

## Structured Output Template

```
## Research: <topic>

### Questions
1. <question> — <factual|evaluative>

### Findings
1. <finding> [HIGH|MEDIUM|LOW]
   Source: <file path or URL>
   Evidence: <quote or line reference>

### Conflicts
- <source A> says X; <source B> says Y — reason for conflict unknown / likely due to <version>

### Open Questions
- <anything still unresolved>

### Recommendation
<one paragraph — what should happen next based on these findings>
```

---

## Time-Boxing Rules

| Research scope | Max time before checkpoint |
|---------------|---------------------------|
| Single function or file | 15 minutes |
| Single module or package | 30 minutes |
| Cross-repo or library evaluation | 60 minutes |

If the time limit is reached, produce a partial output using the template above and flag it as incomplete. Do not continue without surfacing findings.

---

## When to Use Parallel Agents

Spawn sub-agents when:

- Investigating multiple independent libraries simultaneously
- Comparing implementations across different parts of a large codebase
- Source gathering and source evaluation can proceed concurrently

Do not spawn agents for tasks that are inherently sequential (e.g., reading a file whose path depends on the output of a previous search).
