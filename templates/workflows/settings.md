<purpose>
View and modify MaxsimCLI configuration stored in .claude/maxsim/config.json.
</purpose>

<process>

## Step 1: Load current config

```bash
node .claude/maxsim/bin/maxsim-tools.cjs config-ensure-section
```

Then read the current config:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs config-get
```

Parse current values (use defaults if field is absent):
- `model_profile` — "quality" | "balanced" | "budget" (default: "balanced")
- `workflow.research` — true | false (default: true)
- `workflow.plan_checker` — true | false (default: true)
- `workflow.verifier` — true | false (default: true)
- `workflow.auto_advance` — true | false (default: false)
- `parallelism` — "conservative" | "standard" | "aggressive" (default: "standard")
- `git.branching_strategy` — "none" | "phase" | "milestone" (default: "none")

Call `EnterPlanMode` before presenting current settings to the user. After the user confirms all changes, call `ExitPlanMode` before writing to config.json.

Display current settings before prompting for changes:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► CURRENT SETTINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting           | Current Value      |
|-------------------|--------------------|
| Model Profile     | [quality/balanced/budget] |
| Researcher        | [On/Off] |
| Plan Checker      | [On/Off] |
| Verifier          | [On/Off] |
| Auto-Advance      | [On/Off] |
| Parallelism       | [conservative/standard/aggressive] |
| Git Branching     | [none/phase/milestone] |
```

---

## Step 2: Prompt user for changes

```
AskUserQuestion([
  {
    question: "Which model profile for agents?",
    header: "Model Profile",
    multiSelect: false,
    options: [
      { label: "Quality", description: "Opus for planner/executor/verifier, Sonnet for researcher." },
      { label: "Balanced (Recommended)", description: "Opus for planner, Sonnet for executor/researcher/verifier." },
      { label: "Budget", description: "Sonnet for planner/executor/verifier, Haiku for researcher." }
    ]
  },
  {
    question: "Spawn Research agent during planning?",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Research domain before planning each phase." },
      { label: "No", description: "Skip research, plan directly." }
    ]
  },
  {
    question: "Spawn Plan Checker agent?",
    header: "Plan Check",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Verify plans meet phase goals before execution." },
      { label: "No", description: "Skip plan verification." }
    ]
  },
  {
    question: "Spawn Verifier agent after execution?",
    header: "Verifier",
    multiSelect: false,
    options: [
      { label: "Yes (Recommended)", description: "Verify phase completion against must-haves." },
      { label: "No", description: "Skip post-execution verification." }
    ]
  },
  {
    question: "Parallelism — how many executor agents run at once?",
    header: "Parallelism",
    multiSelect: false,
    options: [
      { label: "Conservative", description: "1 executor at a time. Lowest resource use." },
      { label: "Standard (Recommended)", description: "Parallel within waves (respects plan dependencies)." },
      { label: "Aggressive", description: "Maximum parallel execution. Fastest, highest cost." }
    ]
  },
  {
    question: "Competition strategy — how do agents compete on a task?",
    header: "Competition",
    multiSelect: false,
    options: [
      { label: "None", description: "Single agent per task. No competition." },
      { label: "Quick (Recommended)", description: "Two agents compete, orchestrator picks winner." },
      { label: "Standard", description: "Three agents compete, orchestrator picks winner." },
      { label: "Deep", description: "Maximum competition. Highest quality, highest cost." }
    ]
  },
  {
    question: "Git branching strategy?",
    header: "Branching",
    multiSelect: false,
    options: [
      { label: "None (Recommended)", description: "Commit directly to current branch." },
      { label: "Phase", description: "Create branch for each phase." },
      { label: "Milestone", description: "Create branch for the entire milestone." }
    ]
  }
])
```

---

## Step 3: Save updated config

Call `ExitPlanMode` before writing to config.json.

Merge new settings into config.json:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.model_profile "[quality/balanced/budget]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.parallelism.max_agents_per_wave [number]
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.parallelism.competition_strategy "[none/quick/standard/deep]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.parallelism.max_retries [number]
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.verification.strict_mode [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.verification.require_code_review [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.verification.auto_resolve_conflicts [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set worktrees.auto_cleanup [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set worktrees.branch_prefix "[value]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set automation.auto_commit_on_success [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set automation.conventional_commits [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set automation.co_author "[value]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set hooks.enabled [true/false]
```

---

## Step 4: Confirm and offer global save

Display updated settings table, then ask:

```
AskUserQuestion([
  {
    question: "Save these as global defaults for all new projects?",
    header: "Defaults",
    multiSelect: false,
    options: [
      { label: "Yes", description: "New projects start with these settings (.claude/maxsim/defaults.json)." },
      { label: "No", description: "Only apply to this project." }
    ]
  }
])
```

If "Yes":

```bash
mkdir -p .claude/maxsim
node .claude/maxsim/bin/maxsim-tools.cjs config-save-defaults .claude/maxsim/defaults.json
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Settings saved to .claude/maxsim/config.json
[If global: Also saved to .claude/maxsim/defaults.json]

Re-run /maxsim:settings anytime to change these.
```

</process>

<success_criteria>
- [ ] Current config loaded and displayed
- [ ] User presented with all 7 settings
- [ ] Config updated via maxsim-tools config-set commands
- [ ] User offered to save as global defaults
- [ ] Confirmation displayed after save
</success_criteria>
