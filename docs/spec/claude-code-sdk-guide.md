# Claude Code SDK (Claude Agent SDK) — Comprehensive Reference for MaxsimCLI

**Date:** 2026-03-22
**Status:** Reference

---

## Table of Contents

1. [What the SDK Is and When to Use It](#1-what-the-sdk-is-and-when-to-use-it)
2. [Package Names and Migration](#2-package-names-and-migration)
3. [Spawning Claude Code Sessions Programmatically](#3-spawning-claude-code-sessions-programmatically)
4. [Feeding Prompts and Getting Responses](#4-feeding-prompts-and-getting-responses)
5. [Tool Result Handling](#5-tool-result-handling)
6. [Hooks and the SDK](#6-hooks-and-the-sdk)
7. [CI / Headless Integration](#7-ci--headless-integration)
8. [Performance Considerations](#8-performance-considerations)
9. [Using the SDK for Automated Testing of MaxsimCLI](#9-using-the-sdk-for-automated-testing-of-maxsimcli)
10. [Using the SDK for the Self-Improvement Loop](#10-using-the-sdk-for-the-self-improvement-loop)
11. [How MaxsimCLI Could Expose Its Own SDK Layer](#11-how-maxsimcli-could-expose-its-own-sdk-layer)

---

## 1. What the SDK Is and When to Use It

### What It Is

The **Claude Agent SDK** (previously called the Claude Code SDK) is the programmatic interface to the same agent loop, built-in tools, and context management that power the Claude Code CLI. You get the full Claude Code engine — file reading, shell execution, editing, web search, MCP servers, subagents, hooks — driven from TypeScript or Python code instead of an interactive terminal.

The SDK ships in two flavors:
- **`@anthropic-ai/claude-agent-sdk`** — TypeScript / Node.js
- **`claude-agent-sdk`** — Python

Under the hood, both packages spawn the `claude` binary and communicate over a structured JSON stream. You do not call the Anthropic Messages API directly; you call the Claude Code agent loop.

### SDK vs. CLI

| | Interactive CLI | SDK |
|---|---|---|
| Primary use | Daily development | Automation, CI/CD, tooling |
| Input method | Keyboard in terminal | Programmatic strings |
| Output | Rendered in terminal | Structured message stream |
| Tool execution control | Manual approval prompts | Programmatic permission callbacks |
| Session management | Implicit | Explicit session IDs |
| Hooks | `~/.claude/settings.json` | Both filesystem + callback functions |
| Settings loading | All sources by default | Explicit `settingSources` required |
| Best for | Exploration, interactive coding | Production agents, pipelines |

### SDK vs. Headless CLI (`claude -p`)

The `claude -p` ("print") flag runs Claude non-interactively from a shell script. It is the simplest headless option and is equivalent to the SDK for single-shot tasks.

| | `claude -p` | SDK (`query()`) |
|---|---|---|
| Language | Any (shell, bash, etc.) | TypeScript / Python |
| Output format | Text, JSON, stream-JSON | Typed message objects |
| Permission callbacks | Not available | `can_use_tool` callback |
| Programmatic hooks | Not available | `hooks` option |
| Session resume | `--resume <id>` flag | `resume` option |
| Structured output schema | `--json-schema` flag | `output_format` option |
| Subagent definitions | Not available | `agents` option |
| Suitable for MaxsimCLI | Simple one-shot tasks | Orchestration, testing, loop |

**Rule of thumb:** Use `claude -p` when you are inside a skill or command and need Claude to do a single task. Use the SDK when you are writing TypeScript that orchestrates multiple agent interactions, needs permission control, or needs to react to streaming events.

---

## 2. Package Names and Migration

### Current Package Names (2026)

The SDK was renamed from "Claude Code SDK" to "Claude Agent SDK". The old packages still install but are deprecated.

| | Old (deprecated) | New (current) |
|---|---|---|
| TypeScript package | `@anthropic-ai/claude-code` | `@anthropic-ai/claude-agent-sdk` |
| Python package | `claude-code-sdk` | `claude-agent-sdk` |
| TypeScript options type | `ClaudeCodeOptions` | Passed as plain object |
| Python options type | `ClaudeCodeOptions` | `ClaudeAgentOptions` |
| Python import | `from claude_code_sdk import ...` | `from claude_agent_sdk import ...` |

### Breaking Changes in v0.1.0

Two defaults changed when migrating. Both have straightforward opt-ins.

**1. System prompt is no longer the Claude Code prompt by default**

```typescript
// Old behavior — Claude Code system prompt was included automatically.
// New behavior — minimal system prompt unless you opt in:
query({
  prompt: "...",
  options: {
    systemPrompt: { type: "preset", preset: "claude_code" }
  }
})
```

**2. Filesystem settings are not loaded by default**

```typescript
// Old behavior — CLAUDE.md, settings.json, hooks, skills were auto-discovered.
// New behavior — no filesystem settings unless you opt in:
query({
  prompt: "...",
  options: {
    settingSources: ["user", "project", "local"]
  }
})
```

This isolation-by-default is intentional: SDK agents in CI or production should not silently inherit whatever happens to be in the developer's `~/.claude/`.

### Installation (MaxsimCLI Context)

MaxsimCLI is a TypeScript package. Add the SDK as a dev dependency for testing and as a regular dependency if you expose an SDK layer:

```bash
npm install @anthropic-ai/claude-agent-sdk
```

The package requires the `claude` binary to be installed and available in `PATH`. In CI, install MaxsimCLI first (`npm install -g maxsim`), which bundles the binary.

---

## 3. Spawning Claude Code Sessions Programmatically

### The `query()` Function

`query()` is the primary entry point for one-shot interactions. Each call creates a new session.

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Read package.json and tell me the current version.",
  options: {
    allowedTools: ["Read"],
    cwd: "/path/to/project"
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

### The `ClaudeSDKClient` Class (Continuous Conversations)

For multi-turn interactions where you need to send follow-up prompts based on responses, use `ClaudeSDKClient`. It keeps the session alive between calls.

```typescript
import { ClaudeSDKClient } from "@anthropic-ai/claude-agent-sdk";

const client = new ClaudeSDKClient({
  allowedTools: ["Read", "Edit", "Bash"],
  permissionMode: "acceptEdits",
  cwd: "/path/to/project"
});

await client.connect();

// First query
await client.query("Read the roadmap and summarize the current phase.");
for await (const message of client.receive_response()) {
  // handle messages
}

// Follow-up — Claude retains the full context of the first query
await client.query("Now look at the phases directory and tell me what plans exist.");
for await (const message of client.receive_response()) {
  // handle messages
}

await client.disconnect();
```

### Session Resumption

Sessions are stored locally. You can resume a previous session:

```typescript
let sessionId: string | undefined;

// First query — capture the session ID
for await (const message of query({ prompt: "Start analysis." })) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}

// Later — resume with full context
for await (const message of query({
  prompt: "Continue from where we left off.",
  options: { resume: sessionId }
})) {
  // ...
}
```

### Key Configuration Options

```typescript
interface Options {
  // Tool control
  allowedTools: string[];          // Pre-approve: ["Read", "Edit", "Bash"]
  disallowedTools: string[];       // Block specific tools

  // Permissions
  permissionMode:
    | "default"            // Standard prompts
    | "acceptEdits"        // Auto-accept file edits
    | "plan"               // Plan only, no execution
    | "bypassPermissions"; // Bypass all checks (dangerous)
  can_use_tool: CanUseTool;        // Custom callback — see section 5

  // Context
  cwd: string;                     // Working directory for file operations
  systemPrompt: string | { type: "preset", preset: "claude_code" };
  settingSources: ("user" | "project" | "local")[];

  // Conversation
  resume: string;                  // Resume a previous session by ID
  continueConversation: boolean;   // Continue most recent session
  maxTurns: number;                // Cap agentic turns
  maxBudgetUsd: number;            // Cost ceiling

  // Model
  model: string;                   // e.g., "claude-opus-4-6", "claude-sonnet-4-6"
  fallbackModel: string;
  effort: "low" | "medium" | "high" | "max";

  // Subagents
  agents: Record<string, AgentDefinition>;

  // MCP
  mcpServers: Record<string, McpServerConfig>;

  // Output
  outputFormat: object;            // JSON schema for structured output
  includePartialMessages: boolean; // Stream tokens as they arrive

  // Claude Code filesystem features
  settingSources: ("user" | "project" | "local")[];

  // Hooks (see section 6)
  hooks: Record<HookEvent, HookMatcher[]>;
}
```

### Bare Mode (CLI only)

When using `claude -p` from a shell script or skill, add `--bare` to skip auto-discovery of hooks, MCP servers, skills, and CLAUDE.md. This gives deterministic behavior regardless of the local environment:

```bash
claude --bare -p "Summarize this file" --allowedTools "Read"
```

`--bare` is the recommended mode for all scripted CLI calls. It will become the default for `-p` in a future release.

---

## 4. Feeding Prompts and Getting Responses

### Prompt Delivery

The prompt is a plain string. For complex context, build it programmatically:

```typescript
import { readFileSync } from "fs";

const diff = execSync("git diff HEAD~1").toString();
const prompt = `Review this git diff for regressions and code quality issues:\n\n${diff}`;

for await (const message of query({ prompt, options: { allowedTools: ["Read"] } })) {
  if (message.type === "result") console.log(message.result);
}
```

You can also pipe content via stdin when using the CLI:

```bash
git diff HEAD~1 | claude -p "Review this diff for regressions." --output-format json
```

### Streaming Input

The SDK accepts an `AsyncIterable<dict>` as the prompt, enabling dynamic prompt construction:

```typescript
async function* buildPrompt() {
  yield { type: "text", text: "Review the following files:\n" };
  for (const file of filePaths) {
    yield { type: "text", text: `- ${file}\n` };
  }
}

for await (const message of query({ prompt: buildPrompt() })) { ... }
```

### Message Types

The SDK streams a sequence of typed messages as Claude works:

| Type | Subtype | Description |
|---|---|---|
| `system` | `init` | Session started; contains `session_id` |
| `system` | `api_retry` | API error being retried; contains `attempt`, `error`, `retry_delay_ms` |
| `assistant` | — | Claude text or tool use blocks |
| `user` | — | Tool results fed back into the conversation |
| `result` | `success` | Final result; contains `result` (text), `total_cost_usd`, `num_turns`, `session_id` |
| `result` | `error` | Failure; `is_error: true` |
| `stream_event` | — | Raw token-level events when `includePartialMessages: true` |

### Extracting the Final Answer

```typescript
let finalAnswer = "";

for await (const message of query({ prompt, options })) {
  if (message.type === "result" && !message.is_error) {
    finalAnswer = message.result ?? "";
    console.log(`Cost: $${message.total_cost_usd?.toFixed(4)}`);
    console.log(`Turns: ${message.num_turns}`);
  }
}
```

### Structured Output

Get JSON conforming to a schema instead of free text:

```typescript
for await (const message of query({
  prompt: "Extract all phase numbers and their names from ROADMAP.md",
  options: {
    allowedTools: ["Read"],
    outputFormat: {
      type: "object",
      properties: {
        phases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              number: { type: "string" },
              name: { type: "string" }
            }
          }
        }
      }
    }
  }
})) {
  if (message.type === "result") {
    const data = message.structured_output; // typed per schema
  }
}
```

CLI equivalent:
```bash
claude -p "Extract phase numbers and names from ROADMAP.md" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"phases":{"type":"array"}}}' \
  | jq '.structured_output'
```

---

## 5. Tool Result Handling

### Built-in Tools Available

The SDK gives Claude access to these tools without any extra setup:

| Tool | What it does | Relevant for MaxsimCLI |
|---|---|---|
| `Read` | Read any file | Reading plans, roadmaps, state |
| `Write` | Create new files | Writing plans, summaries |
| `Edit` | Precise edits to existing files | Updating state, roadmap |
| `Bash` | Run terminal commands | Git ops, test runs, builds |
| `Glob` | Find files by pattern | Discovering phase directories |
| `Grep` | Regex search in files | Finding plan content |
| `WebSearch` | Search the web | Research phase |
| `WebFetch` | Fetch and parse a URL | Research phase |
| `AskUserQuestion` | Ask clarifying question | Interactive modes |
| `Agent` | Spawn a subagent | Parallel execution |
| `Skill` | Invoke a skill | When `settingSources` includes project |

### Observing Tool Calls

Watch what tools Claude uses by inspecting `assistant` messages:

```typescript
for await (const message of query({ prompt, options })) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "tool_use") {
        console.log(`Tool: ${block.name}`);
        console.log(`Input: ${JSON.stringify(block.input, null, 2)}`);
      }
      if (block.type === "tool_result") {
        console.log(`Result: ${JSON.stringify(block.content)}`);
      }
    }
  }
}
```

### Custom Permission Callback (`can_use_tool`)

The `can_use_tool` callback intercepts every tool call before execution. Return `allow` or `deny`:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const safetyGuard = async (
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolPermissionContext
): Promise<PermissionResultAllow | PermissionResultDeny> => {
  // Block any bash command that deletes files
  if (toolName === "Bash") {
    const cmd = toolInput.command as string ?? "";
    if (/\brm\b/.test(cmd)) {
      return { behavior: "deny", message: "Deletion blocked by safety guard" };
    }
  }

  // Restrict writes to the project directory only
  if (toolName === "Write" || toolName === "Edit") {
    const filePath = toolInput.file_path as string ?? "";
    if (!filePath.startsWith(projectRoot)) {
      return { behavior: "deny", message: "Write outside project root blocked" };
    }
  }

  return { behavior: "allow" };
};

for await (const message of query({
  prompt: "Refactor the auth module",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    can_use_tool: safetyGuard
  }
})) { ... }
```

### Modifying Tool Input

The `allow` result can transform the tool input before execution:

```typescript
return {
  behavior: "allow",
  updated_input: {
    ...toolInput,
    command: toolInput.command + " --dry-run" // force dry-run on all bash calls
  }
};
```

### Custom MCP Tools

Define custom tools as MCP servers:

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const maxsimPhaseInfo = tool(
  "maxsim_phase_info",
  "Get current phase information from the MaxsimCLI state file",
  { state_path: String },
  async (args) => {
    const data = readFileSync(args.state_path, "utf8");
    return { content: [{ type: "text", text: data }] };
  }
);

const maxsimServer = createSdkMcpServer("maxsim", "1.0.0", [maxsimPhaseInfo]);

for await (const message of query({
  prompt: "What phase are we on?",
  options: {
    mcpServers: { maxsim: maxsimServer },
    allowedTools: ["mcp__maxsim__maxsim_phase_info"]
  }
})) { ... }
```

---

## 6. Hooks and the SDK

### Two Hook Systems That Run Side by Side

| Hook Type | Definition location | Scope | Formats supported |
|---|---|---|---|
| **Filesystem hooks** | `.claude/settings.json` | Main agent + all subagents | `command`, `http`, `prompt`, `agent` |
| **Programmatic hooks** | `hooks` option in `query()` | Main session only | TypeScript / Python callbacks |

When `settingSources` includes `"project"`, filesystem hooks from `.claude/settings.json` run automatically alongside any programmatic hooks you pass. They do not conflict; both execute during the same lifecycle.

### Available Hook Events

| Event | When it fires |
|---|---|
| `PreToolUse` | Before a tool executes |
| `PostToolUse` | After a tool returns successfully |
| `PostToolUseFailure` | After a tool fails |
| `UserPromptSubmit` | When the user (or SDK) submits a prompt |
| `Stop` | When the main agent stops |
| `SubagentStart` | When a subagent starts |
| `SubagentStop` | When a subagent stops |
| `PreCompact` | Before context compaction |
| `Notification` | Notification events |
| `PermissionRequest` | When a permission decision is needed |

### Programmatic Hook Registration

```typescript
import { query, type HookInput, type HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";

// Audit all file modifications
const auditWrites = async (input: HookInput): Promise<HookJSONOutput> => {
  if (input.hook_event_name !== "PostToolUse") return {};
  const toolInput = input.tool_input as { file_path?: string };
  appendFileSync("./audit.log", `${new Date().toISOString()}: modified ${toolInput.file_path}\n`);
  return {};
};

// Block dangerous bash commands
const blockDangerous = async (input: HookInput): Promise<HookJSONOutput> => {
  if (input.hook_event_name !== "PreToolUse") return {};
  const cmd = (input.tool_input as { command?: string }).command ?? "";
  if (cmd.includes("rm -rf") || cmd.includes("git push --force")) {
    return { decision: "block", reason: "Destructive command blocked by MaxsimCLI safety hook" };
  }
  return {};
};

for await (const message of query({
  prompt: "Refactor the payment module",
  options: {
    settingSources: ["project"],  // also loads hooks from .claude/settings.json
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [auditWrites] }],
      PreToolUse: [{ matcher: "Bash", hooks: [blockDangerous] }]
    }
  }
})) { ... }
```

### Hook Output Reference

Returning `{}` (empty object) always means "allow and proceed". Other return values:

```typescript
// Block the tool call and tell Claude why
return { decision: "block", reason: "Reason shown to Claude as tool result" };

// Allow but add context to the tool result
return { additionalContext: "Note: this file is shared across microservices" };

// Stop the entire agent run
return { continue_: false, stopReason: "Task complete — stopping early" };

// Suppress this tool's stdout from the transcript
return { suppressOutput: true };
```

### MaxsimCLI Existing Hooks and SDK Interaction

MaxsimCLI installs hooks in `.claude/settings.json` during `maxsim install`. These include:
- `maxsim-notification-sound` — plays a sound on notifications
- `maxsim-stop-sound` — plays a sound when Claude stops
- `maxsim-sync-reminder` — reminds to sync with GitHub
- `maxsim-check-update` — checks for CLI updates
- `maxsim-statusline` — updates the terminal status line

When you run an SDK agent with `settingSources: ["user", "project"]`, all these hooks fire automatically. In CI or automated testing, use `settingSources: []` (or omit it) to suppress them for deterministic behavior.

---

## 7. CI / Headless Integration

### CLI Approach (`claude -p`)

```bash
# Basic — runs Claude, prints response, exits
claude -p "Run the test suite and report failures" --allowedTools "Bash"

# With bare mode — fastest, no local settings loaded
claude --bare -p "Check if build passes" --allowedTools "Bash(npm run build *)"

# Structured JSON output — parseable by jq or Node
claude --bare -p "List incomplete phases" --output-format json | jq '.result'

# Multi-turn — continue the most recent session
claude --bare -p "Run tests"
claude --bare -p "Fix the failing test" --continue

# Resume a specific session
SESSION=$(claude --bare -p "Analyze auth.py" --output-format json | jq -r '.session_id')
claude --bare -p "Now write tests for it" --resume "$SESSION"
```

### GitHub Actions Example

```yaml
name: Claude Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }

      - name: Install MaxsimCLI (includes claude binary)
        run: npm install -g maxsim

      - name: Run AI code review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          DIFF=$(git diff origin/main...HEAD)
          RESULT=$(echo "$DIFF" | claude --bare -p \
            --append-system-prompt "You are a strict code reviewer. Focus on correctness and security." \
            --allowedTools "Read,Glob,Grep" \
            --output-format json | jq -r '.result')
          echo "$RESULT"
```

### SDK Approach (TypeScript in CI)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "child_process";

async function ciReview() {
  const diff = execSync("git diff origin/main...HEAD").toString();

  let reviewResult = "";
  for await (const message of query({
    prompt: `Review this PR diff for correctness and security:\n\n${diff}`,
    options: {
      allowedTools: ["Read", "Glob", "Grep"],
      permissionMode: "default",
      maxTurns: 5,
      maxBudgetUsd: 2.00,
      cwd: process.cwd(),
      // No settingSources — isolated from local ~/.claude configuration
    }
  })) {
    if (message.type === "result" && !message.is_error) {
      reviewResult = message.result ?? "";
    }
  }

  return reviewResult;
}
```

### Authentication in CI

The SDK reads `ANTHROPIC_API_KEY` from the environment. It also supports cloud provider authentication:

```bash
# Amazon Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
# (configure AWS credentials via standard AWS env vars)

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
# (configure via GOOGLE_APPLICATION_CREDENTIALS)

# Microsoft Azure AI Foundry
export CLAUDE_CODE_USE_FOUNDRY=1
# (configure via standard Azure env vars)
```

---

## 8. Performance Considerations

### Token Budget and Turn Limits

Each `query()` call has a conversation that accumulates tokens. Use limits to control cost:

```typescript
options: {
  maxTurns: 10,          // Stop after 10 agent turns regardless of task completion
  maxBudgetUsd: 1.00,    // Stop if cost exceeds $1.00
}
```

Monitor cost per call by reading `message.total_cost_usd` from `ResultMessage`.

### Context Compaction

The SDK automatically compacts context when the conversation grows long. A `CompactBoundaryMessage` event signals when compaction occurred. If you need to preserve specific content across compaction boundaries, include it in the system prompt rather than the conversation.

### Bare Mode Startup Cost

`--bare` in CLI mode skips file discovery (CLAUDE.md, settings.json, MCP servers, skills). This reduces startup latency significantly, especially on projects with many files. Use it in all scripted calls.

In the SDK, the equivalent is not passing `settingSources`:

```typescript
// Fast — no filesystem scanning
options: { allowedTools: ["Read"] }

// Slower — scans for CLAUDE.md, skills, hooks, settings
options: { settingSources: ["user", "project"], allowedTools: ["Read"] }
```

### Subagent Parallelism

Define multiple subagents to execute tasks in parallel within a single `query()` call:

```typescript
options: {
  allowedTools: ["Read", "Grep", "Glob", "Agent"],
  agents: {
    "security-reviewer": {
      description: "Reviews code for security vulnerabilities",
      prompt: "Analyze the code for injection flaws, auth issues, and data exposure.",
      tools: ["Read", "Grep"]
    },
    "performance-reviewer": {
      description: "Reviews code for performance issues",
      prompt: "Find N+1 queries, memory leaks, and slow algorithms.",
      tools: ["Read", "Grep"]
    }
  }
}
```

Messages from subagents carry a `parent_tool_use_id` that ties them to the `Agent` tool call that spawned them.

### Model Tiers

Use cheaper models for simpler tasks:

```typescript
// Expensive — use for complex reasoning
options: { model: "claude-opus-4-6" }

// Balanced — use for most tasks
options: { model: "claude-sonnet-4-6" }

// Cheap — use for simple extraction, formatting
options: { model: "claude-haiku-4" }
```

MaxsimCLI already maps `AgentType` → `ModelTier` (`executor`, `planner`, `researcher`, `verifier`, `debugger`). The same mapping applies when creating SDK agents programmatically.

### Effort Levels

For models that support extended thinking, control computation depth:

```typescript
options: {
  effort: "low",    // Fast responses, less reasoning
  effort: "medium", // Balanced
  effort: "high",   // Deep reasoning, slower
  effort: "max"     // Maximum reasoning, highest cost
}
```

---

## 9. Using the SDK for Automated Testing of MaxsimCLI

### What to Test with the SDK

MaxsimCLI is a collection of Claude Code commands, skills, and agents. The SDK lets you drive the agent loop in tests to verify:

1. **Command correctness** — does `/maxsim:execute-phase` actually execute the right plans?
2. **Skill correctness** — does the `executing-plans` skill follow its defined checklist?
3. **State management** — does `STATE.md` get updated correctly after a phase executes?
4. **Agent coordination** — does the executor correctly hand off to the verifier?
5. **Regression testing** — does a change to a skill file break existing workflows?

### Test Structure

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, cpSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("MaxsimCLI execute-phase command", () => {
  let testProjectDir: string;

  beforeEach(() => {
    // Copy a fixture project to a temp directory
    testProjectDir = mkdtempSync(join(tmpdir(), "maxsim-test-"));
    cpSync("./test/fixtures/sample-project", testProjectDir, { recursive: true });
  });

  it("executes phase 1 and creates a summary", async () => {
    let finalResult = "";

    for await (const message of query({
      prompt: "/maxsim:execute-phase 1",
      options: {
        cwd: testProjectDir,
        settingSources: ["project"],       // load MaxsimCLI commands and skills
        systemPrompt: { type: "preset", preset: "claude_code" },
        allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Skill"],
        permissionMode: "acceptEdits",
        maxTurns: 30,
        maxBudgetUsd: 2.00,
      }
    })) {
      if (message.type === "result") {
        finalResult = message.result ?? "";
      }
    }

    // Assert outcomes in the filesystem
    const stateContent = readFileSync(join(testProjectDir, ".planning/STATE.md"), "utf8");
    expect(stateContent).toContain("Phase 1");
    expect(stateContent).toContain("complete");

    const summaryFiles = globSync(join(testProjectDir, ".planning/phases/01-*/**/*.summary.md"));
    expect(summaryFiles.length).toBeGreaterThan(0);
  });
});
```

### Fixture Projects

Create minimal test projects under `packages/cli/test/fixtures/`:

```
test/fixtures/
  minimal-project/
    .claude/
      settings.json          # MaxsimCLI hooks (copied from install)
      commands/              # MaxsimCLI commands (symlinked or copied)
      skills/                # MaxsimCLI skills
    .planning/
      ROADMAP.md             # One milestone, two phases
      REQUIREMENTS.md
      STATE.md
      phases/
        01-setup/
          plan-001.md        # A simple plan with 2-3 tasks
```

### Asserting Agent Behavior via Hooks

Use a programmatic `PostToolUse` hook to collect a trace of all tools used, then assert on it:

```typescript
const toolTrace: Array<{ name: string; input: Record<string, unknown> }> = [];

for await (const message of query({
  prompt: "/maxsim:plan-phase 1",
  options: {
    cwd: testProjectDir,
    settingSources: ["project"],
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{
        hooks: [async (input) => {
          toolTrace.push({
            name: (input as any).tool_name,
            input: (input as any).tool_input
          });
          return {};
        }]
      }]
    }
  }
})) { ... }

// Assert that Claude read the roadmap before writing the plan
const readOps = toolTrace.filter(t => t.name === "Read");
expect(readOps.some(r => String(r.input.file_path).endsWith("ROADMAP.md"))).toBe(true);

// Assert that at least one plan file was written
const writeOps = toolTrace.filter(t => t.name === "Write");
expect(writeOps.some(w => String(w.input.file_path).includes("plan-"))).toBe(true);
```

### CI Integration for Tests

```yaml
# .github/workflows/sdk-tests.yml
name: SDK Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm run build
      - run: npm install -g .  # install current maxsim build
      - run: npm run test:integration
        timeout-minutes: 15
```

---

## 10. Using the SDK for the Self-Improvement Loop

MaxsimCLI's self-improvement loop is the process by which MaxsimCLI uses itself to plan, execute, and verify improvements to its own codebase. The SDK can formalize and automate parts of this loop.

### The Loop Architecture

```
[Detect improvement need]
        ↓
[Research phase — SDK agent reads codebase, searches docs]
        ↓
[Plan phase — SDK agent writes plan files]
        ↓
[Review gate — SDK agent checks plan quality]
        ↓
[Execute phase — SDK agent implements the plan]
        ↓
[Verify phase — SDK agent runs tests, checks output]
        ↓
[Summarize — SDK agent writes summary, updates STATE.md]
```

### Example: Automated Self-Improvement Trigger

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";

async function runSelfImprovementCycle(phaseNumber: string, projectRoot: string) {
  // Step 1: Research the phase
  await runAgent(
    `/maxsim:research-phase ${phaseNumber}`,
    projectRoot,
    { maxTurns: 20, maxBudgetUsd: 3.00 }
  );

  // Step 2: Plan the phase
  await runAgent(
    `/maxsim:plan-phase ${phaseNumber}`,
    projectRoot,
    { maxTurns: 30, maxBudgetUsd: 4.00 }
  );

  // Step 3: Execute the phase (reads plans, runs implementations)
  await runAgent(
    `/maxsim:execute-phase ${phaseNumber}`,
    projectRoot,
    { maxTurns: 60, maxBudgetUsd: 10.00 }
  );

  // Step 4: Verify the phase
  const verifyResult = await runAgent(
    `/maxsim:verify-work ${phaseNumber}`,
    projectRoot,
    { maxTurns: 20, maxBudgetUsd: 3.00 }
  );

  return verifyResult;
}

async function runAgent(
  prompt: string,
  cwd: string,
  limits: { maxTurns: number; maxBudgetUsd: number }
) {
  let result = "";
  for await (const message of query({
    prompt,
    options: {
      cwd,
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Skill", "Agent"],
      permissionMode: "acceptEdits",
      ...limits
    }
  })) {
    if (message.type === "result") {
      result = message.result ?? "";
      console.log(`Cost: $${message.total_cost_usd?.toFixed(4)}, Turns: ${message.num_turns}`);
    }
  }
  return result;
}
```

### Using Subagents for Parallel Plan Execution

MaxsimCLI already supports parallel plan execution via worktrees. The SDK can replicate this:

```typescript
for await (const message of query({
  prompt: `Execute all plans in wave 1 of phase ${phaseNumber} in parallel.`,
  options: {
    cwd: projectRoot,
    settingSources: ["project"],
    allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Agent"],
    agents: {
      "plan-executor": {
        description: "Executes a single MaxsimCLI plan file",
        prompt: `You execute MaxsimCLI plan files. Read the plan, implement all tasks,
                 run the tests, and write a summary file when complete.`,
        tools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
        model: "sonnet"
      }
    },
    permissionMode: "acceptEdits",
    maxTurns: 100
  }
})) { ... }
```

### Capturing Metrics from the Loop

Use the `ResultMessage` data to build a performance record:

```typescript
const metrics = {
  phase: phaseNumber,
  plan: planId,
  duration_ms: message.duration_ms,
  duration_api_ms: message.duration_api_ms,
  turns: message.num_turns,
  cost_usd: message.total_cost_usd,
  model: message.usage?.model
};

// Write to STATE.md via a tool call or direct write
appendFileSync(join(cwd, ".planning/STATE.md"), formatMetricEntry(metrics));
```

### Drift Detection Loop

Automate periodic drift detection:

```typescript
async function detectDrift(projectRoot: string) {
  for await (const message of query({
    prompt: "/maxsim:check-drift",
    options: {
      cwd: projectRoot,
      settingSources: ["project"],
      allowedTools: ["Read", "Glob", "Grep", "Write"],
      permissionMode: "acceptEdits",
      maxTurns: 20,
      maxBudgetUsd: 2.00
    }
  })) {
    if (message.type === "result") {
      return { result: message.result, cost: message.total_cost_usd };
    }
  }
}
```

---

## 11. How MaxsimCLI Could Expose Its Own SDK Layer

### The Opportunity

MaxsimCLI currently installs commands, skills, agents, and hooks into Claude Code. External tools that want to trigger MaxsimCLI workflows must either:
1. Call `claude -p "/maxsim:execute-phase 3"` and parse unstructured output
2. Directly call the `maxsim-tools` binary with raw CLI commands

A MaxsimCLI SDK layer would let external TypeScript code interact with MaxsimCLI workflows through typed functions with structured return values.

### Proposed SDK Architecture

```
@maxsim/sdk (new package)
├── index.ts                  — Public API
├── client.ts                 — MaxsimClient class (wraps Claude Agent SDK)
├── commands/
│   ├── execute-phase.ts
│   ├── plan-phase.ts
│   ├── verify-work.ts
│   └── check-drift.ts
├── types/
│   ├── phase.ts
│   ├── roadmap.ts
│   └── results.ts
└── tools/
    └── maxsim-mcp-server.ts  — Exposes MaxsimCLI ops as MCP tools
```

### Core Client Interface

```typescript
// @maxsim/sdk
export class MaxsimClient {
  constructor(options: MaxsimClientOptions) {}

  async executePhase(
    phase: string,
    options?: ExecutePhaseOptions
  ): Promise<PhaseExecutionResult>;

  async planPhase(
    phase: string,
    options?: PlanPhaseOptions
  ): Promise<PlanPhaseResult>;

  async verifyWork(
    phase: string,
    options?: VerifyOptions
  ): Promise<VerifyResult>;

  async checkDrift(
    options?: DriftOptions
  ): Promise<DriftResult>;

  async getRoadmapAnalysis(): Promise<RoadmapAnalysis>;
  async getStateSnapshot(): Promise<StateSnapshot>;

  // Event streaming — useful for progress UIs
  on(event: "tool_use", handler: (tool: string, input: unknown) => void): this;
  on(event: "turn", handler: (turn: number) => void): this;
  on(event: "cost", handler: (costUsd: number) => void): this;
}
```

### Implementation Pattern

Each SDK method wraps a `query()` call against the MaxsimCLI command, plus direct calls to the `maxsim-tools` binary for data retrieval (which doesn't need an LLM):

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "child_process";

export async function executePhase(
  phase: string,
  options: ExecutePhaseOptions
): Promise<PhaseExecutionResult> {
  const toolTrace: ToolCall[] = [];
  let cost = 0;
  let turns = 0;

  for await (const message of query({
    prompt: `/maxsim:execute-phase ${phase}`,
    options: {
      cwd: options.projectRoot,
      settingSources: ["project"],
      systemPrompt: { type: "preset", preset: "claude_code" },
      allowedTools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep", "Skill", "Agent"],
      permissionMode: options.dryRun ? "plan" : "acceptEdits",
      maxTurns: options.maxTurns ?? 60,
      maxBudgetUsd: options.maxBudgetUsd ?? 10.00,
      hooks: options.onToolUse ? {
        PostToolUse: [{
          hooks: [async (input) => {
            options.onToolUse!((input as any).tool_name, (input as any).tool_input);
            return {};
          }]
        }]
      } : undefined
    }
  })) {
    if (message.type === "result") {
      cost = message.total_cost_usd ?? 0;
      turns = message.num_turns;
    }
  }

  // Read structured state from the filesystem after execution
  const state = JSON.parse(
    execSync(`maxsim state --json`, { cwd: options.projectRoot }).toString()
  );

  return {
    phase,
    cost_usd: cost,
    turns,
    completed_plans: state.completed_plans ?? [],
    state_snapshot: state
  };
}
```

### MCP Server Exposure

Expose MaxsimCLI operations as MCP tools so other agents can call them:

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const executePhase = tool(
  "maxsim_execute_phase",
  "Execute a MaxsimCLI phase using the configured agents and plans",
  {
    phase: { type: "string", description: "Phase number, e.g. '3' or '3A'" },
    dry_run: { type: "boolean", description: "Plan only, do not execute" }
  },
  async (args) => {
    const result = await executePhase(args.phase, { dryRun: args.dry_run });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

export const maxsimMcpServer = createSdkMcpServer(
  "maxsim",
  "1.0.0",
  [executePhase, planPhase, verifyWork, checkDrift, getRoadmapStatus]
);

// Usage: expose to another agent
for await (const message of query({
  prompt: "Check if phase 3 is complete, then execute phase 4",
  options: {
    mcpServers: { maxsim: maxsimMcpServer },
    allowedTools: ["mcp__maxsim__maxsim_execute_phase", "mcp__maxsim__getRoadmapStatus"]
  }
})) { ... }
```

### Direct Data Access (No LLM Required)

For data that doesn't require reasoning — reading state, listing phases, checking drift status — call the `maxsim-tools` binary directly and parse its JSON output. This is dramatically cheaper and faster than an SDK call:

```typescript
import { execSync } from "child_process";

// Fast, no LLM cost
function getPhaseStatus(phase: string, cwd: string) {
  return JSON.parse(
    execSync(`maxsim phase find --phase ${phase} --json`, { cwd }).toString()
  );
}

function getRoadmapAnalysis(cwd: string) {
  return JSON.parse(
    execSync(`maxsim roadmap analyze --json`, { cwd }).toString()
  );
}
```

Only invoke the Agent SDK when the task requires reasoning, file editing, or multi-step decision making.

---

## Quick Reference

### SDK Decision Matrix

| Task | Use |
|---|---|
| Read structured data from MaxsimCLI state | `maxsim-tools` binary + JSON |
| Run a single Claude Code command in CI | `claude --bare -p "..."` |
| Test a MaxsimCLI skill end-to-end | SDK `query()` with `settingSources: ["project"]` |
| Multi-step automated phase execution | SDK `query()` with maxTurns + maxBudget |
| Interactive session with follow-ups | SDK `ClaudeSDKClient` |
| Block dangerous operations in automation | `can_use_tool` callback |
| Audit all file changes | `PostToolUse` programmatic hook |
| Share MaxsimCLI ops with other agents | MCP server via `createSdkMcpServer` |
| Run parallel plan execution | SDK `agents` option with subagent definitions |

### Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required for direct Anthropic API auth |
| `CLAUDE_CODE_USE_BEDROCK=1` | Route to Amazon Bedrock |
| `CLAUDE_CODE_USE_VERTEX=1` | Route to Google Vertex AI |
| `CLAUDE_CODE_USE_FOUNDRY=1` | Route to Microsoft Azure AI Foundry |

### Import Reference

```typescript
// TypeScript
import {
  query,
  ClaudeSDKClient,
  tool,
  createSdkMcpServer,
  list_sessions,
  get_session_messages
} from "@anthropic-ai/claude-agent-sdk";

// Python
from claude_agent_sdk import (
  query,
  ClaudeSDKClient,
  ClaudeAgentOptions,
  HookMatcher,
  AgentDefinition,
  AssistantMessage,
  ResultMessage,
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  PermissionResultAllow,
  PermissionResultDeny,
  list_sessions,
  get_session_messages
)
```

---

## Sources

- [Agent SDK Overview — Anthropic Platform Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Run Claude Code Programmatically (Headless) — Claude Code Docs](https://code.claude.com/docs/en/headless)
- [Python SDK Reference — Anthropic Platform Docs](https://platform.claude.com/docs/en/agent-sdk/python)
- [Claude Code Features in the SDK — Anthropic Platform Docs](https://platform.claude.com/docs/en/agent-sdk/claude-code-features)
- [Migrate to Claude Agent SDK — Anthropic Platform Docs](https://platform.claude.com/docs/en/agent-sdk/migration-guide)
- [Hooks — Anthropic Platform Docs](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Streaming Output — Anthropic Platform Docs](https://platform.claude.com/docs/en/agent-sdk/streaming-output)
- [@anthropic-ai/claude-agent-sdk — npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [GitHub — anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [GitHub — anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python)
- [Local reference: The Claude Code SDK lesson](../claude-code-in-action/03-hooks-and-the-sdk/07-the-claude-code-sdk.md)
