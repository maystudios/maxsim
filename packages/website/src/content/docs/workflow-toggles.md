---
id: workflow-toggles
title: Workflow Toggles
group: Configuration
---

MaxsimCLI's workflow includes optional agents and steps you can disable to trade thoroughness for speed. These are configured under the `workflow` object in `.claude/maxsim/config.json`.

{% doctable headers=["Toggle", "Agent/Step", "Cost when enabled", "When to disable"] rows=[["workflow.research", "researcher", "1-3 min + tokens", "Small phases, already-researched domains"], ["workflow.plan_checker", "planner (review pass)", "1-2 min + tokens", "Simple plans, rapid iteration"], ["workflow.verifier", "verifier", "2-5 min + tokens", "Speed runs, trusted executors"], ["workflow.auto_advance", "auto phase advance", "None", "When you want manual control between phases"]] %}
{% /doctable %}

{% codeblock language="json" %}
{
  "workflow": {
    "research": false,
    "plan_checker": true,
    "verifier": true,
    "auto_advance": false
  }
}
{% /codeblock %}

The `execution.verification` object controls what the verifier checks when it runs. Each gate can be included or excluded from the `gates` array. The retry limit is set via `execution.parallelism.max_retries`.

{% doctable headers=["Setting", "Default", "Description"] rows=[["execution.verification.strict_mode", "true", "Enforce all verification gates — phases cannot close when gates fail"], ["execution.verification.gates", "[tests_pass, build_succeeds, lint_clean, spec_compliance, code_review]", "Which verification gates to run"], ["execution.verification.require_code_review", "true", "Whether the code_review gate is mandatory"], ["execution.parallelism.max_retries", "3", "Maximum retries when a verification gate fails"]] %}
{% /doctable %}

{% codeblock language="json" %}
{
  "execution": {
    "verification": {
      "strict_mode": true,
      "gates": ["tests_pass", "build_succeeds", "lint_clean", "spec_compliance", "code_review"],
      "require_code_review": true,
      "auto_resolve_conflicts": true
    },
    "parallelism": {
      "max_retries": 3
    }
  }
}
{% /codeblock %}

{% callout type="warn" %}
Disabling the verifier (`workflow.verifier: false`) means broken items won't automatically generate fix phases. Re-enable the verifier to restore automatic verification through /maxsim:execute. Recommended only for throwaway or prototype phases.
{% /callout %}
