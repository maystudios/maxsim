---
id: model-profiles
title: Model Profiles
group: Configuration
---

Model profiles control which Claude model each agent uses. Pick a profile that matches your priorities: best results, cost efficiency, or a middle ground.

{% doctable headers=["Agent", "quality", "balanced", "budget"] rows=[["executor", "opus", "sonnet", "sonnet"], ["planner", "opus", "opus", "sonnet"], ["researcher", "sonnet", "sonnet", "haiku"], ["verifier", "opus", "sonnet", "sonnet"]] %}
{% /doctable %}

The `balanced` profile (default) gives you Opus-quality planning with Sonnet for execution and research. It is a good trade-off between results and cost. The `quality` profile upgrades the executor, planner, and verifier to Opus. The `budget` profile uses Sonnet for planning and execution, Haiku for research, giving the lowest cost.

To switch profiles, use `/maxsim:settings`:

{% codeblock language="bash" %}
/maxsim:settings profile quality
/maxsim:settings profile balanced
/maxsim:settings profile budget
{% /codeblock %}
