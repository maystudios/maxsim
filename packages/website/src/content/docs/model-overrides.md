---
id: model-overrides
title: Model Overrides
group: Advanced
---

Per-agent model overrides let you assign a specific model to any agent, regardless of the active profile. This is useful when you want Opus quality for planning but Haiku is sufficient for research and verification.

### Configuration

Overrides are set under `execution.model_overrides` in `.claude/maxsim/config.json`:

{% codeblock language="json" %}
{
  "execution": {
    "model_profile": "balanced",
    "model_overrides": {
      "executor": "opus",
      "researcher": "haiku"
    }
  }
}
{% /codeblock %}

Override keys are agent names: `executor`, `planner`, `researcher`, `verifier`. Override values are model tiers: `opus`, `sonnet`, or `haiku`. Only agents you want to override need to be listed -- agents not in the overrides object use the profile default.

### How overrides interact with profiles

Overrides take strict precedence over the profile. An overridden agent always uses the specified model regardless of what the profile says.

{% doctable headers=["Agent", "Profile Default (balanced)", "Override", "Effective Model"] rows=[["executor", "sonnet", "opus", "opus (override wins)"], ["planner", "opus", "---", "opus (profile default)"], ["researcher", "sonnet", "haiku", "haiku (override wins)"], ["verifier", "sonnet", "---", "sonnet (profile default)"]] %}
{% /doctable %}

### Common override patterns

{% doctable headers=["Pattern", "Configuration", "Use Case"] rows=[["Opus planner, budget everything else", "planner: opus, executor: sonnet, researcher: haiku, verifier: sonnet", "Complex architecture phases where planning quality is critical but execution is straightforward"], ["Opus executor only", "executor: opus", "Phases with tricky implementation but well-defined plans"], ["Haiku researcher", "researcher: haiku", "Phases where the codebase is well-known and deep research is unnecessary"], ["Full Opus", "executor: opus, planner: opus, researcher: opus, verifier: opus", "High-stakes phases (security, payments, data migration) where every agent needs maximum capability"]] %}
{% /doctable %}

### Setting overrides via settings

You can also use `/maxsim:settings` to configure overrides interactively:

{% codeblock language="bash" %}
/maxsim:settings
{% /codeblock %}

The settings workflow lets you view and modify model overrides without editing config.json directly.

{% callout type="tip" %}
Start with the balanced profile and switch individual agents to Opus only when you find their output quality insufficient. This gives you quality where it matters without paying for Opus on every background task.
{% /callout %}
