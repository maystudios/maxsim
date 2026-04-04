<purpose>
Full initialization for a new project. Takes a repo from zero to a GitHub-tracked MAXSIM project with a config, labels, project board, and optional initial roadmap. Proceeds in five phases: scan (if code exists), interview, GitHub setup, local setup, roadmap.

> **GitHub-only:** All state lives on GitHub. No local `.planning/` directory.
</purpose>

<process>

## Phase 1: Prerequisites Gate

Before any user interaction, verify GitHub is accessible.

```bash
gh auth status 2>/dev/null && echo "AUTH_OK" || echo "AUTH_FAIL"
git remote get-url origin 2>/dev/null && echo "REMOTE_OK" || echo "REMOTE_FAIL"
```

**If AUTH_FAIL:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► GITHUB CLI NOT AUTHENTICATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAXSIM requires GitHub CLI authentication.

Fix: gh auth login

Then re-run /maxsim:init.
```

Stop. Do not proceed.

**If REMOTE_FAIL:**

Use `AskUserQuestion` to ask:

"No GitHub remote found. Would you like me to create a private GitHub repository for this project?"

- **If yes:** Determine the project name from the directory name or `package.json` name field. Run:
  ```bash
  gh repo create {project_name} --private --source=. --remote=origin --push
  ```
  Verify the remote was created: `git remote get-url origin`
  If creation fails, show the error and display the manual setup instructions below.

- **If no:** Display:
  ```
  To set up manually:
    Create a new repo:   gh repo create --private
    Link existing repo:  git remote add origin <url>
  Then re-run /maxsim:init.
  ```
  Stop. Do not proceed.

Call `EnterPlanMode` immediately after verifying prerequisites. All scanning and GitHub setup happens within Plan Mode. Call `ExitPlanMode` only after the user approves the complete initialization plan.

## Phase 2: Scan (if code exists)

Check for existing code:

```bash
HAS_CODE=$(find . -maxdepth 2 -not -path './.git/*' -not -name '.gitignore' -type f 2>/dev/null | head -5 | wc -l)
```

If `HAS_CODE > 0`, spawn parallel Research agents to analyze the repo. Use the Agent tool with `isolation: "worktree"` and `run_in_background: true`.

Spawn these agents simultaneously (adjust count to repo size, 5–10 agents):

**Agent 1 — README and docs:**
Prompt: "Read the README.md, CONTRIBUTING.md, and any docs/ directory in this repo. Summarize: project purpose, target users, key features described, setup instructions, and any stated non-goals. Return a JSON object with keys: purpose, target_users, key_features (array), stack_mentioned (array), non_goals (array)."

**Agent 2 — Package manifest and dependencies:**
Prompt: "Read package.json, pyproject.toml, Cargo.toml, go.mod, or equivalent manifest files in this repo. Summarize: project name, version, runtime dependencies (top 10), dev dependencies (top 10), defined scripts/tasks. Return JSON with keys: project_name, version, runtime_deps (array), dev_deps (array), scripts (object)."

**Agent 3 — CI/CD configuration:**
Prompt: "Read .github/workflows/, .circleci/, .gitlab-ci.yml, Jenkinsfile, or equivalent CI config in this repo. Summarize: CI provider, workflow triggers, test commands, build commands, deploy targets. Return JSON with keys: ci_provider, triggers (array), test_commands (array), build_commands (array), deploy_targets (array)."

**Agent 4 — Test setup:**
Prompt: "Find test files in this repo (*.test.*, *.spec.*, tests/, __tests__/). Summarize: test framework(s) used, approximate test count, test coverage tooling if any, test patterns observed. Return JSON with keys: frameworks (array), approx_test_count, coverage_tool, patterns (array)."

**Agent 5 — File structure and architecture:**
Prompt: "List the top-level directories and key files in this repo (exclude .git, node_modules, vendor). Identify the architectural pattern: monorepo, monolith, microservices, library, CLI tool, etc. Return JSON with keys: top_level_dirs (array), architecture_pattern, entry_points (array), config_files (array)."

**Agents 6–10 (spawn if repo is large or complex):**

**Agent 6 — Linting and formatting:**
Prompt: "Read .eslintrc*, .prettierrc*, pyproject.toml [tool.ruff], .rubocop.yml, or equivalent lint/format config. Summarize: linter, formatter, key rules enforced. Return JSON with keys: linter, formatter, key_rules (array)."

**Agent 7 — Environment and secrets:**
Prompt: "Read .env.example, .env.sample, or any documented environment variable files (do NOT read actual .env files). List all required environment variables and their purpose. Return JSON with keys: env_vars (array of {name, purpose})."

**Agent 8 — Database and data layer:**
Prompt: "Look for ORM configs, migration files, schema files, or database connection setup in this repo. Summarize: database type, ORM/query builder, migration tool, schema highlights. Return JSON with keys: db_type, orm, migration_tool, schema_notes."

**Agent 9 — Deployment and infrastructure:**
Prompt: "Look for Dockerfile, docker-compose.yml, Kubernetes manifests, Terraform, CDK, or serverless configs. Summarize: containerization approach, orchestration, cloud provider, infrastructure-as-code tool. Return JSON with keys: containerized, orchestration, cloud_provider, iac_tool."

**Agent 10 — Open issues and tech debt:**
Prompt: "Search for TODO, FIXME, HACK, and DEPRECATED comments across source files. List the top 10 by frequency of occurrence. Also check if there are open GitHub issues via: node .claude/maxsim/bin/maxsim-tools.cjs github list-issues --state open. Return JSON with keys: todo_hotspots (array of {file, count}), open_issues (array of {number, title})."

After all agents complete, synthesize their JSON outputs into a single findings object. This feeds into the interview phase to pre-fill answers and skip redundant questions.

## Phase 3: Interview

Use AskUserQuestion to gather project context. Maximum 4 questions per call. Skip any question for which the scan already produced a confident answer.

**Batch 1 — Core identity (always ask):**

Use AskUserQuestion:
- header: "New Project Setup (1/3)"
- questions:
  1. "What is the project name?" (prefill from scan: `project_name` if found)
  2. "Describe the project in one sentence — what does it do and for whom?"
  3. "What are the 3 most important goals for this project?" (freeform)
  4. "What is the primary tech stack?" (prefill from scan: `stack_mentioned` if found)

**Batch 2 — Conventions and constraints:**

Use AskUserQuestion:
- header: "New Project Setup (2/3)"
- questions:
  1. "What testing strategy will you use? (unit, integration, e2e, TDD, etc.)" (prefill from scan if found)
  2. "What are the coding conventions or style rules to enforce?" (prefill from scan lint findings)
  3. "What are the acceptance criteria for the first milestone?" (freeform)
  4. "What are the explicit no-gos — things MAXSIM agents must never do?" (freeform)

**Batch 3 — Optional context:**

Use AskUserQuestion:
- header: "New Project Setup (3/3)"
- questions:
  1. "Are there any external APIs or services this project depends on?" (prefill from scan env_vars if found)
  2. "Any additional context agents should know? (team size, deadlines, constraints)" (freeform, optional)

Collect and store all answers as `PROJECT_CONTEXT`.

## Phase 4: GitHub Setup

Execute in sequence:

**4a. Ensure labels:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github ensure-labels
```

This creates the standard MAXSIM label set (type:phase, type:task, type:bug, type:quick, maxsim:auto, maxsim:user).

**4b. Create GitHub Project Board:**

```bash
REPO=$(gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"')
OWNER=$(gh repo view --json owner -q '.owner.login')
PROJECT_NAME="{project_name} — MAXSIM"

gh project create --owner "$OWNER" --title "$PROJECT_NAME"
```

Capture the project number from the output.

**4c. Store project board number in config:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github set-project --project-number {PROJECT_NUMBER}
```

**4d. Create initial milestone:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github create-milestone \
  --title "Milestone 1 — {project_name}" \
  --description "Initial milestone created by MAXSIM"
```

## Phase 5: Local Setup

**5a. Write .claude/maxsim/config.json:**

Create `.claude/maxsim/config.json` with:

```json
{
  "version": "6",
  "project_name": "{project_name}",
  "description": "{one_sentence_description}",
  "tech_stack": ["{stack items}"],
  "testing_strategy": "{testing_strategy}",
  "conventions": "{conventions}",
  "no_gos": ["{no_go items}"],
  "acceptance_criteria": "{acceptance_criteria}",
  "github": {
    "repo": "{owner/repo}",
    "project_number": {PROJECT_NUMBER},
    "milestone_number": {MILESTONE_NUMBER}
  },
  "initialized_at": "{ISO timestamp}"
}
```

**5b. Write or update CLAUDE.md:**

Add the project context to the project root `CLAUDE.md` directly (CLAUDE.md generation is handled automatically by `npx maxsim` during installation). If CLAUDE.md already exists, append the MAXSIM context section.

**5c. Commit initialization files:**

```bash
git add .claude/
git commit -m "chore: initialize MAXSIM v6"
```

Call ExitPlanMode after committing initialization files.

## Phase 6: Roadmap (Optional)

Use AskUserQuestion:
- header: "Initial Roadmap"
- question: "Would you like to create an initial roadmap now? I'll generate phase issues on GitHub based on your project goals."
- options:
  - "Yes, create roadmap" — create phase issues
  - "No, I'll plan phases later with /maxsim:plan" — skip

**If "No":** Print the completion message below and exit.

**If "Yes":**

Use the Agent tool with `run_in_background: false` to spawn a single Roadmap agent with this prompt:

"You are creating an initial GitHub roadmap for a MAXSIM v6 project. The project details are:

Name: {project_name}
Description: {description}
Goals: {goals}
Tech stack: {tech_stack}
Acceptance criteria: {acceptance_criteria}

Create 3–7 phase GitHub Issues on the repo {owner/repo}. Each phase issue should:
1. Have title format: 'Phase N: {phase_name}'
2. Have label 'phase:{N}'
3. Have a body describing the phase goal and 5–10 acceptance criteria as a task list (- [ ] item)
4. Be added to milestone #{MILESTONE_NUMBER}

Use: node .claude/maxsim/bin/maxsim-tools.cjs github create-phase --phase-number N --title '{name}' --body '{body}' --milestone-number {MILESTONE_NUMBER} --project-number {PROJECT_NUMBER}

Set each issue status to 'To Do' on the board using:
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number {N} --status 'To Do'

Return the list of created issue numbers and titles."

After the agent completes, display the phase list.

## Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► PROJECT INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project:   {project_name}
GitHub:    {owner/repo}
Board:     {project_name} — MAXSIM (#{PROJECT_NUMBER})
Milestone: Milestone 1 (#{MILESTONE_NUMBER})
Phases:    {N} phases created (or "none yet")

Next step: /maxsim:go
```

</process>

<constraints>
- Tool name is Agent (NOT Task)
- No SlashCommand tool
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for CLI operations
- EnterPlanMode must be called immediately after Phase 1 prerequisites pass; ExitPlanMode must be called after the user approves the complete initialization plan (after the Phase 5 commit)
- Agent spawning uses: Agent tool with isolation:"worktree", run_in_background:true (for parallel research) or run_in_background:false (for sequential work)
- Self-contained agent prompts — include all context the agent needs inline
- Maximum 4 questions per AskUserQuestion call
- Skip interview questions already answered by scan findings
- Do not read actual .env files — only .env.example or documented equivalents
</constraints>
