---
id: gap-closure
title: Gap Closure
group: Advanced
---

When verification finds broken items after phase execution, MaxsimCLI creates focused fix phases automatically. These gap-closure phases target specific failures without re-executing the entire phase.

### How gap closure works

After `/maxsim:execute` completes, the verifier agent checks every deliverable against the phase success criteria. If items fail verification, the verifier creates decimal sub-phase Issues:

{% codeblock language="text" %}
Phase 1 verification finds 2 broken items:
  → Phase 1.1 (fix: login form validation missing)
  → Phase 1.2 (fix: API rate limiting not enforced)
{% /codeblock %}

Each gap-closure phase gets its own GitHub Issue with a plan comment (tagged with `gap_closure: true` in frontmatter) and task sub-Issues. The plan is scoped narrowly to the specific failure, not to the original phase scope.

### Executing gap-closure phases

Gap closure is handled as part of the execute workflow. After verification identifies gaps, run `/maxsim:execute` to close them:

{% codeblock language="bash" %}
# Execute fix phases created by verification
/maxsim:execute
{% /codeblock %}

The execute workflow detects which plans still need completion by checking GitHub Issue status on the Project Board and runs only those. You do not need to specify individual fix phases. You can also use `/maxsim:go`, which detects pending fix phases and dispatches execution automatically.

### Re-verification after gap closure

After closing all gaps, verification re-runs automatically as part of execution to confirm the fixes. The phase is marked complete only when a verification pass finds no broken items. If the fix introduces new failures, another round of gap-closure phases is created.

### The Guard pattern

To prevent infinite loops, MaxsimCLI uses the Guard pattern: if the same verification check fails twice in a row after gap-closure attempts, the executor stops and creates a GitHub Issue flagged for human review instead of retrying. This ensures that persistent failures are escalated rather than looped on indefinitely.

### Retry limits

The `execution.parallelism.max_retries` setting in config.json controls the maximum number of fix-and-verify cycles per task. The default is 3 retries. After exhausting retries, the task is flagged for human intervention and the remaining tasks in the wave continue.

{% callout type="tip" %}
Gap closure works best when phase success criteria are specific and testable. Vague criteria like "the feature should work well" produce vague verification results and less effective gap-closure phases. Write criteria like "the login form validates email format and shows an inline error message."
{% /callout %}
