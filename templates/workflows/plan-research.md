<purpose>
Research stage sub-workflow for /maxsim:plan. Spawns the researcher agent with phase context to produce research findings, then posts them to GitHub as a comment on the phase issue.

This file is loaded by the plan.md orchestrator. It does NOT handle gate confirmations or stage routing -- the orchestrator handles that. This sub-workflow focuses ONLY on running research and posting the output to GitHub.
</purpose>

<process>

## Step 1: Check Prerequisites

The orchestrator provides phase context. Verify we have what we need:

- `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`
- `researcher_model`, `research_enabled`
- `has_research` (whether a research comment already exists on the phase issue)
- `state_path`, `roadmap_path`, `requirements_path`, `context_path`
- `phase_req_ids` (requirement IDs that this phase must address)
- `phase_issue_number` (GitHub Issue number for the phase)
- `--force-research` flag presence

## Step 2: Resolve Researcher Model

```bash
RESEARCHER_MODEL=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs resolve-model researcher --raw)
```

## Step 3: Check Existing Research

Determine whether a research comment already exists on the phase GitHub Issue by checking for a comment containing `<!-- maxsim:type=research -->`. This is reflected in the `has_research` flag passed from the orchestrator (which performs the GitHub query).

**If `has_research` is true AND `--force-research` is NOT set:**

Research already exists as a GitHub comment on Issue #{phase_issue_number}. Display:
```
Using existing research from GitHub Issue #{phase_issue_number}.
```

Return control to orchestrator -- no need to re-research.

**If `has_research` is true AND `--force-research` IS set:**

Continue to Step 4 (re-research will post a new research comment, replacing the old one).

**If `has_research` is false:**

Continue to Step 4.

**If `research_enabled` is false AND `--force-research` is NOT set:**

Research is disabled in config. Display:
```
Research disabled in config (workflow.research = false).
Skipping research stage.
```

Return control to orchestrator.

## Step 4: Gather Phase Context

```bash
PHASE_DESC=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap get-phase "${PHASE}" 2>/dev/null)
```

Extract the phase section/description from the JSON output for the researcher prompt.

## Step 5: Spawn Researcher

Display:
```
Researching Phase {phase_number}: {phase_name}...
```

Construct the research prompt. The researcher must return its findings as a structured markdown document (not write to a local file -- the orchestrator will post findings to GitHub):

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}
Answer: "What do I need to know to PLAN this phase well?"
</objective>

<files_to_read>
- GitHub Issue #{phase_issue_number} context comment (USER DECISIONS -- locked choices that constrain research)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

<additional_context>
**Phase description:** {phase_description from PHASE_DESC}
**Phase requirement IDs (MUST address):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists -- follow project-specific guidelines
**Project skills:** Check .skills/ directory (if exists) -- read SKILL.md files, research should account for project skill patterns
</additional_context>

<output>
Return findings as a structured markdown document in your response.
Do NOT write to a local file -- findings will be posted to GitHub by the orchestrator.
</output>
```

Spawn the researcher:

```
Task(
  prompt=research_prompt,
  subagent_type="researcher",
  model="{researcher_model}",
  description="Research Phase {phase_number}"
)
```

## Step 6: Handle Researcher Return

Parse the researcher's return message:

- **`## RESEARCH COMPLETE`:**
  Extract the research findings document from the researcher's response.

  Post research findings to GitHub:
  ```bash
  TMPFILE=$(mktemp)
  cat > "$TMPFILE" << 'BODY_EOF'
  <!-- maxsim:type=research -->
  {research_findings_document}
  BODY_EOF
  node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type research
  ```

  Research findings are posted as a GitHub comment on phase issue #{phase_issue_number}. No local RESEARCH.md file is written.

  Display confirmation:
  ```
  Research complete. Findings posted to GitHub Issue #{phase_issue_number}.
  ```

  Return control to orchestrator.

- **`## RESEARCH BLOCKED`:**
  Display the blocker reason. Offer options:
  ```
  Research blocked: {reason}

  1. Provide additional context and retry
  2. Skip research and proceed to planning
  3. Abort
  ```
  Wait for user choice.

  - If "Provide context": Get additional info, re-spawn researcher with augmented prompt.
  - If "Skip": Return to orchestrator without posting research comment.
  - If "Abort": Exit workflow.

- **`## RESEARCH INCONCLUSIVE`:**
  Display what was attempted. Offer:
  ```
  Research inconclusive after {N} attempts.

  1. Provide more context and retry
  2. Skip research
  3. Abort
  ```
  Handle same as BLOCKED options.

## Step 7: Return to Orchestrator

After research is posted to GitHub (or research is skipped), return control to the plan.md orchestrator. Do NOT show gate confirmation or next steps -- the orchestrator handles the gate between Research and Planning.

</process>

<success_criteria>
- Researcher model resolved from config
- Existing research detected from GitHub Issue comment (<!-- maxsim:type=research --> marker) and reused unless --force-research
- researcher agent spawned with full context (GitHub context comment, requirements, state)
- Research findings returned from researcher as document, then posted as GitHub comment on Issue #{phase_issue_number}
- No local RESEARCH.md file written
- Blocked/inconclusive scenarios handled with user options
- Control returned to orchestrator without showing gate or next steps
</success_criteria>
