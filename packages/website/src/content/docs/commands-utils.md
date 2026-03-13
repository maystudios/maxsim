---
id: commands-utils
title: Utility Commands
group: Commands Reference
---

### `/maxsim:settings`

View or modify MAXSIM configuration interactively. Settings include model profile, branching strategy, workflow toggles, and other project-level options.

{% codeblock language="bash" %}
/maxsim:settings
{% /codeblock %}

Available configuration options:

{% doctable headers=["Setting", "Description"] rows=[["model_profile", "Switch between quality, balanced, budget, or tokenburner profiles"], ["branching_strategy", "Control how branches are created during execution"], ["Workflow toggles", "Enable or disable specific workflow steps (research, verification, etc.)"]] %}
{% /doctable %}

### `/maxsim:help`

Show all available MAXSIM commands and their usage.

{% codeblock language="bash" %}
/maxsim:help
{% /codeblock %}

Use this to see the full list of commands, their descriptions, and available flags. You can also type `/maxsim:` and browse the command list interactively.
