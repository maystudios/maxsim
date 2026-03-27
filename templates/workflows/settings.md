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
- `parallelism` — derived from `execution.model_profile`:
  - quality → max 40 agents (typical 20-40)
  - balanced → max 20 agents (typical 10-20)
  - budget → max 10 agents (typical 5-10)
  Actual count is dynamically scaled by project size (small projects <10 files use fewer agents).
  Resolve current limit: `node .claude/maxsim/bin/maxsim-tools.cjs resolve-max-agents`
- `git.branching_strategy` — "none" | "phase" | "milestone" (default: "none")
- `worktrees.path_template` — Template for worktree paths (default: `.claude/worktrees/agent-{id}/`)
- `worktrees.branch_template` — Template for worktree branches (default: `maxsim/phase-{N}-task-{id}`)
- `hooks.sound_style` — "system" | "bundled" (default: "system")

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
| Parallelism       | [profile-derived: quality 20-40 / balanced 10-20 / budget 5-10] |
| Git Branching     | [none/phase/milestone] |
| Worktree Path     | [.claude/worktrees/agent-{id}/] |
| Worktree Branch   | [maxsim/phase-{N}-task-{id}] |
| Sound Style       | [system/bundled] |
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
    question: "Parallelism — max executor agents per wave (derived from model profile). Actual count is dynamically scaled by project size via `resolve-max-agents`.",
    header: "Parallelism",
    multiSelect: false,
    options: [
      { label: "Quality limits (max 40, typical 20-40)", description: "Matches quality profile. Highest throughput, highest cost." },
      { label: "Balanced limits (max 20, typical 10-20) (Recommended)", description: "Matches balanced profile. Good throughput/cost ratio." },
      { label: "Budget limits (max 10, typical 5-10)", description: "Matches budget profile. Lowest resource use." }
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
    question: "Auto-advance: Should MaxsimCLI automatically proceed between stages (research → plan → execute) without waiting for confirmation?",
    header: "Auto-Advance",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Automatically proceed between stages without confirmation. Maps to config key: workflow.auto_advance" },
      { label: "No (Recommended)", description: "Pause between stages for user confirmation. Maps to config key: workflow.auto_advance" }
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
  },
  {
    question: "Template for worktree paths? Use {id} as placeholder for agent ID.",
    header: "Worktree Path Template",
    multiSelect: false,
    options: [
      { label: ".claude/worktrees/agent-{id}/ (Recommended)", description: "Default path template. Maps to config key: worktrees.path_template" },
      { label: "Custom", description: "Enter a custom path template with {id} placeholder." }
    ]
  },
  {
    question: "Template for worktree branches? Use {N} for phase number and {id} for task ID.",
    header: "Worktree Branch Template",
    multiSelect: false,
    options: [
      { label: "maxsim/phase-{N}-task-{id} (Recommended)", description: "Default branch template. Maps to config key: worktrees.branch_template" },
      { label: "Custom", description: "Enter a custom branch template with {N} and {id} placeholders." }
    ]
  },
  {
    question: "Override models for individual agent types?",
    header: "Model Overrides",
    multiSelect: false,
    options: [
      { label: "No overrides (use profile defaults)", description: "All agents use models from the selected profile." },
      { label: "Custom overrides", description: "Set individual models per agent type (planner/executor/researcher/verifier)." }
    ]
  },
  {
    question: "Choose between OS-native system sounds (default) or MaxsimCLI's built-in chime sounds for notification and completion events.",
    header: "Sound Style",
    multiSelect: false,
    options: [
      { label: "System (Recommended)", description: "OS-native system sounds. Maps to config key: hooks.sound_style" },
      { label: "Bundled", description: "MaxsimCLI custom chime sounds. Maps to config key: hooks.sound_style" }
    ]
  }
])
```

**If "Custom overrides" selected**, use additional `AskUserQuestion` calls for each agent type:
- Planner: haiku / sonnet / opus (default from profile)
- Executor: haiku / sonnet / opus (default from profile)
- Researcher: haiku / sonnet / opus (default from profile)
- Verifier: haiku / sonnet / opus (default from profile)

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
node .claude/maxsim/bin/maxsim-tools.cjs config-set worktrees.path_template "[value]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set worktrees.branch_template "[value]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set automation.auto_commit_on_success [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set automation.conventional_commits [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set workflow.auto_advance [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set automation.co_author "[value]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set hooks.enabled [true/false]
node .claude/maxsim/bin/maxsim-tools.cjs config-set hooks.sound_style "[system/bundled]"
# Per-agent model overrides (only if custom overrides selected)
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.model_overrides.planner "[haiku/sonnet/opus]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.model_overrides.executor "[haiku/sonnet/opus]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.model_overrides.researcher "[haiku/sonnet/opus]"
node .claude/maxsim/bin/maxsim-tools.cjs config-set execution.model_overrides.verifier "[haiku/sonnet/opus]"
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
- [ ] User presented with all 12 settings
- [ ] Config updated via maxsim-tools config-set commands
- [ ] User offered to save as global defaults
- [ ] Confirmation displayed after save
</success_criteria>
