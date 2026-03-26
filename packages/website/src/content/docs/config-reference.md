---
id: config-reference
title: config.json Reference
group: Configuration
---

Place `.claude/maxsim/config.json` to customize MaxsimCLI behavior per-project. All keys have sensible defaults. Start with an empty object and add only what you need to change.

{% codeblock language="json" %}
{
  "version": "6.0.0",
  "execution": {
    "model_profile": "balanced",
    "competitive_enabled": false,
    "model_overrides": {},
    "parallelism": {
      "max_agents_per_wave": 3,
      "max_retries": 3,
      "competition_strategy": "standard"
    },
    "verification": {
      "strict_mode": true,
      "gates": ["tests_pass", "build_succeeds", "lint_clean", "spec_compliance", "code_review"],
      "require_code_review": true,
      "auto_resolve_conflicts": true
    }
  },
  "worktrees": {
    "auto_cleanup": true,
    "branch_prefix": "maxsim/",
    "path_template": ".claude/worktrees/agent-{id}/",
    "branch_template": "maxsim/phase-{N}-task-{id}"
  },
  "automation": {
    "auto_commit_on_success": true,
    "conventional_commits": true,
    "co_author": "Co-Authored-By: Claude <noreply@anthropic.com>"
  },
  "github": {
    "projectName": "",
    "auto_push": true
  },
  "hooks": {
    "enabled": true
  },
  "workflow": {
    "research": true,
    "plan_checker": true,
    "verifier": true,
    "auto_advance": false
  },
  "git": {
    "branching_strategy": "phase"
  }
}
{% /codeblock %}

{% doctable headers=["Key", "Type", "Default", "Description"] rows=[["execution.model_profile", "string", "balanced", "Active model profile for all agents (quality, balanced, budget)"], ["execution.competitive_enabled", "boolean", "false", "Enable competitive implementation where multiple agents solve the same task"], ["execution.model_overrides", "object", "{}", "Per-agent model overrides (keys: planner, executor, researcher, verifier; values: haiku, sonnet, opus)"], ["execution.parallelism.max_agents_per_wave", "number", "3", "Maximum number of agents that can run concurrently in a wave"], ["execution.parallelism.max_retries", "number", "3", "Maximum retry attempts when an agent fails"], ["execution.parallelism.competition_strategy", "string", "standard", "Strategy for competitive implementation (none, quick, standard, deep)"], ["execution.verification.strict_mode", "boolean", "true", "Require all verification gates to pass before marking execution complete"], ["execution.verification.gates", "array", "(all)", "List of verification gates to enforce (tests_pass, build_succeeds, lint_clean, spec_compliance, code_review)"], ["execution.verification.require_code_review", "boolean", "true", "Require code review gate during verification"], ["execution.verification.auto_resolve_conflicts", "boolean", "true", "Automatically resolve minor conflicts during parallel execution"], ["worktrees.auto_cleanup", "boolean", "true", "Remove worktrees automatically after agent completion"], ["worktrees.branch_prefix", "string", "maxsim/", "Prefix for worktree branch names"], ["worktrees.path_template", "string", ".claude/worktrees/agent-{id}/", "Path template for worktree directories ({id} is replaced with the agent id)"], ["worktrees.branch_template", "string", "maxsim/phase-{N}-task-{id}", "Branch name template for worktrees ({N} = phase number, {id} = task id)"], ["automation.auto_commit_on_success", "boolean", "true", "Automatically commit changes when a task completes successfully"], ["automation.conventional_commits", "boolean", "true", "Enforce conventional commit message format"], ["automation.co_author", "string", "Co-Authored-By: Claude <noreply@anthropic.com>", "Co-author trailer appended to commit messages"], ["github.projectName", "string", "\"\"", "GitHub Project Board name for issue tracking"], ["github.auto_push", "boolean", "true", "Automatically push commits to the remote after successful execution"], ["hooks.enabled", "boolean", "true", "Enable the MaxsimCLI hook system for lifecycle events"], ["workflow.research", "boolean", "true", "Run research agent during planning phases"], ["workflow.plan_checker", "boolean", "true", "Run plan-checker agent to validate phase plans before execution"], ["workflow.verifier", "boolean", "true", "Run verifier agent after execution to validate results"], ["workflow.auto_advance", "boolean", "false", "Automatically advance to the next phase after successful execution"], ["git.branching_strategy", "string", "phase", "Git branching strategy (none, phase, milestone)"]] %}
{% /doctable %}
