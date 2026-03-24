# Agent Teams Research — Consolidated Findings

> **Research date:** 2026-03-24
> **Method:** 20 parallel research agents analyzing official docs, community sources, existing spec docs, and codebase
> **Purpose:** Inform MaxsimCLI's Agent Teams integration strategy

---

## 1. Executive Summary

Claude Code Agent Teams is an **experimental feature** (since Feb 5, 2026, v2.1.32) that enables multiple independent Claude Code sessions to coordinate via a shared task list and peer-to-peer messaging. It remains **disabled by default** and gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

**Key decisions for MaxsimCLI:**

1. **Hybrid approach:** Subagents for focused execution (default), Agent Teams only for inter-agent communication workflows (opt-in).
2. **CRITICAL: Enterprise-only restriction.** Agent Teams may require Claude Max, Team, or Enterprise subscription. Non-enterprise users see: *"The 'Agent Teams' feature is not available on this plan."* There is a server-side plan check beyond the env var. (Issue #25148 requests all-plan access.) **MaxsimCLI MUST gracefully degrade to subagent-only mode when Agent Teams are unavailable.**
3. **Windows limitation:** Split-pane mode not supported. In-process mode works but has `isTTY` issues on Bun (Issue #26244).
4. **Cost:** ~7x single session, ~3.5x subagents. "Multi-agent workflows don't make sense for 95% of agent-assisted development tasks." (Anthropic)

---

## 2. Architecture

### 2.1 Components

| Component | Role | Storage |
|-----------|------|---------|
| **Team lead** | Creates team, spawns teammates, coordinates | N/A (main session) |
| **Teammates** | Independent Claude Code instances with own context | `~/.claude/teams/{team-name}/config.json` |
| **Task list** | Shared work items with dependency tracking | `~/.claude/tasks/{team-name}/{id}.json` |
| **Mailbox** | Per-agent message queues | `~/.claude/teams/{team-name}/inboxes/{agent-name}.json` |

### 2.2 File System Layout

```
~/.claude/
├── teams/{team-name}/
│   ├── config.json              # Team roster (members array with name, agentId, agentType)
│   └── inboxes/{agent-name}.json  # Per-agent message queues
└── tasks/{team-name}/
    ├── .lock                    # flock()-based mutual exclusion
    ├── .highwatermark           # Auto-increment task ID counter
    └── {id}.json                # Individual task files (status, owner, dependencies)
```

### 2.3 Coordination Model

All coordination is **filesystem-based** — no network calls, no message broker. Teammates read/write the same directories on the local machine. File locking (`flock()`) prevents race conditions on task claiming.

---

## 3. Tools Reference

### 3.1 TeamCreate

Creates team namespace and directories.

| Parameter | Type | Description |
|-----------|------|-------------|
| `team_name` | string | Namespace identifier, becomes directory name |
| `description` | string | Human-readable team purpose |

**Note:** TeamCreate is an internal tool — users describe the team in natural language, the lead invokes it internally.

### 3.2 TeamDelete

Removes all team resources. **Fails if any teammate is still active.** No force-kill mechanism exists (Issue #31788).

### 3.3 SendMessage (v2.1.75+ schema)

| Parameter | Type | Description |
|-----------|------|-------------|
| `to` | string | Recipient name, `"team-lead"`, or `"*"` for broadcast |
| `message` | string/object | Text or structured protocol object |
| `summary` | string (optional) | Brief synopsis for indexing |

**Protocol message types** (nested in `message` field):
- `message` — standard peer-to-peer
- `broadcast` — lead to all (via `to: "*"`)
- `shutdown_request` / `shutdown_response` — graceful termination
- `plan_approval_request` / `plan_approval_response` — quality gate
- `idle_notification` — automatic when teammate goes idle
- `task_assignment` — explicit delegation

**Breaking change in v2.1.75:** Old schema used `type`/`recipient`/`content`; new schema uses `to`/`message`/`summary`.

### 3.4 TaskCreate

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subject` | string | Yes | Short imperative title |
| `description` | string | Yes | Full work specification |
| `activeForm` | string | No | Progress spinner label |

### 3.5 TaskUpdate

| Parameter | Type | Description |
|-----------|------|-------------|
| `taskId` | string | Target task |
| `status` | enum | `pending` / `in_progress` / `completed` |
| `owner` | string | Agent claiming the task |
| `addBlockedBy` | string[] | Dependency task IDs |
| `addBlocks` | string[] | Tasks this unblocks on completion |

**Automatic unblocking:** When a task completes, dependent tasks are automatically unblocked.

### 3.6 TaskList / TaskGet

- `TaskList()` — returns all tasks with id, subject, status, owner (no description)
- `TaskGet({ taskId })` — returns full task details including description

---

## 4. Hooks

### 4.1 TeammateIdle

**Fires:** When teammate is about to go idle after finishing its turn.
**Matcher:** Not supported — fires for every teammate.

**Payload fields:** `session_id`, `cwd`, `hook_event_name`, `teammate_name`, `team_name`

**Control:**
| Exit Code | Effect |
|-----------|--------|
| `0` | Allow idle |
| `2` | Block idle; stderr fed back as instruction — teammate continues |
| JSON `{"continue": false}` | Stop teammate entirely |

### 4.2 TaskCompleted

**Fires:** When task is being marked complete (via TaskUpdate or auto-completion).
**Matcher:** Not supported.

**Payload fields:** `session_id`, `cwd`, `hook_event_name`, `task_id`, `task_subject`, `task_description`, `teammate_name`, `team_name`

**Control:** Same as TeammateIdle — exit 2 blocks completion with feedback.

---

## 5. Subagents vs. Agent Teams — Decision Matrix

| Dimension | Subagents (Agent Tool) | Agent Teams (TeamCreate) |
|-----------|----------------------|--------------------------|
| **Context** | Own window; results return to caller | Own window; fully independent |
| **Communication** | Report back only; no peer messaging | Peer-to-peer via SendMessage |
| **Coordination** | Caller manages scheduling | Shared task list with self-claiming |
| **Worktrees** | `isolation: worktree` automatic | Manual setup required |
| **Token cost** | ~2x solo for 3 workers | ~4-7x solo for 3 workers |
| **Nesting** | No subagent nesting | No nested teams |
| **Resumption** | Works normally | `/resume` does NOT restore teammates |
| **Best for** | Focused, independent tasks | Collaborative, multi-domain work |
| **Mixing** | N/A | Teammates can spawn subagents |
| **Status** | Generally available | Experimental |

### 5.1 When to Use Which (for MaxsimCLI)

**Use Subagents (default for MaxsimCLI):**
- `/maxsim:execute` — parallel phase execution (tasks are independent, results are code)
- `/maxsim:init` — parallel codebase scanning (read-only, report back)
- `/maxsim:plan` — parallel research (gather info, report back)
- Quick tasks, debugging (focused, single-purpose)

**Use Agent Teams (opt-in for MaxsimCLI):**
- Competitive implementation with debate (agents challenge each other's hypotheses)
- Multi-reviewer code review (security + quality + performance reviewers share findings)
- Architecture decisions requiring collaborative reasoning
- Complex debugging where hypotheses need cross-checking

### 5.2 Cost Comparison

| Scenario | Tokens | Cost vs. Solo |
|----------|--------|---------------|
| Solo session | ~200k | 1x |
| 3 subagents | ~440k | 2.2x |
| 3-person team | ~800k | 4x |
| Full team (5 active) | ~1.4M | 7x |

---

## 6. Limitations & Known Issues

### 6.1 Hard Architectural Limits
- One team per session
- No nested teams
- Fixed lead (no promotion/transfer)
- Permissions set at spawn (changeable after, but known bugs)

### 6.2 Windows-Specific Issues
- Split-pane mode **not supported** in Windows Terminal (requires tmux/iTerm2)
- `process.stdout.isTTY` is false in Bun binary on Windows → may block Task tools (Issue #26244)
- In-process mode works, but no visual split view

### 6.3 Known Bugs
- **TeamDelete blocked by hung teammate** — no force-kill (Issue #31788)
- **Permission bypass** — teammates can sometimes bypass permission checks (Issue #26980)
- **VS Code deadlock** — teammate permission prompts can't reach lead in VS Code extension (Issue #25254)
- **Delegate mode permission bug** — teammates lose tool access (Issues #24073, #24307)

### 6.4 Operational Issues
- No session resumption for in-process teammates
- Task status can lag (teammates fail to mark completed)
- Shutdown is slow (waits for current tool call)
- Broadcasts scale cost linearly with team size

---

## 7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Enable feature (set to `1`) |
| `CLAUDE_CODE_TEAM_NAME` | Auto-set on spawned teammates |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | Auto-set when plan approval required |
| `CLAUDE_CODE_TASK_LIST_ID` | Share task list across independent sessions |
| `CLAUDE_CODE_SUBAGENT_MODEL` | Model for subagents spawned by teammates |

---

## 8. Implications for MaxsimCLI Spec

### 8.1 Recommended Architecture: Hybrid

MaxsimCLI should implement a **two-tier parallel execution model**:

**Tier 1 — Subagents (default):** Used for all standard phase execution. Each executor agent gets `isolation: worktree`, runs independently, reports PR URL or failure. This is the current architecture and works well.

**Tier 2 — Agent Teams (opt-in):** Used when the user or MaxsimCLI detects a workflow that benefits from inter-agent communication:
- Competitive implementation with debate
- Multi-dimensional code review
- Collaborative debugging
- Architecture decision-making

### 8.2 Config Changes Needed

```json
{
  "execution": {
    "mode": "subagents",         // "subagents" | "teams" | "hybrid"
    "teams_for": ["competitive", "review", "debug-collab"]
  }
}
```

### 8.3 What to Update in PROJECT.md

1. **§7.2 Parallelism Strategy:** Document hybrid approach (subagents default, teams opt-in)
2. **§7.3 Worktrees:** Note that Agent Teams don't auto-create worktrees; manual setup needed
3. **§12.2 Agent Team Hooks:** Document TeammateIdle and TaskCompleted with full schemas
4. **§11 Self-Improvement:** Agent Teams could enable collaborative self-review patterns
5. **New: §7.5 Agent Teams Integration:** Dedicated section for when/how teams are used

### 8.4 What to Update in docs/spec/agent-teams-guide.md

The existing 1,283-line guide is comprehensive but needs:
1. Update SendMessage schema to v2.1.75+ format
2. Correct speculative sections vs. verified facts
3. Add Windows-specific caveats
4. Add cost comparison table
5. Add decision matrix for subagents vs. teams
6. Add `Teammate` tool alternative documentation
7. Remove or clarify `TeammateTool`/`TeamCreate` naming ambiguity

---

## 9. Official Documentation URLs

| Resource | URL |
|----------|-----|
| Agent Teams | https://code.claude.com/docs/en/agent-teams |
| Subagents | https://code.claude.com/docs/en/sub-agents |
| Hooks | https://code.claude.com/docs/en/hooks |
| Permissions | https://code.claude.com/docs/en/permissions |
| Sandboxing | https://code.claude.com/docs/en/sandboxing |
| Environment Variables | https://code.claude.com/docs/en/env-vars |
| Skills | https://code.claude.com/docs/en/skills |
| Agent SDK | https://platform.claude.com/docs/en/agent-sdk/overview |
| Docs Index (llms.txt) | https://code.claude.com/docs/llms.txt |

---

## 10. Critical: Plan Restrictions

Agent Teams tools (`TeammateTool`, `SendMessage`, `spawnTeam`) are currently **enterprise-only** on some setups. Non-enterprise users may see:
> *"Note: The 'Agent Teams' feature (TeammateTool, SendMessage, spawnTeam) is not available on this plan."*

There is an active feature request (Issue #25148) to enable it on all plans. The environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` alone is **not sufficient** — there appears to be a server-side plan check.

**Implication for MaxsimCLI:** The system MUST detect whether Agent Teams are available at runtime and gracefully fall back to subagent-only mode. This should be a core architectural requirement.

---

## 11. Community-Discovered Issues

- **Name-based inference bug:** Claude infers agent behavior from its name. An agent named "code-reviewer" silently overrides custom instructions with generic review rules. **Workaround:** Use non-descriptive names (e.g., "blue-jay" instead of "code-reviewer").
- **Orphaned team directories** persist after unclean session end. Manual cleanup: `rm -rf ~/.claude/teams/{team-name}/`
- **Inbox write is O(N)** — entire JSON array rewritten per message. Degrades under high volume.
- **Agent Teams were discovered hidden in the binary** before official release (v2.1.29). The community reverse-engineered 13 TeammateTool operations.

---

## 12. Notable Open-Source Projects Using Agent Teams

| Project | Description |
|---------|-------------|
| `wshobson/agents` | 112 specialized agents with `agent-teams` plugin (7 preset team configs) |
| `ruvnet/ruflo` | Enterprise orchestration with native TeammateIdle/TaskCompleted hook integration |
| `Gentleman-Programming/agent-teams-lite` | Pure-Markdown SDD pipeline — works without native Agent Teams |
| `NikiforovAll/claude-code-kanban` | Real-time Kanban board tracking Agent Teams via SSE |
| `yuvalsuede/claude-teams-language-protocol` | "AgentSpeak" — 60-70% token reduction for inter-agent communication |
| `disler/claude-code-hooks-multi-agent-observability` | Multi-agent observability dashboard |
| `OthmanAdi/planning-with-teams` | Shared markdown files as collective agent memory |

---

## 13. Six Core Multi-Agent Patterns

| Pattern | Communication | Best For | Requires Teams? |
|---------|--------------|----------|-----------------|
| **Coordinator** | Hub-and-spoke | Independent domains, central control | No (subagents work) |
| **Pipeline** | Linear A→B→C | Sequential dependencies | No |
| **Fan-Out/Fan-In** | Parallel → aggregator | Independent tasks, speed | No |
| **Competitive** | Isolated → judge | Multiple approaches, high stakes | No (worktrees) |
| **Review** | Maker ↔ checker loop | Quality gates | No |
| **Pair Programming** | Bidirectional peer mesh | Complex design, debugging | **Yes** (needs SendMessage) |

**Key insight:** Only the Pair Programming pattern truly requires Agent Teams. All other patterns work with subagents.

---

## 14. Key Community Resources

| Resource | URL |
|----------|-----|
| Reverse-engineering internals | https://dev.to/nwyin/reverse-engineering-claude-code-agent-teams-architecture-and-protocol-o49 |
| System prompt changelog | https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/CHANGELOG.md |
| Complete guide 2026 | https://claudefa.st/blog/guide/agents/agent-teams |
| 30 tips | https://getpushtoprod.substack.com/p/30-tips-for-claude-code-agent-teams |
| Swarm orchestration skill | https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea |
| Git worktree + teams | https://engineering.intility.com/article/agent-teams-or-how-i-learned-to-stop-worrying-about-merge-conflicts-and-love-git-worktrees |
| Subagent vs Team (60 sec) | https://medium.com/data-science-collective/sub-agent-vs-agent-team-in-claude-code-pick-the-right-pattern-in-60-seconds-e856e5b4e5cc |
| Anthropic C compiler case study | https://www.anthropic.com/engineering/building-c-compiler |
