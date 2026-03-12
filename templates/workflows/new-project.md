<purpose>
Initialize a new project through unified flow: questioning, research (optional), requirements, roadmap. This is the most leveraged moment in any project — deep questioning here means better plans, better execution, better outcomes. One workflow takes you from idea to ready-for-planning.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
@~/.claude/maxsim/references/thinking-partner.md
@~/.claude/maxsim/references/questioning.md
</required_reading>

<auto_mode>
## Auto Mode Detection

Check if `--auto` flag is present in $ARGUMENTS.

**If auto mode:**
- Skip brownfield mapping offer (assume greenfield)
- Skip deep questioning (extract context from provided document)
- Config: YOLO mode is implicit (skip that question), but ask depth/git/agents FIRST (Step 2a)
- After config: run Steps 6-9 automatically with smart defaults:
  - Research: Always yes
  - Requirements: Include all table stakes + features from provided document
  - Requirements approval: Auto-approve
  - Roadmap approval: Auto-approve

**Document requirement:**
Auto mode requires an idea document — either:
- File reference: `/maxsim:init --auto @prd.md`
- Pasted/written text in the prompt

If no document content provided, error:

```
Error: --auto requires an idea document.

Usage:
  /maxsim:init --auto @your-idea.md
  /maxsim:init --auto [paste or write your idea here]

The document should describe what you want to build.
```
</auto_mode>

<process>

## 1. Setup

**MANDATORY FIRST STEP — Execute these checks before ANY user interaction:**

**If `INIT_CONTEXT` was already loaded by the router** (the init.md workflow runs this before delegating), use that JSON directly — do NOT re-run the CLI command.

**Otherwise**, run:

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init new-project)
```

Parse JSON for: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `project_exists`, `has_codebase_map`, `planning_exists`, `has_existing_code`, `has_package_file`, `is_brownfield`, `needs_codebase_map`, `has_git`, `project_path`, `github_ready`, `has_github_remote`, `gh_authenticated`.

**If `project_exists` is true:** Error — project already initialized. Use `/maxsim:progress`.

**If `has_git` is false:** Initialize git:
```bash
git init
```

## 1b. GitHub Prerequisites Gate

**This gate is MANDATORY. Do not proceed if it fails.**

Parse init context for `has_github_remote` and `gh_authenticated`:

1. If `has_github_remote` is false:
   - STOP. Tell user:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      MAXSIM ► NO GITHUB REMOTE FOUND
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     MAXSIM requires a GitHub remote to track phases as Issues.

     To fix: git remote add origin <your-repo-url>

     Then re-run /maxsim:init.
     ```
   - Do NOT proceed with project setup.

2. If `gh_authenticated` is false:
   - STOP. Tell user:
     ```
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      MAXSIM ► GITHUB CLI NOT AUTHENTICATED
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     MAXSIM requires GitHub CLI authentication to create phase issues.

     To fix: gh auth login

     Then re-run /maxsim:init.
     ```
   - Do NOT proceed with project setup.

3. Both checks passed — run `github setup` with the project name as the milestone title:
   ```bash
   node ~/.claude/maxsim/bin/maxsim-tools.cjs github setup --milestone-title "[project name]"
   ```

4. If `github setup` fails:
   - STOP with the error message returned by the tool.
   - Do not fall back to local-only mode.

5. Record the `project_number` and board details returned by `github setup` for use in the Phase Issue Creation step.

## 2. Brownfield Offer

**If auto mode:** Skip to Step 4 (assume greenfield, synthesize PROJECT.md from provided document).

**If `needs_codebase_map` is true** (from init — existing code detected but no codebase map):

Use AskUserQuestion:
- header: "Codebase"
- question: "I detected existing code in this directory. Would you like to map the codebase first?"
- options:
  - "Map codebase first" — Run /maxsim:init (codebase mapping stage) to understand existing architecture (Recommended)
  - "Skip mapping" — Proceed with project initialization

**If "Map codebase first":**
```
Run `/maxsim:init (codebase mapping stage)` first, then return to `/maxsim:init`
```
Exit command.

**If "Skip mapping" OR `needs_codebase_map` is false:** Continue to Step 3.

## 2a. Auto Mode Config (auto mode only)

**If auto mode:** Collect config settings upfront before processing the idea document.

YOLO mode is implicit (auto = YOLO). Ask remaining config questions:

**Round 1 — Core settings (3 questions, no Mode question):**

```
AskUserQuestion([
  {
    header: "Depth",
    question: "How thorough should planning be?",
    multiSelect: false,
    options: [
      { label: "Quick (Recommended)", description: "Ship fast (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced scope and speed (5-8 phases, 3-5 plans each)" },
      { label: "Comprehensive", description: "Thorough coverage (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
])
```

**Round 2 — Workflow agents (same as Step 5):**

```
AskUserQuestion([
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" }
    ]
  }
])
```

Create `.planning/config.json` with mode set to "yolo":

```json
{
  "mode": "yolo",
  "depth": "[selected]",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget",
  "workflow": {
    "research": true|false,
    "plan_checker": true|false,
    "verifier": true|false,
    "auto_advance": true
  }
}
```

**If commit_docs = No:** Add `.planning/` to `.gitignore`.

**Commit config.json:**

```bash
mkdir -p .planning
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "chore: add project config" --files .planning/config.json
```

**Persist auto-advance to config (survives context compaction):**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs config-set workflow.auto_advance true
```

Proceed to Step 4 (skip Steps 3 and 5).

## 3. Deep Questioning

**If auto mode:** Skip (already handled in Step 2a). Extract project context from provided document instead and proceed to Step 4.

**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Open the conversation:**

Ask inline (freeform, NOT AskUserQuestion):

"What do you want to build?"

Wait for their response. This gives you the context needed to ask intelligent follow-up questions.

**Follow the thread (thinking-partner mode):**

Based on what they said, ask follow-up questions that dig into their response. Use AskUserQuestion with options that probe what they mentioned — interpretations, clarifications, concrete examples.

Apply thinking-partner behaviors from `thinking-partner.md`:
- **Challenge vague answers** — "Good UX" means what? Push for specifics.
- **Surface unstated assumptions** — Name assumptions the user didn't realize they were making.
- **Propose alternatives with trade-offs** — Don't just accept the first approach. Offer 2-3 paths.
- **Suggest directions** — "Have you considered...?" Frame as possibilities, not mandates.
- **Make consequences visible** — "If we go with X, that means Y will need to change."
- **Disagree constructively** — If you see a risk, say so.

Keep following threads. Each answer opens new threads to explore. Ask about:
- What excited them
- What problem sparked this
- What they mean by vague terms
- What it would actually look like
- What's already decided

Consult `questioning.md` for techniques:
- Challenge vagueness
- Make abstract concrete
- Surface assumptions
- Find edges
- Reveal motivation

**Track context with domain checklist (background, not out loud):**

Follow the `<domain_checklist>` from `questioning.md`. Silently track which domains have been COVERED, marked N/A, or remain UNCOVERED as the conversation progresses. Do NOT show the checklist or switch to checklist mode. Weave uncovered domains naturally when the conversation allows.

Also follow the `<nogos_tracking>` from `questioning.md`:
- Watch for rejection signals, past failures, and strong opinions throughout
- Silently accumulate no-gos — do NOT confirm each one as it comes up
- After 5+ rounds, weave challenge-based probing naturally ("What would make this project fail?")
- After understanding the domain, suggest common anti-patterns for their project type

**Count questioning rounds internally.** Each AskUserQuestion call counts as one round. Do NOT show the count to the user.

**Decision gate (with coverage gate):**

The "Ready?" option ONLY appears when BOTH conditions are met:
1. Round count >= 10 (at least 10 questioning rounds completed)
2. Domain coverage >= 80% (at least 80% of relevant domains are COVERED or N/A)

If either condition is not met, continue questioning — weave uncovered domains naturally.

When both conditions are met, **first display a coverage summary** (this IS shown to the user):

```
## Domain Coverage Summary

**Core:** Auth (COVERED), Data Model (COVERED), API Style (N/A), Deployment (COVERED), Error Handling (UNCOVERED), Testing (COVERED)
**Infrastructure:** Caching (N/A), Search (N/A), Monitoring (COVERED), CI/CD (COVERED), Environments (COVERED)
**UX/Product:** Roles (COVERED), Notifications (N/A), File Uploads (N/A), i18n (N/A), Accessibility (N/A)
**Scale/Ops:** Performance (COVERED), Concurrency (N/A), Migration (N/A), Backup (N/A), Rate Limiting (N/A)

Coverage: [X]% ([covered + na] / [total]) — [X] rounds completed
```

Then use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to create PROJECT.md?"
- options:
  - "Create PROJECT.md" — Let's move forward
  - "Keep exploring" — I want to share more / ask me more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

**No-Gos Confirmation (after user selects "Create PROJECT.md"):**

Before writing any documents, present ALL accumulated no-gos for user confirmation:

```
## No-Gos Collected

During our conversation, I captured these boundaries:

### Hard Constraints
- [constraint 1]

### Anti-Patterns
- [pattern to avoid 1]

### Previous Failures
- [past failure 1]

### Domain-Specific Risks
- [risk 1]

Anything to add, remove, or change before these become locked?
```

Use AskUserQuestion:
- header: "No-Gos"
- question: "Confirm these no-gos?"
- options:
  - "Confirmed" — Lock these no-gos
  - "Adjust" — I want to add/remove/change some

If "Adjust": capture changes via freeform, update the list, re-confirm.

Loop until "Confirmed" selected. These confirmed no-gos flow into NO-GOS.md using the structured template from `templates/no-gos.md`.

## 4. Write PROJECT.md

**If auto mode:** Synthesize from provided document. No "Ready?" gate was shown — proceed directly to commit.

Synthesize all context into `.planning/PROJECT.md` using the template from `templates/project.md`.

**For greenfield projects:**

Initialize requirements as hypotheses:

```markdown
## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] [Requirement 3]

### Out of Scope

- [Exclusion 1] — [why]
- [Exclusion 2] — [why]
```

All Active requirements are hypotheses until shipped and validated.

**For brownfield projects (codebase map exists):**

Infer Validated requirements from existing code:

1. Read `.planning/codebase/ARCHITECTURE.md` and `STACK.md`
2. Identify what the codebase already does
3. These become the initial Validated set

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing
- ✓ [Existing capability 2] — existing
- ✓ [Existing capability 3] — existing

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]

### Out of Scope

- [Exclusion 1] — [why]
```

**Key Decisions:**

Initialize with any decisions made during questioning:

```markdown
## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| [Choice from questioning] | [Why] | — Pending |
```

**Last updated footer:**

```markdown
---
*Last updated: [date] after initialization*
```

Do not compress. Capture everything gathered.

**Commit PROJECT.md:**

```bash
mkdir -p .planning
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs: initialize project" --files .planning/PROJECT.md
```

## 4b. Generate Artefakte

After PROJECT.md is committed, generate artefakte documents that capture structured insights from questioning.

**DECISIONS.md** — Key decisions made during questioning with rationale:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write .planning/DECISIONS.md
```

Write content:

```markdown
# Key Decisions

**Generated:** [date]
**Source:** Project initialization questioning

| # | Decision | Rationale | Alternatives Considered | Status |
|---|----------|-----------|------------------------|--------|
| 1 | [Choice from questioning] | [Why this was chosen] | [What else was discussed] | Locked |
| 2 | [Choice from questioning] | [Why this was chosen] | [What else was discussed] | Locked |

---
*Decisions captured during /maxsim:init initialization*
```

**ACCEPTANCE-CRITERIA.md** — Measurable success criteria derived from user's vision:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write .planning/ACCEPTANCE-CRITERIA.md
```

Write content:

```markdown
# Acceptance Criteria

**Generated:** [date]
**Source:** Project initialization

## Project-Level Criteria

These define what "done" looks like for the entire project:

- [ ] [Observable outcome from user's vision]
- [ ] [Observable outcome from user's vision]
- [ ] [Observable outcome from user's vision]

## Phase-Level Criteria

Populated per-phase during /maxsim:plan.

---
*Criteria derived from project initialization*
```

**NO-GOS.md** — Explicit exclusions and anti-patterns:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write .planning/NO-GOS.md
```

Write content:

```markdown
# No-Gos

**Generated:** [date]
**Source:** Project initialization

## Excluded Features

- [Feature explicitly excluded] — [why]

## Anti-Patterns

- [Approach to avoid] — [why]

## Scope Boundaries

- [What this project is NOT]

---
*No-gos captured during /maxsim:init initialization*
```

**CONVENTIONS.md** — Coding conventions for agents to follow:

Generate `.planning/CONVENTIONS.md` using the template from `templates/conventions.md`.

**If research has already run (Step 6 completed):**
Populate from research recommendations + questioning confirmations:
- Tech Stack: from locked decisions in research synthesis
- File Layout: from recommended framework conventions
- Error Handling: from user's stated preference during questioning
- Testing: from user's stated testing strategy during questioning
- Set `{{source}}` to "new-project init (research-informed)"
- Set `{{generated_or_confirmed}}` to "generated"

**If no research (Step 6 was skipped):**
Populate from questioning context + reasonable defaults:
- Tech Stack: from any technology choices mentioned during questioning
- File Layout: from framework conventions (infer from chosen framework)
- Error Handling: from user's stated preference or framework default
- Testing: from user's stated strategy or framework default
- Set `{{source}}` to "new-project init (questioning-derived)"
- Set `{{generated_or_confirmed}}` to "generated"

Write content using the 4 must-have sections (Tech Stack, File Layout, Error Handling, Testing). Remove HTML comment examples and replace with actual project-specific conventions.

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs artefakte-write .planning/CONVENTIONS.md
```

**Commit artefakte:**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs: generate initialization artefakte" --files .planning/DECISIONS.md .planning/ACCEPTANCE-CRITERIA.md .planning/NO-GOS.md .planning/CONVENTIONS.md
```

**If auto mode:** Generate artefakte from the provided document with reasonable inferences. Mark uncertain entries with `(inferred)`.

## 5. Workflow Preferences

**If auto mode:** Skip — config was collected in Step 2a. Proceed to Step 5.5.

**Check for global defaults** at `~/.maxsim/defaults.json`. If the file exists, offer to use saved defaults:

```
AskUserQuestion([
  {
    question: "Use your saved default settings? (from ~/.maxsim/defaults.json)",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Use saved defaults, skip settings questions" },
      { label: "No", description: "Configure settings manually" }
    ]
  }
])
```

If "Yes": read `~/.maxsim/defaults.json`, use those values for config.json, and skip directly to **Commit config.json** below.

If "No" or `~/.maxsim/defaults.json` doesn't exist: proceed with the questions below.

**Round 1 — Core workflow settings (4 questions):**

```
questions: [
  {
    header: "Mode",
    question: "How do you want to work?",
    multiSelect: false,
    options: [
      { label: "YOLO (Recommended)", description: "Auto-approve, just execute" },
      { label: "Interactive", description: "Confirm at each step" }
    ]
  },
  {
    header: "Depth",
    question: "How thorough should planning be?",
    multiSelect: false,
    options: [
      { label: "Quick", description: "Ship fast (3-5 phases, 1-3 plans each)" },
      { label: "Standard", description: "Balanced scope and speed (5-8 phases, 3-5 plans each)" },
      { label: "Comprehensive", description: "Thorough coverage (8-12 phases, 5-10 plans each)" }
    ]
  },
  {
    header: "Execution",
    question: "Run plans in parallel?",
    multiSelect: false,
    options: [
      { label: "Parallel (Recommended)", description: "Independent plans run simultaneously" },
      { label: "Sequential", description: "One plan at a time" }
    ]
  },
  {
    header: "Git Tracking",
    question: "Commit planning docs to git?",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Planning docs tracked in version control" },
      { label: "No", description: "Keep .planning/ local-only (add to .gitignore)" }
    ]
  }
]
```

**Round 2 — Workflow agents:**

These spawn additional agents during planning/execution. They add tokens and time but improve quality.

| Agent | When it runs | What it does |
|-------|--------------|--------------|
| **Researcher** | Before planning each phase | Investigates domain, finds patterns, surfaces gotchas |
| **Plan Checker** | After plan is created | Verifies plan actually achieves the phase goal |
| **Verifier** | After phase execution | Confirms must-haves were delivered |

All recommended for important projects. Skip for quick experiments.

```
questions: [
  {
    header: "Research",
    question: "Research before planning each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Investigate domain, find patterns, surface gotchas" },
      { label: "No", description: "Plan directly from requirements" }
    ]
  },
  {
    header: "Plan Check",
    question: "Verify plans will achieve their goals? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Catch gaps before execution starts" },
      { label: "No", description: "Execute plans without verification" }
    ]
  },
  {
    header: "Verifier",
    question: "Verify work satisfies requirements after each phase? (adds tokens/time)",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Confirm deliverables match phase goals" },
      { label: "No", description: "Trust execution, skip verification" }
    ]
  },
  {
    header: "AI Models",
    question: "Which AI models for planning agents?",
    multiSelect: false,
    options: [
      { label: "Balanced (Recommended)", description: "Sonnet for most agents — good quality/cost ratio" },
      { label: "Quality", description: "Opus for research/roadmap — higher cost, deeper analysis" },
      { label: "Budget", description: "Haiku where possible — fastest, lowest cost" }
    ]
  }
]
```

Create `.planning/config.json` with all settings:

```json
{
  "mode": "yolo|interactive",
  "depth": "quick|standard|comprehensive",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget",
  "workflow": {
    "research": true|false,
    "plan_checker": true|false,
    "verifier": true|false
  }
}
```

**If commit_docs = No:**
- Set `commit_docs: false` in config.json
- Add `.planning/` to `.gitignore` (create if needed)

**If commit_docs = Yes:**
- No additional gitignore entries needed

**Commit config.json:**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "chore: add project config" --files .planning/config.json
```

**Note:** Run `/maxsim:settings` anytime to update these preferences.

## 5.5. Resolve Model Profile

Use models from init: `researcher_model`, `synthesizer_model`, `roadmapper_model`.

## 6. Research Decision

**If auto mode:** Default to "Research first" without asking.

Use AskUserQuestion:
- header: "Research"
- question: "Research the domain ecosystem before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover standard stacks, expected features, architecture patterns
  - "Skip research" — I know this domain well, go straight to requirements

**If "Research first":**

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Researching [domain] ecosystem...
```

Create research directory:
```bash
mkdir -p .planning/research
```

**Determine milestone context:**

Check if this is greenfield or subsequent milestone:
- If no "Validated" requirements in PROJECT.md → Greenfield (building from scratch)
- If "Validated" requirements exist → Subsequent milestone (adding to existing app)

Display spawning indicator:
```
◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

Spawn 4 parallel researcher agents with path references:

```
Task(prompt="

<research_type>
Project Research — Stack dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: Research the standard stack for building [domain] from scratch.
Subsequent: Research what's needed to add [target features] to an existing [domain] app. Don't re-research the existing system.
</milestone_context>

<question>
What's the standard 2025 stack for [domain]?
</question>

<files_to_read>
- {project_path} (Project context and goals)
</files_to_read>

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with Context7/official docs, not training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned to each recommendation
</quality_gate>

<output>
Write to: .planning/research/STACK.md
Use template: ~/.claude/maxsim/templates/research-project/STACK.md
</output>
", subagent_type="researcher", model="{researcher_model}", description="Stack research")

Task(prompt="

<research_type>
Project Research — Features dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What features do [domain] products have? What's table stakes vs differentiating?
Subsequent: How do [target features] typically work? What's expected behavior?
</milestone_context>

<question>
What features do [domain] products have? What's table stakes vs differentiating?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

<downstream_consumer>
Your FEATURES.md feeds into requirements definition. Categorize clearly:
- Table stakes (must have or users leave)
- Differentiators (competitive advantage)
- Anti-features (things to deliberately NOT build)
</downstream_consumer>

<quality_gate>
- [ ] Categories are clear (table stakes vs differentiators vs anti-features)
- [ ] Complexity noted for each feature
- [ ] Dependencies between features identified
</quality_gate>

<output>
Write to: .planning/research/FEATURES.md
Use template: ~/.claude/maxsim/templates/research-project/FEATURES.md
</output>
", subagent_type="researcher", model="{researcher_model}", description="Features research")

Task(prompt="

<research_type>
Project Research — Architecture dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: How are [domain] systems typically structured? What are major components?
Subsequent: How do [target features] integrate with existing [domain] architecture?
</milestone_context>

<question>
How are [domain] systems typically structured? What are major components?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

<downstream_consumer>
Your ARCHITECTURE.md informs phase structure in roadmap. Include:
- Component boundaries (what talks to what)
- Data flow (how information moves)
- Suggested build order (dependencies between components)
</downstream_consumer>

<quality_gate>
- [ ] Components clearly defined with boundaries
- [ ] Data flow direction explicit
- [ ] Build order implications noted
</quality_gate>

<output>
Write to: .planning/research/ARCHITECTURE.md
Use template: ~/.claude/maxsim/templates/research-project/ARCHITECTURE.md
</output>
", subagent_type="researcher", model="{researcher_model}", description="Architecture research")

Task(prompt="

<research_type>
Project Research — Pitfalls dimension for [domain].
</research_type>

<milestone_context>
[greenfield OR subsequent]

Greenfield: What do [domain] projects commonly get wrong? Critical mistakes?
Subsequent: What are common mistakes when adding [target features] to [domain]?
</milestone_context>

<question>
What do [domain] projects commonly get wrong? Critical mistakes?
</question>

<files_to_read>
- {project_path} (Project context)
</files_to_read>

<downstream_consumer>
Your PITFALLS.md prevents mistakes in roadmap/planning. For each pitfall:
- Warning signs (how to detect early)
- Prevention strategy (how to avoid)
- Which phase should address it
</downstream_consumer>

<quality_gate>
- [ ] Pitfalls are specific to this domain (not generic advice)
- [ ] Prevention strategies are actionable
- [ ] Phase mapping included where relevant
</quality_gate>

<output>
Write to: .planning/research/PITFALLS.md
Use template: ~/.claude/maxsim/templates/research-project/PITFALLS.md
</output>
", subagent_type="researcher", model="{researcher_model}", description="Pitfalls research")
```

After all 4 agents complete, spawn synthesizer to create SUMMARY.md:

```
Task(prompt="
<task>
Synthesize research outputs into SUMMARY.md.
</task>

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

<output>
Write to: .planning/research/SUMMARY.md
Use template: ~/.claude/maxsim/templates/research-project/SUMMARY.md
Commit after writing.
</output>
", subagent_type="researcher", model="{synthesizer_model}", description="Synthesize research")
```

**Locked Decisions Approval Gate:**

After synthesis completes, read `.planning/research/SUMMARY.md` and extract the "Locked Decisions" section. Present these to the user for approval:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Key Findings

**Stack:** [from SUMMARY.md]
**Table Stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]

Files: `.planning/research/`

## Locked Decisions (Approval Required)

These decisions will flow to the planner as constraints:

| # | Decision | Rationale | Alternatives Rejected | Effort |
|---|----------|-----------|----------------------|--------|
| 1 | [from SUMMARY.md] | ... | ... | ... |
| 2 | [from SUMMARY.md] | ... | ... | ... |
```

Use AskUserQuestion:
- header: "Decisions"
- question: "Approve these locked decisions? You can override any of them."
- options:
  - "Approve all" — Lock these decisions as-is
  - "Override some" — I want to change some decisions
  - "Reject all" — Start fresh on decisions

If "Override some": ask which decisions to change, capture overrides, update the locked decisions list.
If "Reject all": remove locked decisions section from SUMMARY.md; decisions will emerge during requirements/roadmap instead.

**After approval, update PROJECT.md** with the "Tech Stack Decisions" section (from template `templates/project.md`):

Read the current `.planning/PROJECT.md` and append the Tech Stack Decisions section populated from the approved locked decisions. Use the format from the project.md template.

```bash
# PROJECT.md already exists from Step 4 — update it with tech stack decisions
```

Commit the updated PROJECT.md:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs: add tech stack decisions from research" --files .planning/PROJECT.md
```

**If "Skip research":** Continue to Step 7.

## 7. Define Requirements

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Load context:**

Read PROJECT.md and extract:
- Core value (the ONE thing that must work)
- Stated constraints (budget, timeline, tech limitations)
- Any explicit scope boundaries

**If research exists:** Read research/FEATURES.md and extract feature categories.

**If auto mode:**
- Auto-include all table stakes features (users expect these)
- Include features explicitly mentioned in provided document
- Auto-defer differentiators not mentioned in document
- Skip per-category AskUserQuestion loops
- Skip "Any additions?" question
- Skip requirements approval gate
- Generate REQUIREMENTS.md and commit directly

**Present features by category (interactive mode only):**

```
Here are the features for [domain]:

## Authentication
**Table stakes:**
- Sign up with email/password
- Email verification
- Password reset
- Session management

**Differentiators:**
- Magic link login
- OAuth (Google, GitHub)
- 2FA

**Research notes:** [any relevant notes]

---

## [Next Category]
...
```

**If no research:** Gather requirements through conversation instead.

Ask: "What are the main things users need to be able to do?"

For each capability mentioned:
- Ask clarifying questions to make it specific
- Probe for related capabilities
- Group into categories

**Scope each category:**

For each category, use AskUserQuestion:

- header: "[Category]" (max 12 chars)
- question: "Which [category] features are in v1?"
- multiSelect: true
- options:
  - "[Feature 1]" — [brief description]
  - "[Feature 2]" — [brief description]
  - "[Feature 3]" — [brief description]
  - "None for v1" — Defer entire category

Track responses:
- Selected features → v1 requirements
- Unselected table stakes → v2 (users expect these)
- Unselected differentiators → out of scope

**Identify gaps:**

Use AskUserQuestion:
- header: "Additions"
- question: "Any requirements research missed? (Features specific to your vision)"
- options:
  - "No, research covered it" — Proceed
  - "Yes, let me add some" — Capture additions

**Validate core value:**

Cross-check requirements against Core Value from PROJECT.md. If gaps detected, surface them.

**Generate REQUIREMENTS.md:**

Create `.planning/REQUIREMENTS.md` with:
- v1 Requirements grouped by category (checkboxes, REQ-IDs)
- v2 Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, CONTENT-02)

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Reject vague requirements. Push for specificity:
- "Handle authentication" → "User can log in with email/password and stay logged in across sessions"
- "Support sharing" → "User can share post via link that opens in recipient's browser"

**Present full requirements list (interactive mode only):**

Show every requirement (not counts) for user confirmation:

```
## v1 Requirements

### Authentication
- [ ] **AUTH-01**: User can create account with email/password
- [ ] **AUTH-02**: User can log in and stay logged in across sessions
- [ ] **AUTH-03**: User can log out from any page

### Content
- [ ] **CONT-01**: User can create posts with text
- [ ] **CONT-02**: User can edit their own posts

[... full list ...]

---

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```

## 8. Create Roadmap

Display stage banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

Spawn planner (roadmap mode) with path references:

```
Task(prompt="
<planning_context>

<files_to_read>
- .planning/PROJECT.md (Project context)
- .planning/REQUIREMENTS.md (v1 Requirements)
- .planning/research/SUMMARY.md (Research findings - if exists)
- .planning/config.json (Depth and mode settings)
</files_to_read>

</planning_context>

<instructions>
Create roadmap:
1. Derive phases from requirements (don't impose structure)
2. Map every v1 requirement to exactly one phase
3. Derive 2-5 success criteria per phase (observable user behaviors)
4. Validate 100% coverage
5. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
6. Return ROADMAP CREATED with summary

Write files first, then return. This ensures artifacts persist even if context is lost.
</instructions>
", subagent_type="planner", model="{roadmapper_model}", description="Create roadmap")
```

**Handle roadmapper return:**

**If `## ROADMAP BLOCKED`:**
- Present blocker information
- Work with user to resolve
- Re-spawn when resolved

**If `## ROADMAP CREATED`:**

Read the created ROADMAP.md and present it nicely inline:

```
---

## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 2 | [Name] | [Goal] | [REQ-IDs] | [count] |
| 3 | [Name] | [Goal] | [REQ-IDs] | [count] |
...

### Phase Details

**Phase 1: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
3. [criterion]

**Phase 2: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]

[... continue for all phases ...]

---
```

**If auto mode:** Skip approval gate — auto-approve and commit directly.

**CRITICAL: Ask for approval before committing (interactive mode only):**

Use AskUserQuestion:
- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Commit and continue
  - "Adjust phases" — Tell me what to change
  - "Review full file" — Show raw ROADMAP.md

**If "Approve":** Continue to commit.

**If "Adjust phases":**
- Get user's adjustment notes
- Re-spawn roadmapper with revision context:
  ```
  Task(prompt="
  <revision>
  User feedback on roadmap:
  [user's notes]

  <files_to_read>
  - .planning/ROADMAP.md (Current roadmap to revise)
  </files_to_read>

  Update the roadmap based on feedback. Edit files in place.
  Return ROADMAP REVISED with changes made.
  </revision>
  ", subagent_type="planner", model="{roadmapper_model}", description="Revise roadmap")
  ```
- Present revised roadmap
- Loop until user approves

**If "Review full file":** Display raw `cat .planning/ROADMAP.md`, then re-ask.

**Commit roadmap (after approval or auto mode):**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs: create roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 8b. Create Phase Issues on GitHub

After the roadmap is finalized and committed, create a GitHub Issue for each phase. This is a mandatory step — phase tracking lives in GitHub, not in local `.planning/phases/` files (per WIRE-02).

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► CREATING GITHUB PHASE ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

1. Parse `.planning/ROADMAP.md` to extract all phases. For each phase, collect:
   - `phase_number` (e.g., `01`, `02`)
   - `phase_name` (e.g., "Foundation")
   - `goal` (the phase goal statement)
   - `requirements` (list of REQ-IDs mapped to this phase)
   - `success_criteria` (list of observable outcomes)

2. For each phase, run `github create-phase`:
   ```bash
   node ~/.claude/maxsim/bin/maxsim-tools.cjs github create-phase \
     --phase-number "[phase_number]" \
     --phase-name "[phase_name]" \
     --goal "[goal]"
   ```
   The tool auto-adds each issue to the project board with "To Do" status.

3. Track results per phase. If any phase issue creation fails:
   - Log which phases succeeded and which failed.
   - Offer targeted retry for failed phases only (do not re-create successful ones).

4. Report completion:
   ```
   ✓ Created {N} phase issues on GitHub Project Board #{project_number}
   ```

**Note:** Per WIRE-02, phase-level artifact files (PLAN.md, SUMMARY.md, RESEARCH.md, CONTEXT.md) are NOT created in `.planning/phases/` during init. These live exclusively as GitHub Issue comments and bodies. The following local files are still created and committed: PROJECT.md, REQUIREMENTS.md, config.json, STATE.md, ROADMAP.md.

## 8c. Agent Dry-Run Validation

**Always runs after all documents are generated — this is the quality gate for init output.**

Spawn a test agent to validate that all generated docs contain enough information for a fresh agent to start Phase 1 without asking clarifying questions.

```
Task(prompt="
You are a fresh agent about to start Phase 1 of this project.
Read the following files and report what you would need to ask before starting work.

Do NOT infer missing information. If a specific library version is not stated, report it as a gap.
If the error handling pattern is not described, report it as a gap.
Your job is to find what is NOT written, not to demonstrate you could figure it out.

<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/CONVENTIONS.md
- .planning/NO-GOS.md
- .planning/ROADMAP.md
</files_to_read>

Report format:

## DRY-RUN RESULT

### Can Start: YES/NO

### Gaps Found:
- [What information is missing]
- [What is ambiguous]
- [What would need clarification]

### Quality Score: [1-10]
(10 = could start immediately with zero questions, 1 = need major clarifications)
", model="{planner_model}", description="Agent readiness dry-run")
```

**Handle dry-run results:**

**If gaps found (Can Start = NO or Quality Score < 7):**
- For each gap, update the relevant document to fill it:
  - Missing tech versions → update CONVENTIONS.md Tech Stack
  - Missing error handling → update CONVENTIONS.md Error Handling
  - Ambiguous requirements → update REQUIREMENTS.md
  - Missing constraints → update NO-GOS.md
- Commit the fixes:
  ```bash
  node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs: fill gaps from agent dry-run validation" --files .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/CONVENTIONS.md .planning/NO-GOS.md
  ```

**If no gaps (Can Start = YES and Quality Score >= 7):**
- Continue to Step 9.

## 9. Done

Present completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[Project Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Config         | `.planning/config.json`     |
| Conventions    | `.planning/CONVENTIONS.md`  |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |
| Phase Issues   | GitHub Project Board #{project_number} |

**[N] phases** | **[X] requirements** | **[N] GitHub issues created** | Ready to build ✓
```

**If auto mode:**

```
╔══════════════════════════════════════════╗
║  AUTO-ADVANCING → DISCUSS PHASE 1        ║
╚══════════════════════════════════════════╝
```

Exit skill and invoke SlashCommand("/maxsim:plan 1 --auto")

**If interactive mode:**

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/maxsim:plan 1 — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

---

**Also available:**
- /maxsim:plan 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<output>

- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/CONVENTIONS.md`
- `.planning/NO-GOS.md`
- `.planning/DECISIONS.md`
- `.planning/ACCEPTANCE-CRITERIA.md`
- `.planning/research/` (if research selected)
  - `STACK.md`
  - `FEATURES.md`
  - `ARCHITECTURE.md`
  - `PITFALLS.md`
  - `SUMMARY.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`

</output>

<success_criteria>

- [ ] .planning/ directory created
- [ ] Git repo initialized
- [ ] Brownfield detection completed
- [ ] Deep questioning completed (threads followed, not rushed)
- [ ] PROJECT.md captures full context → **committed**
- [ ] config.json has workflow mode, depth, parallelization → **committed**
- [ ] Research completed (if selected) — 4 parallel agents spawned → **committed**
- [ ] Requirements gathered (from research or conversation)
- [ ] User scoped each category (v1/v2/out of scope)
- [ ] REQUIREMENTS.md created with REQ-IDs → **committed**
- [ ] GitHub remote detected (gate passed)
- [ ] GitHub CLI authenticated (gate passed)
- [ ] `github setup` called successfully — project_number recorded
- [ ] planner (roadmap mode) spawned with context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md created with phases, requirement mappings, success criteria
- [ ] STATE.md initialized
- [ ] REQUIREMENTS.md traceability updated
- [ ] CONVENTIONS.md generated with 4 must-have sections (Tech Stack, File Layout, Error Handling, Testing)
- [ ] NO-GOS.md populated from confirmed no-gos during questioning
- [ ] `github create-phase` called for every phase — all issues on board with "To Do" status
- [ ] Agent dry-run validation passed (Quality Score >= 7)
- [ ] User knows next step is `/maxsim:plan 1`

**Atomic commits:** Each phase commits its artifacts immediately. If context is lost, artifacts persist.

</success_criteria>
