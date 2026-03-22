# Git Worktree Strategy for Parallel AI Agent Development

A comprehensive technical reference for using git worktrees to run multiple AI agents simultaneously — covering fundamentals, architecture, merge strategies, conflict resolution, lifecycle management, and MaxsimCLI integration.

---

## Table of Contents

1. [Git Worktree Fundamentals](#1-git-worktree-fundamentals)
2. [Directory Structure for Parallel Worktrees](#2-directory-structure-for-parallel-worktrees)
3. [Branch Naming Conventions](#3-branch-naming-conventions)
4. [How Claude Code's `isolation: "worktree"` Works](#4-how-claude-codes-isolation-worktree-works)
5. [Creating Worktrees Programmatically from Node.js](#5-creating-worktrees-programmatically-from-nodejs)
6. [Merge Strategies](#6-merge-strategies)
7. [Automated Conflict Resolution Strategies](#7-automated-conflict-resolution-strategies)
8. [Post-Merge Verification](#8-post-merge-verification)
9. [Cleanup: Worktrees and Branches After Merge](#9-cleanup-worktrees-and-branches-after-merge)
10. [Performance: Disk Space and Git Operations](#10-performance-disk-space-and-git-operations)
11. [Limitations: Shared Index, Lock Files, Submodules](#11-limitations-shared-index-lock-files-submodules)
12. [Handling Worktree Failures](#12-handling-worktree-failures)
13. [Worktree Lifecycle Management for MaxsimCLI](#13-worktree-lifecycle-management-for-maxsimcli)
14. [GitHub Integration: Push Branches and Create PRs](#14-github-integration-push-branches-and-create-prs)

---

## 1. Git Worktree Fundamentals

A git repository normally has one working tree: the directory you cloned into. `git worktree` extends this model — you can have multiple working trees, each checked out at a different branch, all sharing the single `.git` directory. There is no duplication of git objects. A single `git fetch` in any one worktree synchronizes data for all of them.

### 1.1 Internal Structure

When you add a linked worktree, git creates an administrative record inside the main repository:

```
$GIT_DIR/worktrees/<name>/
  gitdir       → path back to the worktree's .git file
  commondir    → path to the main .git directory
  HEAD         → this worktree's HEAD (not shared)
  index        → this worktree's index/staging area (not shared)
  locked       → (optional) reason the worktree is locked from pruning
```

Inside the worktree directory itself, there is a `.git` file (not a directory) containing a single line: `gitdir: /path/to/main/.git/worktrees/<name>`. This indirection links the worktree back to shared git data.

**What is shared across all worktrees:**
- All refs under `refs/` (except `refs/bisect`, `refs/worktree`, `refs/rewritten`)
- The object database (commits, trees, blobs)
- Repository configuration (`$GIT_DIR/config`)
- Remote definitions

**What is per-worktree (not shared):**
- `HEAD` — each worktree tracks its own current commit/branch
- `index` — the staging area is independent
- `refs/bisect/` and `refs/worktree/` — per-worktree refs
- The working directory files themselves

### 1.2 Core Commands

**`git worktree add`**

```bash
# Add a worktree on an existing branch
git worktree add <path> <branch>

# Add a worktree and create a new branch
git worktree add -b <new-branch> <path> [<start-point>]

# Force-reset the branch if it already exists
git worktree add -B <existing-branch> <path>

# Add in detached HEAD state (useful for read-only or fuzzing work)
git worktree add --detach <path> <commit-ish>

# Add with a lock to prevent automatic pruning
git worktree add --lock <path> -b <new-branch>

# Suppress dependency on remote tracking: guess remote branch
git worktree add --guess-remote <path>
```

Flags of note:
- `--no-checkout`: Creates the worktree directory and metadata but does not populate the working tree. Useful when you want to configure sparse checkout before checkout occurs.
- `--orphan`: Creates a worktree with an unborn branch (empty history). Useful for isolated experiments.

**`git worktree list`**

```bash
# Human-readable list
git worktree list

# Verbose: shows lock reason, prunable status
git worktree list --verbose

# Machine-parseable (for scripts)
git worktree list --porcelain

# NUL-terminated for safe parsing with special characters in paths
git worktree list --porcelain -z
```

Porcelain output format:
```
worktree /absolute/path/to/main
HEAD abc1234...
branch refs/heads/main

worktree /absolute/path/to/feature-worktree
HEAD def5678...
branch refs/heads/feature/auth-revamp
locked reason for locking

worktree /absolute/path/to/stale-worktree
HEAD 999aaaa...
branch refs/heads/old-branch
prunable gitdir file points to non-existent location
```

**`git worktree remove`**

```bash
# Remove a clean worktree (no untracked or modified files)
git worktree remove <path>

# Remove even if there are untracked/modified files
git worktree remove --force <path>

# Remove a locked worktree (requires --force twice)
git worktree remove --force --force <path>
```

The `remove` command deletes the worktree directory and its administrative metadata in `$GIT_DIR/worktrees/`. The branch itself is not deleted — only the checkout.

**`git worktree prune`**

```bash
# Remove stale administrative records for deleted directories
git worktree prune

# Dry run: see what would be pruned without doing it
git worktree prune --dry-run

# Only prune entries older than specified time
git worktree prune --expire 2.weeks.ago
```

If you manually delete a worktree directory (without `git worktree remove`), git retains stale records in `$GIT_DIR/worktrees/`. `prune` detects that the path no longer exists and removes the orphaned metadata. This runs automatically during `git gc`.

**`git worktree lock` / `unlock`**

```bash
# Lock a worktree to prevent accidental pruning (e.g., on removable storage)
git worktree lock --reason "NFS mount in CI" <path>

# Unlock
git worktree unlock <path>
```

**`git worktree move`**

```bash
# Relocate a worktree (updates internal gitdir pointers automatically)
git worktree move <worktree> <new-path>
```

Cannot move the main worktree. Cannot move a worktree that contains submodules. If you move a worktree directory manually without this command, run `git worktree repair` afterward.

**`git worktree repair`**

```bash
# Fix broken connections after manual moves
git worktree repair [<path>...]
```

Use this when:
- You moved the main `.git` directory (e.g., changed repository location): run `repair` in the new main worktree location.
- You moved a linked worktree directory manually: run `repair` inside that linked worktree.
- You moved multiple worktrees at once: run `repair <path1> <path2> ...` from the main worktree.

### 1.3 Per-Worktree Configuration

By default, all worktrees share `$GIT_DIR/config`. To enable per-worktree configuration overrides:

```bash
git config extensions.worktreeConfig true
```

This creates `$GIT_DIR/worktrees/<name>/config.worktree` per linked worktree. The main worktree uses `$GIT_DIR/config.worktree`. Settings in `config.worktree` override shared `config` for that worktree only.

Settings that should be per-worktree (not shared):
- `core.sparseCheckout`
- `core.worktree`

Settings that must never be shared across worktrees:
- `core.bare` (if true)

---

## 2. Directory Structure for Parallel Worktrees

How you lay out worktrees on disk matters for tooling, IDE behavior, and cognitive overhead. Three patterns dominate:

### 2.1 Siblings Pattern (Most Common)

Keep worktrees as sibling directories of the main repository:

```
~/projects/
  myproject/              ← main worktree (.git/ lives here)
    .git/
    src/
    package.json
  myproject-feature-auth/ ← linked worktree
    src/
    package.json
  myproject-fix-123/      ← linked worktree
    src/
    package.json
```

Creation:
```bash
git worktree add ../myproject-feature-auth -b feature/auth
git worktree add ../myproject-fix-123 -b fix/issue-123
```

Pros: Each worktree is a first-class directory; easy to `ls` and see all active work.
Cons: Parent directory gets cluttered with many worktrees on large parallel efforts.

### 2.2 Subdirectory Pattern (Best for AI Agents)

Keep linked worktrees inside a dedicated subdirectory of the main repo:

```
myproject/
  .git/
  .worktrees/             ← add to .gitignore
    agent-auth/
    agent-payments/
    agent-search/
  src/
  package.json
```

Creation:
```bash
mkdir -p .worktrees
git worktree add .worktrees/agent-auth -b agent/auth
git worktree add .worktrees/agent-payments -b agent/payments
```

`.gitignore` entry:
```
.worktrees/
```

Pros: All active worktrees are co-located; version control stays clean; path is predictable for automation scripts.
Cons: IDEs may scan `.worktrees/` and duplicate index entries — configure exclusions (see Section 10).

### 2.3 Bare Repository Pattern (Advanced CI/CD)

Clone as bare, then create worktrees for every branch:

```
myproject.git/            ← bare clone (no working tree)
  HEAD
  config
  objects/
  ...
worktrees/
  main/                   ← worktree on main
  release-1.0/            ← worktree on release/1.0
  feature-auth/           ← worktree on feature/auth
```

Creation:
```bash
git clone --bare git@github.com:org/myproject.git myproject.git
cd myproject.git
git worktree add ../worktrees/main main
git worktree add ../worktrees/feature-auth -b feature/auth
```

Pros: The bare repository is the authoritative source; worktrees are entirely disposable. Ideal for CI/CD runners where each pipeline run gets a fresh worktree.
Cons: Requires more setup; less intuitive for daily development.

### 2.4 Recommended Structure for MaxsimCLI

For MaxsimCLI's parallel agent execution model, the subdirectory pattern inside `.worktrees/` is recommended:

```
<project-root>/
  .git/
  .worktrees/
    phase3-plan1/         ← worktree for agent executing plan 1
    phase3-plan2/         ← worktree for agent executing plan 2
    phase3-plan3/         ← worktree for agent executing plan 3
  .planning/
  src/
  package.json
  .gitignore              ← includes .worktrees/
```

This mirrors the `.planning/` convention already established in MaxsimCLI and keeps all agent workspaces under a single predictable path.

---

## 3. Branch Naming Conventions

Branch names must be unique across all worktrees — git enforces single branch ownership per worktree. A clear naming convention prevents collisions and makes the purpose of each branch immediately obvious.

### 3.1 General Branch Naming Rules

- Use lowercase letters, numbers, and hyphens only
- Use `/` to create namespaced groups (e.g., `feature/`, `fix/`, `agent/`)
- Include an issue or ticket ID when one exists
- Keep total length under 60 characters
- Avoid underscores (some tooling breaks on them in branch names)

### 3.2 Conventional Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New capability | `feature/oauth-login` |
| `fix/` | Bug fix | `fix/gh-312-null-pointer` |
| `hotfix/` | Urgent production fix | `hotfix/broken-deploy` |
| `refactor/` | Code restructuring | `refactor/extract-auth-service` |
| `docs/` | Documentation only | `docs/api-reference` |
| `chore/` | Maintenance tasks | `chore/upgrade-deps` |
| `agent/` | AI agent worktree | `agent/phase3-plan2` |
| `experiment/` | Throwaway exploration | `experiment/new-bundler` |

### 3.3 Naming Conventions for AI Agent Worktrees

When multiple agents run in parallel on a MaxsimCLI phase:

```
agent/<phase>-plan<n>
```

Examples:
```
agent/phase3-plan1
agent/phase3-plan2
agent/phase4-auth-revamp
```

When tracking a GitHub issue:
```
agent/gh-<issue-number>-<short-description>
```

Examples:
```
agent/gh-312-fix-payment-webhook
agent/gh-198-add-csv-export
```

When running a batch of independent tasks:
```
batch/<batch-id>-task-<n>
```

Examples:
```
batch/2026-03-22-task-1
batch/2026-03-22-task-2
```

### 3.4 Branch Uniqueness Enforcement

Git prevents the same branch from being checked out in two worktrees simultaneously. If you attempt `git worktree add .worktrees/foo -b agent/phase3-plan1` when `agent/phase3-plan1` is already checked out elsewhere, git will error:

```
fatal: 'agent/phase3-plan1' is already checked out at '.worktrees/other-dir'
```

Resolution: use a unique suffix, or remove/prune the existing worktree first.

---

## 4. How Claude Code's `isolation: "worktree"` Works

Claude Code has built-in worktree isolation for both interactive sessions and subagents. This section explains the internal mechanics.

### 4.1 The `--worktree` CLI Flag

When you start Claude Code with `claude --worktree <name>`:

1. Claude creates `.claude/worktrees/<name>/` inside the project root
2. Runs `git worktree add .claude/worktrees/<name>/ -b worktree-<name>`
3. The new branch starts from `origin/main` (or the configured default remote branch), not the current local branch
4. Claude's session runs with its working directory set to `.claude/worktrees/<name>/`

All file edits, commits, and test runs happen inside that isolated directory. The main worktree is untouched throughout the session.

```bash
# Equivalent manual setup
git worktree add .claude/worktrees/feature-auth -b worktree-feature-auth origin/main
```

If `<name>` is omitted, Claude generates an auto-identifier (e.g., `worktree-a8f3b`).

### 4.2 `isolation: "worktree"` in Agent Frontmatter

Custom agents in `.claude/agents/` can declare worktree isolation in their YAML frontmatter:

```yaml
---
name: executor
description: Implements a single plan task in isolation
isolation: worktree
model: claude-sonnet-4-5
---
```

When an orchestrator spawns this agent via the `Task` tool, Claude Code automatically:
1. Creates a fresh worktree for that agent invocation
2. Runs the agent inside the worktree
3. On agent completion: if no changes were made, removes the worktree automatically; if changes exist, leaves the worktree for review or further processing

This means each parallel subagent gets an entirely separate copy of the working tree, removing the constraint that parallel agents can only touch non-overlapping files.

### 4.3 Subagent Isolation for Parallel Work

The standard constraint without worktree isolation:

> Parallel sub-agents are limited to reading files or writing to completely non-overlapping paths.

With `isolation: worktree`:

> Each agent has the entire codebase to itself. Agent A can modify `src/auth.ts` while Agent B modifies `src/auth.ts` with a different approach, in a separate worktree, without conflict.

The divergence is resolved when merging branches back to main — at that point, one implementation wins or a manual merge combines both.

### 4.4 Cleanup Behavior

Claude Code's cleanup logic after a worktree session ends:

| State | Action |
|-------|--------|
| No changes made | Worktree and branch removed automatically |
| Uncommitted changes | Claude prompts: keep or discard? |
| Commits exist, not pushed | Claude prompts: keep worktree or push then remove? |
| Branch pushed to remote | Worktree can be safely removed locally |

Add `.claude/worktrees/` to `.gitignore`:
```
.claude/worktrees/
```

### 4.5 Custom `WorktreeCreate` and `WorktreeRemove` Hooks

Teams using non-git VCS (Mercurial, Perforce, Plastic SCM) can override the default behavior with hooks:

```bash
# .claude/hooks/WorktreeCreate.sh
#!/usr/bin/env bash
# Called with: $1=worktree-path $2=branch-name
p4 sync -f //$P4_CLIENT/...@latest
```

This allows the same `isolation: worktree` semantics to work on any VCS.

---

## 5. Creating Worktrees Programmatically from Node.js

MaxsimCLI's `maxsim-tools.cjs` CLI already wraps git operations. Here is the pattern for adding worktree management.

### 5.1 Core Helper

```javascript
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute a git command and return stdout as a string.
 * Throws on non-zero exit.
 */
function git(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    cwd: options.cwd || process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr}`);
  }
  return result.stdout.trim();
}
```

### 5.2 Creating a Worktree

```javascript
/**
 * Create a new worktree at the given path on a new branch.
 * The new branch starts from `startPoint` (default: HEAD).
 */
function createWorktree(worktreePath, branchName, startPoint = 'HEAD') {
  const absPath = path.resolve(worktreePath);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  git(['worktree', 'add', '-b', branchName, absPath, startPoint]);

  return { path: absPath, branch: branchName };
}
```

### 5.3 Listing Worktrees (Parseable)

```javascript
/**
 * Parse `git worktree list --porcelain` output.
 * Returns an array of worktree objects.
 */
function listWorktrees() {
  const raw = git(['worktree', 'list', '--porcelain']);
  const worktrees = [];
  let current = {};

  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current);
      current = { path: line.slice(9), head: null, branch: null, locked: false, prunable: false };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7);
    } else if (line === 'locked') {
      current.locked = true;
    } else if (line.startsWith('locked ')) {
      current.locked = true;
      current.lockReason = line.slice(7);
    } else if (line.startsWith('prunable')) {
      current.prunable = true;
    }
  }
  if (current.path) worktrees.push(current);
  return worktrees;
}
```

### 5.4 Removing a Worktree

```javascript
/**
 * Remove a worktree and optionally delete its branch.
 */
function removeWorktree(worktreePath, { deleteBranch = false, force = false } = {}) {
  const absPath = path.resolve(worktreePath);
  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(absPath);

  git(args);

  if (deleteBranch) {
    // Find branch name from worktree list before removal, or pass it in
    git(['branch', '-d', branchName]); // use -D to force-delete unmerged
  }
}
```

### 5.5 Pruning Stale Worktrees

```javascript
function pruneWorktrees(dryRun = false) {
  const args = ['worktree', 'prune'];
  if (dryRun) args.push('--dry-run');
  return git(args);
}
```

### 5.6 Spawning a Node.js Agent in a Worktree

```javascript
const { spawn } = require('child_process');

/**
 * Run an agent script inside a worktree directory.
 * Returns a Promise that resolves with exit code.
 */
function runAgentInWorktree(worktreePath, agentScript, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [agentScript, ...args], {
      cwd: worktreePath,
      stdio: 'inherit',
      env: { ...process.env, MAXSIM_WORKTREE: worktreePath },
    });
    child.on('exit', resolve);
    child.on('error', reject);
  });
}
```

### 5.7 Parallel Worktree Execution Pattern

```javascript
async function runParallelAgents(plans) {
  const worktreeRoot = path.resolve('.worktrees');
  fs.mkdirSync(worktreeRoot, { recursive: true });

  // Create all worktrees first (sequential to avoid lock contention)
  const worktrees = [];
  for (const plan of plans) {
    const branchName = `agent/phase${plan.phase}-plan${plan.id}`;
    const worktreePath = path.join(worktreeRoot, `plan${plan.id}`);
    createWorktree(worktreePath, branchName);
    worktrees.push({ ...plan, worktreePath, branchName });
  }

  // Install dependencies in parallel if needed
  await Promise.all(worktrees.map(wt =>
    runAgentInWorktree(wt.worktreePath, 'scripts/install-deps.js')
  ));

  // Run agents in parallel
  const results = await Promise.allSettled(worktrees.map(wt =>
    runAgentInWorktree(wt.worktreePath, 'scripts/execute-plan.js', [wt.id])
  ));

  return worktrees.map((wt, i) => ({
    ...wt,
    success: results[i].status === 'fulfilled' && results[i].value === 0,
    exitCode: results[i].value ?? -1,
  }));
}
```

### 5.8 Dependency Duplication: pnpm Workaround

Each worktree needs its own `node_modules`. Use pnpm's global store to avoid duplicating disk space:

```javascript
function installDepsInWorktree(worktreePath) {
  // pnpm uses hard links from a global store — no duplication
  execSync('pnpm install', { cwd: worktreePath, stdio: 'inherit' });
}
```

For npm, symlink `node_modules` from the main worktree if dependencies are identical across worktrees:

```javascript
function symlinkNodeModules(mainPath, worktreePath) {
  const target = path.join(worktreePath, 'node_modules');
  if (!fs.existsSync(target)) {
    fs.symlinkSync(path.join(mainPath, 'node_modules'), target, 'dir');
  }
}
```

**Warning:** Only symlink `node_modules` if you are certain no agent will modify dependencies. If agents run `npm install` with different packages, each needs its own `node_modules`.

---

## 6. Merge Strategies

After parallel agents complete their work, changes from each worktree branch must be integrated back to `main`. The right strategy depends on the nature of the changes and the tolerance for a complex commit history.

### 6.1 Sequential Merge (One at a Time)

The simplest approach: merge worktree branches into `main` one at a time. Each subsequent merge may conflict with earlier merges and must resolve those conflicts before proceeding.

```bash
# Merge plan 1 first
git checkout main
git merge --no-ff agent/phase3-plan1 -m "feat: implement plan 1 (auth)"

# Run tests
npm test

# Merge plan 2 (may conflict with plan 1's changes)
git merge --no-ff agent/phase3-plan2 -m "feat: implement plan 2 (payments)"

# If conflicts appear, resolve them, then continue
# git add <resolved-files>
# git merge --continue
```

**Pros:**
- Simple; each merge is a discrete, reviewable step
- Later merges automatically incorporate earlier changes; no rebasing needed
- `--no-ff` (no fast-forward) preserves branch structure in history

**Cons:**
- Each merge may conflict with all previous merges; conflict surface grows with each step
- Sequential: no parallelism in the merge phase
- Later branches may have stale code (written without knowledge of earlier merged changes)

**When to use:** Small number of parallel branches (2-4) with low file overlap.

### 6.2 Rebase Before Merge

Each worktree branch is rebased onto the current tip of `main` before merging. This replays the branch's commits on top of all previously merged work, resolving conflicts at the branch level rather than at merge time.

```bash
# For each worktree branch, in merge order:
git checkout agent/phase3-plan2
git fetch origin
git rebase origin/main

# Resolve any conflicts that arise during rebase
# git add <resolved-file>
# git rebase --continue

# Now merge cleanly into main
git checkout main
git merge --ff-only agent/phase3-plan2
```

Or equivalently, from `main`:

```bash
git merge --rebase agent/phase3-plan2
```

**Pros:**
- Linear commit history — easier to read with `git log`
- Conflicts surface on the feature branch, not on `main` (main stays stable during the process)
- `--ff-only` guarantees the merge is a fast-forward, keeping history truly linear

**Cons:**
- Rewrites commit hashes — problematic if the worktree branch was already pushed and other people have it
- Rebase of long branches can be tedious to resolve conflict-by-conflict
- Not suitable when commits must preserve exact original authorship metadata

**When to use:** Feature branches with clean commit history, not yet pushed to a shared remote, where linear history is a priority.

### 6.3 Squash Merge

Collapses all commits from the worktree branch into a single commit on `main`. The branch history is not preserved in `main`.

```bash
git checkout main
git merge --squash agent/phase3-plan1
git commit -m "feat(phase3): implement auth revamp (plan 1)"
```

The worktree branch commits disappear from `main`'s history — only the squashed commit appears.

**Pros:**
- `main` history stays clean; each parallel task appears as exactly one commit
- Hides "work in progress" commits (debug prints, partial implementations) that agents often produce
- Simplest to reason about when reviewing history

**Cons:**
- Loses individual commit context from the branch
- After squash-merge, `git branch -d agent/phase3-plan1` may fail (git sees the branch as unmerged, since the commits don't exist in `main`); use `git branch -D` to force-delete
- Can obscure authorship of specific changes

**When to use:** AI agent output that produces many noisy commits; when `main` history cleanliness matters more than preserving every agent commit.

### 6.4 Three-Way Merge (Default `git merge`)

The standard `git merge` performs a three-way merge: it finds the common ancestor of the two branches and combines changes from both sides. This is what happens when you run `git merge` without `--squash`, `--rebase`, or `--ff-only`.

```bash
git checkout main
git merge agent/phase3-plan1
```

Git computes:
1. `base` = last common commit between `main` and `agent/phase3-plan1`
2. `ours` = current tip of `main`
3. `theirs` = tip of `agent/phase3-plan1`

Changes in `theirs` not in `base` are applied to `main`. Changes in `ours` not in `base` are preserved. Where both sides changed the same lines, a conflict is raised.

**Pros:**
- Standard behavior; well-understood
- Correctly handles both sides having diverged
- Merge commit serves as an explicit integration record

**Cons:**
- Merge commits clutter history when integrating many parallel branches
- Conflict resolution can be complex when multiple branches have touched the same files

**When to use:** General-purpose integration; when the explicit merge record is useful for audit purposes.

### 6.5 Octopus Merge (Many Branches at Once)

Git supports merging more than two branches simultaneously. This creates a single merge commit with multiple parents.

```bash
git checkout main
git merge agent/phase3-plan1 agent/phase3-plan2 agent/phase3-plan3
```

Git uses the `octopus` strategy automatically for three or more branches.

**Limitation:** Octopus merge aborts if any conflicts arise — it cannot resolve conflicts. Use only when you are confident all branches are non-conflicting.

```bash
# Validate before merging: check for conflicts with git merge-tree
git merge-tree $(git merge-base main agent/phase3-plan1 agent/phase3-plan2) \
  agent/phase3-plan1 agent/phase3-plan2
```

**When to use:** Multiple fully independent worktrees that touched completely different files. Rare in practice.

### 6.6 Choosing the Right Strategy

| Scenario | Recommended Strategy |
|----------|----------------------|
| Few branches, clean code | Sequential merge with `--no-ff` |
| Want linear history | Rebase onto main, then `--ff-only` merge |
| Noisy agent commits, clean main history matters | Squash merge |
| Large team, audit trail needed | Three-way merge (default) |
| Many branches, provably no file overlap | Octopus merge |
| GitHub PR workflow | Squash-and-merge or Merge commit (via PR settings) |

---

## 7. Automated Conflict Resolution Strategies

Conflicts are inevitable when parallel agents touch overlapping code. Automated strategies reduce manual intervention.

### 7.1 Conflict-First Task Planning (Prevent Before They Occur)

The best conflict resolution strategy is preventing conflicts before they happen:

- Assign each agent tasks that touch **different files or directories**
- Use a task graph that makes file-level dependencies explicit
- Run `clash check` or `git merge-tree` before agents even start work

For MaxsimCLI, the planning phase should generate plans with explicit file ownership annotations that the orchestrator checks before launching parallel agents.

### 7.2 The Clash Tool for Early Detection

[Clash](https://github.com/clash-sh/clash) is a purpose-built tool that detects merge conflicts between worktrees during development, before any merge is attempted.

```bash
npm install -g clash-sh

# Check if a specific file conflicts between all worktree pairs
clash check src/auth.ts

# Show a full conflict matrix for all worktree pairs
clash status

# Machine-readable output for orchestrators
clash status --json

# Real-time monitoring during agent work
clash watch
```

Exit codes:
- `0` — no conflicts detected
- `1` — error (configuration or git issue)
- `2` — conflicts found

Clash uses `git merge-tree` (read-only, no repository modification) to simulate merges between every pair of worktrees, identifying files that would conflict if merged now. Integrate this into the MaxsimCLI orchestrator as a pre-merge gate:

```javascript
const { spawnSync } = require('child_process');

function checkWorktreeConflicts() {
  const result = spawnSync('clash', ['status', '--json'], { encoding: 'utf-8' });
  if (result.status === 2) {
    const data = JSON.parse(result.stdout);
    return { hasConflicts: true, conflicts: data.conflicts };
  }
  return { hasConflicts: false };
}
```

### 7.3 `git rerere` — Reuse Recorded Resolution

`rerere` (Reuse Recorded Resolution) records how you resolved a conflict the first time, then automatically applies the same resolution when the same conflict appears again. Invaluable when re-running failed merges or rebasing repeatedly.

```bash
# Enable globally
git config --global rerere.enabled true

# Or per-repository
git config rerere.enabled true
```

When a conflict occurs and you resolve it, git stores the resolution in `.git/rr-cache/`. The next time the same conflict pattern appears, git applies the stored resolution automatically.

```bash
# Review what rerere is about to apply before committing
git rerere diff

# Clear a stored resolution if it is wrong
git rerere forget <file>
```

### 7.4 Merge Driver Strategies (`-X ours` / `-X theirs`)

For known conflict patterns, specify a preference at merge time:

```bash
# Prefer our (main branch) version for all conflicts
git merge -X ours agent/phase3-plan1

# Prefer their (worktree branch) version for all conflicts
git merge -X theirs agent/phase3-plan1
```

Use `-X ours` when the worktree branch contains additive changes and the main branch has the authoritative version of shared structures (like config files). Use `-X theirs` when the agent's version should always win (rare).

For fine-grained control, define a custom merge driver in `.gitattributes`:

```
# .gitattributes
package-lock.json merge=npm-lock-driver
*.generated.ts merge=ours
```

```ini
# .git/config or ~/.gitconfig
[merge "npm-lock-driver"]
  name = npm lock file merge driver
  driver = node scripts/merge-lock.js %O %A %B %L %P
```

### 7.5 Automated Conflict Resolution Script

For MaxsimCLI's orchestrator, a resolution script that handles common conflict patterns:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');

const CONFLICT_MARKER = '<<<<<<<';

/**
 * Attempt automatic resolution of conflicts in a file.
 * Strategy: prefer "theirs" for generated files, manual for others.
 */
function autoResolveFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(CONFLICT_MARKER)) return 'clean';

  // Auto-resolve generated/lock files by taking "theirs"
  if (filePath.match(/\.(lock|generated\.\w+|snap)$/)) {
    execSync(`git checkout --theirs "${filePath}"`);
    execSync(`git add "${filePath}"`);
    return 'auto-resolved-theirs';
  }

  return 'needs-manual';
}

function resolveAfterMerge() {
  const conflicted = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' })
    .trim().split('\n').filter(Boolean);

  const results = conflicted.map(file => ({ file, result: autoResolveFile(file) }));

  const unresolved = results.filter(r => r.result === 'needs-manual');
  if (unresolved.length > 0) {
    console.error('Manual resolution required for:');
    unresolved.forEach(r => console.error(' -', r.file));
    process.exit(1);
  }

  execSync('git merge --continue --no-edit');
  return results;
}
```

### 7.6 Semantic Conflict Detection

Syntactic conflicts (same lines modified) are caught by git. Semantic conflicts (logically incompatible changes that don't produce text conflicts) require tests. Two agents could each modify a function's callers and callees in ways that are text-compatible but logically broken.

The only reliable detection for semantic conflicts is running the test suite after every merge. See Section 8.

---

## 8. Post-Merge Verification

Merging code that passes no tests is as dangerous as not merging at all. A post-merge verification gate ensures the integrated codebase is functional.

### 8.1 Verification Sequence

After every merge to `main`:

```bash
# 1. Confirm clean working tree
git status

# 2. Run lint
npm run lint

# 3. Run type checking (TypeScript projects)
npm run typecheck

# 4. Run unit tests
npm test

# 5. Run integration tests (if applicable)
npm run test:integration

# 6. Build verification
npm run build
```

Automate this as a script:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Verifying merged state..."

npm run lint && echo "PASS: lint" || { echo "FAIL: lint"; exit 1; }
npm run typecheck && echo "PASS: typecheck" || { echo "FAIL: typecheck"; exit 1; }
npm test && echo "PASS: unit tests" || { echo "FAIL: unit tests"; exit 1; }
npm run build && echo "PASS: build" || { echo "FAIL: build"; exit 1; }

echo "==> Verification complete."
```

### 8.2 Rollback Strategy

If verification fails after a merge:

```bash
# Identify the merge commit
git log --oneline -5

# Revert the merge commit (creates a new commit undoing it)
git revert -m 1 <merge-commit-hash>

# Or hard reset if the merge hasn't been pushed
git reset --hard HEAD~1
```

For MaxsimCLI's orchestrator: record the `HEAD` commit hash before each merge. If verification fails, revert to that hash and flag the offending worktree branch for manual review.

```javascript
async function mergeWithVerification(branchName, verifyFn) {
  const premergeHead = git(['rev-parse', 'HEAD']);

  try {
    git(['merge', '--no-ff', branchName]);
    await verifyFn();
    console.log(`Merged and verified: ${branchName}`);
    return { success: true };
  } catch (err) {
    console.error(`Verification failed after merging ${branchName}:`, err.message);
    // Revert to pre-merge state
    git(['reset', '--hard', premergeHead]);
    return { success: false, error: err.message, branch: branchName };
  }
}
```

### 8.3 Per-Worktree Pre-Merge Verification

Before merging a worktree branch to `main`, verify it independently:

```bash
cd .worktrees/agent-plan1

# Run tests in this worktree's isolated context
npm test

# Check for uncommitted changes (agent may have left partial work)
git status

# Confirm all intended changes are committed
git diff HEAD
```

This catches agent errors (syntax errors, test failures) before they infect `main`.

### 8.4 Integration with MaxsimCLI's Verification System

MaxsimCLI already has a verification step in its execute workflow. The post-merge verification should plug into the same `verify` command/agent that runs after single-plan execution, applied to the merged `main` branch.

---

## 9. Cleanup: Worktrees and Branches After Merge

Leaving stale worktrees and branches accumulates disk space, confuses `git worktree list` output, and creates false signals in branch listings.

### 9.1 Standard Cleanup Sequence

After a worktree branch has been successfully merged (or its PR merged on GitHub):

```bash
# Step 1: Remove the worktree directory and its admin records
git worktree remove .worktrees/agent-plan1

# Step 2: Delete the local branch
git branch -d agent/phase3-plan1
# Use -D if squash-merged (git won't see it as fully merged)
git branch -D agent/phase3-plan1

# Step 3: Delete the remote branch (if pushed)
git push origin --delete agent/phase3-plan1

# Step 4: Prune any remaining stale admin records
git worktree prune

# Step 5: Prune stale remote-tracking refs
git fetch --prune
```

### 9.2 Cleanup Script for All Merged Worktrees

```bash
#!/usr/bin/env bash
# cleanup-worktrees.sh — remove all worktrees for merged branches

set -euo pipefail

MAIN_BRANCH="${1:-main}"
WORKTREE_ROOT=".worktrees"

git fetch --prune

# List merged branches (excluding main)
MERGED_BRANCHES=$(git branch --merged "$MAIN_BRANCH" \
  | grep -v "^\*" \
  | grep -v "$MAIN_BRANCH" \
  | sed 's/^[[:space:]]*//')

for branch in $MERGED_BRANCHES; do
  # Find worktree using this branch
  worktree_path=$(git worktree list --porcelain \
    | awk -v branch="refs/heads/$branch" '
        /^worktree / { current=$2 }
        $0 == "branch " branch { print current }
      ')

  if [[ -n "$worktree_path" ]]; then
    echo "Removing worktree: $worktree_path (branch: $branch)"
    git worktree remove --force "$worktree_path"
  fi

  echo "Deleting branch: $branch"
  git branch -D "$branch"

  # Delete remote branch if it exists
  if git ls-remote --exit-code --heads origin "$branch" &>/dev/null; then
    git push origin --delete "$branch"
  fi
done

git worktree prune
echo "Done."
```

### 9.3 Cleanup After Squash Merge

After squash merge, the original branch commits do not appear in `main`'s history, so `git branch --merged` will NOT list the branch as merged. Use explicit tracking:

```javascript
// Track merged branches in a state file or GitHub PR status
async function cleanupSquashedBranches(mergedBranches) {
  for (const branch of mergedBranches) {
    try {
      git(['branch', '-D', branch]); // -D because not technically "merged"
      git(['push', 'origin', '--delete', branch]);
    } catch (e) {
      console.warn(`Could not delete branch ${branch}:`, e.message);
    }
  }
  git(['worktree', 'prune']);
}
```

### 9.4 Automated Cleanup via Git Aliases

Add to `~/.gitconfig` or `.git/config`:

```ini
[alias]
  cleanup-merged = "!f() { \
    git branch --merged ${1:-main} \
    | grep -v '\\*\\|main\\|master\\|develop' \
    | xargs -r git branch -d; \
    git worktree prune; \
    git fetch --prune; \
  }; f"

  worktrees = "worktree list"
  prunetrees = "worktree prune"
```

---

## 10. Performance: Disk Space and Git Operations

### 10.1 Disk Space Profile

Worktrees share the git object database — the `.git/objects/` directory — so there is zero duplication of git history. What does duplicate per-worktree:

| Item | Duplicated? | Notes |
|------|-------------|-------|
| `.git/objects/` | No | Shared |
| Working tree files (source) | Yes | One copy per worktree |
| `node_modules/` | Yes | Unless symlinked or using pnpm |
| Build artifacts (`dist/`) | Yes | Each worktree builds independently |
| `.git/worktrees/<name>/` | Minimal | ~5KB of metadata |

For a typical 50MB source project with 2GB of `node_modules`, five worktrees cost approximately 10GB of disk without optimization.

**With pnpm:** The global store hard-links packages — five worktrees with identical dependencies cost ~50MB extra (one copy of source files × 5), not 10GB. This is the single biggest disk optimization available.

### 10.2 Git Operation Performance

| Operation | Impact | Notes |
|-----------|--------|-------|
| `git fetch` | Shared | One fetch updates all worktrees |
| `git checkout` | Per-worktree I/O | Linux kernel-sized repo: ~30s per worktree |
| `git status` | Per-worktree | ~80-300ms per worktree on 5k-file repo |
| `git commit` | Per-worktree | Normal speed; object storage is shared |
| `git gc` | Global | Runs once; benefits all worktrees |

Run `git fetch` only once from the main worktree; all linked worktrees then have access to the updated refs.

### 10.3 Filesystem and IDE Considerations

**Inode limits (Linux ext4):**
- ext4 degrades above ~80% inode usage
- Practical limit: 8-12 worktrees before performance impact
- XFS, Btrfs, ZFS: 15-25+ worktrees safely

**IDE indexing:**
IDEs (VS Code, WebStorm) that scan all subdirectories will re-index every worktree directory, causing quadratic performance loss. Configure exclusions:

```json
// .vscode/settings.json
{
  "files.exclude": {
    ".worktrees/**": true,
    ".claude/worktrees/**": true
  },
  "search.exclude": {
    ".worktrees/**": true
  }
}
```

**Symlink non-critical directories** to save inodes:

```bash
# Symlink VS Code config so all worktrees share it
ln -s "$(pwd)/.vscode" .worktrees/agent-plan1/.vscode
```

### 10.4 I/O Parallelism Guidelines

- **CPU-bound git ops** (status, checkout): parallelize to CPU core count
- **Network-bound ops** (fetch, push): limit to 2-4 concurrent
- **Disk-bound ops**: limit to 1-2 concurrent to prevent I/O thrashing

```javascript
const os = require('os');

async function parallelGitOps(worktrees, operation, { maxConcurrent } = {}) {
  const limit = maxConcurrent ?? os.cpus().length;
  const chunks = [];
  for (let i = 0; i < worktrees.length; i += limit) {
    chunks.push(worktrees.slice(i, i + limit));
  }
  for (const chunk of chunks) {
    await Promise.all(chunk.map(wt => operation(wt)));
  }
}
```

### 10.5 Sparse Checkout for Monorepos

In a monorepo, agents often only need a subset of the codebase. Sparse checkout reduces worktree disk usage by 50-70%:

```bash
git worktree add --no-checkout .worktrees/agent-auth -b agent/auth

cd .worktrees/agent-auth
git sparse-checkout set services/auth shared/utils

# Now checkout with only the specified paths
git checkout
```

---

## 11. Limitations: Shared Index, Lock Files, Submodules

### 11.1 Branch Exclusivity

**The core constraint:** A branch can only be checked out in one worktree at a time. Attempting to reuse a branch across worktrees fails with:

```
fatal: '<branch>' is already checked out at '<path>'
```

This means you cannot run two agents on the same branch simultaneously. Each agent must have its own branch.

### 11.2 Lock Files

Git uses lock files (`.lock` suffix) to coordinate concurrent access to shared repository files. In a multi-worktree setup:

- `$GIT_DIR/index.lock` — prevents two operations modifying the index simultaneously
- `$GIT_DIR/refs/heads/<branch>.lock` — prevents concurrent branch updates

These locks are per-operation and typically short-lived. Problems arise when:
1. A process crashes mid-operation, leaving a stale `.lock` file
2. CI/CD systems run multiple git operations in parallel against the same repository

**Stale lock recovery:**
```bash
# Verify no git process is running before removing
ls -la .git/*.lock
rm -f .git/index.lock
```

Never remove lock files while a git process is running — only do so after confirming the repository is idle.

**In practice with worktrees:** Each worktree has its own `index` (not shared), so `index.lock` conflicts between worktrees are rare. The main risk is concurrent operations against the shared `refs/` directory.

### 11.3 Shared Configuration

`$GIT_DIR/config` is shared. If one worktree's process modifies config (e.g., `git config user.email ...`), it affects all worktrees. Use `extensions.worktreeConfig true` to enable per-worktree config when this matters.

### 11.4 Submodules

Submodule support in worktrees is incomplete:

- Submodules work in the main worktree normally
- In linked worktrees, `git submodule update --init` may fail or behave unexpectedly
- `git worktree remove` requires `--force` to remove a worktree with checked-out submodules
- `git worktree move` cannot move worktrees with submodules

**Workaround:** If agents need to work in submodule directories, consider cloning the submodule separately or treating the submodule path as a read-only reference within the worktree.

### 11.5 Hooks

Git hooks in `.git/hooks/` apply to all worktrees (they are part of the shared `.git` directory). There is no per-worktree hook override mechanism in standard git. This means:

- Pre-commit hooks run for all commits in all worktrees
- Post-merge hooks run after merges in any worktree
- Hooks that assume a specific directory structure may fail in a worktree context

**Workaround:** Check `$GIT_COMMON_DIR` vs `$GIT_DIR` in hooks to detect whether you are running in a linked worktree.

### 11.6 Bare Repositories

You cannot add a linked worktree that is bare. The `--orphan` flag creates an empty worktree but not a bare one. If you need bare-repository behavior (e.g., for a deployment target), use a separate bare clone.

### 11.7 `git stash` Is Per-Worktree

Stashes are stored in `refs/stash` which is per-worktree (listed under `refs/worktree/stash` when accessed from another worktree). A stash created in one worktree is not directly accessible from another.

---

## 12. Handling Worktree Failures

Agents crash. Implementations get abandoned. Networks drop mid-push. This section covers every failure mode and its recovery path.

### 12.1 "Already Checked Out" Error

**Symptom:**
```
fatal: '<branch>' is already checked out at '/path/to/worktree'
```

**Cause:** The branch is registered to an existing worktree, either active or stale.

**Diagnosis:**
```bash
git worktree list --porcelain | grep -A3 '<branch>'
```

**Recovery options:**

1. If the existing worktree is still needed: use a different branch name.
2. If the existing worktree is abandoned: remove it first.
   ```bash
   git worktree remove --force /path/to/old-worktree
   git worktree prune
   ```
3. If the directory was deleted manually: prune stale metadata.
   ```bash
   git worktree prune
   # Then retry the add
   ```

### 12.2 Stale Worktree Directory (Manual Deletion)

**Symptom:** Directory is gone, but `git worktree list` still shows it.

**Cause:** Worktree directory deleted without `git worktree remove`.

**Recovery:**
```bash
git worktree prune --dry-run  # Verify what would be pruned
git worktree prune             # Remove stale admin records
```

After pruning, the branch is still available; only the checkout is gone.

### 12.3 Partial Implementation (Agent Crashed Mid-Task)

An agent may commit partial, broken work before crashing. The worktree branch exists with commits that do not pass tests.

**Detection:**
```bash
cd .worktrees/failed-agent
git log --oneline -10  # Review what was committed
npm test               # Confirm failure
```

**Options:**

1. **Resume the agent:** Point a new agent at the same worktree to continue from where the previous one left off. Provide the last successful commit as context.

2. **Abandon and restart:** Reset the branch to the pre-task state, then re-run the agent on a fresh worktree.
   ```bash
   # From main worktree
   git worktree remove --force .worktrees/failed-agent
   git branch -D agent/phase3-plan2
   # Re-create fresh
   git worktree add .worktrees/agent-plan2 -b agent/phase3-plan2 origin/main
   ```

3. **Cherry-pick good commits:** If some commits from the failed agent are good, cherry-pick them to a new branch.
   ```bash
   git cherry-pick <good-commit-hash>
   ```

4. **Salvage via diff:** Export the diff of all changes (even broken ones) for a new agent to use as context.
   ```bash
   git diff origin/main..agent/phase3-plan2 > /tmp/failed-agent.patch
   ```

### 12.4 Corrupted Worktree References

**Symptom:**
```
error: could not read Username for 'https://github.com': No such device or address
# or
fatal: not a git repository: /path/to/.git/worktrees/<name>
```

**Cause:** The `gitdir` file inside the worktree's `.git` file points to a non-existent or moved location.

**Recovery:**
```bash
# From inside the worktree
git worktree repair

# From the main worktree with the path
git worktree repair .worktrees/corrupted-agent
```

If repair fails:
```bash
# Manually update the gitdir file
echo "gitdir: /absolute/path/to/main/.git/worktrees/<name>" > .worktrees/corrupted-agent/.git

# Then repair
cd .worktrees/corrupted-agent && git worktree repair
```

### 12.5 Agent Modified Git Internal Files

**Symptom:** Agent accidentally edited files inside `.git/worktrees/<name>/` or the worktree's `.git` file, corrupting references.

**Recovery:**
```bash
# From the main worktree, check all worktree list output for anomalies
git worktree list --porcelain

# For a corrupted entry, remove and re-add
git worktree remove --force .worktrees/corrupted-agent
git worktree prune
git worktree add .worktrees/fresh-agent -b agent/fresh origin/main
```

**Prevention:** When running agents, set the git directory as read-only or use a wrapper that filters out writes to `.git`:

```bash
# Restrict git internal file writes during agent execution
chmod -R a-w .git/worktrees/agent-plan1
# Remember to restore after
chmod -R u+w .git/worktrees/agent-plan1
```

### 12.6 Recovering Unpushed Commits from a Removed Worktree

If a worktree was removed but contained commits that were never pushed, the commits still exist in git's object store for up to 30 days (controlled by `gc.reflogExpireUnreachable`).

**Recovery:**
```bash
# Find the lost commit in the reflog
git reflog --all | grep <worktree-name>

# Or search by date
git reflog --all --since="2 hours ago"

# Recover to a new branch
git checkout -b recovered-agent <lost-commit-hash>
```

### 12.7 MaxsimCLI Orchestrator: Failure State Machine

```
┌────────────────────────────────────────────────────┐
│              AGENT EXECUTION                       │
│                                                    │
│  [CREATE WORKTREE] → [RUN AGENT] → [VERIFY]       │
│                           │              │         │
│                           │ crash        │ fail    │
│                           ▼              ▼         │
│                    [DETECT FAILURE]─────┘          │
│                           │                        │
│              ┌────────────┼────────────┐           │
│              ▼            ▼            ▼           │
│         [RESUME]    [ABANDON &    [PARTIAL        │
│         (if partial  RETRY FRESH] SALVAGE]        │
│          work exists)                              │
│              │            │            │           │
│              └────────────┴────────────┘           │
│                           │                        │
│                    [CLEANUP WORKTREE]               │
│                    [FLAG FOR REVIEW]               │
└────────────────────────────────────────────────────┘
```

Implement failure metadata in a state file:

```javascript
// .planning/worktree-state.json
{
  "worktrees": [
    {
      "id": "plan2",
      "branch": "agent/phase3-plan2",
      "path": ".worktrees/plan2",
      "status": "failed",
      "failureReason": "test_failure",
      "lastCommit": "abc1234",
      "attempts": 1,
      "createdAt": "2026-03-22T10:00:00Z",
      "failedAt": "2026-03-22T10:45:00Z"
    }
  ]
}
```

---

## 13. Worktree Lifecycle Management for MaxsimCLI

MaxsimCLI's execute workflow spawns agents to implement plans. When executing multiple plans in parallel, each agent should run in its own worktree. This section defines the full lifecycle.

### 13.1 Phase Execution Lifecycle

```
PHASE START
    │
    ├─ Load plans from GitHub Issues
    ├─ Identify independent plans (no interdependencies)
    ├─ Run clash status to check for known file conflicts
    │
    ├─ [FOR EACH INDEPENDENT PLAN IN PARALLEL]
    │       ├─ Create worktree: .worktrees/phase<N>-plan<id>
    │       ├─ Create branch: agent/phase<N>-plan<id>
    │       ├─ Symlink node_modules if dependencies are identical
    │       ├─ Launch subagent with isolation: worktree
    │       ├─ Agent implements plan, commits changes
    │       └─ Agent runs unit tests, reports result
    │
    ├─ Collect results from all agents
    ├─ Sort by merge order (resolve dependency order)
    │
    ├─ [FOR EACH COMPLETED AGENT IN ORDER]
    │       ├─ Merge strategy selection:
    │       │     - Has many noisy commits? → squash merge
    │       │     - Clean history needed? → rebase + ff merge
    │       │     - Default → no-ff merge
    │       ├─ Run post-merge verification suite
    │       ├─ If verification fails: revert, flag for retry
    │       └─ If verification passes: proceed to next
    │
    ├─ Run full integration test suite on merged main
    ├─ Cleanup: remove worktrees and branches for merged plans
    ├─ Push main to remote
    │
PHASE END
```

### 13.2 Worktree Naming Convention for MaxsimCLI

```
.worktrees/
  phase<phase-number>-plan<plan-id>/
```

Examples:
```
.worktrees/phase3-plan1/
.worktrees/phase3-plan2/
.worktrees/phase4-plan1/
```

Branch names:
```
agent/phase3-plan1
agent/phase3-plan2
agent/phase4-plan1
```

### 13.3 Agent Configuration for Parallel Execution

In `.claude/agents/executor.md`:

```yaml
---
name: executor
description: Implements a single MaxsimCLI plan in an isolated worktree
isolation: worktree
model: claude-sonnet-4-5
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

You are a MaxsimCLI executor agent. You implement a single plan from the current phase.
Work only within your assigned scope. Do not modify files outside the plan's defined scope.
After implementing, run `npm test` and report the result.
```

### 13.4 Orchestrator Integration Points

The MaxsimCLI `execute-plan.md` workflow should include:

**Before spawning agents:**
```bash
# Create the worktree
node maxsim-tools.cjs worktree:create --phase $PHASE --plan $PLAN_ID

# Check for conflicts with existing worktrees
node maxsim-tools.cjs worktree:check-conflicts
```

**After agents complete:**
```bash
# Merge in dependency order
node maxsim-tools.cjs worktree:merge --phase $PHASE --strategy squash

# Verify
node maxsim-tools.cjs verify --post-merge

# Cleanup
node maxsim-tools.cjs worktree:cleanup --phase $PHASE
```

### 13.5 `maxsim-tools.cjs` Worktree Commands to Implement

| Command | Purpose |
|---------|---------|
| `worktree:create` | Create worktree for a plan |
| `worktree:list` | List all active MaxsimCLI worktrees |
| `worktree:status` | Show status of each worktree (clean/dirty/failed) |
| `worktree:merge` | Merge worktree branches back to main |
| `worktree:check-conflicts` | Run clash-style conflict detection |
| `worktree:cleanup` | Remove merged worktrees and branches |
| `worktree:recover` | Attempt recovery of a failed worktree |
| `worktree:prune` | Remove stale worktree metadata |

### 13.6 State Persistence

Worktree lifecycle state should be persisted in `.planning/worktree-state.json` so the orchestrator can resume after interruption:

```json
{
  "phase": 3,
  "worktrees": [
    {
      "planId": "plan1",
      "branch": "agent/phase3-plan1",
      "path": ".worktrees/phase3-plan1",
      "status": "merged",
      "mergeStrategy": "squash",
      "mergeCommit": "abc1234",
      "verificationPassed": true
    },
    {
      "planId": "plan2",
      "branch": "agent/phase3-plan2",
      "path": ".worktrees/phase3-plan2",
      "status": "pending-merge",
      "agentResult": "success",
      "lastAgentCommit": "def5678"
    },
    {
      "planId": "plan3",
      "branch": "agent/phase3-plan3",
      "path": ".worktrees/phase3-plan3",
      "status": "failed",
      "failureReason": "agent_crash",
      "attempts": 1
    }
  ]
}
```

---

## 14. GitHub Integration: Push Branches and Create PRs

For teams using GitHub as the integration point, each worktree branch becomes a pull request rather than a direct merge to `main`.

### 14.1 Push a Worktree Branch

```bash
cd .worktrees/agent-plan1

# Push worktree branch to remote
git push -u origin agent/phase3-plan1

# Or from the main worktree
git push origin agent/phase3-plan1
```

### 14.2 Create a PR with `gh`

```bash
gh pr create \
  --head agent/phase3-plan1 \
  --base main \
  --title "feat(phase3): implement auth revamp (plan 1)" \
  --body "$(cat <<'EOF'
## Summary
- Implements plan 1 from phase 3
- Adds OAuth2 login flow
- Updates user session management

## Changes
- `src/auth/oauth.ts` — OAuth2 client implementation
- `src/middleware/session.ts` — Session validation middleware
- `tests/auth.test.ts` — Unit tests for OAuth flow

## Verification
- All unit tests pass
- Lint: no errors
- TypeScript: no errors

Generated by MaxsimCLI executor agent.
EOF
)" \
  --label "agent-generated" \
  --label "phase-3"
```

### 14.3 Automated PR Creation per Worktree

```javascript
const { execSync } = require('child_process');

async function createPRForWorktree(worktree, phase, planId) {
  const { branch, path: worktreePath } = worktree;

  // Get a summary of changes
  const diffStat = git(['diff', '--stat', `origin/main...${branch}`]);
  const commitMessages = git(['log', '--oneline', `origin/main..${branch}`]);

  const body = `## Summary

Generated by MaxsimCLI executor agent — Phase ${phase}, Plan ${planId}.

## Changes

\`\`\`
${diffStat}
\`\`\`

## Commits

\`\`\`
${commitMessages}
\`\`\`

## Verification Status

Agent-reported: tests passing at time of commit.
`;

  const result = execSync([
    'gh pr create',
    `--head ${branch}`,
    `--base main`,
    `--title "feat(phase${phase}): plan ${planId}"`,
    `--body "${body.replace(/"/g, '\\"')}"`,
    '--label agent-generated',
  ].join(' '), { encoding: 'utf-8' });

  const prUrl = result.trim();
  return prUrl;
}
```

### 14.4 Merging PRs via `gh`

Once a PR is reviewed and approved:

```bash
# Squash and merge
gh pr merge <PR_NUMBER> --squash --delete-branch

# Standard merge commit
gh pr merge <PR_NUMBER> --merge --delete-branch

# Rebase merge
gh pr merge <PR_NUMBER> --rebase --delete-branch
```

`--delete-branch` automatically deletes the remote branch after merge.

After the remote branch is deleted, clean up locally:

```bash
git fetch --prune                        # Removes remote-tracking ref
git worktree remove .worktrees/agent-plan1
git branch -D agent/phase3-plan1
```

### 14.5 Checking Out a PR Locally for Review

```bash
# Using gh (creates a worktree for the PR branch)
gh pr checkout 42

# Or manually
git worktree add .worktrees/pr-42 -b review/pr-42 origin/agent/phase3-plan1
```

The `@johnlindquist/worktree` npm package provides a `wt pr <number>` shorthand that does exactly this.

### 14.6 GitHub Actions Integration

When worktree branches are pushed, trigger CI on each:

```yaml
# .github/workflows/agent-branch-ci.yml
name: Agent Branch CI

on:
  push:
    branches:
      - 'agent/**'
      - 'batch/**'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const status = '${{ job.status }}';
            const body = status === 'success'
              ? '✅ All checks passed on this agent branch.'
              : '❌ CI failed. Review required before merge.';
            const prs = await github.rest.pulls.list({
              owner: context.repo.owner,
              repo: context.repo.repo,
              head: `${context.repo.owner}:${context.ref.replace('refs/heads/', '')}`,
            });
            if (prs.data.length > 0) {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: prs.data[0].number,
                body,
              });
            }
```

### 14.7 Auto-Merge After CI Passes

For fully automated workflows where PR review is not required:

```bash
# Enable auto-merge on PR creation
gh pr merge <PR_NUMBER> --auto --squash --delete-branch
```

GitHub will automatically squash-merge the PR once all required status checks pass.

---

## Summary Reference

### Quick Command Reference

```bash
# Create
git worktree add .worktrees/agent-plan1 -b agent/phase3-plan1 origin/main

# List
git worktree list --porcelain

# Remove
git worktree remove .worktrees/agent-plan1
git branch -D agent/phase3-plan1
git push origin --delete agent/phase3-plan1

# Prune stale
git worktree prune
git fetch --prune

# Repair corrupted
git worktree repair

# Recover stale branch from reflog
git reflog --all | grep agent/phase3-plan1
git checkout -b recovered-plan1 <commit-hash>

# Merge strategies
git merge --no-ff agent/phase3-plan1          # Standard merge commit
git merge --squash agent/phase3-plan1         # Squash to single commit
git rebase origin/main && git merge --ff-only # Rebase then fast-forward

# GitHub
gh pr create --head agent/phase3-plan1 --base main
gh pr merge 42 --squash --delete-branch
```

### Decision Matrix: Merge Strategy

| Condition | Strategy |
|-----------|----------|
| Clean single-commit agent output | `--ff-only` after rebase |
| Many noisy agent commits | `--squash` |
| Need explicit merge record | `--no-ff` (default) |
| All branches touch different files | Octopus merge |
| GitHub PR workflow | Squash-and-merge via `gh pr merge` |
| Any merge fails verification | `git reset --hard <pre-merge-sha>` |

### MaxsimCLI Worktree Root

```
.worktrees/               ← listed in .gitignore
  phase<N>-plan<id>/      ← worktree directory per agent
```

Branch pattern: `agent/phase<N>-plan<id>`

---

*Sources consulted for this guide:*

- [git-worktree official documentation](https://git-scm.com/docs/git-worktree)
- [Git Worktrees: The Secret Weapon for Running Multiple AI Coding Agents in Parallel](https://medium.com/@mabd.dev/git-worktrees-the-secret-weapon-for-running-multiple-ai-coding-agents-in-parallel-e9046451eb96)
- [Using Git Worktrees for Multi-Feature Development with AI Agents](https://www.nrmitchi.com/2025/10/using-git-worktrees-for-multi-feature-development-with-ai-agents/)
- [How Git Worktrees Changed My AI Agent Workflow — Nx Blog](https://nx.dev/blog/git-worktrees-ai-agents)
- [Git Worktrees for AI Coding: Run Multiple Agents in Parallel](https://dev.to/mashrulhaque/git-worktrees-for-ai-coding-run-multiple-agents-in-parallel-3pgb)
- [Parallel Workflows: Git Worktrees and the Art of Managing Multiple AI Agents](https://medium.com/@dennis.somerville/parallel-workflows-git-worktrees-and-the-art-of-managing-multiple-ai-agents-6fa3dc5eec1d)
- [Mastering Git Worktrees with Claude Code for Parallel Development Workflow](https://medium.com/@dtunai/mastering-git-worktrees-with-claude-code-for-parallel-development-workflow-41dc91e645fe)
- [Git Worktrees: From Running Multiple Agents to Real Multi-Agent Development](https://vibehackers.io/blog/git-worktrees-multi-agent-development)
- [Parallel AI Coding with Git Worktrees and Custom Claude Code Commands](https://docs.agentinterviews.com/blog/parallel-ai-coding-with-gitworktrees/)
- [Claude Code Worktrees: Run Parallel Sessions Without Conflicts](https://claudefa.st/blog/guide/development/worktree-guide)
- [Worktrees: Parallel Agent Isolation — Agent Factory](https://agentfactory.panaversity.org/docs/General-Agents-Foundations/general-agents/worktrees)
- [Clash: Avoid merge conflicts across git worktrees for parallel AI coding agents](https://github.com/clash-sh/clash)
- [Agent Teams or: How I Learned to Stop Worrying About Merge Conflicts and Love Git Worktrees](https://engineering.intility.com/article/agent-teams-or-how-i-learned-to-stop-worrying-about-merge-conflicts-and-love-git-worktrees)
- [Performance Optimization for Git Worktrees — Git Cheat Sheet](https://gitcheatsheet.dev/docs/advanced/worktrees/performance/)
- [Disk Space Management for Git Worktrees — Git Cheat Sheet](https://gitcheatsheet.dev/docs/advanced/worktrees/disk-space-management/)
- [Git Worktree Isolation in Claude Code: Parallel Development Without the Chaos](https://medium.com/@richardhightower/git-worktree-isolation-in-claude-code-parallel-development-without-the-chaos-262e12b85cc5)
- [Git worktree already checked out: Safe Recovery Fix Guide](https://devtoolbox.dedyn.io/blog/git-worktree-already-checked-out-fix-guide)
- [Git Worktree Best Practices and Tools (Christopher Allen)](https://gist.github.com/ChristopherA/4643b2f5e024578606b9cd5d2e6815cc)
- [Git merge strategy options — Atlassian](https://www.atlassian.com/git/tutorials/using-branches/merge-strategy)
- [Merge Strategies and Squash Merge — Microsoft Learn](https://learn.microsoft.com/en-us/azure/devops/repos/git/merging-with-squash?view=azure-devops)
- [Isolated Subagents: Running Claude Code in parallel with Neon Database Branching](https://neon.com/guides/isolated-subagents-neon-branching)
- [Git Worktree Tutorial — DataCamp](https://www.datacamp.com/tutorial/git-worktree-tutorial)
