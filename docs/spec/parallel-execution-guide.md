# MaxsimCLI Parallel Execution Architecture: Comprehensive Guide

> Research-based guide for implementing, orchestrating, and optimizing parallel agent execution in Claude Code and MaxsimCLI workflows. Sources: official Claude Code docs (code.claude.com), Anthropic engineering blog, community guides, and local MaxsimCLI skill files.

---

## Table of Contents

1. [Agent Tool: Complete Parameter Reference](#1-agent-tool-complete-parameter-reference)
2. [The Single Message Block Pattern](#2-the-single-message-block-pattern)
3. [Worktree Isolation: Mechanism, Branches, and Cleanup](#3-worktree-isolation-mechanism-branches-and-cleanup)
4. [Background vs Foreground Agents](#4-background-vs-foreground-agents)
5. [Self-Contained Prompt Structure](#5-self-contained-prompt-structure)
6. [Output Contracts](#6-output-contracts)
7. [Progress Tracking with Re-rendered Status Tables](#7-progress-tracking-with-re-rendered-status-tables)
8. [Error Handling for Parallel Agents](#8-error-handling-for-parallel-agents)
9. [Competitive Implementation: N Agents, Same Task](#9-competitive-implementation-n-agents-same-task)
10. [Automated Best-Implementation Selection](#10-automated-best-implementation-selection)
11. [Wave-Based Execution: Dependency Analysis and Formation](#11-wave-based-execution-dependency-analysis-and-formation)
12. [Git Merge Strategy for Parallel Worktrees](#12-git-merge-strategy-for-parallel-worktrees)
13. [Coordinator-Worker Communication Patterns](#13-coordinator-worker-communication-patterns)
14. [Token Cost Analysis: Parallel vs Sequential](#14-token-cost-analysis-parallel-vs-sequential)
15. [Maximum Practical Parallelism](#15-maximum-practical-parallelism)
16. [How Agent Teams Enhances the Basic Agent Tool Pattern](#16-how-agent-teams-enhances-the-basic-agent-tool-pattern)

---

## 1. Agent Tool: Complete Parameter Reference

### 1.1 YAML Frontmatter Fields (Subagent Definition Files)

Subagents are defined as Markdown files with YAML frontmatter. Store them in `.claude/agents/` (project scope) or `~/.claude/agents/` (user scope). Only `name` and `description` are required; all others are optional.

| Field | Required | Type | Default | Description |
|-------|----------|------|---------|-------------|
| `name` | Yes | string | — | Unique identifier: lowercase letters and hyphens only. Used in `@agent-name` mentions and `Agent(name)` tool syntax. |
| `description` | Yes | string | — | Natural language description of when Claude should delegate to this subagent. Richer descriptions improve automatic delegation accuracy. Add "Use proactively" to encourage Claude to dispatch without being asked. |
| `tools` | No | string/list | inherits all | Allowlist of tools the subagent can use. Omit to inherit all tools from the parent conversation (including MCP tools). Use `Agent(worker, researcher)` syntax to restrict which subagents *this* agent can spawn. Use `Agent` alone to allow spawning any subagent. |
| `disallowedTools` | No | string/list | none | Denylist applied on top of the inherited or specified tool set. If both `tools` and `disallowedTools` are set, `disallowedTools` is applied first, then `tools` resolves against the remainder. |
| `model` | No | string | `inherit` | Model to use: `sonnet`, `opus`, `haiku`, a full model ID (e.g. `claude-opus-4-6`), or `inherit`. Use `haiku` for fast exploration subagents, `sonnet` for implementation, `opus` for complex reasoning. |
| `permissionMode` | No | string | `default` | Controls how permission prompts are handled. See [Permission Modes table](#permission-modes-reference) below. |
| `maxTurns` | No | integer | unlimited | Maximum agentic turns before the subagent stops. Use to prevent runaway agents in production workflows. |
| `skills` | No | list | none | Skills whose full content is injected into the subagent's context at startup. Subagents do not inherit skills from the parent; list them explicitly. |
| `mcpServers` | No | list | inherits session | MCP servers available to this subagent. Each entry is either a string referencing an already-configured server or an inline definition (keyed by server name). Inline servers are connected when the subagent starts and disconnected when it finishes — useful for keeping heavy MCP tools out of the main context. |
| `hooks` | No | object | none | Lifecycle hooks scoped to this subagent (PreToolUse, PostToolUse, Stop). `Stop` hooks in frontmatter are automatically converted to `SubagentStop` events. Not supported in plugin subagents. |
| `memory` | No | string | none | Persistent memory scope: `user` (`~/.claude/agent-memory/<name>/`), `project` (`.claude/agent-memory/<name>/`), or `local` (`.claude/agent-memory-local/<name>/`). Enables cross-session learning; injects first 200 lines of `MEMORY.md` at startup. |
| `background` | No | boolean | `false` | When `true`, this subagent always runs as a background task without blocking the main conversation. |
| `effort` | No | string | inherits session | Effort/thinking level when this subagent is active. Options: `low`, `medium`, `high`, `max` (Opus 4.6 only). Overrides the session effort level. |
| `isolation` | No | string | none | Set to `worktree` to run the subagent in a temporary git worktree. Each subagent gets its own branch and working directory. The worktree is automatically cleaned up if the subagent makes no changes. |

The Markdown body (after the YAML block) becomes the subagent's complete system prompt. Subagents receive only this system prompt plus basic environment details (working directory, etc.) — they do not receive the full Claude Code system prompt.

#### Permission Modes Reference

| Mode | Behavior |
|------|----------|
| `default` | Standard permission checking with interactive prompts passed through to the user |
| `acceptEdits` | Auto-accept file edit/write operations without prompting |
| `dontAsk` | Auto-deny permission prompts; only explicitly allowed tools run without approval |
| `bypassPermissions` | Skip all permission prompts. Writes to `.git`, `.claude`, `.vscode`, `.idea` still prompt. Use with caution. |
| `plan` | Read-only plan mode; no filesystem modifications |

**Note:** If the parent session uses `bypassPermissions`, subagents inherit it and cannot override it. Subagent permission modes cannot escalate beyond the parent's permission level.

### 1.2 CLI-Defined Subagents (--agents Flag)

Pass subagent definitions as JSON at session launch for single-session agents without creating files:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "tester": {
    "description": "Test runner and failure investigator.",
    "prompt": "You run tests, analyze failures, and report only failing tests with error messages.",
    "model": "haiku"
  }
}'
```

The `prompt` field in CLI JSON is equivalent to the Markdown body in file-based subagents. All frontmatter fields are supported: `description`, `prompt`, `tools`, `disallowedTools`, `model`, `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `memory`, `effort`, `background`, `isolation`.

### 1.3 Built-in Subagent Types

Claude Code ships with built-in subagents used automatically:

| Name | Model | Tools | Purpose |
|------|-------|-------|---------|
| `Explore` | Haiku | Read-only | Fast codebase search and analysis; invoked with thoroughness: `quick`, `medium`, `very thorough` |
| `Plan` | Inherits | Read-only | Research for plan mode (prevents infinite nesting; subagents cannot spawn subagents) |
| `general-purpose` | Inherits | All | Complex multi-step tasks requiring both exploration and modification |
| `Bash` | Inherits | Bash | Terminal commands in a separate context |
| `statusline-setup` | Sonnet | All | Configures status line when `/statusline` is run |
| `Claude Code Guide` | Haiku | Read | Answers questions about Claude Code features |

**Critical constraint:** Subagents cannot spawn other subagents. Only an agent running as the main thread via `claude --agent` can spawn subagents using the Agent tool. Design nested hierarchies by chaining from the main conversation, not from within a subagent.

### 1.4 Scoping and Priority

When multiple subagents share the same name, the higher-priority location wins:

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Current session only | 1 (highest) |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All user projects | 3 |
| Plugin `agents/` directory | Where plugin is enabled | 4 (lowest) |

---

## 2. The Single Message Block Pattern

### 2.1 Why It Matters

True parallelism in Claude Code requires dispatching all agents within a single response/message block. If you invoke agents sequentially across multiple messages, each waits for the prior one to return before the next is launched. The throughput gain is:

- **Sequential dispatch of N agents:** wall-clock time ≈ T₁ + T₂ + ... + Tₙ
- **Single-block dispatch of N agents:** wall-clock time ≈ max(T₁, T₂, ..., Tₙ)

For N homogeneous tasks, single-block dispatch approaches an N× speedup in wall-clock time (at N× the token cost).

### 2.2 The Pattern

The coordinator calls the Agent tool N times within one turn, before waiting for any result:

```
[Coordinator single turn]:
  Agent(worker-1, prompt="Task A - full self-contained context", run_in_background=true, isolation="worktree")
  Agent(worker-2, prompt="Task B - full self-contained context", run_in_background=true, isolation="worktree")
  Agent(worker-3, prompt="Task C - full self-contained context", run_in_background=true, isolation="worktree")
  ...
  Agent(worker-N, prompt="Task N - full self-contained context", run_in_background=true, isolation="worktree")
  [Render initial status table]
  [Wait for completion notifications]
```

This is the core mechanic behind `/batch` and all MaxsimCLI parallel execution workflows.

### 2.3 Practical Application in /batch

The `/batch` command's Phase 2 uses this pattern exactly: after planning, the orchestrator spawns all workers in a single message block. Every worker gets `isolation: "worktree"` and `run_in_background: true`. The orchestrator renders an initial status table, then receives completion notifications as workers finish.

From the batch.md skill reference:
> "Once the plan is approved, spawn one background agent per work unit using the Agent tool. **All agents must use `isolation: "worktree"` and `run_in_background: true`.** Launch them all in a single message block so they run in parallel."

### 2.4 Decomposition Heuristics

Before dispatching in a single block, decompose work into units that:

- Are independently implementable in an isolated git worktree (no shared state with sibling units)
- Are mergeable on their own without depending on another unit's PR landing first
- Are roughly uniform in size (split large units, merge trivial ones)
- Prefer per-directory or per-module slicing over arbitrary file lists

Scale the count to the actual work:
- Few files → closer to 5 units
- Hundreds of files → closer to 30 units (the practical ceiling before coordination cost dominates)

---

## 3. Worktree Isolation: Mechanism, Branches, and Cleanup

### 3.1 What Git Worktrees Are

A git worktree is a separate working directory linked to the same repository. All worktrees share the same `.git` directory (history, remotes, config), but each has its own:
- Branch (checked out independently)
- Working directory (files on disk)
- Index (staging area)

This means Agent A can modify `src/auth.ts` while Agent B modifies a different version of `src/auth.ts` in its own worktree — no conflicts until merge time.

### 3.2 How Claude Code Uses Worktrees

**CLI flag for manual sessions:**
```bash
claude --worktree feature-auth        # creates .claude/worktrees/feature-auth/ on branch worktree-feature-auth
claude --worktree bugfix-123          # creates .claude/worktrees/bugfix-123/ on branch worktree-bugfix-123
claude --worktree                     # auto-generates name like "bright-running-fox"
```

**Subagent-level isolation via frontmatter:**
```yaml
---
name: parallel-worker
isolation: worktree
---
```

**Inline when dispatching via Agent tool:**
```
Agent(general-purpose,
  prompt="...",
  isolation="worktree",
  run_in_background=true
)
```

### 3.3 Worktree Directory Structure

Worktrees created via `--worktree` are placed at:
```
<repo>/.claude/worktrees/<name>/
```

The branch is named `worktree-<name>` and branches from the default remote branch. Add `.claude/worktrees/` to `.gitignore` to prevent worktree contents from appearing as untracked files in the main repository.

For custom placement and branch control, use git directly:
```bash
git worktree add ../project-feature-a -b feature-a    # new branch
git worktree add ../project-bugfix bugfix-123          # existing branch
git worktree list                                      # show all worktrees
git worktree remove ../project-feature-a               # cleanup
```

### 3.4 Cleanup Behavior

Automatic cleanup rules when exiting a worktree session:

| State | Behavior |
|-------|----------|
| No changes made | Worktree directory and branch are removed automatically |
| Changes or commits exist | Claude prompts: keep (preserves directory and branch) or remove (deletes all uncommitted work and commits) |

For subagents with `isolation: worktree`, the worktree is cleaned up automatically if the subagent makes no changes. This makes ephemeral read-only subagents cost-free from a branch management perspective.

For subagents that produce PRs, the branch persists until the PR is merged and the branch is deleted in GitHub/GitLab.

### 3.5 Non-Git Version Control

For SVN, Perforce, or Mercurial, configure `WorktreeCreate` and `WorktreeRemove` hooks in `settings.json`. These hooks replace default git behavior when `--worktree` is invoked, allowing custom worktree creation and cleanup logic.

### 3.6 Environment Initialization

Each new worktree starts with a fresh filesystem snapshot of the codebase but without the runtime environment. Depending on the project stack, each worker prompt should include instructions to:
- Run dependency installation (`npm install`, `pip install`, `bundle install`)
- Set up virtual environments or build toolchains
- Configure any environment-specific variables

Failing to initialize the environment is a common cause of worker failures in parallel workflows.

---

## 4. Background vs Foreground Agents

### 4.1 Behavioral Differences

| Dimension | Foreground | Background |
|-----------|-----------|------------|
| Blocks main conversation | Yes | No |
| Permission prompts | Passed through to user interactively | Pre-approved at spawn time; auto-denied if not pre-approved |
| Clarifying questions (`AskUserQuestion`) | Passed through to user | Tool call fails; agent continues without answer |
| User interaction mid-task | Full | None after spawn |
| Progress visibility | Inline in terminal | Via `/tasks` command |
| When agent needs input it didn't have | Pauses and asks | Fails silently on that question |

### 4.2 Decision Criteria

**Use background (`run_in_background: true` or `background: true` in frontmatter) when:**
- The task is fully defined upfront with no anticipated need for clarification
- The task is long-running (large codebase analysis, security audits, documentation generation)
- Multiple agents are being dispatched simultaneously (the single-block pattern)
- Results aren't immediately blocking current work in the main session
- Web research, performance profiling, or any read-only investigation

**Use foreground when:**
- The task may require interactive prompts (asking the user about ambiguous requirements)
- File modifications need user review before proceeding
- Sequential dependencies exist on the current activity
- Latency matters and the result is needed immediately

### 4.3 How to Background an Agent

Three mechanisms:
1. **Frontmatter:** `background: true` in the subagent's `.md` file — always runs in background
2. **At dispatch time:** `run_in_background: true` in the Agent tool call
3. **During execution:** Press `Ctrl+B` while a forground subagent is running to move it to the background

### 4.4 Progress Monitoring

Use `/tasks` to view all background agents:
- Current status of each background agent
- Token usage metrics
- Progress indicators
- Clickable details for inspection

If a background agent fails due to missing permissions, start a new foreground agent with the same task to retry with interactive prompts. To disable all background tasks, set `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`.

---

## 5. Self-Contained Prompt Structure

### 5.1 The Core Requirement

Background agents cannot ask clarifying questions. This means every background agent prompt must be entirely self-contained — the agent must have everything it needs to complete the task without user interaction.

This is Anthropic's "batch pattern": treat each prompt as if it will be executed in isolation, with no access to the spawning conversation's context.

### 5.2 Required Prompt Components

Every worker prompt must include all of the following:

```markdown
## Overall Goal
[The user's high-level instruction — why this work is being done]

## Your Specific Task
[Title, file list, change description — copied verbatim from the plan]

## Codebase Conventions
[Naming conventions, patterns, frameworks discovered during research phase]

## End-to-End Verification Recipe
[Exact steps to verify the change works:
  - Setup: (start dev server, install deps)
  - Execute: (exact command/browser interaction)
  - Assert: (what success looks like)]

## Worker Instructions
[Standard worker protocol — commit, push, open PR, output "PR: <url>"]
```

### 5.3 Standard Worker Instructions Template

From the batch.md skill reference, workers receive this verbatim:

```
Worker Protocol:
1. Implement the specific task described above
2. Follow the codebase conventions listed
3. Run the e2e verification recipe to confirm it works
4. If the recipe fails, debug and fix before proceeding
5. Commit your changes with a descriptive commit message
6. Push your branch and open a pull request using: gh pr create
7. Output your result as: PR: <url>
   If you failed to complete the task, output: FAILED: <reason>
```

### 5.4 Context Density

The most common worker failure is not an execution failure — it is an invocation failure caused by insufficient context. Effective prompts include:

- Specific file paths (not "the auth module" but `src/auth/jwt.ts`)
- Exact error messages if fixing a bug
- The specific test names if fixing test failures
- Codebase conventions the coordinator discovered (import style, error handling patterns, test framework)
- What the agent should NOT do (prevents overreach and scope creep)

Poor invocation:
```
Fix the authentication bug.
```

Effective invocation:
```
Fix the JWT expiration bug in src/auth/jwt.ts (line 42, the expiry check
uses Date.now() instead of Date.now() / 1000 — JWT exp is in seconds,
not milliseconds). Do NOT modify the middleware or the User model.
Run `npm test -- --testPathPattern=auth/jwt` to verify. Commit, push,
and open a PR. Output: PR: <url>
```

---

## 6. Output Contracts

### 6.1 PR URL Contract

The standard output contract for worker agents in batch/parallel workflows is a single line at the end of the agent's final response:

```
PR: https://github.com/org/repo/pull/123
```

Or on failure:
```
FAILED: <brief reason>
```

The coordinator parses this line from each agent's result to update the status table and extract PR links. This contract must be included verbatim in every worker's instructions. Any other format breaks the coordinator's parser.

### 6.2 Structured Output (Non-PR Workflows)

For workflows that don't produce PRs, define an explicit output schema in the worker prompt:

```markdown
Output your findings as:
RESULT: <one-line summary>
FILES_CHANGED: <comma-separated list>
TESTS_ADDED: <count>
COVERAGE_DELTA: <+/- percentage>
```

The coordinator then parses specific fields by prefix. This approach is more resilient than asking for JSON (which models sometimes format inconsistently) and more structured than free text.

### 6.3 Anthropic Structured Outputs (API Level)

For programmatic workflows using the Anthropic API directly (not Claude Code's Agent tool), the Claude API supports a `structured_outputs` parameter requiring responses to conform to a provided JSON schema. This is useful when building MaxsimCLI extensions that call agents programmatically and need machine-readable results.

---

## 7. Progress Tracking with Re-rendered Status Tables

### 7.1 The Pattern

After launching all workers in a single message block, the coordinator renders an initial status table:

```
| # | Unit | Status | PR |
|---|------|--------|----|
| 1 | Auth module migration | running | — |
| 2 | Database layer update | running | — |
| 3 | API endpoint refactor | running | — |
| 4 | Test suite update | running | — |
| 5 | Documentation update | running | — |
```

As background agent completion notifications arrive, the coordinator parses the `PR: <url>` or `FAILED: <reason>` line from each result and re-renders the table:

```
| # | Unit | Status | PR |
|---|------|--------|----|
| 1 | Auth module migration | done | [#142](url) |
| 2 | Database layer update | done | [#143](url) |
| 3 | API endpoint refactor | running | — |
| 4 | Test suite update | FAILED | scope unclear |
| 5 | Documentation update | done | [#145](url) |
```

When all agents have reported, the coordinator renders the final table and a one-line summary:
```
4/5 units landed as PRs. Unit 4 failed: scope unclear.
```

### 7.2 Implementation Notes

- The coordinator should not attempt to parse partial results — wait for each agent's full response before updating that row
- Failed agents should include a brief failure note in the status column (not just "failed")
- The table should be re-rendered in full each time (not incrementally patched), as terminal output is append-only
- For very large batches (30+ workers), group rows by domain to keep the table scannable

---

## 8. Error Handling for Parallel Agents

### 8.1 Individual Agent Failure

Each agent failure is isolated by design. Worktree isolation ensures that a crashed or incorrect agent cannot corrupt another agent's working directory. When a worker reports `FAILED: <reason>`, the coordinator:

1. Updates the status table with the failure note
2. Does NOT retry automatically (retries may compound errors)
3. Reports the failure in the final summary
4. Leaves remediation to the human reviewer

### 8.2 Cascade Prevention

Parallel agents are inherently cascade-safe when:
- Each agent works in its own worktree (no shared filesystem state)
- Agents do not depend on each other's outputs during execution
- The output contract is simple (PR URL or failure message)

Cascade failures occur when:
- Agents share a mutable resource (a database, a shared file, a lock)
- A coordinator dispatches Wave N before confirming Wave N-1 succeeded
- An agent's changes break CI checks that other agents depend on

Prevention strategies:
- Always use `isolation: worktree`
- Design work units with no inter-unit dependencies within a wave
- Validate wave completion before starting the next wave
- Use separate test environments per worktree when tests mutate shared state

### 8.3 Permission Failures

Background agents that encounter a permission prompt auto-deny it. If the agent needs that permission to complete its task, it will fail. To prevent this:
- Before dispatching background agents, enumerate all tools and permissions they will need
- Claude Code prompts for these permissions upfront when a background agent is launched
- If an agent fails due to missing permissions, start a foreground agent with the same task to retry interactively

### 8.4 Context Window Exhaustion

Each subagent has its own context window. Auto-compaction triggers at approximately 95% capacity (configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`). For long-running workers:
- Keep worker prompts tight (avoid pasting the entire codebase)
- Give workers specific file paths rather than asking them to discover scope
- Use the Explore built-in subagent (Haiku, read-only) for discovery phases before spawning implementation workers

---

## 9. Competitive Implementation: N Agents, Same Task

### 9.1 The Pattern

Rather than decomposing one problem into N different subproblems, the competitive pattern assigns the same problem to N agents simultaneously with instructions to produce independent solutions. The coordinator then selects the best result.

This is most valuable when:
- The solution space is large and stochastic (the best prompt doesn't guarantee the best code)
- Quality variance between runs is high
- A wrong solution is expensive (correctness is critical)
- The task is small enough that N× cost is acceptable

### 9.2 Dispatch Example

```
[Coordinator dispatches 3 competing implementations of the same task]

Agent(worker-1, prompt="""
Task: Implement JWT refresh token rotation in src/auth/refresh.ts.
Approach: Try an in-memory token blacklist with Redis backing.
[full context]
Output: IMPL: <brief description of your approach>
        PR: <url>
""", isolation="worktree", run_in_background=true)

Agent(worker-2, prompt="""
Task: Implement JWT refresh token rotation in src/auth/refresh.ts.
Approach: Try a stateless approach using token versioning in the user record.
[full context]
Output: IMPL: <brief description of your approach>
        PR: <url>
""", isolation="worktree", run_in_background=true)

Agent(worker-3, prompt="""
Task: Implement JWT refresh token rotation in src/auth/refresh.ts.
Approach: Try rotating tokens with a sliding window expiry.
[full context]
Output: IMPL: <brief description of your approach>
        PR: <url>
""", isolation="worktree", run_in_background=true)
```

Each worker gets its own worktree, its own branch, and its own implementation strategy. Because worktrees are isolated at the filesystem level, Agent A can write a completely different version of `src/auth/refresh.ts` than Agent B without conflict.

### 9.3 Anthropic C Compiler Case Study

Anthropic's engineering team deployed 16 agents in parallel to build a C compiler. Key patterns from that project:

- Agents claimed tasks by writing lock files to `current_tasks/` (e.g., `parse_if_statement.txt`) using git's built-in synchronization to prevent duplicate work
- Agents handled merge conflicts independently before pushing
- A GCC reference oracle was used as a comparison baseline — random files were compiled with GCC, remaining files with the in-progress compiler, isolating bugs to specific files
- The primary challenge: monolithic tasks caused all agents to converge on identical bugs, eliminating parallelism benefits; the solution was decomposing into independent, verifiable units

This case study demonstrates that task independence is the critical design requirement for parallel agents — not just the number of agents.

### 9.4 Applying the Adversarial Debate Pattern

For problems where the solution requires judgment (not just implementation), spawn agents with explicitly adversarial instructions:

```
Agent-1: "Implement approach X. Your secondary goal: document weaknesses in approach X that Agent-2's alternative approach might exploit."
Agent-2: "Implement approach Y. Your secondary goal: document weaknesses in approach Y that Agent-1's alternative approach might avoid."
Agent-3 (judge): "Read the outputs of Agent-1 and Agent-2. Compare the two implementations against these criteria: [criteria]. Select the better implementation and explain why. Output: WINNER: agent-1|agent-2, REASON: <explanation>"
```

Research shows multi-agent debate systems can reach state-of-the-art performance on coding benchmarks (41.4% Pass@1 in one documented case), demonstrating that adversarial dynamics meaningfully improve solution quality.

---

## 10. Automated Best-Implementation Selection

### 10.1 Criteria-Based Selection

After N competing implementations complete, the coordinator dispatches a judge agent with:
- The N PR URLs or branch names
- Explicit comparison criteria (performance, test coverage, code readability, adherence to conventions)
- The ground truth oracle (test suite, reference implementation, benchmark)

```
Agent(judge, prompt="""
Review these 3 competing implementations of JWT refresh:
- Branch worktree-impl-1: Redis blacklist approach (PR #142)
- Branch worktree-impl-2: User-record versioning approach (PR #143)
- Branch worktree-impl-3: Sliding window approach (PR #144)

Evaluation criteria (in priority order):
1. All tests pass: run `npm test -- --testPathPattern=auth/refresh`
2. No performance regression: response time < 50ms at 1000 req/s
3. Minimal external dependencies added
4. Code readability (lines of code, cyclomatic complexity)

For each branch:
1. Check out the branch in a read-only context
2. Run the test suite
3. Read the implementation (30 lines max)
4. Score on each criterion (1-5)

Output:
WINNER: worktree-impl-N
SCORES:
| Criterion | impl-1 | impl-2 | impl-3 |
...
RATIONALE: <2-3 sentences>
""", isolation="worktree")
```

### 10.2 Automated Test Oracle

The most reliable selection mechanism is a deterministic test oracle. If you can express "correctness" as a passing test suite, selection becomes objective:

1. Each worker runs the test suite before reporting `PR: <url>` (only creates a PR if tests pass)
2. Workers that fail tests report `FAILED: tests did not pass`
3. The coordinator only has to choose among passing implementations (typically using secondary criteria like code simplicity)

This is why the batch.md skill reference requires workers to run the e2e verification recipe before committing — it gates the output contract on correctness.

### 10.3 Two-Step Reduce Pattern

For large competitive pools (N > 5), use a two-step reduction:
1. **Normalize:** a first-pass judge eliminates implementations that fail basic criteria (tests fail, obvious security issues, wrong interface signature)
2. **Compare:** a second-pass judge does detailed comparison among the survivors

This mirrors the subagent-driven-development skill's two-stage review pattern: spec compliance review first (eliminate non-conforming implementations), then code quality review (select the best conforming implementation).

---

## 11. Wave-Based Execution: Dependency Analysis and Optimal Wave Formation

### 11.1 Why Waves

Not all parallel tasks are independent. When Task B requires output from Task A, B cannot start until A completes. Wave-based execution groups tasks by dependency depth: all tasks in Wave 1 are independent, Wave 2 tasks depend only on Wave 1 outputs, and so on.

```
Wave 1 (parallel): [Schema migration] [API stubs] [Test fixtures]
     ↓ (all Wave 1 complete)
Wave 2 (parallel): [API implementation] [Integration tests] [Documentation]
     ↓ (all Wave 2 complete)
Wave 3 (sequential): [Final QA] [Release notes]
```

### 11.2 Dependency Analysis Algorithm

Before dispatching workers, the coordinator performs dependency analysis:

1. **List all work units** from the plan (title, files, description)
2. **Identify dependencies:** For each pair (A, B), ask: "Can B be implemented correctly without A's changes being present in the codebase?" If no → B depends on A.
3. **Assign wave numbers:** Wave number of a task = 1 + max(wave numbers of its dependencies). Tasks with no dependencies are Wave 1.
4. **Check for conflicts:** Two tasks are conflicting (not just dependent) if they would edit the same file. If they must both edit the same file, they cannot be parallel — one must depend on the other.
5. **Form waves:** Group tasks by wave number. Within each wave, all tasks are safe to dispatch in a single message block.

### 11.3 Sequential vs Parallel Decision Criteria

Execute **sequentially** (next wave only after current wave completes) when:
- Tasks have data dependencies (output of A is input to B)
- Tasks have file conflicts (A and B both modify the same file)
- Tasks have shared state dependencies (a database migration must precede API changes)

Execute **parallel** (same wave) when:
- Tasks are independent with no data dependencies
- Tasks touch non-overlapping file sets
- Tasks can be merged without conflict after independent completion

### 11.4 Optimal Wave Size

Within a wave, there is no technical limit on the number of parallel agents. The practical limits are:
- **Token budget:** Each agent burns tokens concurrently; more agents = faster token depletion
- **Coordination overhead:** Each additional agent adds marginal status-tracking cost
- **Merge complexity:** More agents per wave means more PRs to merge in sequence

Empirical guideline (from community and Anthropic data): **5–10 agents per wave** is the sweet spot for most workflows. Beyond ~10 agents per wave, the gains from parallelism are offset by merge complexity and context management overhead.

---

## 12. Git Merge Strategy for Parallel Worktrees

### 12.1 The Merge Problem

Parallel agents each produce a branch (one per worktree). After all agents complete, these branches must be merged into the main branch. If agents truly worked on non-overlapping files, merges are conflict-free. If files overlap, conflicts arise.

### 12.2 Sequential Merge Protocol

Merge parallel branches one at a time in sequence, not all at once. This prevents three-way conflicts from compounding into an unresolvable state:

```bash
# After Wave 1 completes: merge PRs sequentially
gh pr merge 142 --squash   # Auth module
git fetch && git pull       # pull merged state

gh pr merge 143 --squash   # DB layer
git fetch && git pull

gh pr merge 144 --squash   # API endpoints
git fetch && git pull
```

Between each merge, pull the latest main so the next PR is rebased against the current merged state. This way, each conflict is a two-branch conflict, not an N-branch conflict.

### 12.3 Conflict Prevention by Design

The most effective conflict prevention is design-level task decomposition:
- Assign each agent ownership of a directory, not scattered individual files
- Use per-module or per-feature slicing (not per-file slicing)
- For cross-cutting changes (renaming a function called everywhere), use the batch pattern to assign a different file range to each worker (e.g., worker 1 handles `src/a/` to `src/f/`, worker 2 handles `src/g/` to `src/m/`)

### 12.4 Drift Prevention

Agents working in long-running worktrees can drift far from the main branch, creating large merge conflicts. After completing a checkpoint (e.g., completing one feature's tests), workers should:

```bash
git fetch origin
git rebase origin/main
```

Include rebase instructions in worker prompts for tasks expected to take more than a few minutes.

### 12.5 Automated Conflict Resolution

For conflicts that do arise in sequential merges, dispatch a single conflict-resolution agent:

```
Agent(conflict-resolver, prompt="""
Branch worktree-worker-3 has merge conflicts with main.
Conflict files: src/auth/middleware.ts, src/types/user.ts

The intended change in worktree-worker-3 is: [description]
The current state of main is: [relevant excerpt]

Resolve the conflicts preserving the intent of worktree-worker-3 while
keeping the breaking changes introduced to main in PR #143.
Do NOT change the public interface of UserMiddleware.
""")
```

---

## 13. Coordinator-Worker Communication Patterns

### 13.1 Subagent Model (One-Way Report)

In the basic subagent pattern, communication is strictly one-directional: workers report results to the coordinator; workers cannot initiate communication with each other or with the coordinator mid-task.

```
Coordinator
    ├─→ Worker 1 (fires and forgets)
    ├─→ Worker 2 (fires and forgets)
    └─→ Worker 3 (fires and forgets)

[Later]
Worker 1 ──→ Coordinator: "PR: https://..."
Worker 2 ──→ Coordinator: "PR: https://..."
Worker 3 ──→ Coordinator: "FAILED: tests failed"
```

This model is simple, robust, and token-efficient. It is the appropriate model for `/batch` and most MaxsimCLI parallel workflows.

### 13.2 Agent Teams Model (Bidirectional Mesh)

Agent Teams (experimental, requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) enable direct agent-to-agent communication:

```
Team Lead
    ├─→ spawn Researcher teammate
    ├─→ spawn Implementer teammate
    └─→ spawn Reviewer teammate

[During execution]
Researcher ──→ Implementer: "Found relevant context in src/auth/"
Implementer ──→ Reviewer: "PR ready for review at branch feature-x"
Reviewer ──→ Team Lead: "Approved with minor comments"
Team Lead ──→ Implementer: "Address reviewer comments"
```

Agent Teams use four components:
- **Team Lead:** Main Claude Code session; creates team, assigns tasks, synthesizes results
- **Teammates:** Separate Claude Code instances, each with independent context windows
- **Shared Task List:** Central work queue; teammates self-claim tasks; uses file locking to prevent race conditions
- **Mailbox System:** Point-to-point messaging between agents; broadcast available but expensive

### 13.3 When to Use Each Pattern

| Scenario | Recommended Pattern |
|----------|-------------------|
| Independent parallel tasks, results reported at end | Subagent (one-way) |
| Tasks requiring inter-agent knowledge sharing | Agent Teams |
| Sequential review pipeline | Subagent chain |
| Competing hypotheses that agents should debate | Agent Teams with adversarial prompts |
| Large batch (15+ units) | Subagent with wave orchestration |
| Research where findings should cross-pollinate | Agent Teams |

### 13.4 Resuming Subagents

Each subagent invocation creates a new instance with fresh context. To continue an existing subagent's work, ask Claude to resume it — resumed subagents retain full conversation history including all previous tool calls and reasoning.

When a subagent completes, Claude receives its agent ID. Claude uses `SendMessage` with the agent's ID as the `to` field to resume it. Transcripts are stored at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl` and persist for `cleanupPeriodDays` (default: 30 days).

---

## 14. Token Cost Analysis: Parallel vs Sequential

### 14.1 The Core Tradeoff

Parallelism trades token cost for wall-clock time. The token count for the same total work is higher in parallel execution because:
- Each agent has its own context window (system prompt, task context, tool call history)
- Agents may read overlapping files (each reads the codebase independently)
- Coordination overhead (status messages, progress tracking) adds tokens

### 14.2 Cost Models

**Sequential execution of N tasks:**
```
Total tokens ≈ N × T_per_task
Wall-clock time ≈ N × t_per_task
```

**Parallel execution of N tasks (subagent model):**
```
Total tokens ≈ N × (T_per_task + T_context_overhead)
Wall-clock time ≈ t_per_task (longest task)
T_context_overhead = system_prompt + task_prompt + shared_file_reads
```

For typical tasks, `T_context_overhead` adds 20–40% overhead per agent. The parallel execution of N tasks therefore costs approximately N × 1.3× the tokens of the sequential baseline, while reducing wall-clock time by up to N×.

**Agent Teams mode (fully persistent context windows):**
From real-world measurement, a 5-teammate Agent Team consumed 27% of a daily token budget in 45 minutes for work that a single session with sub-tasks completed using 8% of the daily budget. Agent Teams cost approximately 20× a single agent for equivalent output due to: 5 agents × per-agent context overhead + coordination messages + duplicate file reads.

### 14.3 Optimization Strategies

**Use Haiku for exploration subagents:**
```yaml
---
name: explorer
model: haiku
tools: Read, Grep, Glob
---
```
Haiku is the built-in model for the Explore subagent — fast and cheap for read-only investigation.

**Run main session on Opus, subagents on Sonnet:**
Set `CLAUDE_CODE_SUBAGENT_MODEL=claude-sonnet-4-6` to route all subagent invocations to Sonnet while the main orchestrator runs on Opus. This trades some worker quality for significantly reduced cost.

**Prompt caching:**
Claude Code automatically caches `CLAUDE.md` and system prompts, providing a 90% discount on those input tokens after the first message. This saves approximately 40–50% on total input token costs across a session. Workers spawned in the same session benefit from cached CLAUDE.md content.

**Tasks (subagents) vs Agent Teams:**
For pure parallelization without inter-agent coordination, use subagent Tasks: they spin up, do one job, return results, and die with no persistent context overhead. This achieves approximately 70% token savings compared to Agent Teams for equivalent parallel work output.

### 14.4 When Parallel Cost Is Justified

Parallel execution is worth the cost premium when:
- The wall-clock time savings are greater than the cost of human time waiting
- The task is on a critical path (release blocked, production incident)
- The quality improvement from competitive implementations outweighs cost
- The work genuinely benefits from simultaneous investigation (research, review, debugging with competing hypotheses)

Parallel execution is NOT worth the cost when:
- Tasks are sequential by nature (no dependency-free parallelism)
- The total number of agents is large (>10) and tasks are small
- The work is routine and sequential processing is fast enough

---

## 15. Maximum Practical Parallelism

### 15.1 The Empirical Sweet Spot

Based on Anthropic documentation, community data, and the MaxsimCLI batch skill:

| Agent Count | Assessment |
|-------------|------------|
| 1–2 | No meaningful parallelism; use sequential workflow |
| 3–5 | Optimal for most workflows; minimal coordination overhead |
| 5–10 | Strong parallelism; manageable merge complexity |
| 10–30 | /batch territory; requires wave orchestration and sequential PR merging |
| 30+ | Diminishing returns dominate; only justified for very large codebases (hundreds of files) |

The /batch command explicitly caps decomposition at 5–30 units depending on codebase size. Agent Teams documentation recommends starting with 3–5 teammates for most workflows. The Anthropic C compiler project used 16 agents but noted that task independence was the binding constraint, not the agent count.

### 15.2 Diminishing Returns Analysis

Coordination overhead increases super-linearly with agent count:
- **Token cost:** scales linearly (N × per-agent cost)
- **PR merge time:** scales linearly (sequential merging of N PRs)
- **Conflict resolution:** scales with the square of agents touching overlapping files
- **Status tracking complexity:** scales linearly
- **Cognitive load for human review:** scales linearly

Beyond ~10 agents, the additional throughput from more agents is increasingly offset by merge complexity. The "three focused teammates often outperform five scattered ones" observation from Anthropic's documentation reflects this: agent count is secondary to task isolation quality.

### 15.3 Practical Scaling Approach

Start conservative and scale up:
1. Begin with 3 agents for proof of concept
2. Measure wall-clock time and token cost
3. If tasks complete quickly and merges are clean, scale to 5–8 agents
4. Only scale beyond 10 if tasks are genuinely large and independent (e.g., per-module refactors in a multi-module monorepo)

Having 5–6 tasks per teammate (in Agent Teams) or 5–6 units per wave (in subagent workflows) keeps agents productive without excessive context switching or task starvation.

---

## 16. How Agent Teams Enhances the Basic Agent Tool Pattern

### 16.1 The Fundamental Difference

The Agent tool (subagent) pattern is a **hub-and-spoke** architecture: the coordinator is the hub, workers are spokes, and all communication passes through the hub. Workers cannot see each other's work in progress.

Agent Teams is a **mesh** architecture: all teammates can communicate directly with each other, see a shared task list, and coordinate without routing through the lead.

```
Subagent Pattern (hub-and-spoke):
  Coordinator ←→ Worker 1
  Coordinator ←→ Worker 2
  Coordinator ←→ Worker 3
  [Workers cannot communicate with each other]

Agent Teams (mesh):
  Lead ←→ Teammate 1 ←→ Teammate 2
           ↕              ↕
         Teammate 3 ←→ Teammate 4
  [All agents share a task list and mailbox]
```

### 16.2 Key Capabilities Agent Teams Adds

| Capability | Subagents | Agent Teams |
|------------|-----------|-------------|
| Parallel execution | Yes | Yes |
| Inter-agent messaging | No | Yes (point-to-point + broadcast) |
| Shared task list with self-claiming | No | Yes |
| Task dependencies tracked automatically | No | Yes |
| Agents can challenge each other's findings | No | Yes |
| Plan approval workflow before implementation | No | Yes |
| Direct user-to-teammate interaction | No (via lead) | Yes (Shift+Down to cycle) |
| Quality gates via hooks (TeammateIdle, TaskCompleted) | No | Yes |
| Persistent teammate context across tasks | No | Yes (own context window) |

### 16.3 Self-Coordination via Shared Task List

In Agent Teams, the team lead populates a shared task list with work items and dependencies. Teammates self-claim tasks from the queue when they finish their current work. This eliminates the coordinator bottleneck: the lead does not need to explicitly assign each task to each teammate. Task claiming uses file locking to prevent race conditions when multiple teammates try to claim the same task simultaneously.

Task states: `pending` → `in progress` → `completed`. Tasks with unresolved dependencies cannot be claimed until those dependencies complete — wave-based execution emerges naturally from the dependency graph.

### 16.4 Plan Approval Gate

Agent Teams supports a plan-before-implement workflow:

1. Lead spawns teammate with "require plan approval before making changes"
2. Teammate works in read-only plan mode
3. Teammate sends plan to lead for approval
4. Lead reviews (autonomously, based on criteria in its prompt) and approves or rejects with feedback
5. If rejected, teammate revises and resubmits
6. Once approved, teammate exits plan mode and implements

This prevents wasteful implementation of incorrect approaches and is the Agent Teams analogue of the plan-mode / approval-gate pattern in MaxsimCLI's `plan-phase` workflow.

### 16.5 Quality Gates with Hooks

Two Agent Teams-specific hook events enable automated quality enforcement:

- **`TeammateIdle`**: fires when a teammate is about to go idle. Exit with code 2 to send feedback and keep the teammate working (prevents premature completion).
- **`TaskCompleted`**: fires when a task is being marked complete. Exit with code 2 to prevent completion and send feedback (enforces done criteria).

These hooks are the Agent Teams equivalent of the subagent-driven-development skill's two-stage review (spec compliance + code quality review) — automated and integrated into the coordination protocol.

### 16.6 When to Use Agent Teams vs Subagents

**Use subagents (Agent tool) when:**
- Tasks are well-defined upfront with no anticipated need for inter-agent knowledge sharing
- Output is a PR URL or structured result (not a synthesis requiring deliberation)
- You are running /batch or a MaxsimCLI phase plan
- Cost efficiency is a primary concern (subagents are significantly cheaper than Agent Teams)
- The workflow is automated and unattended

**Use Agent Teams when:**
- Workers need to share findings mid-task (e.g., Researcher finds something Implementer needs immediately)
- The problem benefits from adversarial debate (competing hypotheses, security review from multiple angles)
- You want teammates to self-coordinate without constant lead intervention
- You are doing exploratory research or review work (not mechanical implementation)
- The task genuinely requires collaborative reasoning, not just parallel execution

### 16.7 Limitations (as of 2026)

Agent Teams is experimental and has known limitations:
- No session resumption with in-process teammates (`/resume` and `/rewind` do not restore in-process teammates)
- Task status can lag (teammates sometimes fail to mark tasks completed, blocking dependent tasks)
- Shutdown can be slow (teammates finish current request before stopping)
- One team per session
- No nested teams (teammates cannot spawn their own teams)
- Fixed lead (cannot promote a teammate to lead)
- Permissions set at spawn time (cannot configure per-teammate modes at creation)
- Split-pane mode requires tmux or iTerm2 (not supported in VS Code terminal, Windows Terminal, or Ghostty)

---

## Summary: Decision Tree for MaxsimCLI Parallel Execution

```
START: Is the work parallelizable?
│
├── No → Use sequential workflow or subagent-driven-development skill
│
└── Yes → How many independent units?
    │
    ├── 2–4 units → Dispatch in single message block, foreground or background
    │               Use worktree isolation if units touch overlapping files
    │
    ├── 5–30 units → /batch or plan-phase + execute-phase
    │                Use wave orchestration if dependency graph is non-trivial
    │                All workers: isolation=worktree, run_in_background=true
    │                Merge PRs sequentially after each wave
    │
    └── Same task, multiple solutions → Competitive implementation pattern
        N agents × same prompt + different approach hints
        Judge agent selects winner by test oracle or criteria scorecard

Do workers need to share findings mid-task?
│
├── No → Subagent pattern (lower cost, simpler)
│
└── Yes → Agent Teams (experimental)
          Enable: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
          Start with 3–5 teammates
          Use shared task list for self-coordination
          Use TeammateIdle + TaskCompleted hooks for quality gates
```

---

## References

**Official Documentation:**
- [Create custom subagents](https://code.claude.com/docs/en/sub-agents) — Complete subagent parameter reference
- [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) — Agent Teams architecture
- [Common workflows: Git worktrees](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) — Worktree isolation mechanics
- [Manage costs effectively](https://code.claude.com/docs/en/costs) — Token cost guidance

**Anthropic Engineering:**
- [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler) — 16-agent parallel case study

**Local MaxsimCLI Reference:**
- `/c/Development/cli/maxsim/docs/claude-own-skills-ref/batch.md` — Batch parallel orchestration skill
- `/c/Development/cli/maxsim/docs/superpowers-reference/skills/dispatching-parallel-agents/index.md` — Parallel agent dispatch patterns
- `/c/Development/cli/maxsim/docs/superpowers-reference/skills/subagent-driven-development/index.md` — Sequential subagent development with review gates

**Community:**
- [Claude Code Sub-Agents: Parallel vs Sequential Patterns](https://claudefa.st/blog/guide/agents/sub-agent-best-practices)
- [Claude Code Agent Teams: The Complete Guide 2026](https://claudefa.st/blog/guide/agents/agent-teams)
- [Claude Code Worktrees: Run Parallel Sessions Without Conflicts](https://claudefa.st/blog/guide/development/worktree-guide)
- [How to Run Multiple Claude Code Agents in Parallel with Git Worktrees](https://docs.bswen.com/blog/2026-03-21-git-worktrees-parallel-claude-code/)
- [Claude Code Async: Background Agents and Parallel Tasks](https://claudefa.st/blog/guide/agents/async-workflows)
- [Claude Code /batch and /simplify Commands Guide](https://claudefa.st/blog/guide/mechanics/simplify-batch-commands)
