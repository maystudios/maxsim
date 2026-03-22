# Claude Code Memory System: A Comprehensive Guide for Self-Improving Agents

**Version:** March 2026
**Scope:** Claude Code v2.1.59+
**Purpose:** Deep reference for building agents that accumulate knowledge, enforce project-specific patterns, and improve across sessions

---

## Table of Contents

1. [Overview: Two Complementary Memory Systems](#1-overview-two-complementary-memory-systems)
2. [CLAUDE.md: The Human-Written Layer](#2-claudemd-the-human-written-layer)
3. [Auto Memory and MEMORY.md: The Agent-Written Layer](#3-auto-memory-and-memorymd-the-agent-written-layer)
4. [Path-Scoped Rules (.claude/rules/)](#4-path-scoped-rules-clauderules)
5. [Subagent Persistent Memory](#5-subagent-persistent-memory)
6. [Programmatic Memory Writes: Hooks and Scripts](#6-programmatic-memory-writes-hooks-and-scripts)
7. [How Memory is Keyed by Git Repository](#7-how-memory-is-keyed-by-git-repository)
8. [Memory and Agent Teams](#8-memory-and-agent-teams)
9. [Memory vs CLAUDE.md vs Rules: When to Use Which](#9-memory-vs-claudemd-vs-rules-when-to-use-which)
10. [Organizing Memory for a Project Management Tool](#10-organizing-memory-for-a-project-management-tool)
11. [Best Practices: What to Save and What Not to Save](#11-best-practices-what-to-save-and-what-not-to-save)
12. [How Agents Read Their Own Memory at Session Start](#12-how-agents-read-their-own-memory-at-session-start)
13. [Self-Improving Agent Patterns and Feedback Loops](#13-self-improving-agent-patterns-and-feedback-loops)
14. [Reference: Full Memory Hierarchy Diagram](#14-reference-full-memory-hierarchy-diagram)

---

## 1. Overview: Two Complementary Memory Systems

Each Claude Code session begins with a fresh context window. Two distinct mechanisms carry knowledge across sessions:

| Dimension | CLAUDE.md files | Auto Memory (MEMORY.md) |
|---|---|---|
| **Who writes it** | You (human) | Claude (agent) |
| **What it contains** | Instructions and rules | Learnings and patterns |
| **Scope** | Project, user, or org | Per working tree |
| **Loaded into** | Every session, in full | Every session (first 200 lines only) |
| **Use for** | Coding standards, architecture, workflows | Build commands, debugging insights, preferences Claude discovers |
| **Editable by you** | Yes, directly | Yes, via `/memory` or directly in the file |

Both layers are loaded at the start of every conversation. Claude treats them as context, not as enforced configuration. The more specific and concise your instructions, the more consistently Claude follows them.

A third layer exists for named subagents: the **memory frontmatter field**, which gives each agent its own isolated persistent memory directory across all three scopes (user, project, local). This is covered in section 5.

**Critical insight**: Memory in Claude Code is text injection into the prompt, not a database or learning mechanism. Every byte you add to memory files consumes context budget. Treat memory as a behavioral specification for agent decision-making, not as a documentation wiki.

---

## 2. CLAUDE.md: The Human-Written Layer

### 2.1 Locations and Scopes

CLAUDE.md files can live in multiple locations simultaneously. More specific locations take precedence over broader ones. All locations in the directory hierarchy above the working directory load in full at launch.

| Scope | Location | Shared With | Use For |
|---|---|---|---|
| **Managed policy** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`<br>Linux/WSL: `/etc/claude-code/CLAUDE.md`<br>Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | All users on machine | Org-wide standards, security policies (cannot be excluded) |
| **Project** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team (via git) | Architecture, coding standards, workflows |
| **User** | `~/.claude/CLAUDE.md` | Just you (all projects) | Personal preferences, global tooling |
| **User rules** | `~/.claude/rules/*.md` | Just you | Personal conditional rules |

**Subdirectory CLAUDE.md files** load on demand: when Claude reads a file inside that subdirectory, the subdirectory's CLAUDE.md is included. This is different from parent-directory files, which load at launch.

### 2.2 Import Syntax

CLAUDE.md files can import additional files using `@path/to/file` syntax. Imported files are expanded and loaded into context at launch alongside the referencing CLAUDE.md.

```markdown
# Main CLAUDE.md
See @README.md for project overview.
See @package.json for npm commands.

# Import domain-specific guides
- Git workflow: @docs/git-instructions.md
- API patterns: @docs/api-patterns.md

# Import personal preferences (not checked in)
- Personal preferences: @~/.claude/my-project-instructions.md
```

**Import rules:**
- Both relative and absolute paths are allowed
- Relative paths resolve relative to the importing file, not the working directory
- Imported files can recursively import other files (maximum depth: 5 hops)
- First-time external imports trigger an approval dialog; if declined, imports remain disabled

### 2.3 Size Limits and Adherence

- **Target under 200 lines** per CLAUDE.md file. Files under 200 lines achieve rule application rates above 92%. Beyond 400 lines, adherence drops to ~71%.
- The 200-line limit is a soft guideline for CLAUDE.md (unlike the hard limit for MEMORY.md). Longer files are loaded in full but produce lower adherence.
- If your CLAUDE.md grows large, split it using `@imports` or `.claude/rules/` files.

### 2.4 Writing Effective Instructions

Instructions should be specific enough to verify:

```markdown
# Good
- Use 2-space indentation in all TypeScript files
- Run `npm test` before committing
- API handlers live in `src/api/handlers/`
- Never modify files in the `legacy/` directory

# Bad
- Format code properly
- Test your changes
- Keep files organized
```

Use markdown headers and bullet lists. Claude scans structure the same way readers do: organized sections are easier to follow than dense paragraphs.

### 2.5 Excluding CLAUDE.md Files in Monorepos

In large monorepos, ancestor CLAUDE.md files from other teams may be loaded. Exclude them with the `claudeMdExcludes` setting in `.claude/settings.local.json`:

```json
{
  "claudeMdExcludes": [
    "**/monorepo/CLAUDE.md",
    "/home/user/monorepo/other-team/.claude/rules/**"
  ]
}
```

Patterns match against absolute file paths. Managed policy CLAUDE.md files cannot be excluded.

### 2.6 Adding Notes Mid-Conversation

Use the `#` prefix in chat to add a persistent note directly to memory:

```
# Always use pnpm, never npm
# API tests require a local Redis instance on port 6379
```

Claude acknowledges the note and appends it to the appropriate memory file. To add to CLAUDE.md specifically (rather than auto memory), say "add this to CLAUDE.md" explicitly.

---

## 3. Auto Memory and MEMORY.md: The Agent-Written Layer

### 3.1 What Auto Memory Is

Auto memory lets Claude accumulate knowledge across sessions without you writing anything. Claude saves notes for itself as it works: build commands, debugging insights, architecture notes, code style preferences, and workflow habits. Claude does not save something every session — it decides what's worth remembering based on whether the information would be useful in a future conversation.

Requires Claude Code v2.1.59 or later. Check with `claude --version`.

### 3.2 Enabling and Disabling

Auto memory is on by default.

**Toggle in session:** Run `/memory` and use the auto memory toggle.

**Disable via settings:**
```json
{
  "autoMemoryEnabled": false
}
```

**Disable via environment variable** (takes precedence over all settings; recommended for CI):
```bash
CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
```

**Custom storage location** (user or local settings only, not project settings for security):
```json
{
  "autoMemoryDirectory": "~/my-custom-memory-dir"
}
```

### 3.3 Storage Location and Structure

Each project gets its own memory directory:

```
~/.claude/projects/<project>/memory/
├── MEMORY.md          # Concise index, loaded into every session (first 200 lines)
├── debugging.md       # Detailed notes on debugging patterns
├── api-conventions.md # API design decisions
├── build-patterns.md  # Build commands and CI insights
└── ...                # Any other topic files Claude creates
```

The `<project>` path is derived from the git repository root. See section 7 for how encoding works.

Auto memory is machine-local. Files are not shared across machines or cloud environments.

### 3.4 The MEMORY.md 200-Line Rule

**The 200-line limit is a hard limit for MEMORY.md.** Claude Code loads only the first 200 lines at session start. Content beyond line 200 is invisible to Claude at startup.

This is unlike CLAUDE.md, where files are loaded in full (though adherence degrades with length).

**Consequence:** MEMORY.md must function as an index, not a reference manual. When Claude accumulates detailed notes that would push MEMORY.md past 200 lines, it moves the detailed content into separate topic files and keeps only a one-liner reference in MEMORY.md.

**Effective MEMORY.md format:**

```markdown
# Project Memory

## Build & Commands
- [2026-02-15] Build: `npm run build`, Test: `npm test`, Lint: `npm run lint`
- [2026-02-20] Use `pnpm`, never npm — project uses workspace protocol

## Architecture
- [2026-01-10] Auth uses JWT in httpOnly cookies; token refresh at /api/auth/refresh
- [2026-02-01] State management: Zustand (not Redux) — see architecture.md for details

## Patterns Learned
- [2026-02-18] Prisma migrations must run before tests; use `npm run db:migrate:test`
- [2026-02-22] Always check downstream consumers before deleting shared utility functions

## Topic Files
- debugging.md — error patterns and their root causes
- api-conventions.md — request/response shapes, auth headers, error codes
- test-patterns.md — fixture setup, mocking conventions

## Recent Sessions
- [2026-03-20] Refactored auth module; JWT secret now from env var NEXT_AUTH_SECRET
- [2026-03-21] Fixed race condition in WebSocket reconnect; see debugging.md for details
```

**Key conventions:**
- Date-stamp every entry: `[YYYY-MM-DD]`
- Keep each entry to one line in MEMORY.md; move details to topic files
- Maintain a "Topic Files" routing table so Claude knows what's in each topic file
- Topic files are not loaded at startup — Claude reads them on demand using its standard file tools

### 3.5 What Claude Saves Automatically

Claude watches for patterns across your session and decides what to save:

- **Build and test commands** (discovered from package.json, Makefiles, README)
- **Debugging insights** (tricky error patterns and their resolutions)
- **Architecture notes** (key files, module relationships, important abstractions)
- **Code style preferences** (patterns you consistently apply or correct)
- **Workflow habits** (how you prefer to work, package managers you use)
- **Recurring corrections** (if you correct Claude on the same thing twice, it saves it)

### 3.6 Auditing and Editing Auto Memory

Run `/memory` to:
- Browse all loaded CLAUDE.md and rules files
- Toggle auto memory on/off
- Open the auto memory folder in your editor
- See exactly what files are loaded this session

All auto memory files are plain markdown you can edit or delete at any time.

**After `/compact`:** CLAUDE.md survives compaction fully. Auto memory's MEMORY.md is re-read from disk and re-injected fresh. Anything that existed only in the conversation (not written to a file) is lost — a reminder to explicitly ask Claude to save important session findings.

---

## 4. Path-Scoped Rules (.claude/rules/)

### 4.1 What Rules Are

Rules are markdown files in `.claude/rules/` that organize instructions into topic-specific files. They differ from CLAUDE.md in one key capability: **path-scoped rules only load when Claude works with matching files**, saving context space.

Rules without a `paths` field load unconditionally at launch, identical in behavior to `.claude/CLAUDE.md`.

Rules differ from Skills: rules load into context automatically (always or conditionally); skills only load when explicitly invoked or when Claude judges them relevant.

### 4.2 Directory Structure

```
your-project/
├── CLAUDE.md                        # Root project instructions
└── .claude/
    ├── CLAUDE.md                    # Equivalent location for project instructions
    └── rules/
        ├── code-style.md            # Unconditional: loads every session
        ├── testing.md               # Unconditional: loads every session
        ├── api-design.md            # Path-scoped: only for API files
        └── frontend/
            ├── react-patterns.md    # Path-scoped: only for React files
            └── css-conventions.md   # Path-scoped: only for CSS files
```

All `.md` files are discovered recursively, so subdirectory organization works.

### 4.3 Path-Specific Rules with Frontmatter

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/api/**/*.js"
---

# API Development Rules

- All endpoints must include input validation using Zod
- Use the standard error response format: `{ error: string, code: string }`
- Include OpenAPI documentation comments on all route handlers
- Return 422 (not 400) for validation errors
```

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
  - "lib/**/*.ts"
  - "tests/**/*.test.ts"
---

# TypeScript Rules

- Strict mode is enabled; no `any` types without explicit comment
- Use `type` not `interface` for object shapes
- All async functions must have explicit return types
```

### 4.4 Glob Pattern Reference

| Pattern | Matches |
|---|---|
| `**/*.ts` | All TypeScript files in any directory |
| `src/**/*` | All files under `src/` |
| `*.md` | Markdown files in project root only |
| `src/components/*.tsx` | React components in a specific directory |
| `**/*.{ts,tsx}` | TypeScript and TSX files anywhere |
| `{src,lib}/**/*.ts` | TypeScript in both src/ and lib/ |

### 4.5 Known Behavior and Gotchas

- Path-scoped rules trigger when Claude **reads** files matching the pattern, not on Write/Edit operations (known bug as of early 2026 — tracked in anthropics/claude-code#23478)
- The `paths:` frontmatter format has some YAML edge cases. Glob patterns starting with `{` or `*` may need quoting. The undocumented `globs:` key works as an alternative if `paths:` is not recognized
- User-level path rules at `~/.claude/rules/` have a known issue where `paths:` frontmatter is ignored (tracked in anthropics/claude-code#21858)
- User-level rules at `~/.claude/rules/` apply to every project on your machine. They load before project rules, so project rules have higher effective priority

### 4.6 Sharing Rules via Symlinks

The `.claude/rules/` directory supports symlinks for sharing rules across projects:

```bash
# Link a shared rules directory
ln -s ~/shared-claude-rules .claude/rules/shared

# Link a single file
ln -s ~/company-standards/security.md .claude/rules/security.md
```

Symlinks are resolved and loaded normally. Circular symlinks are detected and handled gracefully.

---

## 5. Subagent Persistent Memory

### 5.1 The Memory Frontmatter Field

Subagents can be given their own persistent memory directory using the `memory` frontmatter field in their `.md` definition file. This was introduced in Claude Code v2.1.33.

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices. Use proactively after code changes.
tools: Read, Glob, Grep, Bash
model: sonnet
memory: user
---

You are a senior code reviewer. As you review code:
- Update your agent memory with patterns, conventions, and recurring issues you discover
- Check your memory for patterns you've seen before starting each review
- Build institutional knowledge about this codebase over time
```

### 5.2 Memory Scopes

| Scope | Storage Path | Use When |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name-of-agent>/` | Knowledge applies across all projects |
| `project` | `.claude/agent-memory/<name-of-agent>/` | Project-specific, shareable via version control |
| `local` | `.claude/agent-memory-local/<name-of-agent>/` | Project-specific, not checked into VCS |

**Recommendation:** `project` is the default for most cases. It makes subagent knowledge shareable with the team through git. Use `user` for agents that accumulate knowledge applicable everywhere (e.g., a general code-style reviewer). Use `local` for machine-specific path knowledge or private notes.

### 5.3 How Agent Memory Loads

When `memory` is enabled for a subagent:

1. The subagent's system prompt is automatically augmented with instructions for reading and writing to its memory directory
2. The first 200 lines of `MEMORY.md` in the agent's memory directory are included in the system prompt
3. If MEMORY.md exceeds 200 lines, the system prompt includes instructions to curate it
4. Read, Write, and Edit tools are automatically enabled so the subagent can manage its memory files

The memory directory structure follows the same pattern as main session auto memory:

```
~/.claude/agent-memory/code-reviewer/
├── MEMORY.md              # Concise index (first 200 lines loaded at startup)
├── react-patterns.md      # React-specific insights
├── security-issues.md     # Security patterns found across projects
└── team-conventions.md    # Conventions learned about this team
```

### 5.4 Making Agents Actively Use Their Memory

Simply enabling memory is not enough. The agent's system prompt should explicitly instruct memory use:

```markdown
---
name: architect-reviewer
description: Reviews architectural decisions and technical debt
memory: project
---

You are a software architect reviewer.

**At the start of every session:**
1. Read your MEMORY.md to recall patterns and past findings
2. Check for topic files relevant to the current task
3. Note any patterns from memory that apply to the current review

**During your work:**
- When you discover a recurring pattern, write it to memory
- When you find a recurring issue type, add it to the relevant topic file
- Update MEMORY.md with a dated one-liner when you complete significant analysis

**At session end:**
- Add a session summary line to MEMORY.md: `[DATE] Reviewed X, found Y, key insight: Z`
- Ensure all new patterns are captured in the appropriate topic file

Build institutional knowledge across conversations. Write concise notes about what you found and where.
```

### 5.5 Prompting Patterns for Agent Memory

Ask the agent to consult memory before starting work:
```
Review this PR, and check your memory for patterns you've seen before.
```

Ask the agent to update memory after completing a task:
```
Now that you're done, save what you learned to your memory.
```

For an agent running as the main thread (`claude --agent code-reviewer`), it retains its full memory system plus standard CLAUDE.md loading.

---

## 6. Programmatic Memory Writes: Hooks and Scripts

### 6.1 Hook Event Reference

Claude Code fires hooks at key lifecycle moments:

| Event | When It Fires | Common Use |
|---|---|---|
| `PreToolUse` | Before any tool runs | Validate, block, log operations |
| `PostToolUse` | After a tool completes | Format, lint, record changes |
| `Notification` | When Claude sends an alert | Relay to external systems |
| `Stop` | When Claude finishes its turn | Capture session learnings, summarize |
| `SubagentStart` | When a subagent begins | Set up resources for the agent |
| `SubagentStop` | When a subagent completes | Clean up, capture agent output |
| `TeammateIdle` | When a teammate goes idle (agent teams) | Enforce quality gates |
| `TaskCompleted` | When a task is marked complete (agent teams) | Enforce completion criteria |

Hooks are configured in `.claude/settings.json` (project, shared) or `~/.claude/settings.json` (user, personal):

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/capture-session-learnings.sh",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

### 6.2 Stop Hook for Capturing Session Learnings

The Stop hook fires every time Claude finishes a turn. Use it to capture what Claude learned or accomplished and write it to memory files programmatically.

**Example: Stop hook that writes session summary to MEMORY.md**

```bash
#!/bin/bash
# .claude/hooks/capture-session-learnings.sh
# Reads session transcript and appends a summary to MEMORY.md

MEMORY_DIR="${CLAUDE_MEMORY_DIR:-$HOME/.claude/projects/$(pwd | sed 's|/|-|g')/memory}"
MEMORY_FILE="$MEMORY_DIR/MEMORY.md"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
DATE=$(date +%Y-%m-%d)

# Read hook input from stdin
INPUT=$(cat)

# Extract session metrics for conditional capture
TURN_COUNT=$(echo "$INPUT" | jq -r '.turn_count // 0' 2>/dev/null || echo "0")
TOOL_COUNT=$(echo "$INPUT" | jq -r '.tool_calls_count // 0' 2>/dev/null || echo "0")

# Only capture if this was a substantive session (more than 5 tool calls)
if [ "$TOOL_COUNT" -lt 5 ]; then
  exit 0
fi

# Ensure memory directory exists
mkdir -p "$MEMORY_DIR"

# Append session marker if MEMORY.md exists
if [ -f "$MEMORY_FILE" ]; then
  LINE_COUNT=$(wc -l < "$MEMORY_FILE")

  # Warn if approaching the 200-line limit
  if [ "$LINE_COUNT" -gt 180 ]; then
    echo "Warning: MEMORY.md is at $LINE_COUNT lines. Consider curating it." >&2
  fi
fi

# The Stop hook can also output text that Claude sees as additional context
echo "Session $SESSION_ID complete. $TOOL_COUNT tool calls made. Check MEMORY.md for current state."

exit 0
```

**Registering the Stop hook:**

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/capture-session-learnings.sh"
          }
        ]
      }
    ]
  }
}
```

### 6.3 Stop Hook for Memory Curation

A more aggressive pattern: when a session ends and MEMORY.md is near the 200-line limit, automatically prompt for curation.

```bash
#!/bin/bash
# .claude/hooks/enforce-memory-limit.sh

MEMORY_FILE="${HOME}/.claude/projects/$(pwd | sed 's|/|-|g')/memory/MEMORY.md"

if [ ! -f "$MEMORY_FILE" ]; then
  exit 0
fi

LINE_COUNT=$(wc -l < "$MEMORY_FILE")

if [ "$LINE_COUNT" -gt 190 ]; then
  # Output to stdout — Claude sees this as context in its next turn
  echo "MEMORY.md has $LINE_COUNT lines and is approaching the 200-line hard limit."
  echo "Before ending this session, please:"
  echo "1. Move detailed notes from MEMORY.md into appropriate topic files"
  echo "2. Keep only one-liner summaries in MEMORY.md"
  echo "3. Update the Topic Files section to list all available topic files"
fi

exit 0
```

### 6.4 PostToolUse Hook for Tracking Changes

Track which files were modified during a session, writing to a daily log:

```bash
#!/bin/bash
# .claude/hooks/track-changes.sh

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
DATE=$(date +%Y-%m-%d)
LOG_FILE=".claude/logs/changes-${DATE}.log"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

mkdir -p .claude/logs
echo "[$(date -u +%H:%M:%S)] $TOOL_NAME: $FILE_PATH" >> "$LOG_FILE"

exit 0
```

### 6.5 Hook Output Protocol

| Exit Code | Behavior |
|---|---|
| `0` | Allow the action to proceed |
| `2` | Block the action; stderr is shown to Claude as context |
| Other non-zero | Allow (non-blocking failure) |

Any text written to **stdout** from a hook is added as additional context for Claude in the same turn. Use this to provide Claude with information from your scripts. Write blocking messages or errors to **stderr** (only relevant for exit code 2).

### 6.6 Hooks in Subagent Frontmatter

Hooks can be defined directly in a subagent's markdown file. These hooks only run while that subagent is active:

```yaml
---
name: memory-aware-reviewer
description: Code reviewer that maintains its own memory
memory: project
hooks:
  Stop:
    - hooks:
        - type: command
          command: "bash .claude/hooks/agent-memory-curation.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "bash .claude/hooks/track-agent-changes.sh"
---
```

`Stop` hooks in frontmatter are automatically converted to `SubagentStop` events at runtime.

---

## 7. How Memory is Keyed by Git Repository

### 7.1 Project Path Encoding

Auto memory is stored at `~/.claude/projects/<project>/memory/`. The `<project>` path is derived from your absolute working directory path, with slashes replaced by hyphens:

```
/Users/john/projects/my-app  →  ~/.claude/projects/-Users-john-projects-my-app/memory/
/home/john/work/maxsim       →  ~/.claude/projects/-home-john-work-maxsim/memory/
```

### 7.2 Git Repository Isolation

**Key rule:** The `<project>` is determined by the **git repository root**, not the current subdirectory.

If your git repo is at `/Users/john/projects/my-app`, all of these working directories share the same memory:
- `/Users/john/projects/my-app/`
- `/Users/john/projects/my-app/src/`
- `/Users/john/projects/my-app/packages/frontend/`

This is by design: all work within the same repository shares one accumulated knowledge base.

**Git worktrees are the exception:** each worktree gets its own separate memory directory. This allows parallel work on different branches to accumulate separate learnings without interference.

### 7.3 Outside a Git Repository

If you run Claude Code in a directory that is not inside a git repository, the project root is used as-is. Two different non-git directories always get separate memory directories.

### 7.4 Custom Memory Directory

Override the storage location (per-user or local settings only):

```json
{
  "autoMemoryDirectory": "~/shared-team-memory/my-project"
}
```

This setting is intentionally not accepted from `.claude/settings.json` (project settings) to prevent a shared project file from redirecting memory writes to unexpected or sensitive locations.

### 7.5 Practical Implications for Teams

- Auto memory is machine-local by default — each developer accumulates separate learnings
- Subagent `project`-scope memory at `.claude/agent-memory/<name>/` is shareable via git — commit it to share agent knowledge across the team
- If you want team-shared main-session memory, consider using CLAUDE.md (which you write manually and commit) rather than auto memory (which is machine-local)

---

## 8. Memory and Agent Teams

### 8.1 How Teammates Load Memory

Each teammate in an agent team is a fully independent Claude Code session. When spawned, a teammate loads the same project context as a regular session:

- CLAUDE.md files from the working directory hierarchy
- Auto memory (MEMORY.md, first 200 lines) from the project's memory directory
- Skills listed in the teammate's configuration
- The spawn prompt from the team lead

**The lead's conversation history does not carry over to teammates.** Teammates start fresh with only project-level context plus the spawn prompt. Include task-specific details in the spawn prompt.

### 8.2 Shared vs Isolated Memory in Teams

| Memory Layer | Shared in Teams? |
|---|---|
| CLAUDE.md (project) | Yes — all teammates read from the same project CLAUDE.md |
| Auto memory (MEMORY.md) | Yes — all teammates read from the same `~/.claude/projects/<project>/memory/` |
| Subagent `project`-scope memory | Yes — if teammates are subagents with `memory: project`, they share `.claude/agent-memory/<name>/` |
| Subagent `local`/`user`-scope memory | No — each teammate has its own scope |
| Conversation history | No — each teammate has its own context window |

This means you can use MEMORY.md as a coordination layer across agent teams: the lead writes a plan or findings to MEMORY.md, and teammates read it when they start.

### 8.3 Team Configuration Storage

Teams and task lists are stored locally:

```
~/.claude/teams/{team-name}/config.json   # Team config and member list
~/.claude/tasks/{team-name}/              # Task list with dependencies
```

Team members can read `config.json` to discover other teammates. Combine this with MEMORY.md to build coordination patterns.

### 8.4 Hooks for Agent Team Quality Gates

Use hooks in `settings.json` to enforce quality at the agent team level:

```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/enforce-team-standards.sh"
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/hooks/validate-task-completion.sh"
          }
        ]
      }
    ]
  }
}
```

`TeammateIdle`: fires when a teammate is about to go idle. Exit with code 2 to send feedback and keep the teammate working. Use this to enforce quality gates (tests passing, docs updated) before a teammate is considered done.

`TaskCompleted`: fires when a task is being marked complete. Exit with code 2 to prevent completion and send feedback. Use this to require specific deliverables before a task can close.

### 8.5 Memory-Driven Team Coordination Pattern

A practical pattern for teams working on a large feature:

1. **Lead writes a coordination document** to the project's MEMORY.md or to a dedicated `team-plan.md` topic file before spawning teammates
2. **Each teammate reads MEMORY.md at startup** — they get the shared plan automatically
3. **Teammates write findings to specific topic files** (e.g., `frontend-findings.md`, `backend-findings.md`)
4. **Lead synthesizes** at the end by reading the topic files teammates wrote
5. **Lead updates MEMORY.md** with the key outcomes as dated one-liners

---

## 9. Memory vs CLAUDE.md vs Rules: When to Use Which

### 9.1 Decision Framework

Use this decision tree to choose the right mechanism:

```
Is this something you want ALL sessions to know permanently?
├── Yes → Is it a behavioral rule or architectural constraint?
│   ├── Yes → CLAUDE.md (you control, human-authored)
│   └── No → Is it a learned pattern Claude discovered?
│       └── Yes → Auto memory / MEMORY.md (Claude writes, you curate)
└── No → Should it only apply to specific file types or directories?
    ├── Yes → .claude/rules/ with paths frontmatter
    └── No → Is it a reusable workflow invoked on-demand?
        └── Yes → Skills (.claude/commands/)
```

### 9.2 Detailed Comparison

| Concern | Mechanism | Rationale |
|---|---|---|
| Project architecture overview | CLAUDE.md | Stable, human-curated, team-shared |
| Coding standards (always apply) | CLAUDE.md or rules/ (no paths) | Must be present every session |
| Language-specific conventions (TypeScript only) | .claude/rules/ with `paths: ["**/*.ts"]` | Only load when relevant |
| Build and test commands | CLAUDE.md (important) + auto memory (discovered) | Both: you specify canonical, Claude learns nuances |
| Debugging patterns Claude discovered | MEMORY.md topic file | Agent-discovered, evolves over time |
| Security policies | CLAUDE.md or managed policy file | Human authority, not delegated to agent |
| Personal style preferences | ~/.claude/CLAUDE.md | Per-user, not shared with team |
| Reusable review workflow | Skills (.claude/commands/) | On-demand, not always in context |
| Subagent institutional knowledge | Subagent memory: project | Agent-specific, shareable via git |
| Session-to-session handoff notes | MEMORY.md (recent sessions section) | Temporal, curated summary |

### 9.3 Why Context Budget Matters

Every file loaded into a session consumes tokens. The priority order:

| Priority | Source |
|---|---|
| High | Your current message |
| High | CLAUDE.md (fully loaded at launch) |
| High | Auto memory MEMORY.md (first 200 lines) |
| Conditional | Path-scoped rules (only when matching files are read) |
| On-demand | MEMORY.md topic files (Claude reads them when needed) |
| On-demand | Subdirectory CLAUDE.md files (loaded when files in subdirectory are read) |

Treat your combined memory footprint as a budget. Every line in CLAUDE.md and MEMORY.md is always consuming context. Path-scoped rules and topic files are efficient because they only load when needed.

---

## 10. Organizing Memory for a Project Management Tool

This section provides a concrete reference for how to structure memory in a project like maxsim (a Claude Code workflow/project management tool).

### 10.1 CLAUDE.md Structure

```markdown
# maxsim — Project Memory

## Architecture
- CLI tool: packages/cli/ (TypeScript, built with tsup)
- Website: packages/website/ (Next.js 14, Tailwind)
- Agents: ~/.claude/agents/ (user-scoped) and packages/cli/src/agents/
- Workflows: ~/.claude/maxsim/workflows/
- Skills: ~/.claude/maxsim/skills/
- See @packages/cli/src/README.md for CLI module overview

## Commands
- Build: `pnpm build` (root workspace)
- Test: `pnpm test`
- Lint: `pnpm lint`
- CLI dev: `cd packages/cli && pnpm dev`
- Release: `pnpm release` (triggers semantic-release)

## Key Conventions
- Agents defined as markdown files with YAML frontmatter
- Workflow phases tracked in ~/.claude/maxsim/state/
- All agent names use kebab-case
- Phase plans stored as phase-{n}-{name}.md

## Off-Limits
- Never modify packages/cli/dist/ (generated)
- Never commit ~/.claude/maxsim/state/ (machine-local)

## See Also
- @docs/spec/ for all architectural specs
- @CHANGELOG.md for recent changes
```

### 10.2 Rules Structure

```
.claude/rules/
├── cli-conventions.md         # Unconditional: always load
├── release-process.md         # Unconditional: always load
├── typescript.md              # paths: ["**/*.ts"]
├── agent-authoring.md         # paths: [".claude/agents/**/*.md", "packages/cli/src/agents/**"]
└── website/
    ├── react-patterns.md      # paths: ["packages/website/src/**/*.tsx"]
    └── styling.md             # paths: ["packages/website/src/**/*.css"]
```

Example agent-authoring rule:

```markdown
---
paths:
  - ".claude/agents/**/*.md"
  - "packages/cli/src/agents/**/*.md"
---

# Agent Authoring Rules

- All agents must have: name, description (fields required)
- description must explain when Claude should use the agent
- memory field: use `project` for project-specific agents, `user` for cross-project
- Tools should be minimal: only grant what the agent actually needs
- System prompts must include memory instructions if memory: is set
- Test new agents with @agent-<name> before shipping
```

### 10.3 MEMORY.md Structure for Project Management

```markdown
# maxsim Memory

## Current State
- [2026-03-22] Active branch: main. Phase 6 (memory system) in progress.
- [2026-03-20] Last release: 5.0.7. Next: 5.1.0 (memory guide + agent improvements)

## Build & CI Insights
- [2026-02-10] pnpm workspace: always run from root, not package dirs
- [2026-03-01] semantic-release reads conventional commits; breaking change = major bump
- [2026-03-15] Website deploys via Vercel on push to main; no manual step needed

## Architecture Decisions
- [2026-01-15] Workflow state is machine-local by design (no cloud sync)
- [2026-02-20] Agent memory: project scope for team agents, user scope for personal
- [2026-03-10] Skills use $ARGUMENTS for parameterization; always document expected args

## Patterns Learned
- [2026-02-28] maxsim phases track state in ~/.claude/maxsim/state/phase-{n}.json
- [2026-03-05] execute-phase skill reads the phase plan from docs/phases/ directory
- [2026-03-18] When adding a new skill, also update the maxsim help index

## Topic Files
- workflow-patterns.md — Phase planning and execution patterns
- agent-patterns.md — Common agent authoring patterns and gotchas
- release-process.md — Semantic release, changelog, version bump patterns

## Recent Sessions
- [2026-03-22] Wrote memory system spec. Key: 200-line limit is hard for MEMORY.md
- [2026-03-21] Improved website hero; moving border effect on CTA button
- [2026-03-20] Fixed drift detection tile in header
```

### 10.4 Subagent Memory for Specialized Agents

For a maxsim planning agent:

```yaml
---
name: maxsim-planner
description: Plans and tracks maxsim workflow phases. Use for phase planning, status checks, and task breakdown.
memory: project
tools: Read, Write, Edit, Glob, Grep, Bash
---

You are the maxsim workflow planner. Your job is to plan phases, track progress, and maintain project state.

At the start of every session:
1. Read your MEMORY.md to recall current project state
2. Check ~/.claude/maxsim/state/ for active phase status
3. Report current status before taking any new actions

As you work:
- Update MEMORY.md with dated status lines when phases change state
- Write detailed phase notes to topic files (phase-{n}-notes.md)
- Track blockers and decisions in decisions.md

Your memory directory structure:
- MEMORY.md: current state index, recent session log
- phase-notes.md: detailed notes per phase
- decisions.md: architectural decisions and their rationale
- blockers.md: active blockers and their resolution status
```

---

## 11. Best Practices: What to Save and What Not to Save

### 11.1 Save This

**Commands and tooling (high value, low churn):**
- Exact build, test, and lint commands
- Package manager preferences (`pnpm` vs `npm` vs `yarn`)
- Environment setup requirements (Redis must be running, `.env.local` needed)
- Non-obvious flags or options for common tools

**Architectural decisions (high value, changes rarely):**
- Module boundaries and ownership
- State management approach
- Authentication/authorization patterns
- Error handling conventions
- Key file locations for major concerns

**Recurring corrections (very high value):**
- Anything you've corrected Claude on more than once in the same project
- Anti-patterns specific to this codebase
- "Always check X before doing Y" rules discovered through bugs

**Debugging patterns (high value, domain-specific):**
- Error messages and their root causes in this codebase
- Non-obvious dependencies (test requires DB migration first)
- Race conditions or timing issues that were hard to find

**Recent session handoffs:**
- What was completed (for continuity)
- What was left undone (for resumption)
- What decision was made and why (for context)

### 11.2 Do Not Save This

**Changing state:**
- Current ticket status or sprint goals (use a proper issue tracker)
- Which PR is open right now
- Who is assigned to what
- Temporary debugging state (`added console.logs to auth.ts`)

**Redundant content:**
- Information already in CLAUDE.md
- Information that's obvious from the code (don't explain what imports do)
- Content that duplicates the README

**Personality or tone preferences:**
- Memory files are for operational decisions, not conversational style
- "Be friendly" does not belong in MEMORY.md

**Large amounts of boilerplate:**
- Code templates belong in skills or snippets, not memory
- API schemas belong in docs or type files, not memory

**Speculative information:**
- "This might be how auth works" — only save confirmed facts
- Unverified assumptions that haven't been tested

### 11.3 The Memory Hygiene Loop

Establish a regular review cycle:

**Per-session:** At session end, ask Claude: "What should be saved to memory from this session?" or use a Stop hook that prompts for key learnings.

**Weekly:** Review MEMORY.md for:
- Lines older than 30 days that are no longer relevant
- Lines that should be promoted to CLAUDE.md (stable enough to be an instruction)
- Topic files that have grown so large they need sub-files
- Entries that duplicate information in CLAUDE.md

**Monthly:** Review CLAUDE.md for:
- Outdated conventions
- Instructions that Claude consistently ignores (too vague, conflicting)
- Content that should become a path-scoped rule (only applies to some files)

### 11.4 The Cardinal Rules

1. **One canonical location per fact.** If build commands are in CLAUDE.md, don't also put them in MEMORY.md. Duplication creates conflicts.
2. **Every MEMORY.md entry must be date-stamped.** Dates enable rotation and pattern detection.
3. **Every topic file must be referenced in the MEMORY.md routing table.** Claude won't know to look for `debugging.md` unless MEMORY.md tells it that file exists.
4. **Never treat memory as a wiki.** Memory answers operational questions: "Should I plan before acting? What's the risky move here? What commands work?" It is not documentation.
5. **Keep MEMORY.md under 180 lines actively.** Don't wait until you hit 200. Build in a buffer.

---

## 12. How Agents Read Their Own Memory at Session Start

### 12.1 The Loading Sequence

At the start of every Claude Code session, the following happens in order:

1. **System prompt** is constructed with Claude's core instructions
2. **Managed policy CLAUDE.md** is loaded (if present)
3. **User CLAUDE.md** (`~/.claude/CLAUDE.md`) is loaded
4. **Project CLAUDE.md** files are loaded from the directory hierarchy above the working directory
5. **User rules** (`~/.claude/rules/*.md` without paths) are loaded
6. **Project rules** (`.claude/rules/*.md` without paths) are loaded
7. **Auto memory MEMORY.md** (first 200 lines) is loaded
8. **Subagent system prompt** is injected (if running as a subagent)
9. **Subagent MEMORY.md** (first 200 lines) is loaded (if the subagent has memory configured)

This entire loaded set becomes the context window's initial state before your first message.

### 12.2 Subdirectory Files Load on Demand

CLAUDE.md files in subdirectories below the working directory are NOT loaded at startup. They load when Claude reads a file inside that subdirectory. Similarly, path-scoped rules only load when Claude reads a file matching their pattern.

Topic files in the memory directory (e.g., `debugging.md`) are NOT loaded at startup. Claude reads them on demand using standard file tools when it needs the information.

### 12.3 The /memory Command

Run `/memory` in any session to inspect what's currently loaded:

- Lists all CLAUDE.md and rules files currently in context
- Shows which auto memory files are available
- Provides a toggle for auto memory on/off
- Opens a link to the auto memory folder

Use this when debugging why Claude isn't following a rule — if the file isn't listed in `/memory`, Claude can't see it.

### 12.4 Instructing Agents to Actively Read Memory

By default, memory is loaded passively — it's in the context window, but Claude doesn't explicitly "review" it. For agents that need to take deliberate action based on memory, add explicit instructions:

```markdown
# In the agent's system prompt:

At the start of every session:
1. Read your MEMORY.md and note the current project state
2. If you see any topic files referenced in the routing table that are relevant
   to today's task, read them now before starting work
3. Confirm what you've learned from memory before proceeding
```

This pattern ensures agents are not just passively loaded with context but actively integrate their accumulated knowledge.

### 12.5 Verifying Memory Across Sessions

To test that memory is persisting correctly:

```bash
# Check memory file exists and has content
cat ~/.claude/projects/$(pwd | sed 's|/|-|g')/memory/MEMORY.md

# Count lines (must be under 200 for full loading)
wc -l ~/.claude/projects/$(pwd | sed 's|/|-|g')/memory/MEMORY.md

# List all files in the memory directory
ls -la ~/.claude/projects/$(pwd | sed 's|/|-|g')/memory/
```

---

## 13. Self-Improving Agent Patterns and Feedback Loops

### 13.1 The Core Feedback Loop

A self-improving agent accumulates knowledge systematically:

```
Session N:
  1. Load MEMORY.md → agent starts with accumulated knowledge
  2. Work on tasks → agent discovers new patterns, makes corrections
  3. Stop hook fires → session learnings are captured
  4. MEMORY.md updated → next session starts smarter

Session N+1:
  1. Load updated MEMORY.md → agent starts with N's learnings
  2. Apply previous learnings to new work
  ...
```

The loop compounds. Each session's output becomes input for the next.

### 13.2 Building a Learning Loop in Practice

**Step 1: Define what to learn.** Not everything is worth saving. At project start, define explicit categories:

```markdown
# In MEMORY.md initial state:

## What I Track
- Build and test patterns specific to this project
- Recurring bugs and their root causes
- Architecture decisions and their rationale
- Patterns I've been corrected on (don't repeat mistakes)
- Session-to-session continuity (what was left undone)
```

**Step 2: Make saving explicit.** Don't rely on Claude to decide everything. Build explicit prompting into skills and agent prompts:

```markdown
# In a /close-session skill:
Before ending this session:
1. What did we accomplish? (one line per item)
2. What was left undone?
3. What patterns or learnings are worth saving?
4. What decisions were made and why?

Write the answers as dated entries in MEMORY.md.
```

**Step 3: Review and consolidate.** Run a weekly consolidation skill that:
- Reads all MEMORY.md entries from the past week
- Groups them into patterns
- Promotes stable patterns to CLAUDE.md
- Archives entries older than 30 days to an archive file

**Step 4: Measure adherence.** After each session, note whether Claude followed previously-saved patterns. If it didn't, the instruction may need to move to CLAUDE.md for stronger guidance, or be rewritten more specifically.

### 13.3 Pattern: Learnings File

Some teams maintain a dedicated `learnings.md` in their repo (not in `.claude/memory/` but committed to git) that both humans and agents read:

```markdown
# Learnings — maxsim

## 2026-03-22
- MEMORY.md hard limit is 200 lines; CLAUDE.md soft limit is 200 lines (adherence drops above)
- Agent memory `project` scope is at `.claude/agent-memory/<name>/` — commit this to share with team
- Stop hooks can output to stdout; Claude sees this as additional context in next turn

## 2026-03-15
- Path-scoped rules only trigger on Read, not on Write (known bug)
- Subagent `memory` field was introduced in v2.1.33; check version before using

## Pattern: Consolidation
Every ~100 bullet points, run a consolidation:
- Group related learnings into principles
- Remove superseded learnings
- Promote stable learnings to CLAUDE.md
```

Commit `learnings.md` to your repository. New team members immediately get access to accumulated institutional knowledge.

### 13.4 Pattern: The Stop Hook Memory Extractor

A sophisticated Stop hook that uses Claude itself to extract learnings:

```bash
#!/bin/bash
# .claude/hooks/extract-learnings.sh
# Uses the Agent SDK to have Claude analyze the session and extract key learnings

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TURN_COUNT=$(echo "$INPUT" | jq -r '.turn_count // 0' 2>/dev/null || echo "0")
DATE=$(date +%Y-%m-%d)

# Only extract from substantive sessions
if [ "$TURN_COUNT" -lt 3 ]; then
  exit 0
fi

MEMORY_FILE="${HOME}/.claude/projects/$(pwd | sed 's|/|-|g')/memory/MEMORY.md"

# Output context for Claude to act on in this turn
echo "Session complete (${TURN_COUNT} turns). Please:"
echo "1. Identify 1-3 key learnings from this session worth preserving"
echo "2. Write them as dated entries to MEMORY.md: [${DATE}] <one-line lesson>"
echo "3. If MEMORY.md is over 180 lines, move the oldest 20 lines to a topic file"
echo "Memory file: $MEMORY_FILE"

exit 0
```

This approach has Claude itself decide what's worth saving, guided by the Stop hook's output.

### 13.5 Pattern: Project-Specific Feedback Loop for maxsim

For a tool like maxsim that manages other Claude Code workflows, memory can capture meta-patterns:

```markdown
# In .claude/agents/workflow-optimizer.md

---
name: workflow-optimizer
description: Analyzes completed phases and improves workflow templates. Use after completing a phase.
memory: project
---

You optimize maxsim workflows based on actual execution patterns.

After each phase completes:
1. Read the phase plan and compare to what actually happened
2. Note where the plan was too optimistic, too pessimistic, or misunderstood the domain
3. Update your memory with corrections:
   - What types of tasks took longer than estimated?
   - What dependencies were missed in planning?
   - What patterns consistently produced good results?
4. If you see the same issue across 3+ phases, escalate to CLAUDE.md

Build a model of: "what kinds of plans work for this project?"
```

Over time, this agent accumulates a project-specific planning model that makes future phase plans more accurate.

---

## 14. Reference: Full Memory Hierarchy Diagram

```
Claude Code Memory System
│
├── HUMAN-WRITTEN (you control)
│   │
│   ├── Managed Policy (cannot be excluded)
│   │   └── /etc/claude-code/CLAUDE.md (Linux)
│   │       C:\Program Files\ClaudeCode\CLAUDE.md (Windows)
│   │       /Library/Application Support/ClaudeCode/CLAUDE.md (macOS)
│   │
│   ├── User Scope (all projects, just you)
│   │   ├── ~/.claude/CLAUDE.md          ← loads every session, full
│   │   └── ~/.claude/rules/*.md         ← loads every session (no paths)
│   │                                       or on matching file open (with paths)
│   │
│   └── Project Scope (team-shared via git)
│       ├── ./CLAUDE.md                  ← loads every session, full
│       ├── ./.claude/CLAUDE.md          ← loads every session, full
│       └── ./.claude/rules/*.md         ← loads every session (no paths)
│                                           or on matching file open (with paths)
│
├── AGENT-WRITTEN (Claude controls, you curate)
│   │
│   └── Auto Memory (machine-local, per git repo)
│       └── ~/.claude/projects/<project>/memory/
│           ├── MEMORY.md                ← first 200 lines loaded every session
│           ├── debugging.md             ← loaded on demand by Claude
│           ├── api-conventions.md       ← loaded on demand by Claude
│           └── [other topic files]      ← loaded on demand by Claude
│
└── SUBAGENT MEMORY (agent + scope-specific)
    │
    ├── User scope: ~/.claude/agent-memory/<name>/
    │   └── MEMORY.md                    ← first 200 lines in agent system prompt
    │
    ├── Project scope: .claude/agent-memory/<name>/
    │   └── MEMORY.md                    ← first 200 lines in agent system prompt
    │                                    ← commitable to git for team sharing
    │
    └── Local scope: .claude/agent-memory-local/<name>/
        └── MEMORY.md                    ← first 200 lines in agent system prompt
                                         ← machine-local, not in git
```

**Loading priority (most specific wins):**

```
Managed policy → User → Project root → Subdirectory (on-demand)
```

**Context consumption (always loaded vs on-demand):**

```
Always loaded:
  - All CLAUDE.md files in hierarchy above CWD
  - All rules/*.md without paths frontmatter
  - MEMORY.md first 200 lines

Loaded on demand:
  - Subdirectory CLAUDE.md (when files in that dir are read)
  - rules/*.md with matching paths frontmatter (when matching files are read)
  - Memory topic files (when Claude decides it needs them)
```

---

## Sources

- [How Claude remembers your project — Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Orchestrate teams of Claude Code sessions — Claude Code Docs](https://code.claude.com/docs/en/agent-teams)
- [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [Anthropic Just Added Auto-Memory to Claude Code — Medium (Joe Njenga)](https://medium.com/@joe.njenga/anthropic-just-added-auto-memory-to-claude-code-memory-md-i-tested-it-0ab8422754d2)
- [Claude Code Auto Memory: How Your AI Learns Your Project — claudefa.st](https://claudefa.st/blog/guide/mechanics/auto-memory)
- [Claude Code's Experimental Memory System — giuseppegurgone.com](https://giuseppegurgone.com/claude-memory)
- [Claude Code Memory System: MEMORY.md, Topic Files, and Automated Maintenance — ianlpaterson.com](https://ianlpaterson.com/blog/claude-code-memory-architecture/)
- [You (probably) don't understand Claude Code memory — joseparreogarcia.substack.com](https://joseparreogarcia.substack.com/p/claude-code-memory-explained)
- [Claude Code Gets Path-Specific Rules — paddo.dev](https://paddo.dev/blog/claude-rules-path-specific-native/)
- [Claude Code Rules Directory: Modular Instructions That Scale — claudefa.st](https://claudefa.st/blog/guide/mechanics/rules-directory)
- [How to Build a Learnings Loop for Claude Code Skills That Self-Improve — MindStudio](https://www.mindstudio.ai/blog/how-to-build-learnings-loop-claude-code-skills)
- [Stop and SessionEnd Hooks — DeepWiki (thedotmack/claude-mem)](https://deepwiki.com/thedotmack/claude-mem/3.1.4-stop-and-sessionend-hooks)
- [Claude Code Agent Teams: The Complete Guide 2026 — claudefa.st](https://claudefa.st/blog/guide/agents/agent-teams)
- [The CLAUDE.md Memory System — SFEIR Institute](https://institute.sfeir.com/en/claude-code/claude-code-memory-system-claude-md/)
- [Claude Code in Action course materials — Anthropic SkillJar](https://anthropic.skilljar.com/claude-code-in-action)
