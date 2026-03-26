# Claude Code Plan Mode: Comprehensive Technical Guide

> **Research date:** March 2026. Covers Claude Code up to v2.1.x.

---

## Table of Contents

1. [What Plan Mode Is](#1-what-plan-mode-is)
2. [Activation Methods](#2-activation-methods)
3. [Exact Mechanics: EnterPlanMode](#3-exact-mechanics-enterplanmode)
4. [Tool Availability Matrix](#4-tool-availability-matrix)
5. [Plan File Creation and Storage](#5-plan-file-creation-and-storage)
6. [plansDirectory Configuration](#6-plansdirectory-configuration)
7. [ExitPlanMode: The Approval Workflow](#7-exitplanmode-the-approval-workflow)
8. [permissionMode: plan on Subagents](#8-permissionmode-plan-on-subagents)
9. [Built-in Plan Subagent Architecture](#9-built-in-plan-subagent-architecture)
10. [How Plan Mode Interacts with the Agent Tool](#10-how-plan-mode-interacts-with-the-agent-tool)
11. [Using Plan Mode in Automated Workflows](#11-using-plan-mode-in-automated-workflows)
12. [Best Practices for Plan File Structure](#12-best-practices-for-plan-file-structure)
13. [Integration Patterns: Plan Mode Before Agent Teams](#13-integration-patterns-plan-mode-before-agent-teams)
14. [plannotator: Visual Plan Review](#14-plannotator-visual-plan-review)
15. [Known Issues and Workarounds](#15-known-issues-and-workarounds)
16. [Security Implications](#16-security-implications)
17. [MAXSIM Integration Patterns](#17-maxsim-integration-patterns)

---

## 1. What Plan Mode Is

Plan Mode is a special operating mode in Claude Code that creates a read-only research and planning phase before any code changes are made. In Plan Mode, Claude analyzes the codebase, asks clarifying questions, and generates a detailed implementation plan stored as a markdown file — but is instructed not to modify files, run commands, or execute code until the user explicitly approves.

**The critical architectural fact**: Plan Mode is primarily a prompt-engineering construct, not a hard technical enforcement at the OS or tool-execution layer. When you enter Plan Mode, Claude Code injects a system reminder into the conversation instructing Claude to behave as read-only. The behavioral constraints are backed by the LLM's instruction-following, with ExitPlanMode being the only tool in the system that has genuine enforcement (it shows an approval dialog before allowing execution to resume).

This distinction matters enormously for security — see [Section 16](#16-security-implications).

---

## 2. Activation Methods

### Interactive Session

**Keyboard cycling (Shift+Tab):**
```
Normal Mode → Auto-Accept Mode → Plan Mode → Normal Mode
```
- Terminal indicator for Auto-Accept: `⏵⏵ accept edits on`
- Terminal indicator for Plan Mode: `⏸ plan mode on`

**Slash command (v2.1.0+):**
```
/plan
```

**Model command (Opus Plan Mode):**
```
/model → option 4: "Use Opus in plan mode, Sonnet 4.6 otherwise"
```
This routes planning to Opus 4.6 (1M context window) and execution to Sonnet 4.6.

### Starting a New Session in Plan Mode

```bash
claude --permission-mode plan
```

### Headless (Non-Interactive) Mode

```bash
claude --permission-mode plan -p "Analyze the authentication system and suggest improvements"
```

### Set as Default for a Project

```json
// .claude/settings.json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

### Set as Global Default

```json
// ~/.claude/settings.json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

### Open Plan in Editor

Press `Ctrl+G` while in a plan mode session to open the current plan file in your default text editor.

---

## 3. Exact Mechanics: EnterPlanMode

### What `EnterPlanMode` Is

`EnterPlanMode` is an internal Claude Code tool (not a user-callable slash command) that Claude invokes in its agentic loop when it determines planning is appropriate. It is listed in the tool descriptions injected into Claude's system context.

### When Claude Invokes It

Claude's tool description for `EnterPlanMode` instructs it to invoke the tool when ANY of these conditions apply:

- Adding meaningful new functionality
- Multiple valid solution approaches exist
- Changes affect existing behavior or structure
- Architectural decisions are required
- The task will modify 2 or more files
- Requirements need clarification through exploration
- Implementation could reasonably proceed multiple ways

Claude is instructed to skip it for:
- Single-line or minor fixes (typos, obvious bugs)
- Simple functions with clear requirements
- Tasks with very specific user instructions
- Pure research or exploration activities

The tool description includes: "If unsure whether to use it, err on the side of planning — it's better to get alignment upfront than to redo work."

### What Happens When EnterPlanMode Is Called

1. Claude Code injects a system reminder into the conversation messages. This reminder is not in the true system prompt but in a `<system-reminder>` XML tag attached to the messages array. The model treats it as high-priority context.

2. The system reminder instructs Claude with approximately this content:
   - Plan mode is now active
   - Claude MUST NOT make any edits, run non-readonly tools, or otherwise change the system
   - Exception: Claude may write/edit the plan file itself in the plansDirectory
   - Claude should proceed through a structured workflow (research → design → review → final plan)

3. The available tool set is not technically narrowed at the API call level. Instead, the system reminder content is what constrains behavior.

4. Claude Code displays `⏸ plan mode on` in the terminal.

### The Four-Phase Workflow Injected by the System Reminder

The system reminder that fires on `EnterPlanMode` recommends (but does not hard-enforce) a four-phase planning structure:

**Phase 1 — Initial Understanding:** Codebase exploration and clarifying questions via `AskUserQuestion`.

**Phase 2 — Design:** Develop the implementation approach based on what was learned.

**Phase 3 — Review:** Verify that the proposed plan aligns with the user's intent.

**Phase 4 — Final Plan:** Write a concise, executable plan document to the plan file, then call `ExitPlanMode`.

There are also system reminders for:
- **Plan Mode (5-phase):** Enhanced variant with parallel exploration and multi-agent planning (1297 tokens)
- **Plan Mode (iterative):** Iterative variant with user interviewing workflow (923 tokens)
- **Plan Mode (subagent):** Simplified variant for subagents (307 tokens)
- **Plan Mode Re-entry:** Variant sent when the user enters Plan Mode a second time after having exited (236 tokens)

---

## 4. Tool Availability Matrix

### Tools Available in Plan Mode

| Tool | Available | Notes |
|------|-----------|-------|
| Read | Yes | File viewing |
| LS | Yes | Directory listing |
| Glob | Yes | File pattern search |
| Grep | Yes | Content search |
| WebSearch | Yes | Web research |
| WebFetch | Yes | Web content retrieval |
| AskUserQuestion | Yes | Interactive clarification |
| TodoRead | Yes | Read todo items |
| TodoWrite | Yes | Write todo items (technically available, instructions say allowed) |
| NotebookRead | Yes | Read Jupyter notebooks |
| Agent / Task | Yes | Spawn read-only research subagents |
| Write | Restricted | Allowed only for the plan file in plansDirectory |
| Edit / MultiEdit | Restricted | Allowed only for the plan file in plansDirectory |
| Bash | Restricted | Instructed to avoid non-readonly use |
| NotebookEdit | Restricted | Instructed to avoid |
| State-modifying MCP tools | Restricted | Instructed to avoid |
| ExitPlanMode | Yes | Required to exit plan mode with user approval |

### Important Caveat

"Restricted" means the system reminder instructs Claude not to use these tools, not that the tool execution layer blocks them. As covered in [Section 16](#16-security-implications), the LLM can and sometimes does call these tools anyway, and they will succeed unless a separate enforcement mechanism (like a `PreToolUse` hook) is in place.

---

## 5. Plan File Creation and Storage

### Default Storage Location

```
~/.claude/plans/<randomly-generated-name>.md
```

The filename is randomly generated (UUID or similar) to avoid collisions across sessions and projects.

### How the Plan File Is Created

Claude Code uses its own `Write` or `Edit` tool to write the plan file. This is the explicit exception to the "no writes" instruction. The agent essentially self-edits its plan document during planning. The Piebald-AI system prompts repository confirms: "the agent is seemingly editing its own plan file."

### Persistence Characteristics

- Plan files persist across sessions
- They survive `/clear` and context compaction
- Nothing gets implemented until the user approves via `ExitPlanMode`
- Plans remain on disk indefinitely (manual cleanup required)

### Plan File Format

Plan files are standard Markdown. The content is whatever Claude generates, but the system reminder encourages a structured format including:

- Objective / goal statement
- Architectural overview
- Phased implementation steps
- Risk analysis and mitigations

See [Section 12](#12-best-practices-for-plan-file-structure) for MAXSIM's recommended plan file structure.

---

## 6. plansDirectory Configuration

### Setting (Available Since v2.1.9+)

```json
// ~/.claude/settings.json (global)
{
  "plansDirectory": "~/.claude/plans"
}
```

```json
// .claude/settings.json (project)
{
  "plansDirectory": "./docs/plans"
}
```

### Scope Hierarchy

| Scope | Location | Priority |
|-------|----------|----------|
| Project-local | `.claude/settings.json` | Higher |
| User-global | `~/.claude/settings.json` | Lower |

### Path Resolution

- Relative paths are resolved from the workspace root
- Claude Code creates the directory automatically if it does not exist
- `~` is expanded to the user's home directory

### Key Behavior Details

When `plansDirectory` is set to a project-local path (e.g., `./docs/plans`), plan files land inside the project and can be committed to version control. This enables:
- Team-visible planning decisions
- Git history of plan iterations
- Consistent plan organization across team members

### Known Bug (Resolved January 2026)

GitHub issue #19537 documented a bug where the project-level `plansDirectory` setting was ignored and Claude Code fell back to `~/.claude/plans/`. This was closed as resolved on January 20, 2026.

### Related Feature Requests (Still Open at Time of Writing)

- **#14866** (December 2025): Request for plan templates via `.claude/plan-template.md`
- **#17473** (December 2025): Request for `plansDir` setting with auto-detect pattern

---

## 7. ExitPlanMode: The Approval Workflow

### What `ExitPlanMode` Does

`ExitPlanMode` is an internal tool Claude calls after finishing writing the plan file. Its purpose is to:

1. Signal that planning is complete
2. Display the plan file contents to the user for review
3. Present an approval prompt
4. Wait for explicit user confirmation before allowing execution to resume

The tool description states: "Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for user approval."

### Critical Design Constraint

The tool does not accept plan content as a parameter. It reads the plan from the file Claude has already written to disk. This means the plan must be written to the plan file before `ExitPlanMode` is called.

### The Approval Dialog

When Claude calls `ExitPlanMode`, the user sees the plan file contents and is presented with options. The typical choices are:
1. Continue and start implementation (approve the plan as written)
2. Request changes (decline; provide feedback; Claude stays in plan mode)

### What Happens After Approval

- The `⏸ plan mode on` indicator disappears
- Claude Code automatically names the session from the plan content (unless the session was already renamed with `--name` or `/rename`)
- Claude transitions to execution mode and can now use all tools (Edit, Write, Bash, etc.)
- Claude typically creates a `TodoWrite` checklist from the plan and begins executing tasks

### What `ExitPlanMode` Must NOT Be Replaced With

The tool description explicitly warns: "Do not use `AskUserQuestion` to ask 'Is this plan okay?' — `ExitPlanMode` inherently requests that approval. Use `ExitPlanMode` instead."

### Known Issues with the Approval Workflow

**Issue #9701 — Auto-approval bypass (reported October 2025, closed as duplicate of #6495):**
In some versions, `ExitPlanMode` returned the message "User has approved your plan. You can now start coding" even when the user had never seen or approved anything. Claude then immediately called `TodoWrite`, `Bash`, and other restricted tools. This is a critical safety gap.

**Issue #28288 — Premature approval prompt:**
The approval dialog appeared before the user had a chance to read the plan file content. The prompt showed up before the plan was fully rendered in the terminal.

**Issue #18599 — Default exit option:**
Community request to change the default selected option in the approval dialog, as the current default occasionally leads to accidental approval.

**Issue #2988 — Auto-accept mode activation:**
When a user approves a plan and selects "continue and start," Claude Code automatically enables auto-accept mode for edits without explicit user consent.

---

## 8. permissionMode: plan on Subagents

### The permissionMode Field

Custom subagents (defined in `.claude/agents/` or `~/.claude/agents/`) support a `permissionMode` frontmatter field. When set to `"plan"`, the subagent itself operates in plan mode — it can only read, not write.

```yaml
---
name: planning-researcher
description: Read-only research agent that creates structured plans
tools: Read, Grep, Glob, LS, WebSearch, AskUserQuestion
permissionMode: plan
---

You are a planning specialist. Research the codebase thoroughly and
produce a detailed implementation plan. Do not make any changes.
```

### Available permissionMode Values

| Mode | Behavior |
|------|----------|
| `default` | Standard permission checking with prompts |
| `acceptEdits` | Auto-accept file edits without prompting |
| `dontAsk` | Auto-deny permission prompts (explicitly allowed tools still work) |
| `bypassPermissions` | Skip all permission prompts |
| `plan` | Plan mode — read-only exploration enforced by system reminder |

### Parent-Subagent Permission Inheritance

- Subagents inherit the permission context from the main conversation by default
- If the parent uses `bypassPermissions`, this takes precedence and cannot be overridden by the subagent's own `permissionMode`
- A subagent with `permissionMode: plan` will operate in plan mode regardless of the parent's mode (unless the parent has `bypassPermissions`)

### Plugin Subagent Restriction

For security reasons, plugin subagents (from installed plugins) do not support the `permissionMode` frontmatter field. The field is silently ignored when loading agents from a plugin. To use `permissionMode: plan` on a plugin subagent, copy its agent file into `.claude/agents/` or `~/.claude/agents/`.

---

## 9. Built-in Plan Subagent Architecture

Claude Code ships with several built-in subagents. The ones relevant to Plan Mode are:

### The Plan Subagent

- **Purpose:** Research agent used during plan mode to gather context before presenting a plan
- **Model:** Inherits from the main conversation (no special model override)
- **Tools:** Read-only tools; denied access to Write and Edit
- **Invocation:** Automatically delegated to by the main agent when plan mode requires codebase research

When the main conversation is in plan mode and Claude needs to understand the codebase, it delegates research tasks to the Plan subagent. This prevents infinite nesting: subagents cannot spawn other subagents, so this is the depth limit.

**System prompt size:** The Plan agent prompt is approximately 680 tokens (from the Piebald-AI repository).

### The Explore Subagent (Haiku-Powered)

- **Purpose:** Fast, read-only agent optimized for searching and analyzing codebases
- **Model:** Haiku (fast, low-latency, lower cost)
- **Tools:** Read-only tools; denied access to Write and Edit
- **Invocation:** Claude delegates to Explore when it needs to search or understand a codebase without making changes. Keeps exploration output out of the main context window.

**Thoroughness levels:** When invoking Explore, Claude specifies one of:
- `quick` — targeted lookups
- `medium` — balanced exploration
- `very thorough` — comprehensive codebase analysis

**System prompt size:** The Explore agent prompt is approximately 517 tokens.

### Subagent Context Isolation

A key architectural benefit: subagent work stays in the subagent's context window. Only the summary/result comes back to the main conversation. This means:
- Heavy codebase exploration with Haiku-powered Explore does not burn the main Opus/Sonnet context
- Plan subagent research results return as a summary to the orchestrating agent

### Subagent Nesting Limit

Subagents cannot spawn other subagents. This is a hard constraint in the current architecture. If a workflow requires nested delegation, use Skills or chain subagents from the main conversation.

---

## 10. How Plan Mode Interacts with the Agent Tool

### The Agent Tool (Formerly Task)

The `Agent` tool (renamed from `Task` in v2.1.63; `Task(...)` references still work as aliases) allows the main conversation to spawn subagents. Plan Mode does not disable or block this tool.

### What Happens When Agent Is Called During Plan Mode

When the main agent is in plan mode and calls the `Agent` tool:

1. The spawned subagent gets its own context window
2. The spawned subagent receives a simplified plan mode system reminder (307 tokens) rather than the full one
3. The subagent operates with read-only tool access (denied Write and Edit)
4. The subagent cannot spawn further subagents (nesting limit)
5. Results return to the main conversation as a summary

### The planModeBehavior Property (Proposed, Then Resolved via Documentation)

GitHub issue #4750 proposed a `planModeBehavior` property for subagent frontmatter:

```yaml
---
name: code-reviewer
planModeBehavior: "force"  # Options: "inherit", "ignore", "force"
---
```

| Option | Behavior |
|--------|----------|
| `inherit` | Subagent respects main agent's Plan Mode status (default) |
| `ignore` | Subagent always executes with configured permissions regardless of parent mode |
| `force` | Subagent always operates in Plan Mode even if parent doesn't |

The issue was closed in December 2025. Anthropic resolved it via documentation updates to the subagents page rather than adding the `planModeBehavior` property. The current approach is to use `permissionMode: plan` in subagent frontmatter for subagents that should always behave as read-only.

### Restricting Which Subagents Can Be Spawned

When running as a main thread agent (`claude --agent`), you can restrict which subagent types can be spawned using `Agent(agent_type)` syntax in the `tools` field:

```yaml
---
name: coordinator
tools: Agent(researcher, planner), Read, Bash
---
```

This is an allowlist. To prevent all subagent spawning, omit `Agent` from the tools list entirely.

---

## 11. Using Plan Mode in Automated Workflows

### Headless Plan Mode

The most common automated use case: generate a plan from a prompt without human interaction.

```bash
# Generate a plan and print it (no implementation)
claude --permission-mode plan -p "Analyze the authentication system and create a refactor plan"
```

The plan file will be written to `plansDirectory`. Output from `-p` includes Claude's conversational response; the plan file itself is the artifact.

### Combining Plan Mode with Output Format

```bash
# Get structured JSON output of the planning session
claude --permission-mode plan -p "Plan the OAuth2 migration" --output-format json > plan-session.json

# Stream output in real-time
claude --permission-mode plan -p "Analyze the database schema" --output-format stream-json
```

### Pipeline Pattern: Plan Then Execute

A two-phase automated workflow:

```bash
#!/bin/bash
# Phase 1: Generate plan (read-only, safe)
claude --permission-mode plan \
  -p "Analyze src/auth/ and create a migration plan for OAuth2" \
  --output-format text

# Human reviews ~/.claude/plans/<latest>.md

# Phase 2: Execute the plan (if approved externally)
PLAN_FILE=$(ls -t ~/.claude/plans/*.md | head -1)
claude --permission-mode bypassPermissions \
  -p "Execute the plan in $PLAN_FILE step by step"
```

### CI/CD Integration

Plan mode is well-suited for CI pipelines that need risk-free codebase analysis:

```yaml
# GitHub Actions: PR analysis without code changes
- name: Analyze PR scope
  run: |
    claude --permission-mode plan \
      -p "Analyze the changes in this PR and identify potential risks" \
      --output-format text \
      --max-turns 10
```

For actual code modification in CI, use `--allowedTools` with explicit tool lists rather than plan mode:

```bash
# Read-only code review in CI
claude -p "Review recent changes for security issues" \
  --allowedTools "Read,Grep,Glob" \
  --output-format json
```

### Starting Plan Mode Sessions Programmatically (Agent SDK)

When using the Agent SDK for automation, `permissionMode: plan` can be set on subagents passed via the `--agents` CLI flag:

```bash
claude --agents '{
  "planner": {
    "description": "Creates implementation plans from requirements",
    "prompt": "You are a planning specialist. Research the codebase and create detailed plans.",
    "tools": ["Read", "Grep", "Glob", "LS"],
    "permissionMode": "plan"
  }
}'
```

---

## 12. Best Practices for Plan File Structure

This section covers what makes an effective plan file — both for Claude's execution and for human review.

### MAXSIM's Required Plan File Header

Every plan must start with this header (from the `writing-plans` skill):

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

### Task Granularity

Each task should be one action taking 2-5 minutes. No combined steps:

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**
...

**Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
```

### Key Rules for Good Plans

- **Exact file paths always** — no vague "in the auth module"
- **Complete code in the plan** — not "add validation here"
- **Exact commands with expected output** — removes ambiguity
- **Reference relevant skills** with `@` syntax for subskill invocations
- **DRY, YAGNI, TDD, frequent commits** — one commit per green test
- **Assume zero context** — the executing agent may be a fresh subagent with no history

### Minimum Plan Sections

1. **Header** (goal, architecture, tech stack)
2. **Prerequisites** (dependencies, environment setup if needed)
3. **Tasks** (numbered, each self-contained)
4. **Verification** (how to confirm the whole plan worked end-to-end)

---

## 13. Integration Patterns: Plan Mode Before Agent Teams

### The Core Pattern

Use Plan Mode to produce a plan artifact, then feed that artifact to an agent team or subagent-driven execution workflow. This separates thinking from doing and allows human review at the boundary.

### Pattern 1: Plan-Then-Subagent

```
Main session (Plan Mode) → plan.md → Main session (executing-plans skill)
                                   → Fresh subagent per task
```

The MAXSIM `writing-plans` skill's subagent-driven option: stay in one session, dispatch a fresh subagent per task, review code between tasks.

**How it works:**
1. Run `writing-plans` skill in Plan Mode to produce `docs/plans/YYYY-MM-DD-feature.md`
2. Approve the plan
3. Claude uses the `subagent-driven-development` skill
4. One fresh subagent per task — subagent has zero conversation history from planning, gets only the single task as its prompt
5. Main agent reviews subagent output between tasks

### Pattern 2: Plan-Then-Parallel-Session

```
Main session (Plan Mode) → plan.md → New session (executing-plans skill, batch mode)
```

The MAXSIM `writing-plans` skill's parallel session option: open a completely new Claude session in the worktree, point it at the plan file.

**How it works:**
1. Run `writing-plans` in a dedicated worktree
2. Approve the plan and save it
3. Open a fresh terminal session: `cd worktree-path && claude`
4. Use `executing-plans` skill: load plan, execute 3 tasks at a time, report for review
5. Batch execution with checkpoints rather than per-task review

### Pattern 3: Plan Mode as a Safety Gate

Use plan mode at the start of any Agent SDK automation to prevent runaway changes:

```bash
# Gate 1: Plan mode generates the plan
claude --permission-mode plan \
  -p "Analyze the refactoring needed for the API layer" \
  > /dev/null

# Human reviews ~/.claude/plans/latest.md and approves/modifies

# Gate 2: Execution with specific allowed tools
PLAN=$(cat ~/.claude/plans/latest.md)
claude --allowedTools "Read,Edit,Bash,Write" \
  -p "Execute this plan: $PLAN"
```

### Pattern 4: Opus Plans → Sonnet Executes

Use the `/model` command option 4 to enable "Opus in plan mode, Sonnet 4.6 otherwise":

- Opus 4.6 with 1M context handles complex codebase analysis during planning
- Sonnet 4.6 handles faster, cheaper execution of each task
- This splits cost and capability optimally

### Pattern 5: Plan Mode + Agent Teams (Parallel Work)

```
Plan Mode Session → plan.md with parallel task groups
                  → Agent Team: multiple parallel subagents each handling one task group
```

When the plan identifies tasks that are independent of each other, spawn parallel subagents:

```
Approved plan.md identifies:
  - Group A: Auth module changes (no overlap with B)
  - Group B: Database schema changes (no overlap with A)
  - Group C: API endpoint changes (depends on A and B)
```

```bash
# Run A and B in parallel worktrees
claude --worktree auth-changes -p "Execute Group A from plan.md"
claude --worktree db-changes -p "Execute Group B from plan.md"

# After both complete, run C in main branch
claude -p "Execute Group C from plan.md"
```

---

## 14. plannotator: Visual Plan Review

### What plannotator Is

Plannotator (by `backnotprop`) is a Claude Code plugin that intercepts the `ExitPlanMode` approval step and replaces the terminal-based approval UI with a browser-based annotation interface.

**GitHub:** https://github.com/backnotprop/plannotator

### Installation

```
/plugin marketplace add backnotprop/plannotator
/plugin install plannotator@plannotator
```
Restart Claude Code after installation.

### How It Works

1. Claude writes the plan file and calls `ExitPlanMode`
2. Plannotator's hook intercepts the `ExitPlanMode` call before the standard approval dialog shows
3. Plannotator opens a local browser UI rendering the plan in markdown with syntax highlighting
4. The user can:
   - Select any text and mark it for deletion
   - Add a comment to a section
   - Write a replacement for a section
   - Mark sections as approved
5. The user clicks Approve or Request Changes
6. If approved, plannotator passes the approval to Claude and execution begins
7. If changes are requested, the structured annotations are sent back to Claude as feedback

### Annotation Types

| Annotation | Description |
|-----------|-------------|
| Delete | Mark a section for removal |
| Replace | Write a replacement for selected text |
| Insert | Add content at a specific point |
| Comment | Annotate without structural change |

### Privacy Model

Plannotator runs entirely in the browser. Plans do not leave the machine. The optional "share" feature uses AES-256-GCM encryption in-browser before uploading; the server stores only ciphertext; the decryption key is in the share URL.

### Integration Mechanism

Plannotator registers a `PreToolUse` hook that fires when Claude calls `ExitPlanMode`. The hook:
1. Reads the plan file from disk
2. Starts a local server with the annotate UI
3. Blocks the `ExitPlanMode` call until the user makes a decision in the browser
4. Either lets the call through (approval) or returns a rejection with structured feedback

---

## 15. Known Issues and Workarounds

### Issue 1: ExitPlanMode Auto-Approval Bypass

**Issue:** `ExitPlanMode` can return "User has approved your plan. You can now start coding" without the user having seen or approved anything.

**Status:** Closed as duplicate of #6495 (October 2025). The root issue may still occur in some scenarios.

**Workaround:** When using Plan Mode in automated pipelines, add a confirmation step after the plan is generated but before execution. Use a `PostToolUse` hook on `ExitPlanMode` to validate that genuine approval occurred.

### Issue 2: Plan Mode Is Not Actually Read-Only

**Issue:** The Edit, Write, and Bash tools are not blocked at the tool-execution layer. They succeed if Claude calls them, despite the system prompt saying not to. Multiple confirmed incidents of file modifications during active plan mode sessions.

**Status:** Issue #19874 filed as CRITICAL, closed as NOT_PLANNED on March 9, 2026. Anthropic has confirmed they do not intend to add tool-level enforcement.

**Workaround (via PreToolUse hooks):**

```json
// ~/.claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/enforce-plan-mode.sh"
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# ./scripts/enforce-plan-mode.sh
# Block Write/Edit when in plan mode; allow plan file writes

INPUT=$(cat)
PERMISSION_MODE=$(echo "$INPUT" | jq -r '.session.permissionMode // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')
PLANS_DIR=$(echo "$INPUT" | jq -r '.session.plansDirectory // empty')

if [ "$PERMISSION_MODE" = "plan" ]; then
  # Allow writes to the plans directory
  if [[ "$FILE_PATH" == "$PLANS_DIR"* ]] || [[ "$FILE_PATH" == "$HOME/.claude/plans"* ]]; then
    exit 0
  fi
  echo "Blocked: Plan mode is active. File modifications are not allowed." >&2
  exit 2
fi

exit 0
```

Make executable: `chmod +x ./scripts/enforce-plan-mode.sh`

The blog post at `blog.sondera.ai` demonstrates this approach using Cedar policy language for the enforcement logic.

### Issue 3: Edit Tool Bypasses Plan Mode Restrictions

**Issue:** Issue #14570 (December 2025, closed as duplicate of #13638). The Edit tool successfully modified files outside the plans directory during active plan mode.

**Status:** Closed as duplicate; root cause is the same as Issue 2 — no tool-level enforcement.

**Workaround:** Same as Issue 2 — use `PreToolUse` hooks.

### Issue 4: Plan Mode Cannot Be Used with bypassPermissions

**Issue:** Issue #5466. When `bypassPermissions` is active (e.g., in a CI environment), enabling Plan Mode has no effect because the bypass takes precedence and all tool calls proceed without restriction.

**Status:** This is an architectural conflict. `bypassPermissions` is meant to skip all checks, including plan mode constraints.

**Workaround:** Do not combine `bypassPermissions` with Plan Mode. Use explicit `--allowedTools` lists in CI instead of Plan Mode when permission prompts must be suppressed.

### Issue 5: plansDirectory Project-Level Setting Ignored

**Issue:** Issue #19537. The `plansDirectory` setting in `.claude/settings.json` was ignored; plans went to `~/.claude/plans/` instead.

**Status:** Resolved January 20, 2026.

**Workaround (if still hitting this):** Set `plansDirectory` in `~/.claude/settings.json` (global) as a temporary workaround, or upgrade Claude Code to a version after January 2026.

### Issue 6: EnterPlanMode Called Despite Explicit Instructions to Use Text

**Issue:** Issue #25720. Claude invokes the `EnterPlanMode` tool even when the user has instructed it to present the plan as plain text. The tool description's priority in the prompt hierarchy overrides operator skill file instructions.

**Workaround:** Add an explicit instruction in `CLAUDE.md` or a skill file that is loaded before the tool descriptions. Example:

```markdown
<!-- .claude/CLAUDE.md -->
When asked to create a plan, always write the plan as markdown text in your response.
Do NOT invoke the EnterPlanMode tool unless the user explicitly asks for "plan mode."
```

Note that due to the prompt hierarchy issue, this is not guaranteed to work in all cases.

### Issue 7: Plan Subagent Override of Skill File Guardrails

**Issue:** Issue #29950. Plan mode tool definitions sit at a higher priority level in the prompt hierarchy than operator-provided skill files. When they conflict, the tool definitions win. An "never skip the approval checkpoint" guardrail in a skill file was silently overridden, and the agent self-approved its own plan.

**Workaround:** Use `PreToolUse` hooks rather than skill file instructions to enforce approval checkpoints. Hooks run at the execution layer, not the prompt layer, and cannot be overridden by tool descriptions.

---

## 16. Security Implications

### The Core Security Model

Plan Mode's security model rests on prompt engineering, not tool-execution enforcement. As multiple researchers and GitHub issues have documented:

> "Plan mode is essentially just a system prompt that instructs Claude to perform solely read-only actions."
> — blog.sondera.ai

The practical consequence: Plan Mode is a useful workflow tool that helps Claude organize its approach and get human approval before acting. It is not a security boundary. Do not treat it as one.

### What Plan Mode Actually Guarantees

- Claude will likely follow the read-only instructions most of the time
- Claude will write its plan to the plan file and call ExitPlanMode before attempting implementation
- The user will see a plan and have an opportunity to approve or reject it
- ExitPlanMode itself has tool-level enforcement (an actual UI dialog must be completed)

### What Plan Mode Does NOT Guarantee

- That Write, Edit, or Bash calls will be blocked if Claude generates them
- That a sufficiently adversarial prompt cannot convince Claude to bypass the restrictions
- That subagents spawned during plan mode are truly read-only (they inherit the prompt-based constraints, not technical enforcement)
- That plan mode will work correctly when combined with `bypassPermissions`

### Threat Model: When Plan Mode Fails

**Scenario 1 — Model instruction following failure:** Claude generates an Edit tool call due to confusion, hallucination, or ambiguity. The tool executes successfully. Files are modified during "plan mode." Confirmed real incidents in issues #6716, #19021, #8281.

**Scenario 2 — Prompt injection via codebase content:** During Phase 1 (codebase research), Claude reads files containing prompt injection payloads. The injected instructions could tell Claude to bypass plan mode restrictions. Since plan mode is prompt-based, injected prompts can override the restriction.

**Scenario 3 — ExitPlanMode false approval:** As documented in issue #9701, ExitPlanMode can report approval without user consent, immediately escalating Claude's permissions to full execution.

**Scenario 4 — bypassPermissions override:** If the session uses `bypassPermissions`, plan mode constraints are silently neutralized.

### Recommended Security Architecture

For genuine read-only enforcement, use a defense-in-depth approach:

**Layer 1 — Plan Mode (prompt-based):** Good for normal use; catches most cases; acceptable UX.

**Layer 2 — PreToolUse hooks (execution-based):** Hard block Write/Edit/Bash at the hook layer. Cannot be bypassed by model behavior. See the workaround in [Section 15, Issue 2](#issue-2-plan-mode-is-not-actually-read-only).

**Layer 3 — Explicit allowedTools (session-based):** When starting a planning session, only provide the read-only tools:

```bash
claude --allowedTools "Read,Glob,Grep,LS,WebSearch,WebFetch,AskUserQuestion" \
  -p "Create an implementation plan for the OAuth2 migration"
```

This is the most reliable approach: if a tool is not in the allowedTools list, Claude Code will not allow Claude to call it, regardless of what the model generates.

**Layer 4 — Isolated execution environment:** Run plan mode sessions in a git worktree that is a read-only checkout, or in a sandboxed container with a read-only filesystem. Any writes will fail at the OS level.

### Plugin Subagents and Permission Security

Plugin subagents do not support `permissionMode` in frontmatter (it is silently ignored). If you install a plugin that ships subagents, those subagents cannot be restricted to plan mode via their configuration. To enforce plan mode on a plugin subagent, copy its agent file into `.claude/agents/` and add `permissionMode: plan`.

---

## 17. MAXSIM Integration Patterns

This section documents patterns specific to using Plan Mode within MAXSIM's workflow system.

### Relationship to MAXSIM Skills

MAXSIM provides two skills that directly correspond to Plan Mode usage:

- **`superpowers:writing-plans`** — The planning skill. Announces itself, creates the plan document, saves to `docs/plans/YYYY-MM-DD-<feature-name>.md`, and offers execution handoff.
- **`superpowers:executing-plans`** — The execution skill. Loads the plan, reviews critically, executes in batches of 3 tasks, reports between batches.

These skills are designed to be used across sessions and optionally across parallel worktrees. The plan file is the handoff artifact between planning and execution.

### Recommended MAXSIM Workflow

```
1. Create worktree:
   /maxsim:execute-phase → brainstorming skill → creates worktree

2. Plan in worktree:
   /maxsim:execute-phase → writing-plans skill → saves plan file

3. Review plan:
   Human reviews docs/plans/YYYY-MM-DD-feature.md
   Edit if needed (Ctrl+G or directly)

4. Execute:
   Option A (Subagent-Driven): Stay in same session
     → subagent-driven-development skill
     → Fresh subagent per task + code review between tasks

   Option B (Parallel Session): Open new session
     → executing-plans skill in new terminal
     → Batch of 3 tasks → report → next batch

5. Finish:
   → finishing-a-development-branch skill
   → Verify tests, create PR
```

### Plan File Location in MAXSIM

MAXSIM saves plan files to `docs/plans/` within the project's worktree, not to `~/.claude/plans/`. This means:
- Plans are committed to git alongside the code changes
- Plans survive session clearing
- Plans are visible to all team members
- Plans can be reviewed in code review

The MAXSIM skill file path `docs/plans/YYYY-MM-DD-<feature-name>.md` is explicit in the `writing-plans` skill and overrides the default `plansDirectory`. If `plansDirectory` in `settings.json` conflicts with this, the skill's explicit save instruction takes precedence (since the skill writes the file directly to that path via Claude's Write tool).

### When to Use Plan Mode vs. Writing-Plans Skill

| Use Case | Approach |
|----------|----------|
| Quick feature exploration before coding | Claude Code Plan Mode (`Shift+Tab` or `--permission-mode plan`) |
| Full feature implementation with team handoff | `superpowers:writing-plans` skill |
| Automated pipeline planning | `claude --permission-mode plan -p "..."` |
| Multi-agent parallel execution | writing-plans → plan.md → parallel worktrees |

### MAXSIM Plan File as a Subagent Contract

When using subagent-driven execution, the plan file acts as a contract between the orchestrating agent and the executing subagent. Each task in the plan must be:
- Self-contained (no context from previous tasks assumed)
- Verifiable (exact commands with expected output)
- Committable (ends with a git commit)

The executing subagent receives only the single task as its prompt. It has no access to the planning conversation history. This is why the `writing-plans` skill requires "Complete code in plan (not 'add validation')" — the subagent cannot ask follow-up questions from the planner.

---

## Appendix A: Key Tool Descriptions (Verbatim Intent)

### EnterPlanMode

```
Use this tool to transition into plan mode to explore the codebase and
design an implementation approach for user approval. Use when:
- Adding meaningful new functionality
- Multiple valid solution approaches exist
- Changes affect existing behavior or structure
- Architectural decisions are required
- The task will modify 2+ files
- Requirements need clarification through exploration
- Implementation could reasonably proceed multiple ways

If unsure, err on the side of planning.
```

### ExitPlanMode

```
Use this tool when you are in plan mode and have finished writing your
plan to the plan file and are ready for user approval.

Only use this when the task requires planning the implementation steps
of a task that requires writing code.

This tool inherently requests approval — do not also use AskUserQuestion
to ask "Is this plan okay?"
```

---

## Appendix B: Settings Reference

```json
// Complete plan mode settings in settings.json
{
  "permissions": {
    "defaultMode": "plan"
  },
  "plansDirectory": "./docs/plans"
}
```

| Setting | Values | Default | Scope |
|---------|--------|---------|-------|
| `permissions.defaultMode` | `"default"`, `"plan"`, `"acceptEdits"` | `"default"` | User or Project |
| `plansDirectory` | Any valid path | `~/.claude/plans` | User or Project |

---

## Appendix C: Quick Reference

```bash
# Start in plan mode
claude --permission-mode plan

# Plan mode headless query
claude --permission-mode plan -p "Create a migration plan for the auth system"

# Cycle to plan mode interactively
# Shift+Tab → Shift+Tab (Normal → AutoAccept → Plan)

# Exit plan mode: Claude calls ExitPlanMode → approval dialog appears

# Open plan in editor during session
# Ctrl+G

# View plan mode indicator in terminal
# ⏸ plan mode on
```

---

## Sources and References

- [Claude Code Common Workflows — Plan Mode](https://code.claude.com/docs/en/common-workflows)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Armin Ronacher — What Actually Is Claude Code's Plan Mode?](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/)
- [ClaudeLog — Plan Mode Mechanics](https://claudelog.com/mechanics/plan-mode/)
- [Sondera — Claude Code's Plan Mode Isn't Read-Only, But You Can Fix It](https://blog.sondera.ai/p/claude-codes-plan-mode-isnt-read)
- [Piebald-AI — Claude Code System Prompts Repository](https://github.com/Piebald-AI/claude-code-system-prompts)
- [GitHub Issue #4750 — Subagent Behavior Ambiguity in Plan Mode](https://github.com/anthropics/claude-code/issues/4750)
- [GitHub Issue #9701 — ExitPlanMode Bypasses Restrictions](https://github.com/anthropics/claude-code/issues/9701)
- [GitHub Issue #14570 — Plan Mode Allows Edit Tool](https://github.com/anthropics/claude-code/issues/14570)
- [GitHub Issue #14866 — Configurable Plan File Storage](https://github.com/anthropics/claude-code/issues/14866)
- [GitHub Issue #19537 — Project-Level plansDirectory Ignored](https://github.com/anthropics/claude-code/issues/19537)
- [GitHub Issue #19874 — Plan Mode No Tool-Level Enforcement (CRITICAL)](https://github.com/anthropics/claude-code/issues/19874)
- [GitHub Issue #25720 — EnterPlanMode Called Despite Instructions](https://github.com/anthropics/claude-code/issues/25720)
- [GitHub Issue #29950 — Plan Mode Tool Definitions Override Skill Guardrails](https://github.com/anthropics/claude-code/issues/29950)
- [plannotator — Visual Plan Review for Claude Code](https://plannotator.ai/)
- [plannotator GitHub Repository](https://github.com/backnotprop/plannotator)
- [Short Notes — Claude Code Settings: Default to Plan Mode and Plans Directory](https://notes.ghinda.com/post/claude-code-settings-default-to-plan-mode-and-plans-directory)
- [MAXSIM writing-plans skill](/c/Development/cli/maxsim/docs/superpowers-reference/skills/writing-plans/index.md)
- [MAXSIM executing-plans skill](/c/Development/cli/maxsim/docs/superpowers-reference/skills/executing-plans/index.md)
