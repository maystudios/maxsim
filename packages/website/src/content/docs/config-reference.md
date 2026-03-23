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
    "basePath": ".maxsim-worktrees/",
    "auto_cleanup": true,
    "branch_prefix": "maxsim/"
  },
  "automation": {
    "auto_commit_on_success": true,
    "conventional_commits": true
  }
}
{% /codeblock %}

{% doctable headers=["Key", "Type", "Default", "Description"] rows=[["execution.model_profile", "string", "balanced", "Active model profile for all agents (quality, balanced, budget)"], ["execution.parallelism.max_agents_per_wave", "number", "3", "Maximum number of agents that can run concurrently in a wave"], ["execution.parallelism.max_retries", "number", "3", "Maximum retry attempts when an agent fails"], ["execution.parallelism.competition_strategy", "string", "standard", "Strategy for competitive implementation (none, quick, standard, deep)"], ["execution.verification.strict_mode", "boolean", "true", "Require all verification gates to pass before marking execution complete"], ["execution.verification.gates", "array", "(all)", "List of verification gates to enforce (tests_pass, build_succeeds, lint_clean, spec_compliance, code_review)"], ["execution.verification.require_code_review", "boolean", "true", "Require code review gate during verification"], ["execution.verification.auto_resolve_conflicts", "boolean", "true", "Automatically resolve minor conflicts during parallel execution"], ["worktrees.basePath", "string", ".maxsim-worktrees/", "Directory used for git worktree isolation during parallel execution"], ["worktrees.auto_cleanup", "boolean", "true", "Remove worktrees automatically after agent completion"], ["worktrees.branch_prefix", "string", "maxsim/", "Prefix for worktree branch names"], ["automation.auto_commit_on_success", "boolean", "true", "Automatically commit changes when a task completes successfully"], ["automation.conventional_commits", "boolean", "true", "Enforce conventional commit message format"]] %}
{% /doctable %}
