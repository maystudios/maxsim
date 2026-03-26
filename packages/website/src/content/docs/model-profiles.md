---
id: model-profiles
title: Model Profiles
group: Configuration
---

Model profiles control which Claude model each agent uses. Pick a profile that matches your priorities: best results, cost efficiency, or a middle ground.

### Profile comparison

{% doctable headers=["Agent", "quality", "balanced", "budget"] rows=[["executor", "opus", "sonnet", "sonnet"], ["planner", "opus", "opus", "sonnet"], ["researcher", "sonnet", "sonnet", "haiku"], ["verifier", "opus", "sonnet", "sonnet"]] %}
{% /doctable %}

### Choosing a profile

The `balanced` profile (default) gives you Opus-quality planning with Sonnet for execution, research, and verification. It is a good trade-off between results and cost. Most projects should start here.

The `quality` profile upgrades the executor, planner, and verifier to Opus. Use this for complex projects where execution quality is critical -- architectural refactors, security-sensitive features, or projects with intricate business logic. The cost is higher but the output is more reliable.

The `budget` profile uses Sonnet for planning and execution, Haiku for research. This gives the lowest cost and fastest execution. Use it for straightforward phases where the tasks are well-defined and unlikely to need creative problem-solving.

### Switching profiles

Use `/maxsim:settings` to change the active profile:

{% codeblock language="bash" %}
/maxsim:settings profile quality
/maxsim:settings profile balanced
/maxsim:settings profile budget
{% /codeblock %}

Or edit `.claude/maxsim/config.json` directly:

{% codeblock language="json" %}
{
  "execution": {
    "model_profile": "balanced"
  }
}
{% /codeblock %}

The profile change takes effect on the next agent dispatch. Agents already running are not affected.

### Per-agent overrides

If you need fine-grained control, use model overrides to assign specific models to individual agents regardless of the active profile. See the Model Overrides documentation for details.

{% callout type="tip" %}
Start with balanced. Switch to quality only for phases where you notice the executor or verifier producing insufficient results. Use budget for rapid iteration on simple features.
{% /callout %}
