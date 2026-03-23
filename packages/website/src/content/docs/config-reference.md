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
    "modelProfile": "balanced",
    "parallelism": {
      "maxAgentsPerWave": 3,
      "maxRetries": 3,
      "competitionStrategy": "standard"
    },
    "verification": {
      "strictMode": true,
      "gates": ["tests_pass", "build_succeeds", "lint_clean", "spec_compliance", "code_review"],
      "requireCodeReview": true,
      "autoResolveConflicts": true
    }
  },
  "worktrees": {
    "basePath": ".maxsim-worktrees/",
    "autoCleanup": true,
    "branchPrefix": "maxsim/"
  },
  "automation": {
    "autoCommitOnSuccess": true,
    "conventionalCommits": true
  }
}
{% /codeblock %}

{% doctable headers=["Key", "Type", "Default", "Description"] rows=[["execution.modelProfile", "string", "balanced", "Active model profile for all agents (quality, balanced, budget)"], ["execution.parallelism.maxAgentsPerWave", "number", "3", "Maximum number of agents that can run concurrently in a wave"], ["execution.parallelism.maxRetries", "number", "3", "Maximum retry attempts when an agent fails"], ["execution.parallelism.competitionStrategy", "string", "standard", "Strategy for competitive implementation (none, quick, standard, deep)"], ["execution.verification.strictMode", "boolean", "true", "Require all verification gates to pass before marking execution complete"], ["execution.verification.gates", "array", "(all)", "List of verification gates to enforce (tests_pass, build_succeeds, lint_clean, spec_compliance, code_review)"], ["execution.verification.requireCodeReview", "boolean", "true", "Require code review gate during verification"], ["execution.verification.autoResolveConflicts", "boolean", "true", "Automatically resolve minor conflicts during parallel execution"], ["worktrees.basePath", "string", ".maxsim-worktrees/", "Directory used for git worktree isolation during parallel execution"], ["worktrees.autoCleanup", "boolean", "true", "Remove worktrees automatically after agent completion"], ["worktrees.branchPrefix", "string", "maxsim/", "Prefix for worktree branch names"], ["automation.autoCommitOnSuccess", "boolean", "true", "Automatically commit changes when a task completes successfully"], ["automation.conventionalCommits", "boolean", "true", "Enforce conventional commit message format"]] %}
{% /doctable %}
