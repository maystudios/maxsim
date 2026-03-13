---
id: branching-strategies
title: Branching Strategies
group: Configuration
---

MAXSIM can manage git branches automatically during execution. Set `branching_strategy` in config.json to one of three options.

{% doctable headers=["Strategy", "Branch created", "Template"] rows=[["none", "All work on current branch (default)", "N/A"], ["phase", "One branch per phase", "maxsim/phase-{phase}-{slug}"], ["milestone", "One branch per milestone", "maxsim/{milestone}-{slug}"]] %}
{% /doctable %}

{% codeblock language="json" %}
{
  "branching_strategy": "phase",
  "phase_branch_template": "maxsim/phase-{phase}-{slug}",
  "milestone_branch_template": "maxsim/{milestone}-{slug}"
}
{% /codeblock %}

With `phase` branching, the executor creates a branch from the template before execution and leaves it there for you to review and merge. The `{phase}` placeholder is replaced with the phase number and `{slug}` with a sanitized version of the phase name. With `milestone` branching, the branch spans all phases in the milestone — `{milestone}` is replaced with the milestone identifier.

You can customize the branch name templates by setting `phase_branch_template` or `milestone_branch_template` in config.json. The default templates shown above work for most projects.

{% callout type="note" %}
Branching strategies require a clean working tree before execution. MAXSIM will warn you if there are uncommitted changes that would block branch creation.
{% /callout %}
