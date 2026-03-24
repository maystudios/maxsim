# MaxsimCLI Internals

Internal technical reference for MaxsimCLI v6. Describes the actual source
structure, module responsibilities, data contracts, and build pipeline as
implemented — not as aspirationally planned.

---

## Architecture Overview

MaxsimCLI is a **prompt-engineering and project-orchestration system** whose
runtime is Claude Code itself. The Node.js CLI (`npx maxsimcli`) does one
thing: copy markdown templates and compiled hook scripts into a project's
`.claude/` directory. Once installed, Claude reads those files and follows
their instructions. The CLI binary (`maxsim-tools.cjs`) acts as a
lightweight tools router for structured GitHub operations.

### Monorepo Layout

```
maxsimcli/                        ← repo root
├── packages/
│   ├── cli/                      ← main npm package (maxsimcli)
│   │   ├── src/                  ← TypeScript source
│   │   ├── dist/                 ← build output (gitignored)
│   │   ├── scripts/copy-assets.cjs  ← post-build asset bundler
│   │   ├── tsdown.config.ts
│   │   ├── vitest.config.ts
│   │   └── package.json
│   └── website/                  ← maxsimcli.dev (React + Vite + Tailwind)
├── templates/                    ← source templates (copied to dist/ at build time)
│   ├── agents/                   ← 4 agent definitions
│   ├── commands/maxsim/          ← 13 slash commands
│   ├── skills/                   ← 14 skill modules
│   ├── workflows/                ← 18 workflow orchestrators
│   ├── references/               ← reference documents
│   └── rules/                    ← conventions + verification protocol
└── docs/spec/                    ← deep-dive technical specifications (~20k lines)
```

### Technology Stack

| Component  | Technology                                  |
|------------|---------------------------------------------|
| Language   | TypeScript (strict mode, ES2022 target)     |
| Bundler    | tsdown (rolldown-based)                     |
| Testing    | Vitest (unit + E2E)                         |
| Linting    | Biome                                       |
| CI/CD      | GitHub Actions                              |
| Releases   | semantic-release on `main`                  |
| Website    | React + Vite + Tailwind CSS + Framer Motion |

---

## Source Structure

```
packages/cli/src/
├── cli.ts              ← CLI dispatcher (maxsim-tools.cjs entry point) (Note: COMMANDS registry is currently empty — commands will be registered in a future phase)
├── index.ts            ← package re-exports
├── core/
│   ├── types.ts        ← all TypeScript interfaces + const enums (single source)
│   ├── config.ts       ← config load/save/merge, model resolution
│   ├── utils.ts        ← Reserved for future shared utilities (currently empty)
│   ├── version.ts      ← semver constant
│   └── index.ts
├── github/
│   ├── types.ts        ← GitHub-specific types + MAXSIM_LABELS + BOARD_COLUMNS
│   ├── client.ts       ← Octokit singleton, gh CLI wrappers (ghJson, ghExec)
│   ├── issues.ts       ← Issues CRUD + sub-issues
│   ├── projects.ts     ← Projects v2 board management
│   ├── milestones.ts   ← Milestones CRUD with pagination
│   ├── labels.ts       ← label taxonomy enforcement
│   ├── comments.ts     ← HTML comment parsing + formatting
│   └── index.ts
├── hooks/
│   ├── shared.ts                        ← readStdinJson helper, CLAUDE_DIR constant
│   ├── maxsim-statusline.ts             ← statusLine hook
│   ├── maxsim-check-update.ts           ← SessionStart hook
│   ├── maxsim-notification-sound.ts     ← Notification hook
│   ├── maxsim-stop-sound.ts             ← Stop hook (sound)
│   ├── maxsim-capture-learnings.ts      ← Stop hook (agent memory)
│   └── index.ts
└── install/
    ├── index.ts        ← installer entry point (npx maxsimcli)
    ├── copy.ts         ← recursive directory copy, template path resolution
    ├── hooks.ts        ← hook registration in .claude/settings.json
    ├── uninstall.ts    ← clean removal of all installed files
    └── claudemd.ts     ← CLAUDE.md generation for project root
```

---

## Three-Layer Prompt System

When a user types `/maxsim:execute 3`, Claude Code resolves the chain:

```
Layer 1 — COMMAND
  .claude/commands/maxsim/execute.md
  (YAML frontmatter: allowed-tools, argument-hint)
        │
        │  @./workflows/execute.md
        ▼
Layer 2 — WORKFLOW
  .claude/maxsim/workflows/execute.md
  (orchestrator: state machine, gate logic, agent spawn sequences)
        │
        ├── node .claude/maxsim/bin/maxsim-tools.cjs <cmd>  (structured ops)
        │
        └── Agent tool → spawn executor/planner/researcher/verifier
                ▼
Layer 3 — AGENT
  .claude/agents/executor.md  (or planner, researcher, verifier)
  (preloaded skills, tool list, permissionMode)
```

Commands are the only user-facing surface. Workflows are never invoked
directly. Agents are spawned by workflows, not by commands.

### Commands (13)

Located at `templates/commands/maxsim/`:

| Command      | Workflow loaded        | Purpose                                  |
|--------------|------------------------|------------------------------------------|
| `go`         | `go.md`                | Auto-detect project state and dispatch   |
| `init`       | `init.md`              | Initialize project + GitHub structure    |
| `plan`       | `plan.md`              | Plan a phase (Discussion→Research→Plan)  |
| `execute`    | `execute.md`           | Execute a phase with agents + worktrees  |
| `debug`      | `debug.md`             | Systematic debugging flow                |
| `quick`      | `quick.md`             | Single-issue quick task                  |
| `improve`    | `improve.md`           | Autoresearch optimization loop           |
| `fix-loop`   | `fix-loop.md`          | Autonomous error repair loop             |
| `debug-loop` | `debug-loop.md`        | Scientific method bug hunting loop       |
| `security`   | `security.md`          | STRIDE + OWASP + red-team audit          |
| `progress`   | `progress.md`          | Show board status + next recommendation  |
| `settings`   | `settings.md`          | Configure model profile + options        |
| `help`       | `help.md`              | Command reference                        |

### Workflows (18)

Located at `templates/workflows/`. Key workflows:

| Workflow            | Loaded by         | Purpose                              |
|---------------------|-------------------|--------------------------------------|
| `execute.md`        | `/maxsim:execute` | Phase execution state machine        |
| `execute-plan.md`   | `execute.md`      | Per-plan execution, spawns executor  |
| `verify-phase.md`   | `execute.md`      | Phase verification, spawns verifier  |
| `plan.md`           | `/maxsim:plan`    | Planning orchestrator                |
| `plan-discuss.md`   | `plan.md`         | Discussion stage sub-workflow        |
| `plan-research.md`  | `plan.md`         | Research stage, spawns researcher    |
| `plan-create.md`    | `plan.md`         | Plan creation, spawns planner        |
| `go.md`             | `/maxsim:go`      | State detection + dispatch           |
| `init.md`           | `/maxsim:init`    | Project init routing                 |
| `new-project.md`    | `init.md`         | New project setup                    |
| `init-existing.md`  | `init.md`         | Brownfield onboarding                |
| `new-milestone.md`  | `init.md`         | Milestone management                 |
| `quick.md`          | `/maxsim:quick`   | Quick task flow                      |
| `progress.md`       | `/maxsim:progress`| Board status + routing               |
| `debug.md`          | `/maxsim:debug`   | Systematic debugging flow            |
| `health.md`         | internal          | Health checks                        |
| `settings.md`       | `/maxsim:settings`| Interactive configuration            |
| `help.md`           | `/maxsim:help`    | Help reference                       |

---

## GitHub Module

Located at `packages/cli/src/github/`. All GitHub operations go through this
module. The module never writes local state files — GitHub is the single
source of truth.

### client.ts

Provides the Octokit singleton and `gh` CLI wrappers.

- `getOctokit()` — returns a cached `Octokit` instance composed with
  `@octokit/plugin-retry` and `@octokit/plugin-throttling`. Token is
  fetched via `gh auth token` (no hardcoded credentials).
- `getRepoInfo()` — parses `owner`/`repo`/`isOrg` from `git remote get-url origin`.
- `ghJson<T>(args)` — runs a `gh` CLI command, parses stdout as JSON, returns
  `GhResult<T>`. Classifies errors into `NOT_FOUND | UNAUTHORIZED | RATE_LIMITED | FORBIDDEN | VALIDATION | UNKNOWN`.
- `ghExec(args)` — same as `ghJson` but returns raw string stdout.
- `withGhResult<T>(fn)` — wraps an async Octokit call in the same
  `GhResult<T>` discriminated union.
- `resetClient()` — clears the cached Octokit singleton (used in tests).

All functions are synchronous where possible (`ghJson`, `ghExec`), async only
when Octokit's paginate is required.

### issues.ts

Full Issues CRUD plus sub-issues.

- `createIssue`, `getIssue`, `updateIssue`, `closeIssue` — standard REST via Octokit.
- `listIssues` — paginated list of repository issues.
- `listComments(issueNumber)` — paginated with `octokit.paginate`.
- `addComment(issueNumber, body)` — single POST via `octokit.rest.issues.createComment`.
- `addSubIssue(parentNumber, childNumber)` — **uses the internal numeric `.id`
  (not the issue number)** for the `sub_issue_id` parameter. Fetches the
  child's `.id` first, then calls `issues.addSubIssue`. This is the correct
  API: issue number (#42) and internal id are different values.
- `listSubIssues(parentNumber)` — paginated.

### projects.ts

GitHub Projects v2 board management. Uses `gh` CLI for creation and item
management; GraphQL would be required for adding custom single-select field
options (currently flagged with a console warning).

- `createProject`, `listProjects`, `findProject` — via `gh project *` commands.
- `listProjectFields`, `getStatusField`, `getFieldOptionId` — field introspection.
- `addItemToProject` — adds an issue URL to a board via `gh project item-add`.
- `moveItemToStatus` — resolves the option ID for a named column (e.g., "In Progress"),
  then calls `gh project item-edit --single-select-option-id`.
- `ensureProjectBoard` — find-or-create a project and verify columns.

Board columns defined in `github/types.ts`:
```
Backlog → To Do → In Progress → In Review → Done
```

### milestones.ts

Milestone CRUD using `octokit.paginate` for listing.

- `createMilestone`, `updateMilestone`, `findMilestone`, `listMilestones`
- `ensureMilestone` — idempotent find-or-create by title.

### labels.ts

Enforces the 6-label taxonomy defined in `github/types.ts::MAXSIM_LABELS`.

- `ensureLabels` — paginates existing labels, creates any that are missing.
- `getLabel`, `createLabel` — individual label operations.

Label taxonomy (6 labels, 2 namespaces):

| Namespace   | Labels                  |
|-------------|-------------------------|
| `type:`     | phase, task, bug, quick |
| `maxsim:`   | auto, user              |

### comments.ts

Structured metadata embedded in issue bodies and comments as HTML comments,
invisible in the GitHub UI.

Two block types in issue bodies:
- `<!-- maxsim:meta\n...\n-->` — immutable issue metadata (`MaxsimIssueMeta`)
- `<!-- maxsim:state\n...\n-->` — mutable execution state (`MaxsimIssueState`)

One marker type in comments:
- `<!-- maxsim:type=plan phase=3 -->` — comment classification (`MaxsimCommentMeta`)

Exported functions:
- `parseIssueMeta(body)`, `parseIssueState(body)`, `parseCommentMeta(body)`
- `formatIssueMeta(meta)`, `formatIssueState(state)`, `formatCommentHeader(meta)`
- `buildIssueBody(meta, content, state)` — assembles a complete issue body.

---

## Hook System

Five hook scripts compiled by tsdown into `dist/assets/hooks/*.cjs` and
installed to `.claude/maxsim/hooks/` at `npx maxsimcli` time.

| Hook script                    | Event       | Purpose                                      |
|--------------------------------|-------------|----------------------------------------------|
| `maxsim-statusline.cjs`        | statusLine  | Show "MAXSIM ▶ Phase N \| Status" in terminal |
| `maxsim-check-update.cjs`      | SessionStart| Check for newer maxsimcli version on npm     |
| `maxsim-notification-sound.cjs`| Notification| Play sound when Claude asks a question       |
| `maxsim-stop-sound.cjs`        | Stop        | Play sound when Claude finishes              |
| `maxsim-capture-learnings.cjs` | Stop        | Append session commits to MEMORY.md          |

All hooks share `hooks/shared.ts`:
- `CLAUDE_DIR = '.claude'` constant.
- `readStdinJson<T>(callback)` — reads the Claude Code hook JSON payload from
  stdin, parses it, and calls the callback. Never throws.
- `isWindows()` — returns true when running on Windows.
- `isMac()` — returns true when running on macOS.
- `bundledSound(name)` — resolves the absolute path to a bundled sound asset by name.
- `playSound(soundFile)` — plays the given sound file path (cross-platform).

### Registration in settings.json

`install/hooks.ts::installHooks` writes `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [{ "type": "command", "command": "node \"...maxsim-check-update.cjs\"" }] }],
    "Notification":  [{ "hooks": [{ "type": "command", "command": "node \"...maxsim-notification-sound.cjs\"" }] }],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "node \"...maxsim-stop-sound.cjs\"" }] },
      { "hooks": [{ "type": "command", "command": "node \"...maxsim-capture-learnings.cjs\"" }] }
    ]
  },
  "statusLine": { "command": "node \"...maxsim-statusline.cjs\"" },
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" }
}
```

Paths are quoted to handle spaces in directory names (Windows-safe).
Registration is idempotent: the installer checks for existing maxsim command
strings before appending.

### capture-learnings detail

`maxsim-capture-learnings.ts` runs on every `Stop` event:
1. Checks for `.claude/maxsim/config.json` to confirm MaxsimCLI is installed.
2. Runs `git log --oneline -5` in the project directory.
3. Appends a dated entry to `.claude/agent-memory/maxsim-learner/MEMORY.md`,
   creating the directory if absent.
4. Always exits 0 — never blocks the stop event.

---

## Config Schema

Runtime configuration lives at `.claude/maxsim/config.json`.
`core/config.ts::loadConfig` deep-merges it over `DEFAULT_CONFIG` from
`core/types.ts`.

```typescript
interface MaxsimConfig {
  version: string;                    // "6.0.0"
  execution: {
    model_profile: 'quality' | 'balanced' | 'budget';
    parallelism: {
      max_agents_per_wave: number;     // default: 3
      max_retries: number;             // default: 3
      competition_strategy: 'none' | 'quick' | 'standard' | 'deep';
    };
    verification: {
      strict_mode: boolean;            // default: true
      gates: VerificationGate[];       // all 5 gates by default
      require_code_review: boolean;    // default: true
      auto_resolve_conflicts: boolean; // default: true
    };
  };
  worktrees: {
    basePath: string;                  // default: ".maxsim-worktrees/"
    auto_cleanup: boolean;             // default: true
    branch_prefix: string;             // default: "maxsim/"
  };
  automation: {
    auto_commit_on_success: boolean;   // default: true
    conventional_commits: boolean;     // default: true
    co_author: string;                 // default: "Co-Authored-By: Claude <noreply@anthropic.com>"
  };
  github: {
    projectName: string;               // default: ""
    auto_push: boolean;                // default: true
  };
  hooks: {
    enabled: boolean;                  // default: true
  };
}
```

### Model Profiles

Three profiles control which Claude tier is assigned to each agent type:

| Profile  | Planner | Executor | Researcher | Verifier |
|----------|---------|----------|------------|----------|
| quality  | opus    | opus     | sonnet     | opus     |
| balanced | opus    | sonnet   | sonnet     | sonnet   |
| budget   | sonnet  | sonnet   | haiku      | sonnet   |

`core/config.ts::resolveModel(profile, agentType)` returns the model string.

---

## Template System

The `templates/` directory at the monorepo root is the source for everything
that gets installed into a project's `.claude/`. It is never used at runtime
directly — it is copied into `dist/assets/templates/` during the build.

### What gets installed

```
.claude/
├── commands/maxsim/       ← 13 slash commands (from templates/commands/maxsim/)
├── agents/                ← 4 agent definitions + AGENTS.md
├── skills/                ← 14 skill modules (one subdirectory each)
├── rules/                 ← conventions + verification protocol
├── maxsim/
│   ├── bin/
│   │   └── maxsim-tools.cjs  ← compiled CLI dispatcher
│   ├── hooks/             ← 5 compiled hook scripts (*.cjs)
│   ├── workflows/         ← 18 workflow orchestrators
│   ├── references/        ← reference documents
│   ├── templates/         ← reusable content templates
│   └── config.json        ← runtime config (created/updated by /maxsim:settings)
└── agent-memory/          ← per-agent persistent memory (auto-created at runtime)
    └── maxsim-learner/
        └── MEMORY.md
```

### Skills (14)

Located at `templates/skills/`, one subdirectory per skill with a `SKILL.md`.
All follow Anthropic's skill convention: YAML frontmatter with `name` and
`description`, body under 500 lines, no `@` imports.

| Skill                | Type           | Purpose                                          |
|----------------------|----------------|--------------------------------------------------|
| `tdd`                | Technique      | Red-green-refactor cycle                         |
| `systematic-debugging`| Technique     | Reproduce→Hypothesize→Isolate→Verify→Fix→Confirm |
| `brainstorming`      | Technique      | Multi-approach design exploration                |
| `roadmap-writing`    | Technique      | Phase planning with dependencies                 |
| `handoff-contract`   | Infrastructure | Standard output format for agent results         |
| `commit-conventions` | Infrastructure | Conventional commits, atomic changes             |
| `maxsim-batch`       | Technique      | Parallel agent orchestration (batch pattern)     |
| `code-review`        | Technique      | Security, quality, spec-compliance review        |
| `verification`       | Infrastructure | Gate framework, evidence blocks, anti-rationalization |
| `github-operations`  | Infrastructure | Artifact types, comment conventions, CLI guide   |
| `research`           | Technique      | Systematic investigation with source hierarchy   |
| `project-memory`     | Infrastructure | GitHub-native persistence for decisions/learnings|
| `using-maxsim`       | User-facing    | Command reference and routing table              |
| `maxsim-simplify`    | Technique      | Dead code removal, reuse improvement             |

### Agents (4)

Located at `templates/agents/`:

| Agent        | permissionMode | Key preloaded skills                  |
|--------------|----------------|---------------------------------------|
| `executor`   | (default)      | handoff-contract, commit-conventions  |
| `planner`    | `plan`         | handoff-contract, roadmap-writing     |
| `researcher` | (default)      | handoff-contract, research            |
| `verifier`   | (default)      | handoff-contract, verification        |

Agents use proper YAML list syntax in frontmatter (no pipe-table YAML).

---

## Install Process

Entry point: `packages/cli/src/install/index.ts`, compiled to `dist/install.cjs`.

```
npx maxsimcli
  1. Parse args (minimist): --uninstall, --version, --help, --quiet
  2. Detect project dir (process.cwd())
  3. Locate templates: dist/assets/templates/
  4. Copy directories:
       templates/commands   → .claude/commands/
       templates/agents     → .claude/agents/
       templates/skills     → .claude/skills/
       templates/rules      → .claude/rules/
       templates/workflows  → .claude/maxsim/workflows/
       templates/references → .claude/maxsim/references/
       templates/templates  → .claude/maxsim/templates/
  5. Copy CLI binary: dist/cli.cjs → .claude/maxsim/bin/maxsim-tools.cjs
  6. Copy hook scripts: dist/assets/hooks/*.cjs → .claude/maxsim/hooks/
  7. Register hooks in .claude/settings.json (idempotent)
  8. Generate CLAUDE.md in project root
     (project name from package.json or directory name)
     If an existing CLAUDE.md is found without MaxsimCLI content, the installer
     appends the MaxsimCLI section rather than overwriting.
  9. Print summary: file counts, hook list, get-started commands
```

`--uninstall` calls `install/uninstall.ts::uninstall()` which removes
`.claude/commands/maxsim/`, `.claude/agents/`, `.claude/skills/`,
`.claude/rules/`, `.claude/maxsim/`, `.claude/agent-memory/maxsim-learner/`,
strips maxsim entries from `settings.json`, and removes the generated
`CLAUDE.md`.

---

## Build and Release Pipeline

### Build targets

tsdown compiles three separate entry point groups:

| Entry (`src/`)       | Output (`dist/`)          | Usage                          |
|----------------------|---------------------------|--------------------------------|
| `install/index.ts`   | `dist/install.cjs`        | `npx maxsimcli` (package bin)  |
| `cli.ts`             | `dist/cli.cjs`            | Installed as `maxsim-tools.cjs`|
| `hooks/*.ts` (5 files)| `dist/assets/hooks/*.cjs`| Installed to `.claude/maxsim/hooks/` |

All targets: `format: cjs`, `platform: node`, `target: es2022`, `sourcemap: true`.
`@octokit/*` packages are inlined into `dist/cli.cjs` (`noExternal: [/^@octokit/]`).
All build targets use `external: [/^node:/]`. Hook scripts additionally bundle all other imports.

### Post-build

`packages/cli/scripts/copy-assets.cjs` runs after tsdown:
1. Copies `templates/` (monorepo root) → `dist/assets/templates/` (all markdown files).
2. Cleans `.d.cts` declaration files from `dist/assets/hooks/` (tsdown artefact).
3. Copies `CHANGELOG.md` → `dist/assets/CHANGELOG.md`.
4. Copies root `README.md` → `packages/cli/README.md` (for npm tarball).

The published npm package contains both the compiled CJS bundles and the
full template asset tree under `dist/assets/`.

### Release

- Branch: `main`
- Tool: semantic-release, configured in `packages/cli/package.json`
- Commit prefix `feat:` → minor bump, `fix:` → patch, `BREAKING CHANGE` → major
- On release: version bump → npm publish → GitHub Release with changelog

---

## Data Flow: User Command to File Changes

```
User: /maxsim:execute 3

1. Claude reads .claude/commands/maxsim/execute.md
   → loads .claude/maxsim/workflows/execute.md into context

2. Workflow: read phase #3 issue from GitHub
   → gh issue view 3 --json body,labels,milestone

3. Workflow: read sub-issues (task list)
   → node maxsim-tools.cjs listSubIssues 3

4. Workflow: enter Plan Mode (EnterPlanMode)
   → present task breakdown to user for approval

5. User approves (ExitPlanMode)

6. Workflow: spawn executor agents (Agent tool, isolation: worktree)
   → one worktree per task: .maxsim-worktrees/phase-3-task-{id}/
   → branch per task: maxsim/phase-3-task-{id}

7. Each executor agent:
   → reads task issue, implements changes, runs tests/lint/build
   → commits with conventional format
   → posts verification evidence as GitHub comment
   → exits

8. Workflow: spawn verifier agent
   → checks evidence, runs regression guard
   → marks issue status on GitHub Project board

9. Workflow: merge worktrees sequentially into main branch
   → auto-resolve conflicts where possible
   → push to remote

10. Stop hook: maxsim-capture-learnings appends to MEMORY.md
```

All project state — phase status, task breakdown, plans, verification results,
learnings — is stored as GitHub Issues, comments, and Project board columns.
No local state files outside `.claude/`.

---

## Key Implementation Constraints

**GitHub ID types.** Three distinct identifier systems exist in the GitHub API.
Issue `.number` (e.g., `#42`) is the human-readable reference used in URLs.
Issue `.id` is a numeric internal ID used in REST request bodies and, critically,
in the `sub_issue_id` parameter when linking sub-issues. Issue `.nodeId` is a
Base64 string (`PVT_kwDO...`) used exclusively in GraphQL operations. Mixing
these up is the most common source of GitHub API bugs. `github/types.ts` defines
the `IssueIds` interface to keep all three explicit.

**Agent output size.** Bash buffer limits apply when workflows collect agent
output. Outputs over ~50 KB should be written to a temp file and returned as
a file path reference rather than inline stdout.

**Hook exit codes.** Hooks must exit 0 under all circumstances unless they
intend to block the triggering event (exit 2 for TeammateIdle/TaskCompleted
quality gates). All five installed hooks always exit 0 regardless of errors.

**Worktree isolation.** Every executor agent operates in its own git worktree
under `.maxsim-worktrees/{taskId}/` on a dedicated branch
`maxsim/phase-{N}-task-{id}`. This prevents agents from interfering with
each other's file writes during parallel execution.

**settings.json Agent Teams flag.** The installer sets
`env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"` in `.claude/settings.json`
to enable the TeamCreate/SendMessage/TeammateIdle/TaskCompleted hooks that
the workflows rely on for inter-agent coordination.
