---
id: workflow-toggles
title: Workflow Toggles
group: Configuration
---

MaxsimCLI's workflow includes optional agents and review steps you can disable to trade thoroughness for speed. These are configured under the `workflow` and `review` objects in config.json.

{% doctable headers=["Toggle", "Agent/Step", "Cost when enabled", "When to disable"] rows=[["workflow.research", "researcher", "1-3 min + tokens", "Small phases, already-researched domains"], ["workflow.plan_checker", "planner (review pass)", "1-2 min + tokens", "Simple plans, rapid iteration"], ["workflow.verifier", "verifier", "2-5 min + tokens", "Speed runs, trusted executors"], ["parallelization", "Concurrent agents", "Varies by wave count", "Sequential debugging, cost control"]] %}
{% /doctable %}

{% codeblock language="json" %}
{
  "workflow": {
    "research": false,
    "plan_checker": true,
    "verifier": true
  },
  "parallelization": false
}
{% /codeblock %}

The `review` object controls what the verifier checks when it runs. Each review type can be toggled independently. The retry limit controls how many times a failing review is re-attempted before giving up.

{% doctable headers=["Toggle", "Default", "Description"] rows=[["review.spec_review", "true", "Checks that deliverables match the phase spec and success criteria"], ["review.code_review", "true", "Checks code quality, patterns, and potential issues"], ["review.simplify_review", "true", "Checks for unnecessary complexity that can be reduced"], ["review.retry_limit", "3", "Maximum retries when a review step fails"]] %}
{% /doctable %}

{% codeblock language="json" %}
{
  "review": {
    "spec_review": true,
    "code_review": true,
    "simplify_review": false,
    "retry_limit": 2
  }
}
{% /codeblock %}

{% callout type="warn" %}
Disabling the verifier means broken items won't automatically generate fix phases. You'll need to run /maxsim:verify-work manually and check results yourself. Recommended only for throwaway or prototype phases.
{% /callout %}
