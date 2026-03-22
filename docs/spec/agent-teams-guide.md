# Claude Code Agent Teams: Comprehensive Technical Guide

> **Status**: Agent teams are experimental as of Claude Code v2.1.32 (released February 2026).
> Enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
> This guide reflects official Anthropic documentation plus community research as of March 2026.

---

## Table of Contents

1. [What Are Agent Teams](#1-what-are-agent-teams)
2. [Enabling Agent Teams](#2-enabling-agent-teams)
3. [Creating a Team: TeamCreate and Related Tools](#3-creating-a-team-teamcreate-and-related-tools)
4. [How Teammates Communicate](#4-how-teammates-communicate)
5. [Shared Task Lists](#5-shared-task-lists)
6. [TeammateIdle Hook](#6-teammateidle-hook)
7. [TaskCompleted Hook](#7-taskcompleted-hook)
8. [Display Modes](#8-display-modes)
9. [Team Lifecycle](#9-team-lifecycle)
10. [Token Cost Implications](#10-token-cost-implications)
11. [Known Limitations and Workarounds](#11-known-limitations-and-workarounds)
12. [Real-World Usage Patterns](#12-real-world-usage-patterns)
13. [Combining Agent Teams with the Agent Tool](#13-combining-agent-teams-with-the-agent-tool)
14. [Coordination Patterns](#14-coordination-patterns)
15. [Error Recovery](#15-error-recovery)
16. [Environment Variables Available to Teammates](#16-environment-variables-available-to-teammates)

---

## 1. What Are Agent Teams

Agent teams let you coordinate multiple Claude Code instances working together. One session acts as the **team lead** — it creates the team, spawns teammates, assigns work, and synthesizes results. Each **teammate** is a fully independent Claude Code session with its own context window. Teammates can message each other directly without going through the lead.

This is distinct from the `Task` tool (subagents), which spawn helper agents that only report results back to the calling session and cannot communicate with each other.

### Agent Teams vs. Subagents

| Dimension | Subagents (Task tool) | Agent Teams |
|---|---|---|
| Context | Own window; result returns to caller | Own window; fully independent |
| Communication | Report to parent only | Direct peer-to-peer messaging |
| Coordination | Parent manages all work | Shared task list, self-coordination |
| Best for | Focused tasks where only the result matters | Complex work requiring discussion and collaboration |
| Token cost | Lower — results summarized back | Higher — each teammate is a full Claude instance |
| Setup | None | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |

The threshold for choosing teams over subagents: **when workers need to talk to each other**. If parallel sub-agents hit context limits, or when they need to communicate findings and challenge each other's conclusions, switch to agent teams.

### When to Use Agent Teams

Strong use cases:
- **Research with multiple lenses**: Multiple teammates investigate aspects of a problem simultaneously, then share and challenge findings ("scientific debate" mode).
- **New modules or features**: Teammates each own a distinct file boundary, no overlap.
- **Competing-hypothesis debugging**: Each teammate tests a different theory in parallel. The one that survives challenge is more likely to be the real root cause.
- **Cross-layer coordination**: Frontend, backend, database schema, and tests each owned by a different teammate.
- **Multi-perspective code review**: Security, performance, and test coverage reviewed simultaneously by specialists.

Skip agent teams when:
- Tasks are sequential with tight dependencies between steps.
- Multiple teammates would edit the same files (creates conflicts).
- Only the final result matters, not inter-agent discussion.
- You need session resumption (in-process teammates cannot resume).

---

## 2. Enabling Agent Teams

Agent teams are disabled by default. Enable the feature with an environment variable.

### Option A: Shell Environment

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Option B: settings.json (Persistent)

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Settings files live at:

| Scope | Path |
|---|---|
| Project (shared with team) | `.claude/settings.json` |
| User (all projects) | `~/.claude/settings.json` |

**Version requirement**: Claude Code v2.1.32 or later. Verify with `claude --version`.

---

## 3. Creating a Team: TeamCreate and Related Tools

### How Teams Are Created

You do not call `TeamCreate` directly in a prompt — you describe the team in natural language and Claude's lead session issues the underlying tool calls. Internally, the lead uses `TeamCreate` (or the equivalent `TeammateTool` operation) to bootstrap the team infrastructure.

**Natural language trigger examples:**

```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

### TeamCreate Parameters (Internal)

The `TeamCreate` / `TeammateTool` operation with `spawnTeam` sets up the team infrastructure:

| Parameter | Type | Description |
|---|---|---|
| `team_name` | string | Namespace identifier — links all team artifacts. Used as the directory name under `~/.claude/teams/` and `~/.claude/tasks/`. |
| `description` | string | Team purpose and context. Included in spawn prompts. |

This creates:
- `~/.claude/teams/{team-name}/config.json` — Member metadata (names, agent IDs, colors, backend types).
- `~/.claude/tasks/{team-name}/` — Directory for task files.

### Spawning Individual Teammates

After team creation, the lead spawns each teammate. You can specify:

- **Role description**: "A security reviewer focused on token handling and session management"
- **Model**: "Use Sonnet for each teammate" — Claude Opus 4.6 for leads, Sonnet 4.5 for teammates, and Haiku 4.5 subagents inside teammates is an effective cost-reducing mix.
- **Mode**: `plan` (read-only until lead approves) or standard (full tool access).
- **Context**: Spawn prompt with task-specific details — teammates do not inherit the lead's conversation history.

### Agent Types

| Type | Description |
|---|---|
| `general-purpose` | Full tool access, multi-step work |
| `plan` | Read-only design/architecture phase, no file changes until approved |
| `explore` | Read-only fast searches, uses lighter model |
| `bash` | Command execution only |

---

## 4. How Teammates Communicate

### SendMessage Tool Parameters

Teammates use `SendMessage` for direct peer-to-peer communication. The full parameter set:

| Parameter | Type | Description |
|---|---|---|
| `type` | string | Message classification: `message`, `broadcast`, `shutdown_request`, `shutdown_response`, `plan_approval_response` |
| `recipient` | string | Target agent name, or `"team-lead"` for the lead, or `"*"` for broadcast |
| `content` | string | Message payload — the text the recipient reads |
| `summary` | string | Brief synopsis for the lead's synthesis view |
| `request_id` | string | Used in shutdown flows: the shutdown request ID being acknowledged |
| `approve` | boolean | Used in `plan_approval_response`: whether the lead approves or rejects the plan |

### Point-to-Point Messaging

```
SendMessage({
  type: "message",
  recipient: "security-reviewer",
  content: "I found that the session tokens are stored in localStorage. Can you assess the XSS risk?",
  summary: "Asking security-reviewer about XSS risk from localStorage token storage"
})
```

### Broadcast (Use Sparingly)

```
SendMessage({
  type: "broadcast",
  recipient: "*",
  content: "All teammates: the API rate limit is 100 req/min. Factor this into your approaches.",
  summary: "Broadcasting API rate limit constraint to all teammates"
})
```

Broadcasts send a separate message to every teammate. The **cost scales linearly with team size**. Use point-to-point messages when only one or two teammates need the information.

### Message Storage

Messages are stored as JSON objects in mailboxes at `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`. Each message contains: sender, timestamp, content, and optional structured type fields.

Teammates receive messages automatically — the lead does not need to poll. When a teammate finishes and goes idle, it automatically notifies the lead.

### Plan Approval Flow

When a teammate is spawned in `plan` mode:

1. Teammate works in read-only mode, produces a plan.
2. Teammate calls `ExitPlanMode` when ready for review, sending a `plan_approval_response`-type message.
3. Lead reviews the plan and responds with `approve: true` or `approve: false` plus feedback.
4. If rejected, teammate revises and resubmits. If approved, teammate exits plan mode and begins implementation.

The lead makes approval decisions autonomously. To influence judgment, specify criteria in the spawn prompt: "only approve plans that include test coverage" or "reject any plan that modifies the database schema".

### Shutdown Flow

```
SendMessage({
  type: "shutdown_request",
  recipient: "researcher",
  content: "Your analysis is complete. Please shut down.",
  request_id: "shutdown-001"
})
```

The teammate acknowledges with:

```
SendMessage({
  type: "shutdown_response",
  recipient: "team-lead",
  approve: true,
  request_id: "shutdown-001"
})
```

A teammate can reject a shutdown request with `approve: false` and an explanation. This gives teammates agency to refuse premature termination.

---

## 5. Shared Task Lists

The shared task list is the primary coordination mechanism. All agents (lead and teammates) can read, claim, and update tasks. The list lives at `~/.claude/tasks/{team-name}/`.

### Task States

```
pending → in_progress → completed
```

A task also has an `owner` field. Only one agent can own a task at a time.

### Task Dependencies

Tasks can express dependencies using `blockedBy` and `blocks` arrays:

```
TaskCreate({
  subject: "Write API endpoints",
  description: "Implement REST endpoints for the auth module",
  activeForm: "Implementing API"
})

TaskUpdate({
  taskId: "api-task",
  addBlockedBy: ["schema-task"]  // won't start until schema-task is completed
})
```

This creates execution waves: Wave 1 tasks (no prerequisites) start immediately. Wave 2 tasks unlock automatically when their blockers complete. The system manages dependency resolution — no manual intervention required.

### Task Claiming

File locking prevents race conditions when multiple teammates try to claim the same task simultaneously. The claiming loop:

```
TaskList() → find pending unowned unblocked task →
TaskUpdate(claim task, set owner) → TaskUpdate(set in_progress) →
[do work] → TaskUpdate(set completed) →
SendMessage(results to lead or relevant teammate) → repeat
```

### Lead Assignment vs. Self-Claim

- **Lead assigns explicitly**: "Tell the researcher to pick up task #3."
- **Self-claim**: After finishing a task, a teammate polls the task list and claims the next available, unblocked, unassigned task. This is the default behavior and creates a natural load-balancing effect.

### Task Fields

Each task file stores:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `subject` | string | Brief task name (shown in list) |
| `description` | string | Detailed instructions |
| `status` | enum | `pending`, `in_progress`, `completed` |
| `owner` | string | Agent name that claimed this task |
| `blockedBy` | string[] | Task IDs that must complete first |
| `blocks` | string[] | Task IDs that this task unlocks |
| `activeForm` | string | Status spinner label shown in UI |
| `timestamps` | object | Created, claimed, completed times |

### TaskCreate Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `subject` | string | Yes | Brief task identifier |
| `description` | string | Yes | Full instructions the teammate reads |
| `activeForm` | string | No | Status label shown in task list UI |

### TaskUpdate Parameters

| Parameter | Type | Description |
|---|---|---|
| `taskId` | string | References the task to update |
| `status` | enum | `pending`, `in_progress`, `completed` |
| `owner` | string | Claim the task with your agent name |
| `addBlockedBy` | string[] | Add dependency: this task waits for these |
| `addBlocks` | string[] | Declare that this task's completion unblocks these |

---

## 6. TeammateIdle Hook

### Purpose

`TeammateIdle` fires when a teammate finishes its turn and is about to go idle. Use it to enforce quality gates before a teammate stops — requiring passing lint checks, verifying output files exist, running tests, etc.

### When It Fires

- After a teammate completes a turn and is about to become idle.
- Does **not** support matchers — fires on every occurrence in the team.

### JSON Input Payload

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/username/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/username/my-project",
  "permission_mode": "default",
  "hook_event_name": "TeammateIdle",
  "teammate_name": "researcher",
  "team_name": "my-project"
}
```

**Agent-teams-specific fields:**

| Field | Type | Description |
|---|---|---|
| `teammate_name` | string | Name of the teammate about to go idle |
| `team_name` | string | Name of the team this teammate belongs to |

**Standard fields (present on all hooks):**

| Field | Description |
|---|---|
| `session_id` | Current session identifier |
| `transcript_path` | Path to conversation JSONL file |
| `cwd` | Working directory of the teammate's session |
| `permission_mode` | Current permission mode |

### Exit Codes and Behavior

| Exit Code | Behavior |
|---|---|
| `0` | Allow — teammate goes idle normally |
| `2` | Block — stderr is sent to the teammate as feedback; teammate continues working |
| Other | Allow — non-blocking failure, hook error is silently ignored |

There is also a second control method: return JSON with `{"continue": false, "stopReason": "..."}` to stop the teammate entirely (equivalent to the `Stop` hook behavior). Use this when quality gates fail catastrophically and the teammate should not attempt recovery.

### Example: Require Build Artifact Before Idling

```bash
#!/bin/bash
# ~/.claude/hooks/teammate-idle-check.sh

INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')

if [ ! -f "./dist/output.js" ]; then
  echo "[$TEAMMATE] Build artifact missing at dist/output.js. Run the build before stopping." >&2
  exit 2  # Keep teammate working
fi

exit 0  # Allow idle
```

### Example: Run Lint Before Idling

```bash
#!/bin/bash
# ~/.claude/hooks/teammate-idle-lint.sh

INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')

if ! npx eslint src/ --quiet 2>&1; then
  echo "[$TEAMMATE] ESLint errors found. Fix all lint errors before stopping." >&2
  exit 2
fi

exit 0
```

### Registration in settings.json

```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/teammate-idle-check.sh"
          }
        ]
      }
    ]
  }
}
```

Note: `TeammateIdle` has no `matcher` field — it fires for all teammates.

### Use Cases

- Enforce passing lint before any teammate stops.
- Verify that required output files or artifacts exist.
- Run a scoped test suite and block idling on failures.
- Auto-assign a follow-up task (by writing to the task list and returning a message to the teammate).
- Redirect an early-finishing teammate to claim another task.

---

## 7. TaskCompleted Hook

### Purpose

`TaskCompleted` fires when a task is being marked as completed. Use it to enforce completion criteria — passing tests, lint checks, acceptance criteria — before a task officially closes.

### When It Fires

- When any agent calls `TaskUpdate` with `status: "completed"`.
- When a teammate finishes its turn with in-progress tasks (auto-completion path).
- Does **not** support matchers — fires on every task completion.

### JSON Input Payload

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/username/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/username/my-project",
  "permission_mode": "default",
  "hook_event_name": "TaskCompleted",
  "task_id": "task-001",
  "task_subject": "Implement user authentication",
  "task_description": "Add login and signup endpoints with JWT token handling",
  "teammate_name": "implementer",
  "team_name": "my-project"
}
```

**Agent-teams-specific fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `task_id` | string | Yes | Identifier of the task being completed |
| `task_subject` | string | Yes | Short title of the task |
| `task_description` | string | No | Detailed description of the task |
| `teammate_name` | string | No | Name of the teammate completing the task |
| `team_name` | string | No | Name of the team |

### Exit Codes and Behavior

| Exit Code | Behavior |
|---|---|
| `0` | Allow — task is marked completed |
| `2` | Block — task is NOT marked completed; stderr is fed to the model as feedback |
| Other | Allow — non-blocking hook failure |

You can also return JSON with `{"continue": false, "stopReason": "..."}` to stop the teammate entirely (not just block the task completion).

### Example: Require Passing Tests Before Task Completes

```bash
#!/bin/bash
# ~/.claude/hooks/task-completed-gate.sh

INPUT=$(cat)
TASK=$(echo "$INPUT" | jq -r '.task_subject')
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name // "unknown"')

echo "Validating task completion: $TASK (by $TEAMMATE)"

if ! npm test 2>&1; then
  echo "Tests not passing. Fix failing tests before completing: $TASK" >&2
  exit 2  # Block completion
fi

exit 0  # Allow completion
```

### Example: Require Lint + Tests

```bash
#!/bin/bash
INPUT=$(cat)
TASK=$(echo "$INPUT" | jq -r '.task_subject')

ERRORS=()

if ! npx eslint src/ --quiet 2>/dev/null; then
  ERRORS+=("ESLint errors found")
fi

if ! npm test -- --passWithNoTests 2>/dev/null; then
  ERRORS+=("Test suite failing")
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "Task '$TASK' blocked:" >&2
  for err in "${ERRORS[@]}"; do
    echo "  - $err" >&2
  done
  exit 2
fi

exit 0
```

### Registration in settings.json

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ~/.claude/hooks/task-completed-gate.sh"
          }
        ]
      }
    ]
  }
}
```

### Use Cases

- Enforce passing tests before any task closes.
- Require code review approval (check for a review-approved flag file).
- Verify documentation completeness.
- Check acceptance criteria in task description against actual deliverables.
- Prevent "done" from meaning "I think I'm done" rather than "tests pass".

---

## 8. Display Modes

Agent teams support two display modes that control how teammate sessions are rendered.

### In-Process Mode (Default)

All teammates run inside your main terminal. Navigation is keyboard-driven:

| Key | Action |
|---|---|
| `Shift+Down` | Cycle to next teammate (wraps back to lead after last teammate) |
| `Shift+Up` | Cycle to previous teammate |
| `Enter` | View a teammate's full session |
| `Escape` | Interrupt a teammate's current turn |
| `Ctrl+T` | Toggle the shared task list view |

Works in any terminal — no external dependencies.

**Limitation**: No simultaneous view of all teammate outputs.

### Split-Pane Mode

Each teammate gets its own terminal pane. All outputs visible simultaneously. Click into a pane to interact with that teammate directly.

**Requirements**: `tmux` or iTerm2 with `it2` CLI.

**Not supported in**: VS Code integrated terminal, Windows Terminal, Ghostty.

### Configuration

Set `teammateMode` in `settings.json`:

```json
{
  "teammateMode": "in-process"
}
```

Valid values: `"in-process"`, `"tmux"`, `"auto"` (default).

`"auto"` uses split panes if you are already running inside a tmux session, and in-process otherwise.

Override for a single session with a flag:

```bash
claude --teammate-mode in-process
```

### tmux Setup

```bash
# Install tmux (macOS)
brew install tmux

# Verify
which tmux

# Recommended entry point for macOS/iTerm2
tmux -CC
```

For iTerm2 split panes: install the `it2` CLI, then enable **iTerm2 → Settings → General → Magic → Enable Python API**.

### Delegate Mode

Activate with `Shift+Tab` after starting a team. In delegate mode:

- The lead **cannot** use code-editing tools, run commands, or directly implement anything.
- The lead **can** only: spawn teammates, send messages, shut down workers, and manage tasks.

Use delegate mode for teams of 4+ teammates where you want the lead to act as a pure project manager rather than a participant-contributor. This prevents the lead from "helping" in ways that bypass the coordination structure.

---

## 9. Team Lifecycle

### 1. Enable

Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your environment or `settings.json`.

### 2. Create

Tell the lead what team to create in natural language. The lead:
1. Calls `TeamCreate` with `team_name` and `description`.
2. Creates the task list structure.
3. Spawns each teammate with its role-specific spawn prompt.
4. Begins coordinating work.

Typical teammate spawn time: 20–30 seconds. First results appear within the first minute.

### 3. Work

Normal operation:
- Lead assigns tasks or teammates self-claim from the shared list.
- Teammates send progress updates via `SendMessage`.
- Idle notifications fire automatically when teammates finish turns.
- Task dependencies auto-unblock as predecessors complete.
- Hooks enforce quality gates at idle and completion points.

### 4. Monitoring and Steering

Check in during execution — do not run teams fully unattended for long periods:
- Redirect approaches that aren't working via direct teammate messages.
- Reassign stuck tasks.
- If the lead starts implementing instead of delegating: "Wait for your teammates to complete their tasks before proceeding."

### 5. Shut Down Teammates

When work is complete, gracefully shut down teammates before cleanup:

```
Ask the researcher teammate to shut down
```

The lead sends a `shutdown_request`. The teammate approves (exits gracefully) or rejects with explanation. Shutdown can be slow — teammates finish their current request or tool call first.

### 6. Clean Up

```
Clean up the team
```

This removes shared team resources (`~/.claude/teams/{team-name}/` and `~/.claude/tasks/{team-name}/`). Cleanup **fails** if any teammates are still running. Always shut down teammates first.

**Important**: Only the lead should run cleanup. If a teammate attempts cleanup, its team context may not resolve correctly, leaving resources in an inconsistent state.

### Storage Locations

| Artifact | Path |
|---|---|
| Team config | `~/.claude/teams/{team-name}/config.json` |
| Task list | `~/.claude/tasks/{team-name}/` |
| Teammate inboxes | `~/.claude/teams/{team-name}/inboxes/{agent-name}.json` |

---

## 10. Token Cost Implications

### Cost Scaling

Each teammate is a full Claude instance with its own context window. Costs scale approximately linearly with active teammate count:

| Setup | Approximate Token Usage | Approximate Wall Time |
|---|---|---|
| Single session | ~50K tokens | 45 min |
| 3-person team | ~150K–200K tokens | 20–25 min |
| 5-person team | ~300K–400K tokens | 15–20 min |

A rough formula: **N teammates × single-session cost + coordination overhead**.

### Communication Overhead

- **Point-to-point messages**: Low overhead — one delivery to one inbox.
- **Broadcasts**: High overhead — N deliveries, each processed by a separate context window.

Minimize broadcasts. Reserve them for truly global constraints all teammates must know.

### Optimization Strategies

**Use a tiered model mix:**
- Team lead: Claude Opus 4.6 (highest quality for coordination decisions)
- Teammates: Claude Sonnet 4.5 (good quality, lower cost)
- Subagents inside teammates: Claude Haiku 4.5 (fast/cheap for simple subtasks)

**Specify models in your spawn prompt:**
```
Create a team with 3 teammates to review PR #142.
Use Sonnet 4.5 for each teammate.
```

**Optimize CLAUDE.md:**
- Clear module boundaries reduce teammate exploration overhead.
- Each teammate loads CLAUDE.md on spawn — well-structured context reduces the tokens each teammate spends figuring out the codebase.
- Keep CLAUDE.md under 200 lines. Every line must justify its presence.

**Cap turn counts:**
- Specify `max_turns` in spawn parameters to prevent runaway token consumption.

**Team size discipline:**
- 3–5 teammates is the practical sweet spot for most workflows.
- Beyond 5 active teammates, coordination overhead grows faster than productivity gains.
- 5–6 tasks per teammate keeps everyone productive without excessive context switching.

### Anthropic's Real-World Data

Anthropic's internal C compiler project provides the most comprehensive public data point:

- **16 parallel agents** working simultaneously
- **~2,000 Claude Code sessions** total
- **~2 billion input tokens** + **~140 million output tokens**
- **~$20,000 total API cost**
- **Output**: 100,000-line Rust compiler that compiles Linux 6.9 on x86, ARM, and RISC-V

This project did not use the Agent Teams feature directly — it used a file-locking-based task queue. It demonstrates that very large multi-agent projects are viable at known costs when parallelism is well-structured.

---

## 11. Known Limitations and Workarounds

### No Session Resumption for In-Process Teammates

`/resume` and `/rewind` do not restore in-process teammates. After resuming, the lead may attempt to message teammates that no longer exist.

**Workaround**: Tell the lead to spawn new teammates after resuming.

### Task Status Can Lag

Teammates sometimes complete work but fail to call `TaskUpdate` to mark the task completed. This blocks dependent tasks.

**Workaround**: Check whether work is actually done, then either update the task status manually or tell the lead to nudge the teammate: "Ask the implementer if task #3 is actually complete."

### Shutdown Can Be Slow

Teammates finish their current request or tool call before shutting down. For long-running tool calls, this can take significant time.

**Workaround**: Interrupt the teammate's current turn (`Escape` in in-process mode, or click and type in split-pane mode) before issuing the shutdown request.

### One Team Per Session

A lead can only manage one team at a time.

**Workaround**: Clean up the current team completely before starting a new one.

### No Nested Teams

Teammates cannot spawn their own teams or teammates. Only the lead can manage the team.

**Workaround**: Use the hybrid pattern — teammates can use the `Task` tool (subagents) for focused sub-work that does not require peer communication. Subagents inside teammates report back to that teammate.

### Lead Is Fixed

The session that creates the team is the lead for its lifetime. Leadership cannot be transferred.

**Workaround**: None — plan your lead session accordingly. The lead terminal should remain your primary interface throughout the team's life.

### Permissions Set at Spawn

All teammates start with the lead's permission mode. Per-teammate permission modes cannot be set at spawn time.

**Workaround**: Change individual teammate modes after spawning if needed.

### Split Panes Require tmux or iTerm2

Not supported in VS Code integrated terminal, Windows Terminal, or Ghostty.

**Workaround**: Use in-process mode (`--teammate-mode in-process`), or run Claude Code in a tmux session from your terminal emulator.

### Orphaned tmux Sessions

If a tmux session persists after team cleanup fails, it may be left running.

**Workaround**:
```bash
tmux ls
tmux kill-session -t <session-name>
```

### Too Many Permission Prompts

Teammate permission requests bubble up to the lead, creating friction at scale.

**Workaround**: Pre-approve common operations in settings before spawning:
```json
{
  "permissions": {
    "allow": ["Read", "Write", "Edit", "Bash"]
  }
}
```

---

## 12. Real-World Usage Patterns

### Parallel Code Review

Split a PR review into specialist lenses that cannot easily drift:

```
Create an agent team to review PR #142. Spawn three reviewers:
- Security reviewer: Audit authentication, token handling, input validation, injection risks
- Performance analyst: Profile response times, identify N+1 queries, check caching
- Test coverage checker: Verify edge cases are tested, coverage on new code paths

Have each reviewer examine the PR independently and report findings.
Synthesize the results after all three are done.
```

One reviewer tends to focus on the type of issue they find first and stop noticing others. Splitting by lens ensures each concern gets full attention.

### Competing-Hypothesis Debugging

When root cause is unclear, use adversarial investigation:

```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses:
1. Timeout configuration issue
2. Connection pool exhaustion
3. Memory leak causing OOM kill
4. Race condition in session management
5. Incorrect keep-alive headers

Have them share findings and actively try to disprove each other's theories,
like a scientific debate. Update findings.md with whatever consensus emerges.
```

The debate structure prevents anchoring. Sequential investigation biases toward the first plausible theory found. With teammates actively trying to disprove each other, the surviving theory is more likely to be the actual root cause.

### Cross-Layer Feature Implementation

Assign file ownership explicitly to avoid conflicts:

```
Implement the new user preferences feature. Create a team with 4 teammates:
- Database teammate: owns src/db/schema/, src/db/migrations/
- API teammate: owns src/api/preferences/, src/api/types/
- Frontend teammate: owns src/ui/preferences/, src/ui/components/settings/
- Test teammate: owns src/**/*.test.ts for the preferences feature

Each teammate should own only their specified files.
Dependencies: API teammate waits for database schema. Frontend waits for API types.
Test teammate coordinates with all three after their implementations are done.
```

### Fan-Out Migrations

For large-scale mechanical changes across many files:

```
We need to migrate all API calls from v1 to v2 format across 50 service files.
Create a team of 5 workers to split the migration:
- Worker 1: src/services/auth/ and src/services/users/
- Worker 2: src/services/payments/ and src/services/billing/
- Worker 3: src/services/notifications/ and src/services/emails/
- Worker 4: src/services/analytics/ and src/services/reporting/
- Worker 5: src/services/admin/ and src/services/config/

Each worker should migrate, run tests for their section, and report completion.
```

### Research and Decision Making

For architectural decisions requiring multiple perspectives:

```
I'm designing a CLI tool that tracks TODO comments across a codebase.
Create an agent team to explore this from different angles:
- UX teammate: user workflows, CLI ergonomics, output formats
- Architecture teammate: storage backends, query performance, plugin model
- Devil's advocate: enumerate everything that could go wrong, failure modes, scope creep risks

Have them share findings and produce a decision memo with tradeoffs.
```

### QA Swarm

Parallel testing of a web application across multiple concern areas:

```
Spawn 5 agent teammates to test our application:
- Core pages teammate: test all main navigation flows
- API teammate: test all REST endpoints with edge cases
- Link checker: verify no broken links or missing assets
- SEO teammate: check meta tags, structured data, sitemap
- Accessibility teammate: run a11y checks on all pages

Each teammate should produce a structured findings report.
Lead: synthesize into a prioritized issue list.
```

---

## 13. Combining Agent Teams with the Agent Tool

### The Hybrid Architecture

The two systems are complementary and can be composed:

| Layer | Tool | Use When |
|---|---|---|
| Persistent, communicating peers | Agent Teams (teammate sessions) | Workers need to talk to each other, share findings, debate conclusions |
| Focused, result-returning workers | Agent tool (subagents / `Task`) | Short-lived work where only the result matters; no peer communication needed |

Teammates (agent team members) can themselves dispatch subagents using the `Task` tool. This gives you two levels of parallelism:
- **Outer level**: Teammates working in parallel, communicating peer-to-peer.
- **Inner level**: Each teammate dispatching its own subagents for focused sub-tasks.

### When to Transition from Subagents to Agent Teams

Use subagents when:
- Workers do isolated, independent work.
- Only the final result needs to come back.
- No inter-worker communication is needed.
- Context limits on the main session are not a concern.

Switch to agent teams when:
- Sub-agents need to communicate with each other.
- You are hitting context limits on the main session from managing many subagent results.
- Work requires real-time discussion and collaborative refinement.
- You want workers to challenge each other's findings.

### Hybrid Pattern Example: Research + Implement

Phase 1 (Subagents — cheap exploration):

```
Use the Task tool to spawn three research subagents in parallel:
- Research subagent A: Investigate library X — API surface, limitations, community health
- Research subagent B: Investigate library Y — same criteria
- Research subagent C: Investigate library Z — same criteria

Collect all three reports. Make a recommendation.
```

Phase 2 (Agent team — coordinated implementation):

```
Based on the research, we're using library X.
Create an agent team to implement the integration:
- Core integration teammate: owns src/lib/x-integration/
- Testing teammate: owns src/lib/x-integration/**/*.test.ts
- Documentation teammate: owns docs/x-integration/

Testing teammate: wait for core integration to complete before writing tests.
```

This pattern uses cheap subagents for the exploratory phase where peer communication is not needed, then promotes to an agent team for the implementation phase where coordination matters.

### Plan-Then-Execute Pattern

Use plan mode (agent teams feature) to gate expensive implementation:

1. Spawn teammates in read-only `plan` mode.
2. Review all plans before approving.
3. Only approved plans proceed to implementation.
4. Human checkpoint inserted at near-zero additional cost.

```
Spawn an architect teammate to plan the refactor of our authentication module.
Require plan approval before they make any changes.
Only approve if the plan includes:
- Test coverage for all changed code paths
- No modification to the public API surface
- Backward-compatible database migrations
```

---

## 14. Coordination Patterns

### Pattern 1: Leader-Worker (Parallel Specialists)

The lead assigns distinct tasks to each worker. Workers operate independently and report results. No worker-to-worker communication.

```
Lead
 ├── Worker A → independent task A → report to lead
 ├── Worker B → independent task B → report to lead
 └── Worker C → independent task C → report to lead
Lead synthesizes all three reports
```

**Best for**: Code review, parallel research, independent module development.

**Key property**: Works without inter-agent communication. Subagents can achieve the same result at lower cost if teammates do not need to interact.

### Pattern 2: Pipeline (Sequential with Dependencies)

Tasks pass through stages. Each stage depends on the previous stage completing. Dependencies are expressed with `addBlockedBy`.

```
Researcher → findings document →
Writer (blocked by Researcher) → draft document →
Reviewer (blocked by Writer) → final document
```

```
TaskUpdate({ taskId: "writer-task", addBlockedBy: ["researcher-task"] })
TaskUpdate({ taskId: "reviewer-task", addBlockedBy: ["writer-task"] })
```

The system auto-unblocks downstream tasks when upstream tasks complete.

**Best for**: Workflows with clear handoffs — research → implementation → review, or schema → API → frontend.

**Key property**: Enforces sequential ordering without busy-waiting. Teammates claim tasks only when prerequisites are met.

### Pattern 3: Swarm (Self-Organizing Pool)

Multiple workers continuously poll the task list and race to claim pending tasks. No fixed assignment — work distributes itself.

```
Worker 1 ─┐
Worker 2 ─┤→ Poll TaskList → Claim next pending → Do work → Complete → Repeat
Worker 3 ─┘
```

**Best for**: Large pools of homogeneous tasks (migrating 50 files, testing 146 URLs, processing a queue of similar items).

**Key property**: Natural load balancing. Faster workers do more work. No coordinator bottleneck.

### Pattern 4: Peer-to-Peer (Debate / Collaborative)

All teammates can message any other teammate directly. Used for adversarial investigation, collaborative refinement, and consensus building.

```
Teammate A → challenge Teammate B's hypothesis → B revises → A acknowledges
Teammate C → shares finding relevant to B's investigation → B incorporates
Lead → synthesizes emerging consensus from all inboxes
```

**Best for**: Debugging with competing hypotheses, architectural decisions, research where teams should challenge each other.

**Key property**: Not hierarchical. Any peer can initiate communication with any other peer. Lead may still synthesize but is not the sole communication hub.

### Pattern 5: Builder-Validator

One teammate builds, another validates independently on a separate git worktree. The validator cannot see the builder's reasoning — only the output.

```
Builder teammate: owns implementation files, writes code
Validator teammate (separate worktree): reads implementation, runs tests, reports issues
Builder: receives feedback, fixes issues
```

Use git worktrees (`claude --worktree <name>`) for complete isolation. Worktrees give each teammate its own working copy at `<repo>/.claude/worktrees/<name>` on its own git branch.

**Best for**: High-stakes implementations where you want an independent reviewer with no anchoring bias.

### Pattern 6: Hierarchical Hybrid

Lead manages teammates. Each teammate manages its own subagents. Two-level hierarchy.

```
Lead
 ├── Teammate A (persistent, communicating peer)
 │    ├── Subagent A1 (Task tool — reports only to Teammate A)
 │    └── Subagent A2 (Task tool — reports only to Teammate A)
 ├── Teammate B (persistent, communicating peer)
 │    └── Subagent B1 (Task tool — reports only to Teammate B)
 └── Teammate C (persistent, communicating peer)
```

Teammates communicate with each other. Subagents only report to their spawning teammate.

**Best for**: Complex projects where each major domain has sub-tasks but domains also need to coordinate.

---

## 15. Error Recovery

### Teammate Crashes or Stops Unexpectedly

Symptoms:
- Teammate stops appearing in Shift+Down cycle.
- Tasks owned by that teammate remain `in_progress` indefinitely.
- Idle notifications stop arriving for that teammate.

Recovery steps:
1. Check if the teammate session is still alive: in in-process mode, Shift+Down and look for its entry. In split-pane mode, check whether the pane is still running.
2. If dead, the tasks it owned remain stuck `in_progress`. Tell the lead: "Teammate X has stopped. Unassign their in-progress tasks and spawn a replacement."
3. Spawn a replacement teammate: "Spawn a new [role] teammate to continue work on [task description]."
4. The replacement can read the task description and any output files the crashed teammate left behind.

**Prevention**: Use the `TeammateIdle` hook to detect abnormal stops and alert. Use `max_turns` to cap runaway teammates before they crash from context exhaustion.

### Task Status Lag (Stuck Tasks)

Symptom: A teammate says it finished work but the task list still shows `in_progress`.

Root cause: Teammate completed work but failed to call `TaskUpdate` with `status: completed`.

Recovery:
1. Tell the lead: "Task #3 appears complete but is still marked in_progress. Nudge the implementer or update the status."
2. Or tell the lead directly: "Mark task #3 as completed — the implementer finished the work."
3. The lead can issue `TaskUpdate` to manually advance the task status.

### File Conflicts Between Teammates

Symptom: Two teammates edited the same file, and git shows a conflict.

Root cause: File ownership boundaries were not defined clearly enough in spawn prompts.

Recovery:
1. Stop the conflicting teammates.
2. Resolve conflicts manually with `git diff` and `git merge`.
3. Re-spawn with explicit file ownership: "Teammate A owns `src/auth/` only. Do not touch any other files."

**Prevention**: In spawn prompts, always specify `owns X, does not touch Y`. Use CLAUDE.md to document module boundaries that all teammates will read on spawn.

### Lead Shuts Down Prematurely

Symptom: The lead declares work done while tasks are still incomplete.

Recovery:
```
The team has not finished. There are [N] tasks still in progress.
Wait for your teammates to complete before proceeding.
```

**Prevention**: Use `TaskCompleted` hooks to ensure tasks aren't prematurely closed. Tell the lead at team creation: "Do not shut down or clean up until all tasks show status 'completed'."

### Orphaned tmux Sessions After Abnormal Exit

Symptom: `tmux ls` shows sessions from a team that was already cleaned up, or that crashed.

Recovery:
```bash
tmux ls
tmux kill-session -t <session-name>
```

### Teammate Cannot Connect After Resume

Symptom: After `/resume`, the lead tries to message teammates that no longer exist. Error messages about unknown agents.

Recovery: In-process teammates are not restored by `/resume`. Tell the lead to spawn new teammates to replace the missing ones.

---

## 16. Environment Variables Available to Teammates

When spawned, each teammate automatically receives these environment variables:

| Variable | Description |
|---|---|
| `CLAUDE_CODE_TEAM_NAME` | The team name this teammate belongs to |
| `CLAUDE_CODE_AGENT_ID` | This teammate's unique agent ID |
| `CLAUDE_CODE_AGENT_NAME` | This teammate's display name (e.g., "researcher", "implementer") |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | `"1"` if this teammate was spawned in plan mode |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `"1"` — inherited from lead's environment |

These are usable in prompts and hook scripts for name/context injection. A hook can read `CLAUDE_CODE_AGENT_NAME` to produce teammate-specific log entries or apply different quality gate rules per teammate role.

Teammates also receive the standard hook environment variables:

| Variable | Description |
|---|---|
| `CLAUDE_TOOL_NAME` | Tool being called (in PreToolUse/PostToolUse hooks) |
| `CLAUDE_FILE_PATH` | File path for file operations |
| `CLAUDE_SESSION_ID` | Unique ID for this teammate's session |

---

## Quick Reference Card

### Enable

```json
{ "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

### Create a Team (Natural Language)

```
Create an agent team with [N] teammates: [role descriptions].
```

### Navigate Teammates (In-Process Mode)

| Key | Action |
|---|---|
| `Shift+Down` | Next teammate |
| `Shift+Up` | Previous teammate |
| `Enter` | View session |
| `Escape` | Interrupt turn |
| `Ctrl+T` | Toggle task list |
| `Shift+Tab` | Toggle delegate mode |

### TeammateIdle Hook — Quick Exit Reference

| Exit | Result |
|---|---|
| `exit 0` | Teammate goes idle |
| `exit 2` (+ stderr) | Teammate continues working with feedback |
| JSON `{"continue": false}` | Teammate stops entirely |

### TaskCompleted Hook — Quick Exit Reference

| Exit | Result |
|---|---|
| `exit 0` | Task marked completed |
| `exit 2` (+ stderr) | Task NOT completed; feedback sent to model |
| JSON `{"continue": false}` | Teammate stops entirely |

### SendMessage Type Values

| Type | Use Case |
|---|---|
| `message` | Point-to-point message to one teammate |
| `broadcast` | Message to all teammates (expensive) |
| `shutdown_request` | Request a teammate to shut down |
| `shutdown_response` | Acknowledge a shutdown request |
| `plan_approval_response` | Lead's approval/rejection of a plan |

### Coordination Pattern Selection

| Scenario | Pattern |
|---|---|
| Independent parallel tasks, no communication needed | Leader-Worker |
| Clear handoffs between stages | Pipeline (use `addBlockedBy`) |
| Large pool of homogeneous tasks | Swarm (self-claiming) |
| Competing theories, need debate | Peer-to-Peer |
| High-stakes implementation + review | Builder-Validator (git worktrees) |
| Complex domains with sub-tasks | Hierarchical Hybrid |

---

## Sources

- [Orchestrate teams of Claude Code sessions — Official Docs](https://code.claude.com/docs/en/agent-teams)
- [Hooks reference — Official Docs](https://code.claude.com/docs/en/hooks)
- [Claude Code Agent Teams: The Complete Guide 2026 — ClaudeFast](https://claudefa.st/blog/guide/agents/agent-teams)
- [Claude Code Agent Teams Controls — ClaudeFast](https://claudefa.st/blog/guide/agents/agent-teams-controls)
- [Claude Code Swarms — Addy Osmani](https://addyosmani.com/blog/claude-code-agent-teams/)
- [From Tasks to Swarms: Agent Teams in Claude Code — alexop.dev](https://alexop.dev/posts/from-tasks-to-swarms-agent-teams-in-claude-code/)
- [Claude Code Agent Teams: The Practical Guide — LaoZhang AI Blog](https://blog.laozhang.ai/en/posts/claude-code-agent-teams)
- [Agent Teams in Claude Code: Multi-Agent Orchestration — Claudio Novaglio](https://www.claudio-novaglio.com/en/papers/agent-teams-claude-code-multi-agent-orchestration)
- [Claude Code Swarm Orchestration Skill — Kieran Klaassen (GitHub Gist)](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea)
- [Building a C Compiler with Agent Teams — Anthropic Engineering](https://www.anthropic.com/engineering/building-c-compiler)
