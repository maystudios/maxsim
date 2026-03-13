---
id: model-overrides
title: Model Overrides
group: Advanced
---

Per-agent model overrides let you assign a specific model to any agent, regardless of the active profile. This is useful when you want Opus quality for planning but are fine with Haiku for research and verification.

{% codeblock language="json" %}
{
  "model_profile": "balanced",
  "model_overrides": {
    "executor": "opus",
    "researcher": "haiku"
  }
}
{% /codeblock %}

Override keys are simple agent names: `executor`, `planner`, `researcher`, `verifier`, `debugger`. Override values are model tiers: `opus`, `sonnet`, or `haiku`. Overrides take precedence over the profile — an overridden agent always uses the specified model regardless of what the profile says.

Model overrides are the recommended way to optimize cost for projects where you know which agents need the most capability. For example: complex planning benefits from Opus, but research (which is mostly reading and categorizing) works fine with Haiku.

{% callout type="tip" %}
Start with the balanced profile and switch individual agents to Opus only when you find their output quality insufficient. This gives you quality where it matters without paying for Opus on every background task.
{% /callout %}
