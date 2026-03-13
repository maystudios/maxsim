---
id: config-reference
title: config.json Reference
group: Configuration
---

Place `.planning/config.json` to customize MaxsimCLI behavior per-project. All keys have sensible defaults — start with an empty object and add only what you need to change.

{% codeblock language="json" %}
{
  "model_profile": "balanced",
  "commit_docs": true,
  "search_gitignored": false,
  "branching_strategy": "none",
  "phase_branch_template": "maxsim/phase-{phase}-{slug}",
  "milestone_branch_template": "maxsim/{milestone}-{slug}",
  "workflow": {
    "research": true,
    "plan_checker": true,
    "verifier": true
  },
  "parallelization": true,
  "brave_search": false,
  "worktree_mode": "auto",
  "max_parallel_agents": 10,
  "review": {
    "spec_review": true,
    "code_review": true,
    "simplify_review": true,
    "retry_limit": 3
  },
  "model_overrides": {}
}
{% /codeblock %}

{% doctable headers=["Key", "Type", "Default", "Description"] rows=[["model_profile", "string", "balanced", "Active model profile for all agents (quality, balanced, budget, tokenburner)"], ["commit_docs", "boolean", "true", "Include SUMMARY.md and STATE.md in git commits"], ["search_gitignored", "boolean", "false", "Allow agents to search files matched by .gitignore"], ["branching_strategy", "string", "none", "Git branching mode: none, phase, or milestone"], ["phase_branch_template", "string", "maxsim/phase-{phase}-{slug}", "Branch name template when using phase branching strategy"], ["milestone_branch_template", "string", "maxsim/{milestone}-{slug}", "Branch name template when using milestone branching strategy"], ["workflow.research", "boolean", "true", "Enable researcher agent before planning"], ["workflow.plan_checker", "boolean", "true", "Enable plan-checker review before execution"], ["workflow.verifier", "boolean", "true", "Enable verifier agent after execution"], ["parallelization", "boolean", "true", "Enable wave-based parallel plan execution"], ["brave_search", "boolean", "false", "Enable Brave Search API in research agents"], ["worktree_mode", "string", "auto", "Git worktree isolation mode for agents (auto, always, never)"], ["max_parallel_agents", "number", "10", "Maximum number of agents that can run concurrently"], ["review.spec_review", "boolean", "true", "Enable spec compliance review during verification"], ["review.code_review", "boolean", "true", "Enable code quality review during verification"], ["review.simplify_review", "boolean", "true", "Enable simplification review to reduce unnecessary complexity"], ["review.retry_limit", "number", "3", "Maximum number of retry attempts when a review fails"], ["model_overrides", "object", "{}", "Per-agent model overrides (see Model Overrides)"]] %}
{% /doctable %}
