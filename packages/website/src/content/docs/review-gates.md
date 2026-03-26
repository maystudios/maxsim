---
id: review-gates
title: Review Gates
group: Advanced
---

Review gates are automated quality checks that run after an agent completes its work. They catch issues before changes are merged, reducing the chance of regressions or unnecessary complexity reaching your main branch.

### Configuration

Verification gates are configured under `execution.verification` in `.claude/maxsim/config.json`:

{% codeblock language="json" %}
{
  "execution": {
    "verification": {
      "strict_mode": true,
      "gates": [
        "tests_pass",
        "build_succeeds",
        "lint_clean",
        "spec_compliance",
        "code_review"
      ],
      "require_code_review": true,
      "auto_resolve_conflicts": true
    }
  }
}
{% /codeblock %}

### Gate types

{% doctable headers=["Gate", "What it checks"] rows=[["tests_pass", "Runs the project test suite and requires all tests to pass before the phase can close."], ["build_succeeds", "Runs the project build and requires it to complete without errors."], ["lint_clean", "Runs the linter and requires zero warnings or errors."], ["spec_compliance", "Compares the implementation against the phase spec. Catches missing requirements, incomplete features, and deviations from the plan."], ["code_review", "Reviews code quality, security, and correctness. Looks for bugs, anti-patterns, missing error handling, and potential vulnerabilities."]] %}
{% /doctable %}

### Workflow toggles

The `workflow.verifier` toggle in `.claude/maxsim/config.json` controls whether the verifier agent runs at all. When enabled, the verifier checks each gate listed in `execution.verification.gates`. Set `execution.verification.strict_mode` to `false` to allow phases to close even when some gates fail.

{% codeblock language="json" %}
{
  "workflow": {
    "verifier": true
  },
  "execution": {
    "verification": {
      "strict_mode": true
    }
  }
}
{% /codeblock %}

### Retry limit

When a verification gate fails, the executor agent receives the feedback and attempts to fix the issues. The `execution.parallelism.max_retries` setting controls how many times this fix-and-verify cycle can repeat before MaxsimCLI stops and asks for human intervention. The default is 3 retries.

{% callout type="tip" %}
For exploratory or prototype work, you can disable the verifier entirely by setting `workflow.verifier` to `false`. Turn it back on before merging to your main branch.
{% /callout %}
