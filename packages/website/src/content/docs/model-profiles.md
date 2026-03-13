---
id: model-profiles
title: Model Profiles
group: Configuration
---

Model profiles control which Claude model each agent uses. Pick a profile that matches your priorities: best results, cost efficiency, or somewhere in between.

{% doctable headers=["Agent", "quality", "balanced", "budget", "tokenburner"] rows=[["executor", "opus", "sonnet", "sonnet", "opus"], ["planner", "opus", "opus", "sonnet", "opus"], ["researcher", "opus", "sonnet", "haiku", "opus"], ["verifier", "sonnet", "sonnet", "haiku", "opus"], ["debugger", "sonnet", "sonnet", "haiku", "opus"]] %}
{% /doctable %}

The `balanced` profile (default) gives you Opus-quality planning with Sonnet for execution and research — a good trade-off between results and cost. The `quality` profile upgrades the executor and researcher to Opus. The `budget` profile uses Sonnet for planning and execution, Haiku for everything else — lowest cost. The `tokenburner` profile uses Opus for every agent — maximum quality, maximum cost.

{% codeblock language="bash" %}
/maxsim:set-profile quality
/maxsim:set-profile balanced
/maxsim:set-profile budget
/maxsim:set-profile tokenburner
{% /codeblock %}
