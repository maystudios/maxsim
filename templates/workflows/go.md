<purpose>
Auto-detect project state through live GitHub queries, surface problems proactively, and dispatch to the appropriate MAXSIM command. Uses the Show + Act pattern: display detection reasoning first, then act immediately. GitHub Issues are the sole source of truth — no local .planning/ directory is consulted.
</purpose>

<process>

<step name="immediate_feedback">
## Step 1: Immediate Feedback

Print immediately so the user knows work is happening:

```
Analyzing project state...
```
</step>

<step name="initialization_check">
## Step 2: Check Initialization

Verify MAXSIM is initialized by checking for the config file:

```bash
INITIALIZED=$(test -f .claude/maxsim/config.json && echo "true" || echo "false")
```

If `INITIALIZED` is `false`, stop immediately and display:

```
## MAXSIM Not Initialized

No MAXSIM configuration found in this directory (.claude/maxsim/config.json missing).

Run /maxsim:init to set up this project.
```

Do not proceed further. Exit.
</step>

<step name="context_gathering">
## Step 3: Deep Context Gathering

Gather all signals in parallel for speed. Run these simultaneously:

**1. Live GitHub project board state (primary source of truth):**

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github status
```

Returns: `phase_number`, `title`, `issue_number`, `total_tasks`, `completed_tasks`, `remaining_tasks`, `status` (GitHub board column: To Do / In Progress / In Review / Done), and any interrupted phase detection.

**2. Open bugs and issues:**

```bash
gh issue list --label "bug" --state open --json number,title,createdAt
```

**3. Git context:**

```bash
GIT_STATUS=$(git status --porcelain 2>/dev/null | head -20)
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null)
```

If `github status` fails (GitHub CLI not available, not authenticated, no remote), display:

```
## GitHub Unavailable

GitHub integration is required. Check:
- gh auth status
- git remote -v

Fix the issue, then re-run /maxsim:go.
```

Exit. Do not fall back to local file scanning.
</step>

<step name="problem_detection">
## Step 4: Problem Detection

Check for problems BEFORE suggesting any action. All problems are blocking — surface each one and wait for user resolution before continuing.

**Problem 1: Failed verification on GitHub**

Check if any phase issue is stuck in "In Review" with a verification FAIL comment. Query the current phase issue comments:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue --issue-number N --include-comments
```

If a FAIL is found:

```
## Problem Detected

Issue: Phase verification failed
Phase: {phase number and name} (GitHub Issue #{issue_number})
Impact: Phase is not verified complete — may have gaps
Resolution: Re-run verification or fix identified issues

Options:
1. View verification results (check GitHub issue comments)
2. Re-execute to fix issues
3. Skip and continue anyway
```

Wait for user response before continuing.

**Problem 2: Open bug issues**

If `gh issue list --label "bug"` returned open issues:

```
## Problem Detected

Issue: {N} open bug(s) on GitHub
Bugs:
  #{number} — {title}
  ...
Impact: Active bugs may affect current phase execution
Resolution: Address bugs or route to /maxsim:debug

Options:
1. Route to /maxsim:debug
2. View bugs on GitHub
3. Skip and continue anyway
```

Wait for user response before continuing.

If no problems are found, proceed directly to the decision tree.
</step>

<step name="decision_tree">
## Step 5: Decision Tree

Apply rules in strict precedence order. The FIRST matching rule determines the action. Use live GitHub data from `github status` as the sole source of truth for phase state.

```
Rule 1: GitHub status returns no phases at all?
  -> Action: Suggest creating roadmap
  -> Reasoning: "No phases found on GitHub. Create a roadmap to get started."
  -> Suggest: /maxsim:plan

Rule 2: Interrupted phase detected (from github status)?
  -> Action: /maxsim:execute {N}
  -> Reasoning: "Phase {N} ({name}) was interrupted. Resuming execution."

Rule 3: Phase status = "In Progress" with remaining_tasks > 0?
  -> Action: /maxsim:execute {N}
  -> Reasoning: "Phase {N} ({name}) has {remaining} tasks remaining."

Rule 4: Phase status = "To Do" (next unstarted phase)?
  -> Action: /maxsim:plan {N}
  -> Reasoning: "Phase {N} ({name}) needs planning."

Rule 5: Phase status = "In Review"?
  -> Action: /maxsim:execute {N}
  -> Reasoning: "Phase {N} ({name}) is awaiting verification."

Rule 6: All phases status = "Done"?
  -> Action: /maxsim:progress
  -> Reasoning: "All phases complete. Milestone ready for review."

Rule 7: None of the above?
  -> Action: Show interactive menu (see Step 6)
  -> Reasoning: "Project state is ambiguous."
```
</step>

<step name="show_and_act">
## Step 6: Show + Act

Once a rule matches (Rules 1–6), display detection reasoning FIRST, then invoke the Skill tool to run the recommended command. Do NOT ask for confirmation — the user can Ctrl+C if the detection is wrong.

**Display format:**

```
## Detected: {summary of what was found}

Project:       {project name from config.json}
Current phase: Phase {N} — {name} (GitHub Issue #{issue_number})
GitHub status: {board column}
Tasks:         {completed}/{total} complete

Action: Running /maxsim:{command} {args}...
```

Then invoke the Skill tool with the recommended command.
</step>

<step name="interactive_menu">
## Step 7: Interactive Menu (Rule 7 only)

When no clear action is detected, show a contextual menu. Filter items based on live GitHub data — do not show static options that don't apply.

```
## Project Status

Project:  {project name}
GitHub:   {X}/{Y} phases Done on board

What would you like to do?

1. /maxsim:plan {next_phase} — Plan next phase
2. /maxsim:execute {N} — Continue phase execution
3. /maxsim:quick — Quick ad-hoc task
4. /maxsim:progress — View detailed progress

Or describe what you'd like to do:
```

**Filtering rules:**

- Show `/maxsim:execute {N}` only if an in-progress phase exists on GitHub
- Show `/maxsim:plan {N}` only if an unstarted phase exists on GitHub
- Show `/maxsim:progress` if all phases are Done
- Always show `/maxsim:quick`
- Always include the open-ended fallback

Wait for user selection, then invoke the Skill tool for the chosen command.
</step>

</process>

<constraints>
- Tool name is Agent (NOT Task)
- No SlashCommand tool — use the Skill tool to invoke commands
- GitHub Issues is the SOLE source of truth for phase state
- No local .planning/ directory references anywhere
- Use `node ~/.claude/maxsim/bin/maxsim-tools.cjs` for all CLI operations
- Never ask for confirmation before dispatching (Show + Act, not Show + Ask)
- Always surface problems BEFORE suggesting actions
- All problems are blocking — no warnings, no severity tiers
- No arguments accepted — this is pure auto-detection
- Show "Analyzing..." before heavy operations
- If GitHub is unavailable, fail explicitly — do not fall back to local files
</constraints>
