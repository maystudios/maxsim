---
id: dashboard-network
title: Review Gates
group: Advanced
---

Review gates are automated quality checks that run after an agent completes its work. They catch issues before changes are merged, reducing the chance of regressions or unnecessary complexity reaching your main branch.

### Configuration

Enable or disable each review type in `.claude/settings.json`:

{% codeblock language="json" %}
{
  "review": {
    "spec_review": true,
    "code_review": true,
    "simplify_review": true,
    "retry_limit": 3
  }
}
{% /codeblock %}

### Review types

{% doctable headers=["Review", "What it checks"] rows=[["spec_review", "Compares the implementation against the phase spec. Catches missing requirements, incomplete features, and deviations from the plan."], ["code_review", "Reviews code quality, security, and correctness. Looks for bugs, anti-patterns, missing error handling, and potential vulnerabilities."], ["simplify_review", "Checks for unnecessary complexity, dead code, over-engineering, and opportunities to simplify. Keeps the codebase lean."]] %}
{% /doctable %}

### Retry limit

When a review fails, the executor agent receives the feedback and attempts to fix the issues. The `retry_limit` controls how many times this fix-and-review cycle can repeat before MAXSIM stops and asks for human intervention. The default is 3 retries.

{% callout type="tip" %}
For exploratory or prototype work, you can set `simplify_review` to false to avoid spending cycles on code cleanliness. Turn it back on before merging to your main branch.
{% /callout %}
