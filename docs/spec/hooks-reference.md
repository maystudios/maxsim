# Claude Code Hooks — Comprehensive Reference Guide

> Deep-dive reference covering every hook event, configuration format, payload schemas, output protocol, environment variables, the status line, and practical implementation patterns.

---

## Table of Contents

1. [What Are Hooks?](#1-what-are-hooks)
2. [Hook Lifecycle Overview](#2-hook-lifecycle-overview)
3. [Settings File Configuration](#3-settings-file-configuration)
4. [Complete Hook Event Reference](#4-complete-hook-event-reference)
5. [Hook Input Payload Format](#5-hook-input-payload-format)
6. [Hook Output Format](#6-hook-output-format)
7. [Exit Codes](#7-exit-codes)
8. [Matcher Syntax](#8-matcher-syntax)
9. [Hook Handler Types](#9-hook-handler-types)
10. [Environment Variables](#10-environment-variables)
11. [Status Line Configuration](#11-status-line-configuration)
12. [Writing Hook Scripts](#12-writing-hook-scripts)
13. [Platform Considerations](#13-platform-considerations)
14. [Hook Execution Order and Timing](#14-hook-execution-order-and-timing)
15. [Performance Impact](#15-performance-impact)
16. [Common Patterns](#16-common-patterns)
17. [Hooks and Agent Teams](#17-hooks-and-agent-teams)
18. [Gotchas and Sharp Edges](#18-gotchas-and-sharp-edges)
19. [Testing Hooks](#19-testing-hooks)
20. [The /hooks Menu](#20-the-hooks-menu)
21. [Security Considerations](#21-security-considerations)

---

## 1. What Are Hooks?

Hooks are user-defined shell commands, HTTP endpoints, LLM prompts, or spawned agents that Claude Code executes automatically at specific points in its lifecycle. They provide **deterministic control** over Claude Code's behavior — ensuring actions always happen (or are blocked) rather than relying on the model to decide.

Core capabilities:

- **Block operations** before they execute (pre-validation)
- **React to completed operations** (post-processing, formatting, logging)
- **Modify tool inputs** before execution (input sanitization, path rewriting)
- **Inject context** into Claude's conversation (system messages, additional instructions)
- **Send notifications** to external systems (Slack, webhooks, desktop alerts)
- **Control agent team behavior** (prevent idle, prevent task completion)

Hooks run locally and do not consume API tokens (except `prompt`/`agent` type hooks which make LLM calls).

---

## 2. Hook Lifecycle Overview

```
SessionStart
     |
UserPromptSubmit
     |
     +---> [Agentic Loop] ----------------------+
     |         |                                |
     |    PreToolUse                            |
     |    PermissionRequest                     |
     |    PostToolUse / PostToolUseFailure       |
     |    SubagentStart / SubagentStop           |
     |    TeammateIdle                          |
     |    TaskCompleted                         |
     |    PreCompact / PostCompact              |
     |    InstructionsLoaded                    |
     |    ConfigChange                          |
     |    Notification                          |
     |    Elicitation / ElicitationResult       |
     |    WorktreeCreate / WorktreeRemove        |
     +------------------------------------------+
     |
Stop / StopFailure
     |
SessionEnd
```

---

## 3. Settings File Configuration

### File Locations and Scope

| File | Scope | Shareable |
|------|-------|-----------|
| `~/.claude/settings.json` | All projects (global) | No — local to your machine |
| `.claude/settings.json` | Single project | Yes — commit to repo |
| `.claude/settings.local.json` | Single project | No — gitignored |
| Managed policy settings | Organization-wide | Yes — admin-controlled |
| Plugin `hooks/hooks.json` | When plugin is enabled | Yes — bundled with plugin |
| Skill/Agent frontmatter | Component lifetime | Yes — in component file |

### Top-Level JSON Structure

```json
{
  "hooks": {
    "EventName": [
      {
        "matcher": "regex_pattern",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh",
            "timeout": 600,
            "statusMessage": "Custom spinner message",
            "once": false,
            "async": false
          }
        ]
      }
    ]
  },
  "disableAllHooks": false,
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  }
}
```

### Key Configuration Fields

| Field | Description |
|-------|-------------|
| `hooks` | Object keyed by event name, value is array of matcher objects |
| `disableAllHooks` | Set `true` to disable all hooks globally (also disables the status line) |
| `statusLine` | Separate top-level key — not inside `hooks` (see Section 11) |

### Matcher Object Fields

| Field | Required | Description |
|-------|----------|-------------|
| `matcher` | No | Regex pattern filtering when the hook fires. Omit to match every occurrence. |
| `hooks` | Yes | Array of hook handler objects |

### Hook Handler Common Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `type` | Yes | — | `"command"`, `"http"`, `"prompt"`, or `"agent"` |
| `timeout` | No | Varies | Seconds before cancelling. Command: 600, HTTP: 30, Prompt: 30, Agent: 60 |
| `statusMessage` | No | — | Custom spinner text shown while hook runs |
| `once` | No | `false` | If `true`, runs only once per session then removes itself (skills only) |

### Production Example (Multiple Combined Hooks)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "bash hooks/bash-guard.sh" },
          { "type": "command", "command": "bash hooks/enforce-uv.sh" }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "bash hooks/protect-secrets.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          },
          { "type": "command", "command": "bash hooks/audit-log.sh" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "bash hooks/notify-done.sh" }
        ]
      }
    ]
  }
}
```

---

## 4. Complete Hook Event Reference

### Full Event Table

| Event | When It Fires | Supports Matcher | Can Block? |
|-------|--------------|-----------------|-----------|
| `SessionStart` | Session begins or resumes | Yes | No |
| `UserPromptSubmit` | User submits a prompt, before Claude processes it | No | Yes |
| `PreToolUse` | Before a tool call executes | Yes (tool name) | Yes |
| `PermissionRequest` | When a permission dialog would appear | Yes (tool name) | Yes |
| `PostToolUse` | After a tool call succeeds | Yes (tool name) | No (shows feedback to Claude) |
| `PostToolUseFailure` | After a tool call fails | Yes (tool name) | No |
| `Notification` | When Claude Code sends a notification | Yes (notification type) | No |
| `SubagentStart` | When a subagent is spawned | Yes (agent type) | No |
| `SubagentStop` | When a subagent finishes | Yes (agent type) | Yes |
| `Stop` | When Claude finishes responding | No | Yes |
| `StopFailure` | When turn ends due to API error | Yes (error type) | No — output ignored |
| `TeammateIdle` | When an agent team teammate is about to go idle | No | Yes |
| `TaskCompleted` | When a task is marked as complete | No | Yes |
| `InstructionsLoaded` | When CLAUDE.md or rules file is loaded | Yes (load reason) | No |
| `ConfigChange` | When a configuration file changes during session | Yes (config source) | Yes |
| `WorktreeCreate` | When a worktree is being created | No | Yes (failure = exit 2) |
| `WorktreeRemove` | When a worktree is being removed | No | No |
| `PreCompact` | Before context compaction | Yes (`manual`/`auto`) | No |
| `PostCompact` | After context compaction completes | Yes (`manual`/`auto`) | No |
| `Elicitation` | When MCP server requests user input | Yes (MCP server name) | Yes |
| `ElicitationResult` | After user responds to MCP elicitation | Yes (MCP server name) | Yes |
| `SessionEnd` | When session terminates | Yes (exit reason) | No |

---

### SessionStart

Fires when a session begins or resumes. Use for context injection, environment setup, and re-loading critical information after compaction.

**Matcher values:** `startup`, `resume`, `clear`, `compact`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-6",
  "agent_type": "optional"
}
```

**Special capability:** Write to `$CLAUDE_ENV_FILE` to persist environment variables:
```bash
echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
```

**Output:** `additionalContext` field in `hookSpecificOutput`. Any stdout is added to Claude's context.

**Exit code 2:** Does not block — shows stderr to user only.

**Example — re-inject context after compaction:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing. Current sprint: auth refactor.'"
          }
        ]
      }
    ]
  }
}
```

---

### UserPromptSubmit

Fires when the user submits a prompt, before Claude processes it. Can block the prompt entirely.

**Matcher:** Not supported — always fires.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "The user's prompt text"
}
```

**Output:** Use `additionalContext` to inject text into Claude's context, or `decision: "block"` to reject the prompt and erase it.

**Exit code 2:** Blocks prompt and erases the user's input.

---

### PreToolUse

Fires before a tool call executes. The most commonly used hook for validation and access control.

**Matcher:** Tool name (regex)

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  },
  "tool_use_id": "toolu_abc123"
}
```

Tool-specific `tool_input` shapes:

```json
// Write tool
{ "file_path": "src/config.py", "content": "..." }

// Edit tool
{ "file_path": "src/app.py", "old_string": "...", "new_string": "..." }

// Bash tool
{ "command": "rm -rf dist/" }

// Read tool
{ "file_path": "README.md" }
```

**Decision output (hookSpecificOutput):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Reason shown to Claude",
    "updatedInput": { "command": "safer command" },
    "additionalContext": "Extra context for Claude"
  }
}
```

- `"allow"` — skips the interactive permission prompt (deny rules still apply)
- `"deny"` — cancels tool call, sends reason to Claude
- `"ask"` — shows permission prompt to user

**Note on `updatedInput`:** When modifying tool input, you must also return `permissionDecision: "allow"`. Return a new object, do not mutate.

**Exit code 2:** Blocks the tool call. Stderr is shown to Claude as feedback.

---

### PermissionRequest

Fires when a permission dialog is about to appear, allowing programmatic approval or denial.

**Matcher:** Tool name (regex)

**Note:** Does not fire in non-interactive/headless mode (`-p` flag). Use `PreToolUse` for automated permission decisions in headless contexts.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PermissionRequest",
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf /" },
  "permission_suggestions": [...]
}
```

**Decision output:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow|deny",
      "updatedInput": { "command": "safe command" },
      "updatedPermissions": [
        {
          "type": "addRules|replaceRules|removeRules|setMode|addDirectories|removeDirectories",
          "rules": [{ "toolName": "Bash", "ruleContent": "npm run" }],
          "behavior": "allow|deny|ask",
          "mode": "default|acceptEdits|dontAsk|bypassPermissions|plan",
          "directories": ["/path"],
          "destination": "session|localSettings|projectSettings|userSettings"
        }
      ],
      "message": "Reason shown for deny",
      "interrupt": false
    }
  }
}
```

**Example — auto-approve ExitPlanMode:**
```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'"
          }
        ]
      }
    ]
  }
}
```

---

### PostToolUse

Fires after a tool call succeeds. Used for formatting, linting, logging, and audit trails.

**Important:** Cannot undo the action — the tool has already executed.

**Matcher:** Tool name (regex)

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt" },
  "tool_response": { "success": true },
  "tool_use_id": "toolu_abc123"
}
```

**Decision output:**
```json
{
  "decision": "block",
  "reason": "ESLint errors found",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Context appended to tool result",
    "updatedMCPToolOutput": "Modified MCP tool output"
  }
}
```

**Exit code 2:** Does NOT block — shows stderr to Claude as feedback so it can adjust. Claude sees the message and can attempt corrections.

---

### PostToolUseFailure

Fires when a tool execution fails.

**Matcher:** Tool name (regex)

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PostToolUseFailure",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" },
  "tool_use_id": "toolu_abc123",
  "error": "Command failed with exit code 1",
  "is_interrupt": false
}
```

**Output:** `additionalContext` — cannot block.

---

### Notification

Fires when Claude Code sends a notification. Output and exit code are ignored for blocking purposes.

**Matcher values:** `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "Notification",
  "message": "Notification text",
  "title": "Optional title",
  "notification_type": "permission_prompt"
}
```

**Example — desktop notification (platform-specific):**

macOS:
```json
{
  "type": "command",
  "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
}
```

Linux:
```json
{
  "type": "command",
  "command": "notify-send 'Claude Code' 'Claude Code needs your attention'"
}
```

Windows (PowerShell):
```json
{
  "type": "command",
  "command": "powershell.exe -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude Code needs your attention', 'Claude Code')\""
}
```

---

### SubagentStart

Fires when a subagent is spawned. Can inject additional context.

**Matcher:** Agent type

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "SubagentStart",
  "agent_id": "agent-abc123",
  "agent_type": "Explore"
}
```

**Output:** `additionalContext`. Exit code 2 shows stderr to user only — does not block.

---

### SubagentStop

Fires when a subagent finishes. Can block the subagent from stopping (making it continue).

**Matcher:** Agent type

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "SubagentStop",
  "agent_id": "def456",
  "agent_type": "Explore",
  "agent_transcript_path": "path/to/transcript",
  "last_assistant_message": "Final response",
  "stop_hook_active": false
}
```

**Decision output:**
```json
{
  "decision": "block",
  "reason": "Tasks not yet complete"
}
```

**Exit code 2:** Prevents subagent from stopping, feeds stderr to subagent as continuation instruction.

**Important:** Check `stop_hook_active` to prevent infinite loops. For subagents, `Stop` hooks are automatically converted to `SubagentStop`.

---

### Stop

Fires when the main Claude agent finishes responding. Does not fire on user interrupts; API errors fire `StopFailure` instead.

**Matcher:** Not supported — always fires.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "Stop",
  "stop_hook_active": false,
  "last_assistant_message": "Claude's final response text"
}
```

**Decision output:**
```json
{
  "decision": "block",
  "reason": "Tests are still failing — please fix them"
}
```

**Exit code 2:** Prevents Claude from stopping, continues the conversation. Claude receives stderr as its next instruction.

**Critical:** Always check `stop_hook_active` before blocking, or you will create an infinite loop:

```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Allow Claude to stop
fi
# ... your logic
```

---

### StopFailure

Fires when a turn ends due to an API error. Output and exit codes are ignored.

**Matcher values:** `rate_limit`, `authentication_failed`, `billing_error`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "StopFailure",
  "error": "rate_limit",
  "error_details": "Detailed error message",
  "last_assistant_message": "Error text"
}
```

---

### TeammateIdle

Fires when an agent team teammate is about to go idle.

**Matcher:** Not supported — always fires.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "TeammateIdle",
  "teammate_name": "researcher",
  "team_name": "my-team"
}
```

**Control:** Exit code 2 prevents teammate from going idle (feeds stderr as new task). Or return JSON:
```json
{
  "continue": false,
  "stopReason": "Work is complete"
}
```

---

### TaskCompleted

Fires when a task is being marked as completed. Can prevent task completion.

**Matcher:** Not supported — always fires.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "TaskCompleted",
  "task_id": "task-001",
  "task_subject": "Implement feature",
  "task_description": "Detailed description",
  "teammate_name": "optional",
  "team_name": "optional"
}
```

**Control:** Exit code 2 prevents task completion, feeds stderr as feedback. Or return JSON:
```json
{
  "continue": false,
  "stopReason": "Task criteria not met"
}
```

---

### InstructionsLoaded

Fires when a CLAUDE.md or `.claude/rules/*.md` file is loaded. No decision control.

**Matcher values:** `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "InstructionsLoaded",
  "file_path": "/path/to/CLAUDE.md",
  "memory_type": "User|Project|Local|Managed",
  "load_reason": "session_start",
  "globs": ["optional", "patterns"],
  "trigger_file_path": "optional",
  "parent_file_path": "optional"
}
```

---

### ConfigChange

Fires when a configuration file changes during a session.

**Matcher values:** `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`

**Note:** Cannot block `policy_settings` changes.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "ConfigChange",
  "source": "project_settings",
  "file_path": "/path/to/.claude/settings.json"
}
```

**Decision output:**
```json
{
  "decision": "block",
  "reason": "Unauthorized configuration change"
}
```

---

### WorktreeCreate

Fires when a worktree is being created. The hook's stdout must contain the absolute path to the worktree directory, replacing the default git behavior.

**Matcher:** Not supported.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "WorktreeCreate",
  "name": "feature-auth"
}
```

**Required output:** Print absolute path to stdout:
```bash
#!/bin/bash
NAME=$(jq -r '.name')
DIR="/path/to/worktree/$NAME"
git worktree add "$DIR" >&2
echo "$DIR"
```

**Exit code 2:** Causes worktree creation to fail.

---

### WorktreeRemove

Fires when a worktree is being removed. No decision control; failures logged in debug only.

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "WorktreeRemove",
  "worktree_path": "/path/to/worktree"
}
```

---

### PreCompact

Fires before context compaction. Useful for archiving the full transcript before summarization.

**Matcher values:** `manual`, `auto`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PreCompact",
  "trigger": "manual|auto",
  "custom_instructions": "user instructions"
}
```

---

### PostCompact

Fires after context compaction completes.

**Matcher values:** `manual`, `auto`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "PostCompact",
  "trigger": "manual|auto",
  "compact_summary": "Generated summary text"
}
```

---

### Elicitation

Fires when an MCP server requests user input during a tool call.

**Matcher:** MCP server name

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "Elicitation",
  "mcp_server_name": "my-server",
  "message": "Please provide input",
  "mode": "form|url",
  "requested_schema": { "type": "object" },
  "url": "optional_auth_url",
  "elicitation_id": "optional_id"
}
```

**Decision output:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "Elicitation",
    "action": "accept|decline|cancel",
    "content": { "field": "value" }
  }
}
```

---

### ElicitationResult

Fires after a user responds to an MCP elicitation, before the response is sent back to the server.

**Matcher:** MCP server name

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "ElicitationResult",
  "mcp_server_name": "my-server",
  "message": "Response message",
  "mode": "form|url",
  "elicitation_id": "id",
  "user_response": { "field": "value" }
}
```

**Decision output:** Same as `Elicitation`.

---

### SessionEnd

Fires when the session terminates. Default timeout is 1.5 seconds (configurable via environment variable).

**Matcher values:** `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other`

**Input payload:**
```json
{
  "session_id": "abc123",
  "cwd": "/path/to/project",
  "hook_event_name": "SessionEnd",
  "reason": "clear|resume|logout|prompt_input_exit|bypass_permissions_disabled|other"
}
```

**Note:** Cannot block. Use `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` to override the default 1.5-second timeout.

---

## 5. Hook Input Payload Format

### Common Fields (All Events)

Every hook receives these fields in its JSON stdin payload:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique identifier for this session |
| `transcript_path` | string | Path to the conversation JSON transcript |
| `cwd` | string | Current working directory when the hook fires |
| `permission_mode` | string | Current permission mode: `"default"`, `"plan"`, `"acceptEdits"`, `"dontAsk"`, or `"bypassPermissions"` |
| `hook_event_name` | string | Name of the event that triggered this hook |

### Subagent-Specific Fields

When a hook fires inside a subagent:

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Unique identifier for the subagent |
| `agent_type` | string | Agent name (e.g., `"Explore"`, `"security-reviewer"`) |

### Reading Hook Input in a Script

```bash
#!/bin/bash
INPUT=$(cat)  # Read all of stdin

# Extract individual fields
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
```

---

## 6. Hook Output Format

### Decision Patterns by Event Group

There are five distinct output patterns depending on the event type:

#### Pattern 1: Top-Level `decision: "block"`

**Events:** `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `SubagentStop`, `ConfigChange`

```json
{
  "decision": "block",
  "reason": "Explanation for blocking"
}
```

#### Pattern 2: `hookSpecificOutput.permissionDecision` (PreToolUse)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "Reason shown to Claude",
    "updatedInput": { "modified": "tool input" },
    "additionalContext": "Extra context for Claude"
  }
}
```

#### Pattern 3: `hookSpecificOutput.decision.behavior` (PermissionRequest)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow|deny",
      "updatedInput": { "modified": "input" },
      "updatedPermissions": [],
      "message": "Reason for deny",
      "interrupt": false
    }
  }
}
```

#### Pattern 4: Exit Code 2 or `continue: false` (TeammateIdle, TaskCompleted)

```json
{
  "continue": false,
  "stopReason": "Explanation shown to user"
}
```

#### Pattern 5: Action Enum (Elicitation, ElicitationResult)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "Elicitation",
    "action": "accept|decline|cancel",
    "content": { "field": "value" }
  }
}
```

#### Pattern 6: Stdout Path (WorktreeCreate)

Print the absolute path to the worktree directory on stdout:
```bash
echo "/absolute/path/to/worktree"
```

### Universal Output Fields

These fields work for all events that produce JSON output:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `continue` | boolean | `true` | If `false`, Claude stops processing entirely |
| `stopReason` | string | — | Shown to user when `continue: false` |
| `suppressOutput` | boolean | `false` | If `true`, hides stdout from verbose mode |
| `systemMessage` | string | — | Warning shown to the user |
| `hookSpecificOutput` | object | — | Event-specific fields (see patterns above) |

### Decision Priority

When multiple hooks or permission rules apply: **deny > ask > allow**. If any hook returns `deny`, the operation is blocked regardless of other hooks.

---

## 7. Exit Codes

### Exit Code Table

| Exit Code | Meaning | JSON Processing | Stderr Handling |
|-----------|---------|-----------------|-----------------|
| `0` | Success | Parse stdout as JSON | Shown in verbose mode only |
| `2` | Blocking error | Ignore JSON | Fed to Claude as feedback (or user, depending on event) |
| Any other | Non-blocking error | Ignore JSON | Shown in verbose mode only |

### Exit Code 2 Effects by Event

| Event | Exit 2 Effect |
|-------|--------------|
| `PreToolUse` | Blocks tool call; stderr shown to Claude |
| `PermissionRequest` | Denies permission; stderr shown to Claude |
| `UserPromptSubmit` | Blocks prompt; erases user input |
| `Stop` | Prevents stopping; stderr becomes Claude's next instruction |
| `SubagentStop` | Prevents subagent from stopping |
| `TeammateIdle` | Prevents teammate from going idle; stderr becomes new task |
| `TaskCompleted` | Prevents task completion; stderr as feedback |
| `ConfigChange` | Blocks config change (except `policy_settings`) |
| `Elicitation` | Denies elicitation |
| `ElicitationResult` | Blocks response (becomes decline) |
| `WorktreeCreate` | Causes creation to fail |
| `PostToolUse` | Shows stderr to Claude — does NOT block |
| `PostToolUseFailure` | Shows stderr to Claude — does NOT block |
| `Notification` | Shows stderr to user only |
| `SubagentStart` | Shows stderr to user only |
| `SessionStart` | Shows stderr to user only |
| `SessionEnd` | Output ignored |
| `StopFailure` | Output ignored entirely |

**Critical rule:** Only exit code `2` produces blocking behavior. An exit code of `1` (uncaught exception, script error) will allow the tool call to proceed silently.

---

## 8. Matcher Syntax

Matchers are **regex patterns** tested against a specific field depending on the event type.

### Matcher Values by Event

| Event | Matcher Filters | Example Values |
|-------|----------------|----------------|
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` | Tool name | `Bash`, `Edit\|Write`, `mcp__.*`, `^mcp__github__` |
| `SessionStart` | Session source | `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | Exit reason | `clear`, `resume`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `Notification` | Notification type | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `SubagentStart`, `SubagentStop` | Agent type | `Bash`, `Explore`, `Plan`, custom names |
| `PreCompact`, `PostCompact` | Compaction trigger | `manual`, `auto` |
| `ConfigChange` | Config source | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `StopFailure` | Error type | `rate_limit`, `authentication_failed`, `billing_error`, `invalid_request`, `server_error`, `max_output_tokens`, `unknown` |
| `InstructionsLoaded` | Load reason | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |
| `Elicitation`, `ElicitationResult` | MCP server name | Configured server names |
| `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove` | No matcher support | Always fires |

### Common Matcher Patterns

```
"*"           — Matches all (wildcard; treated as a regex matching everything)
"Write"       — Exact match
"Edit|Write"  — Either Edit or Write (regex OR)
"mcp__.*"     — All MCP tools
"^mcp__github__"  — All GitHub MCP tools
"mcp__.*__write.*"  — All write operations across any MCP server
```

### MCP Tool Naming Convention

MCP tools follow the pattern `mcp__<server>__<tool>`:

```
mcp__memory__create_entities
mcp__filesystem__read_file
mcp__github__search_repositories
mcp__playwright__browser_screenshot
```

The `<server>` name comes from the key used in the `mcpServers` configuration. Matchers are case-sensitive.

### Important Limitation

Matchers only filter by **tool name**, not by file paths, command content, or other arguments. To filter by file path, check `tool_input.file_path` inside your hook script:

```bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [[ "$FILE" != *.md ]]; then exit 0; fi  # Skip non-markdown files
```

---

## 9. Hook Handler Types

### Type 1: Command Hook

Runs a shell command with JSON input via stdin.

```json
{
  "type": "command",
  "command": ".claude/hooks/my-script.sh",
  "timeout": 600,
  "async": false,
  "statusMessage": "Validating..."
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `command` | Yes | — | Shell command to execute |
| `timeout` | No | 600 | Seconds before cancelling |
| `async` | No | `false` | If `true`, runs in background without blocking |
| `statusMessage` | No | — | Custom spinner text |

**Async mode:** When `async: true`, Claude does not wait for the hook to complete. Use for side effects (logging, webhooks) that should not block execution. Async hooks cannot block operations or provide decision output.

### Type 2: HTTP Hook

Sends a JSON POST request to an endpoint.

```json
{
  "type": "http",
  "url": "http://localhost:8080/hooks/tool-use",
  "timeout": 30,
  "headers": {
    "Authorization": "Bearer $MY_TOKEN"
  },
  "allowedEnvVars": ["MY_TOKEN"]
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `url` | Yes | — | URL to POST to |
| `headers` | No | — | HTTP headers; values support `$VAR_NAME` interpolation |
| `allowedEnvVars` | No | — | Env vars permitted for interpolation |
| `timeout` | No | 30 | Seconds before cancelling |

**HTTP response handling:**
- 2xx with empty body → success (equivalent to exit 0)
- 2xx with plain text → success + text added as context
- 2xx with JSON → success + parsed as standard output
- Non-2xx → non-blocking error, execution continues
- Connection failure/timeout → non-blocking error

**Note:** HTTP status codes alone cannot block actions. To block, return 2xx with appropriate `hookSpecificOutput` fields.

### Type 3: Prompt Hook

Single-turn LLM evaluation. Uses a fast model (Haiku) by default.

```json
{
  "type": "prompt",
  "prompt": "Is this shell command safe? $ARGUMENTS. Respond: {\"ok\": true} or {\"ok\": false, \"reason\": \"explanation\"}",
  "model": "claude-haiku",
  "timeout": 30
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `prompt` | Yes | Prompt text. Use `$ARGUMENTS` as placeholder for input JSON |
| `model` | No | Model to use (defaults to fast model) |

**Output format:** Model must return `{"ok": true}` or `{"ok": false, "reason": "..."}`. If `ok: false`, the reason is fed back to Claude and the action is blocked.

**Use case:** Decisions requiring judgment (is this command safe?), not deterministic pattern matching.

### Type 4: Agent Hook

Spawns a subagent with tool access for multi-turn verification.

```json
{
  "type": "agent",
  "prompt": "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
  "model": "claude-sonnet",
  "timeout": 120
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `prompt` | Yes | — | Prompt for the verification agent |
| `model` | No | — | Model to use |
| `timeout` | No | 60 | Seconds (up to 50 tool-use turns) |

**Use case:** Verification requiring codebase inspection (does the code compile? do tests pass?). Use prompt hooks when input data alone is sufficient; use agent hooks when you need to inspect actual codebase state.

---

## 10. Environment Variables

### Available to All Command Hooks

| Variable | Description |
|----------|-------------|
| `$CLAUDE_PROJECT_DIR` | Project root directory |
| `$CLAUDE_CODE_REMOTE` | Set to `"true"` in web environments; not set in local CLI |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin installation directory (plugin hooks only) |
| `${CLAUDE_PLUGIN_DATA}` | Plugin persistent data directory (plugin hooks only) |

### SessionStart Only

| Variable | Description |
|----------|-------------|
| `$CLAUDE_ENV_FILE` | Path to a file where you can write `export VAR=value` statements to persist environment variables across the session |

**Usage:**
```bash
#!/bin/bash
# Run on SessionStart to set project-specific environment
echo 'export NODE_ENV=development' >> "$CLAUDE_ENV_FILE"
echo 'export DATABASE_URL=postgresql://localhost/myapp' >> "$CLAUDE_ENV_FILE"
```

### SessionEnd Only

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | Override the default 1.5-second timeout for SessionEnd hooks |

**Usage:**
```bash
CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS=5000 claude
```

### Variables Available via JSON Input (Not Env Vars)

These are accessed by parsing the JSON stdin payload, not as shell environment variables:

- `session_id` — unique session identifier
- `cwd` — current working directory
- `tool_name` — name of the tool being called
- `tool_input.file_path` — file path for file operations
- `tool_input.command` — command for Bash tool

---

## 11. Status Line Configuration

The status line is a **separate feature** from hooks — configured under a top-level `statusLine` key, not inside `hooks`. It provides a persistent, customizable bar at the bottom of Claude Code.

### Configuration Format

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 0
  }
}
```

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `type` | Yes | — | Always `"command"` |
| `command` | Yes | — | Shell command or path to script |
| `padding` | No | `0` | Extra horizontal spacing characters |

**Note:** If `disableAllHooks: true` is set in settings, the status line is also disabled.

### Quick Setup with /statusline Command

```
/statusline show model name and context percentage with a progress bar
```

This generates the script and updates settings automatically.

### How It Works

1. Claude Code pipes JSON session data to your script via stdin
2. Your script extracts what it needs and prints text to stdout
3. Claude Code displays whatever your script prints at the bottom of the interface

**Update timing:** Runs after each new assistant message, on permission mode change, and on vim mode toggle. Updates are debounced at 300ms. If a new update triggers while the script is running, the in-flight execution is cancelled.

**Does not consume API tokens.** Temporarily hides during autocomplete suggestions, the help menu, and permission prompts.

### Status Line JSON Input Schema

```json
{
  "cwd": "/current/working/directory",
  "session_id": "abc123...",
  "transcript_path": "/path/to/transcript.jsonl",
  "model": {
    "id": "claude-opus-4-6",
    "display_name": "Opus"
  },
  "workspace": {
    "current_dir": "/current/working/directory",
    "project_dir": "/original/project/directory"
  },
  "version": "1.0.80",
  "output_style": {
    "name": "default"
  },
  "cost": {
    "total_cost_usd": 0.01234,
    "total_duration_ms": 45000,
    "total_api_duration_ms": 2300,
    "total_lines_added": 156,
    "total_lines_removed": 23
  },
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": 4521,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false,
  "rate_limits": {
    "five_hour": {
      "used_percentage": 23.5,
      "resets_at": 1738425600
    },
    "seven_day": {
      "used_percentage": 41.2,
      "resets_at": 1738857600
    }
  },
  "vim": { "mode": "NORMAL" },
  "agent": { "name": "security-reviewer" },
  "worktree": {
    "name": "my-feature",
    "path": "/path/to/.claude/worktrees/my-feature",
    "branch": "worktree-my-feature",
    "original_cwd": "/path/to/project",
    "original_branch": "main"
  }
}
```

### Available Data Fields

| Field | Description |
|-------|-------------|
| `model.id`, `model.display_name` | Current model |
| `cwd`, `workspace.current_dir` | Current working directory (identical) |
| `workspace.project_dir` | Directory where Claude Code was launched |
| `cost.total_cost_usd` | Total session cost in USD |
| `cost.total_duration_ms` | Total wall-clock time (ms) |
| `cost.total_api_duration_ms` | Time spent waiting for API (ms) |
| `cost.total_lines_added`, `cost.total_lines_removed` | Lines changed |
| `context_window.context_window_size` | Max tokens (200K or 1M) |
| `context_window.used_percentage` | Pre-calculated % of context used |
| `context_window.remaining_percentage` | Pre-calculated % remaining |
| `context_window.current_usage` | Token counts from last API call (null before first call) |
| `exceeds_200k_tokens` | Whether last response exceeded 200K tokens |
| `rate_limits.five_hour.used_percentage` | % of 5-hour rate limit used (Pro/Max only) |
| `rate_limits.seven_day.used_percentage` | % of 7-day rate limit used (Pro/Max only) |
| `rate_limits.*.resets_at` | Unix epoch when rate limit resets |
| `session_id` | Unique session identifier |
| `version` | Claude Code version |
| `vim.mode` | `NORMAL` or `INSERT` (only when vim mode enabled) |
| `agent.name` | Agent name (only when using `--agent` flag) |
| `worktree.*` | Worktree data (only during `--worktree` sessions) |

**Context window `used_percentage` formula:** `(input_tokens + cache_creation_input_tokens + cache_read_input_tokens) / context_window_size`. Does not include output tokens.

### Status Line Examples

**Minimal inline command:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "jq -r '\"[\\(.model.display_name)] \\(.context_window.used_percentage // 0)% context\"'"
  }
}
```

**Full script with progress bar (Bash):**
```bash
#!/bin/bash
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')

BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /▓}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"

COST_FMT=$(printf '$%.2f' "$COST")
echo "[$MODEL] $BAR $PCT% | $COST_FMT"
```

**Windows (PowerShell):**
```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -File C:/Users/username/.claude/statusline.ps1"
  }
}
```

**Cache expensive operations** (status line runs frequently — cache git calls):
```bash
CACHE_FILE="/tmp/statusline-git-cache"
CACHE_MAX_AGE=5  # seconds

if [ ! -f "$CACHE_FILE" ] || [ $(($(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null || stat -c %Y "$CACHE_FILE"))) -gt $CACHE_MAX_AGE ]; then
    git branch --show-current 2>/dev/null > "$CACHE_FILE"
fi
BRANCH=$(cat "$CACHE_FILE")
```

Use a **fixed filename** for the cache (not `$$` or process-based names) since each status line invocation runs as a new process.

---

## 12. Writing Hook Scripts

### Bash Script Template

```bash
#!/bin/bash
# Read the full JSON input from stdin
INPUT=$(cat)

# Extract fields using jq
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Guard: skip if no relevant data
if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Your logic here...

# Communicate back to Claude via stderr (for blocking)
echo "Error message for Claude" >&2
exit 2  # Block the action

# OR allow with context via stdout JSON
echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": "Extra info"}}'
exit 0
```

### Node.js Script Template

```javascript
#!/usr/bin/env node
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  const toolName = data.tool_name;
  const filePath = data.tool_input?.file_path;

  // Your logic here

  if (shouldBlock) {
    process.stderr.write('Blocked: reason for Claude\n');
    process.exit(2);
  }

  // Return JSON for structured output
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow'
    }
  }));
  process.exit(0);
});
```

### Python Script Template

```python
#!/usr/bin/env python3
import json
import sys

data = json.load(sys.stdin)
tool_name = data.get('tool_name', '')
file_path = data.get('tool_input', {}).get('file_path', '')

# Your logic here

if should_block:
    print("Blocked: reason for Claude", file=sys.stderr)
    sys.exit(2)

# Return JSON for structured output
output = {
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow"
    }
}
print(json.dumps(output))
sys.exit(0)
```

### Making Scripts Executable (macOS/Linux)

```bash
chmod +x ~/.claude/hooks/my-hook.sh
```

Windows scripts do not need the executable bit but must be referenced with the appropriate interpreter in the command field.

---

## 13. Platform Considerations

### Unix (macOS/Linux)

- Scripts run in a non-interactive shell sourcing `~/.zshrc` or `~/.bashrc`
- **Watch out:** Shell profile files that print output unconditionally will corrupt JSON parsing (see Gotcha 8)
- Wrap profile echoes in `if [[ $- == *i* ]]; then ... fi` (checks for interactive shell)
- Make scripts executable with `chmod +x`
- Use `#!/bin/bash` or `#!/usr/bin/env python3` shebangs

### Windows

- Claude Code runs hook commands through Git Bash on Windows
- You can invoke PowerShell from Git Bash: `powershell.exe -Command "..."`
- Or reference a `.ps1` script: `powershell -NoProfile -File C:/path/to/script.ps1`
- Forward slashes work in paths within hook configurations
- No `chmod +x` needed; Windows uses extension-based execution
- `jq` may need separate installation on Windows (via Chocolatey, Scoop, or winget)
- Environment variable syntax in `command` strings: use `$VAR` (Git Bash syntax), not `%VAR%`

**Windows Notification Example:**
```json
{
  "type": "command",
  "command": "powershell.exe -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude finished', 'Claude Code')\""
}
```

### Cross-Platform Path Handling

Use `$CLAUDE_PROJECT_DIR` for portable script references:
```json
{
  "type": "command",
  "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/my-hook.sh"
}
```

Normalize paths in scripts to handle both absolute and relative values:
```bash
file_path=$(realpath "$file_path" 2>/dev/null || echo "$file_path")
```

---

## 14. Hook Execution Order and Timing

### Execution Order

1. Hooks within a single matcher's `hooks` array run **sequentially in order**
2. Multiple matchers for the same event run **in the order they appear in the configuration**
3. Hooks from different settings files are merged; policy settings take highest priority
4. Identical hook commands (same command string or URL) are **deduplicated** — run only once per event
5. `PreToolUse` hooks from the first blocking hook short-circuit remaining hooks for that event

### Parallelism

When multiple matchers fire for the same event, all matching hooks from different matchers run in parallel. Within a single matcher's `hooks` array, they run sequentially.

### Timing

- `PreToolUse` hooks run synchronously before the tool executes
- `PostToolUse` hooks run synchronously after the tool returns
- `Stop` hooks run before Claude's turn ends
- `SessionEnd` hooks have a default 1.5-second timeout (override with `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`)
- Status line updates are debounced at 300ms

### Hook Lifecycle Within a Single Event

```
Event fires
    → Collect all registered hooks matching this event + matcher
    → Deduplicate identical handlers
    → Execute hooks (parallel across matchers, sequential within a matcher)
    → Collect exit codes and output
    → Apply decisions (deny priority > ask > allow)
    → Proceed or block
```

---

## 15. Performance Impact

### Impact by Hook Type

| Hook Type | Performance Risk | Mitigation |
|-----------|-----------------|------------|
| `PreToolUse` (all tools) | High — runs on every tool call | Use narrow matchers; keep logic fast |
| `PostToolUse` (all tools) | High — runs on every tool call | Use narrow matchers; async for logging |
| `Stop` | Low — runs once per turn | Safe for heavier checks |
| `SessionStart` | Low — runs once per session | Fine for initialization |
| `StatusLine` | Medium — runs on every message | Cache slow operations (git, file reads) |

### Performance Guidelines

1. **Keep `PreToolUse` and `PostToolUse` hooks fast** — they run on every matching tool call. A hook that takes 2 seconds on every file edit means every Claude edit takes 2 extra seconds.

2. **Move expensive checks to `Stop` hooks** — after Claude finishes its turn is the right time to run full test suites, linters on all changed files, etc.

3. **Use narrow matchers** — `matcher: "Edit|Write"` is far better than `matcher: "*"` if you only care about file edits.

4. **Use async for side effects** — logging, webhook calls, and notifications that don't need to influence behavior should use `async: true` so they don't block execution.

5. **Cache slow external calls** in status line scripts:
   ```bash
   # Use a fixed cache file path — not process-based names
   CACHE="/tmp/statusline-git-$CLAUDE_PROJECT_DIR_HASH"
   ```

6. **Avoid running full test suites on `PreToolUse`** — this makes Claude extremely slow. Run tests on `Stop` instead.

---

## 16. Common Patterns

### Pattern 1: Pre-Commit Validation (Protect Files)

Prevent Claude from modifying sensitive files:

```bash
#!/bin/bash
# hooks/protect-secrets.sh
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -z "$FILE" ]] && exit 0  # Guard: no file path, allow

PROTECTED_PATTERNS=(".env" ".env.*" "secrets.*" "credentials.*" "*.pem" "*.key" "package-lock.json" ".git/")
for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$(basename "$FILE")" == $pattern || "$FILE" == *".git/"* ]]; then
    echo "Blocked: $FILE matches a protected pattern." >&2
    exit 2
  fi
done
exit 0
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-secrets.sh" }]
      }
    ]
  }
}
```

### Pattern 2: Auto-Formatting After Edits

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

### Pattern 3: Dangerous Command Guard (Bash Tool)

```bash
#!/bin/bash
# hooks/bash-guard.sh
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "dd if="
  "> /dev/sda"
  "mkfs"
  "chmod -R 777 /"
  "curl.*| bash"
  "wget.*| bash"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qiE "$pattern"; then
    echo "Blocked: Command matches dangerous pattern '$pattern'" >&2
    echo "Command was: $CMD" >&2
    exit 2
  fi
done
exit 0
```

### Pattern 4: Package Manager Enforcement

```bash
#!/bin/bash
# hooks/enforce-uv.sh
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$CMD" | grep -qE "^pip install|^pip3 install"; then
  echo "Blocked: Use 'uv add' instead of 'pip install' in this project." >&2
  exit 2
fi
exit 0
```

### Pattern 5: Audit Log (All Tool Calls)

```bash
#!/bin/bash
# hooks/audit-log.sh
INPUT=$(cat)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
SESSION=$(echo "$INPUT" | jq -r '.session_id')

echo "[$TIMESTAMP] Tool: $TOOL | Session: $SESSION" >> ~/.claude/audit.log
echo "$INPUT" >> ~/.claude/audit.log
echo "---" >> ~/.claude/audit.log
exit 0  # Never block — just log
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "bash hooks/audit-log.sh", "async": true }]
      }
    ]
  }
}
```

### Pattern 6: Notification Sounds / Desktop Alerts

```bash
#!/bin/bash
# hooks/notify-done.sh (macOS)
osascript -e 'display notification "Claude Code finished its task." with title "Claude Code"'
```

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{ "type": "command", "command": "bash hooks/notify-done.sh" }]
      }
    ]
  }
}
```

### Pattern 7: Run Tests After Claude Finishes

```bash
#!/bin/bash
# hooks/run-tests.sh
INPUT=$(cat)

# Prevent infinite loop
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

echo "Running tests..."
if pytest tests/ -q 2>&1; then
  echo "All tests passed."
  exit 0
else
  echo "Tests failed — Claude should fix the failures." >&2
  exit 2  # Keep Claude working
fi
```

### Pattern 8: Context Monitoring via Stop Hook (Prompt Type)

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Review the conversation. Have all requested tasks been completed? If any are incomplete, respond {\"ok\": false, \"reason\": \"describe what remains\"}. If complete, respond {\"ok\": true}."
          }
        ]
      }
    ]
  }
}
```

### Pattern 9: Inject Context on Session Start

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'echo \"Current git status:\"; git log --oneline -5 2>/dev/null; echo \"Active issues:\"; cat .claude/context.md 2>/dev/null || true'"
          }
        ]
      }
    ]
  }
}
```

### Pattern 10: Redirect Writes to Sandbox (Input Modification)

```bash
#!/bin/bash
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -n "$FILE" ]]; then
  SANDBOXED="/sandbox$FILE"
  # Return modified input with allow decision
  jq -n \
    --arg path "$SANDBOXED" \
    '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        updatedInput: {file_path: $path}
      }
    }'
  exit 0
fi
exit 0
```

---

## 17. Hooks and Agent Teams

### TeammateIdle Hook

Used with Claude Code's agent team feature. Fires when a teammate agent is about to go idle, allowing you to assign new work or keep the team productive.

```bash
#!/bin/bash
INPUT=$(cat)
TEAMMATE=$(echo "$INPUT" | jq -r '.teammate_name')
TEAM=$(echo "$INPUT" | jq -r '.team_name')

# Assign remaining tasks to idle teammates
echo "Teammate $TEAMMATE in team $TEAM is idle. Check task queue for pending work." >&2
exit 2  # Prevent going idle — send it the feedback message
```

### TaskCompleted Hook

Fires when a teammate marks a task as complete. Use for verification, QA, or aggregating results.

```bash
#!/bin/bash
INPUT=$(cat)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id')
SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

# Log completed task
echo "Task completed: [$TASK_ID] $SUBJECT" >> ~/.claude/task-log.txt

# Optionally prevent completion if criteria not met
# echo "Task not verified yet" >&2
# exit 2
exit 0
```

### SubagentStop Hook

Fires when any subagent completes. Use for aggregating parallel results.

```bash
#!/bin/bash
INPUT=$(cat)
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id')
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type')
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.agent_transcript_path')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

echo "[SUBAGENT DONE] $AGENT_TYPE ($AGENT_ID)" >> ~/.claude/subagent-log.txt
echo "Last message: $LAST_MSG" >> ~/.claude/subagent-log.txt
exit 0
```

### Preventing Recursive Hook Loops with Subagents

A `UserPromptSubmit` hook that spawns subagents can create infinite loops if those subagents trigger the same hook. Mitigation:

```bash
INPUT=$(cat)
AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')

# Skip if already inside a subagent
if [[ -n "$AGENT_ID" ]]; then
  exit 0
fi
```

### Subagents and Permission Inheritance

Subagents do not automatically inherit parent agent permissions. To avoid repeated permission prompts, use `PreToolUse` hooks to auto-approve specific tools across all sessions, or configure permission rules with `destination: "session"`.

---

## 18. Gotchas and Sharp Edges

### Gotcha 1: Only Exit Code 2 Blocks

An exit code of `1` (uncaught exception, script error, missing binary) **allows** the action to proceed. Your hook may fail silently. Always test scripts manually before deploying.

```bash
# Exit 1 = allow (but warns in verbose mode)
# Exit 2 = block (stderr shown to Claude)
# Exit 0 = allow (parses JSON stdout)
```

### Gotcha 2: Infinite Loops in Stop Hooks

If your `Stop` hook exits with code 2, Claude continues. If it does so unconditionally, Claude loops forever. Always check `stop_hook_active`:

```bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Break the loop — let Claude stop
fi
```

### Gotcha 3: PostToolUse Cannot Block

`PostToolUse` with exit code 2 does NOT block — it shows stderr to Claude as feedback. The tool has already executed. If you want to prevent an action, use `PreToolUse`.

### Gotcha 4: Infinite Loops via PostToolUse Chaining

If a `PostToolUse` hook triggers formatting (Write), and that Write triggers another `PostToolUse` hook, you can create a loop. Make hooks idempotent:

```bash
# Track if we're already in a formatting pass
if [[ "$FILE" == *".formatted"* ]]; then exit 0; fi
```

### Gotcha 5: Shell Profile Pollution Breaks JSON Parsing

When Claude Code runs a hook, it spawns a non-interactive shell that may source `~/.zshrc` / `~/.bashrc`. If those files unconditionally echo text, that output gets prepended to your hook's JSON, breaking parsing.

**Symptom:** Error message "JSON validation failed" or "Unexpected token".

**Fix:**
```bash
# In ~/.zshrc or ~/.bashrc
if [[ $- == *i* ]]; then   # Only in interactive shells
  echo "Shell ready"
fi
```

### Gotcha 6: Hooks Must Handle Missing Fields

Not all tool payloads include every field. A Bash tool call has no `file_path`. Always guard with `// empty`:

```bash
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
if [[ -z "$FILE" ]]; then exit 0; fi
```

### Gotcha 7: Hooks Are Stateless

Hooks see only the current tool's JSON input — not the conversation history, prior tool calls, or Claude's reasoning. Design hooks to make decisions based solely on the current tool input.

### Gotcha 8: Relative Paths in Hook Commands

Hook commands run with the project root as the working directory, but `$CLAUDE_FILE_PATH` may be absolute or relative. Normalize:

```bash
file_path=$(realpath "$file_path" 2>/dev/null || echo "$file_path")
```

### Gotcha 9: PermissionRequest Does Not Fire in Headless Mode

When running with `claude -p` (non-interactive/headless), `PermissionRequest` hooks do not fire. Use `PreToolUse` hooks for automated permission decisions in headless/CI contexts.

### Gotcha 10: Deny Rules Override Hook Approvals

Returning `permissionDecision: "allow"` from a `PreToolUse` hook skips the interactive prompt but does NOT override deny rules from settings. If a deny rule matches the tool call, the call is blocked even when your hook returns `"allow"`.

### Gotcha 11: Performance — Don't Run Heavy Work in PreToolUse

Running a full test suite, compilation, or slow external API calls on every `PreToolUse` event will make Claude Code unusably slow. Move expensive checks to `Stop` hooks.

### Gotcha 12: updatedInput Requires permissionDecision: "allow"

When modifying tool input via `updatedInput`, you must also return `permissionDecision: "allow"`. Without it, the modification is ignored.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": { "command": "safe command" }
  }
}
```

---

## 19. Testing Hooks

### Manual Testing via stdin

Test any hook script by piping mock JSON input directly:

```bash
# Test a PreToolUse hook
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | bash hooks/bash-guard.sh
echo "Exit code: $?"

# Test a Write hook
echo '{"tool_name":"Write","tool_input":{"file_path":"secrets.env","content":"SECRET=abc"}}' | bash hooks/protect-secrets.sh
echo "Exit code: $?"

# Test a Stop hook
echo '{"stop_hook_active":false,"last_assistant_message":"I have completed the task."}' | bash hooks/run-tests.sh
echo "Exit code: $?"
```

### Debugging Techniques

1. **Enable verbose mode** — Press `Ctrl+O` to see hook output, stderr, and exit codes in the transcript.

2. **Run with `--debug` flag:**
   ```bash
   claude --debug
   ```
   Shows which hooks matched, their exit codes, and full execution details.

3. **Log to a file:**
   ```bash
   echo "$INPUT" >> /tmp/hook-debug.log
   echo "Exit: $?" >> /tmp/hook-debug.log
   ```

4. **Use bash tracing:**
   ```bash
   #!/bin/bash
   set -x  # Print each command before executing
   ```

5. **Test JSON output validity:**
   ```bash
   echo '{"tool_name":"Write","tool_input":{"file_path":"test.txt"}}' | bash my-hook.sh | jq .
   ```

6. **Verify the /hooks menu** — type `/hooks` in Claude Code to confirm hooks are registered under the correct event.

7. **Ask Claude directly:**
   ```
   > Read my settings file and execute the statusLine command to surface any errors
   ```

### Unit Testing Hook Scripts

```bash
#!/bin/bash
# test-hooks.sh — run all hook tests

PASS=0
FAIL=0

test_hook() {
  local desc="$1"
  local input="$2"
  local expected_exit="$3"
  local hook_script="$4"

  echo "$input" | bash "$hook_script" > /dev/null 2>&1
  actual_exit=$?

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    echo "PASS: $desc"
    ((PASS++))
  else
    echo "FAIL: $desc (expected exit $expected_exit, got $actual_exit)"
    ((FAIL++))
  fi
}

# Test env file protection
test_hook \
  "Should block .env write" \
  '{"tool_name":"Write","tool_input":{"file_path":"/project/.env"}}' \
  2 \
  hooks/protect-secrets.sh

test_hook \
  "Should allow normal file write" \
  '{"tool_name":"Write","tool_input":{"file_path":"/project/src/app.py"}}' \
  0 \
  hooks/protect-secrets.sh

echo "Results: $PASS passed, $FAIL failed"
```

---

## 20. The /hooks Menu

Type `/hooks` in Claude Code to open a **read-only** browser for your configured hooks.

### What It Shows

- All hook events with a count of configured hooks for each
- Drill-down into matchers to see filter details
- Full details of each hook handler: event, matcher, type, source file, command
- Source indicators showing where each hook came from

### Source Labels

| Label | Source |
|-------|--------|
| `User` | `~/.claude/settings.json` |
| `Project` | `.claude/settings.json` |
| `Local` | `.claude/settings.local.json` |
| `Plugin` | Plugin's `hooks/hooks.json` |
| `Session` | Registered in memory for current session |
| `Built-in` | Registered internally by Claude Code |

### Type Labels

```
[command]  — Shell command hooks
[prompt]   — LLM prompt hooks
[agent]    — Subagent verification hooks
[http]     — HTTP endpoint hooks
```

**The menu is read-only.** To add, modify, or remove hooks, edit the settings JSON directly or ask Claude to make the change. If hooks don't appear after editing settings, the file watcher normally picks up changes automatically; if not, restart the session.

---

## 21. Security Considerations

### Trust and Workspace Safety

The status line and hooks only run if you have accepted the workspace trust dialog for the current directory, since they execute shell commands. If trust is not accepted, the status line shows a notification instead of your script output.

### Hook Injection Risk

Hooks receive raw tool inputs including user-controlled data (file paths, shell commands). Avoid passing unvalidated data from hook inputs back to the shell without sanitization. Use `jq` for safe JSON parsing rather than regex on raw JSON strings.

### Protecting Secrets in Hooks

- Store credentials in environment variables, not in the `command` field
- Use `allowedEnvVars` in HTTP hooks to control which vars are interpolated into headers
- Ensure hook script files are not world-readable: `chmod 700 ~/.claude/hooks/`

### Audit Log Integrity

If using hooks for compliance audit trails, ensure the log file is append-only and consider writing to a remote endpoint (HTTP hook) rather than a local file that Claude could modify.

### Deny Rules Take Priority

Remember that Anthropic's managed policy settings (organization-level deny lists) take priority over all hook approvals. A `PreToolUse` hook returning `permissionDecision: "allow"` cannot override policy-level deny rules.

### Review Before Deploying in Shared Environments

Before committing hooks to `.claude/settings.json` (team-shared), ensure all team members understand what the hooks do and that the scripts are accessible to all machines that will run the project.

---

## Appendix: Quick Reference Card

### Settings JSON Structure

```json
{
  "hooks": {
    "EventName": [
      { "matcher": "regex", "hooks": [{ "type": "command", "command": "script.sh" }] }
    ]
  },
  "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" },
  "disableAllHooks": false
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Allow / success — parse stdout JSON |
| `2` | Block — use stderr as Claude feedback |
| Other | Allow — non-blocking warning (verbose only) |

### Most Common Env Variables

| Variable | Use |
|----------|-----|
| `$CLAUDE_PROJECT_DIR` | Portable script paths |
| `$CLAUDE_ENV_FILE` | Persist env vars (SessionStart only) |
| `$CLAUDE_CODE_REMOTE` | Detect web vs local CLI |

### Matcher Filter Fields by Event

| Event | Filters On |
|-------|-----------|
| `PreToolUse`, `PostToolUse`, `PermissionRequest` | Tool name |
| `SessionStart` | startup/resume/clear/compact |
| `Notification` | permission_prompt/idle_prompt/auth_success |
| `SubagentStart`, `SubagentStop` | Agent type |
| `ConfigChange` | Config source |

### Decision Output by Event

| Event | Pattern |
|-------|---------|
| `PreToolUse` | `hookSpecificOutput.permissionDecision: "allow|deny|ask"` |
| `PermissionRequest` | `hookSpecificOutput.decision.behavior: "allow|deny"` |
| `Stop`, `PostToolUse`, `UserPromptSubmit` | `decision: "block"` |
| `TeammateIdle`, `TaskCompleted` | Exit 2 or `continue: false` |
| `WorktreeCreate` | Print path to stdout |

---

*Sources synthesized from:*
- *Anthropic official documentation: code.claude.com/docs/en/hooks*
- *Anthropic official documentation: code.claude.com/docs/en/hooks-guide*
- *Anthropic official documentation: code.claude.com/docs/en/statusline*
- *Anthropic Agent SDK documentation: platform.claude.com/docs/en/agent-sdk/hooks*
- *Claude Code in Action course materials (03-hooks-and-the-sdk, lessons 01–06)*
