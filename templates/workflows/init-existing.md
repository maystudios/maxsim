<purpose>
Initialize MAXSIM in an existing project with code. Performs a deep parallel codebase scan first, synthesizes findings, confirms with the user, then proceeds with GitHub setup and config. GitHub Issues are the sole source of truth — no local .planning/ directory is created or referenced.
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

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► NO GITHUB REMOTE FOUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAXSIM requires a GitHub remote to track phases as Issues.

Fix: git remote add origin <url>

Then re-run /maxsim:init.
```

Stop. Do not proceed.

Call `EnterPlanMode` immediately after verifying prerequisites. All scanning and GitHub setup happens within Plan Mode. Call `ExitPlanMode` only after the user approves the complete initialization plan.

## Phase 2: Deep Codebase Scan

Print immediately:

```
Scanning existing codebase...
```

Spawn 10+ parallel Research agents to deeply analyze the codebase. Use the Agent tool with `isolation: "worktree"` and `run_in_background: true` for all agents simultaneously.

**Agent 1 — Architecture overview:**
Prompt: "Analyze the top-level structure of this repository. List all top-level directories (exclude .git, node_modules, vendor, dist, build). Identify the architectural pattern: monorepo, monolith, microservices, library, CLI tool, web app, mobile app, or hybrid. Identify the primary entry point(s). Return JSON with keys: top_level_dirs (array), architecture_pattern (string), entry_points (array), notable_structure_notes (string)."

**Agent 2 — Language and framework detection:**
Prompt: "Detect all programming languages used in this repository (by file extension frequency). Identify the primary framework(s): React, Vue, Express, Django, Rails, Spring, etc. Read package.json, pyproject.toml, Cargo.toml, go.mod, pom.xml, or equivalent manifest. Return JSON with keys: primary_language (string), secondary_languages (array), frameworks (array), runtime_version (string), project_name (string), project_version (string)."

**Agent 3 — Dependency analysis:**
Prompt: "Read the package manifest (package.json, requirements.txt, pyproject.toml, Cargo.toml, go.mod, etc.). List the top 15 production dependencies and top 10 dev dependencies. Flag any dependencies that are outdated, deprecated, or have known security advisories if detectable from lock files. Return JSON with keys: prod_deps (array of {name, version}), dev_deps (array of {name, version}), flags (array of {name, issue})."

**Agent 4 — Test coverage and quality:**
Prompt: "Find all test files in this repository (*.test.*, *.spec.*, tests/, __tests__/, spec/). Count them. Identify the test framework(s). Look for coverage config or reports. Check if tests are passing by reading CI status files or recent CI output if present. Return JSON with keys: test_file_count (number), test_frameworks (array), coverage_tool (string or null), coverage_percent (number or null), test_patterns (array), test_quality_notes (string)."

**Agent 5 — CI/CD pipeline:**
Prompt: "Read .github/workflows/, .circleci/config.yml, .gitlab-ci.yml, Jenkinsfile, .travis.yml, or equivalent CI config. Identify all workflow triggers, jobs, test commands, build commands, and deployment targets. Note any broken or disabled workflows. Return JSON with keys: ci_provider (string), workflows (array of {name, triggers, jobs}), test_commands (array), build_commands (array), deploy_targets (array), broken_workflows (array)."

**Agent 6 — Code quality and linting:**
Prompt: "Read .eslintrc*, .prettierrc*, pyproject.toml [tool.ruff or tool.black], .rubocop.yml, .golangci.yml, or equivalent lint/format config. Identify the linter, formatter, and key enforced rules. Check if pre-commit hooks are configured (.pre-commit-config.yaml or .husky/). Return JSON with keys: linter (string), formatter (string), key_rules (array), pre_commit_configured (boolean), lint_notes (string)."

**Agent 7 — Database and data layer:**
Prompt: "Look for ORM configs, migration files (migrations/, db/migrate/, alembic/), schema files (schema.prisma, schema.sql), or database connection setup. Identify: database type (postgres, mysql, sqlite, mongodb, etc.), ORM or query builder, migration tool, and key schema entities. Return JSON with keys: db_type (string or null), orm (string or null), migration_tool (string or null), schema_entities (array of string), data_notes (string)."

**Agent 8 — Environment and configuration:**
Prompt: "Read .env.example, .env.sample, .env.template, or any documented environment variable files (do NOT read actual .env files with real secrets). List all documented environment variables and their purpose. Also check for config management patterns (dotenv, 12-factor, secrets managers). Return JSON with keys: env_vars (array of {name, description, required}), config_pattern (string), config_notes (string)."

**Agent 9 — Deployment and infrastructure:**
Prompt: "Look for Dockerfile, docker-compose.yml, Kubernetes manifests (k8s/, kubernetes/), Terraform (.tf files), AWS CDK, Pulumi, or serverless.yml. Identify: whether the app is containerized, the orchestration approach, cloud provider, and infrastructure-as-code tool. Return JSON with keys: containerized (boolean), base_image (string or null), orchestration (string or null), cloud_provider (string or null), iac_tool (string or null), deploy_notes (string)."

**Agent 10 — Tech debt and open work:**
Prompt: "Search source files for TODO, FIXME, HACK, XXX, and DEPRECATED comments. Count occurrences per file. List the top 10 files by comment count. Also run: gh issue list --state open --json number,title,labels,createdAt to get open GitHub issues. Return JSON with keys: todo_files (array of {file, count}), total_todos (number), open_issues (array of {number, title, labels}), debt_notes (string)."

**Agent 11 — API surface (if applicable):**
Prompt: "Look for route definitions, API endpoint declarations, OpenAPI/Swagger specs, GraphQL schemas, or gRPC proto files. Summarize the API surface: how many endpoints/operations, authentication mechanism, versioning strategy. Return JSON with keys: api_type (rest/graphql/grpc/none), endpoint_count (number or null), auth_mechanism (string or null), api_version (string or null), spec_file (string or null), api_notes (string)."

**Agent 12 — Documentation state:**
Prompt: "Check for: README.md (and its completeness), docs/ directory, wiki link in repo metadata, inline code comments density (sample 5 files), CHANGELOG.md, ADR records (docs/adr/ or similar). Return JSON with keys: has_readme (boolean), readme_quality (poor/basic/good/comprehensive), has_docs_dir (boolean), has_changelog (boolean), has_adrs (boolean), doc_notes (string)."

After all agents complete, synthesize all JSON outputs into a single `SCAN_FINDINGS` object covering: architecture, languages, frameworks, dependencies, test coverage, CI/CD, code quality, database, environment, deployment, tech debt, API surface, and documentation state.

## Phase 3: Findings Presentation and Confirmation

Present synthesized findings to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► CODEBASE SCAN COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Architecture:   {architecture_pattern}
Language:       {primary_language} ({secondary_languages})
Frameworks:     {frameworks}
Tests:          {test_file_count} files | {coverage_percent}% coverage | {test_frameworks}
CI/CD:          {ci_provider} — {workflow count} workflows
Database:       {db_type} via {orm}
Tech debt:      {total_todos} TODOs | {open_issues count} open issues
API:            {api_type} — {endpoint_count} endpoints
Docs:           README: {readme_quality} | Changelog: {has_changelog}

Deploy:         {containerized} | {cloud_provider} | {iac_tool}
```

Use AskUserQuestion:
- header: "Scan Results — Confirm or Correct"
- questions:
  1. "Does this look accurate? What should be corrected?" (freeform, optional)
  2. "What is the primary goal of this project — what problem does it solve?" (freeform)
  3. "What are the no-gos — things MAXSIM agents must never touch or modify?" (freeform)
  4. "What are the acceptance criteria for the next milestone?" (freeform)

Incorporate any corrections into `PROJECT_CONTEXT`.

## Phase 4: GitHub Setup

Execute in sequence:

**4a. Ensure labels:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github ensure-labels
```

**4b. Create GitHub Project Board:**

```bash
REPO=$(gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"')
OWNER=$(gh repo view --json owner -q '.owner.login')
PROJECT_NAME="{project_name} — MAXSIM"

gh project create --owner "$OWNER" --title "$PROJECT_NAME"
```

Capture the project number.

**4c. Store project board number:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github set-project --number {PROJECT_NUMBER}
```

**4d. Create initial milestone:**

```bash
gh api repos/$REPO/milestones \
  --method POST \
  --field title="Milestone 1 — {project_name}" \
  --field description="Initial milestone created by MAXSIM" \
  --field state="open"
```

Capture the milestone number.

## Phase 5: Local Setup

**5a. Write .claude/maxsim/config.json:**

Create `.claude/maxsim/config.json` with:

```json
{
  "version": "6",
  "project_name": "{project_name}",
  "description": "{description}",
  "architecture": "{architecture_pattern}",
  "tech_stack": ["{primary_language}", "{frameworks}"],
  "testing": {
    "frameworks": ["{test_frameworks}"],
    "coverage_percent": {coverage_percent}
  },
  "ci_provider": "{ci_provider}",
  "database": "{db_type}",
  "no_gos": ["{no_go items}"],
  "acceptance_criteria": "{acceptance_criteria}",
  "github": {
    "repo": "{owner/repo}",
    "project_number": {PROJECT_NUMBER},
    "milestone_number": {MILESTONE_NUMBER}
  },
  "scan_date": "{ISO timestamp}",
  "initialized_at": "{ISO timestamp}"
}
```

**5b. Write or update CLAUDE.md:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs install write-claude-md \
  --project-name "{project_name}" \
  --description "{description}"
```

If unavailable, add the project context to the project root `CLAUDE.md` directly, or create a GitHub Wiki page for persistent reference.

**5c. Commit initialization files:**

```bash
git add .claude/
git commit -m "chore: initialize MAXSIM v6"
```

Call ExitPlanMode after committing initialization files.

## Phase 6: Roadmap (Optional)

Use AskUserQuestion:
- header: "Initial Roadmap"
- question: "Based on the scan findings and your goals, would you like to generate an initial roadmap now?"
- options:
  - "Yes, generate roadmap from scan findings" — create phase issues
  - "No, I'll plan manually with /maxsim:plan" — skip

**If "No":** Print completion message and exit.

**If "Yes":**

Use the Agent tool with `run_in_background: false` to spawn a Roadmap agent. Self-contained prompt:

"You are creating an initial GitHub roadmap for a MAXSIM v6 project initialized in an existing codebase.

Project details:
- Name: {project_name}
- Description: {description}
- Architecture: {architecture_pattern}
- Tech stack: {primary_language}, {frameworks}
- Goals: {goals}
- Acceptance criteria: {acceptance_criteria}
- Tech debt to address: {total_todos} TODOs, {open_issue_count} open issues
- No-gos: {no_gos}

Scan summary:
- Test coverage: {coverage_percent}%
- CI provider: {ci_provider}
- Database: {db_type}

Create 4–8 phase GitHub Issues on the repo {owner/repo}. Consider:
- Stabilization phases if coverage is low or debt is high
- Feature phases aligned with stated goals
- Infrastructure phases if CI/CD or deploy needs work

Each phase issue must:
1. Have title format: 'Phase N: {phase_name}'
2. Have label 'phase:{N}'
3. Have a body with: goal statement, 5–10 acceptance criteria as task list (- [ ] item), and any relevant context from the scan
4. Be added to milestone #{MILESTONE_NUMBER}

Commands:
  gh issue create --title 'Phase N: {name}' --label 'phase:{N}' --milestone {MILESTONE_NUMBER} --body '{body}' --repo {owner/repo}

After creating all issues, add each to the GitHub Project Board:
  gh project item-add {PROJECT_NUMBER} --owner {OWNER} --url {issue_url}

Set each issue status to 'To Do':
  node .claude/maxsim/bin/maxsim-tools.cjs github set-status --issue-number {N} --status 'To Do'

Return the list of created issue numbers and titles."

After the agent completes, display the phase list.

## Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► PROJECT INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project:      {project_name}
GitHub:       {owner/repo}
Board:        {project_name} — MAXSIM (#{PROJECT_NUMBER})
Milestone:    Milestone 1 (#{MILESTONE_NUMBER})
Phases:       {N} phases created (or "none yet")
Scanned:      {agent count} analysis agents completed

Next step: /maxsim:go
```

</process>

<constraints>
- Tool name is Agent (NOT Task)
- No SlashCommand tool
- GitHub Issues is the SOLE source of truth — no local .planning/ directory
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for CLI operations
- EnterPlanMode must be called immediately after Phase 1 prerequisites pass; ExitPlanMode must be called after the user approves the complete initialization plan (after the Phase 5 commit)
- Agent spawning uses: Agent tool with isolation:"worktree", run_in_background:true (for parallel scan) or run_in_background:false (for sequential roadmap work)
- Self-contained agent prompts — every agent prompt includes all context it needs inline, no external references
- Maximum 4 questions per AskUserQuestion call
- Do NOT read actual .env files with real secrets — only .env.example or documented equivalents
- Spawn all scan agents simultaneously; do not wait for one before starting the next
- Synthesize all agent findings before presenting to user — do not dump raw JSON
</constraints>
