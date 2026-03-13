---
id: gap-closure
title: Gap Closure
group: Advanced
---

When verification finds broken items, it creates focused fix phases automatically. If phase 1 has two broken items, they become phases 1.1 and 1.2. Each has its own PLAN.md and is executed independently.

Gap closure is handled as part of the execute workflow. After verification identifies gaps, run `/maxsim:execute` to close them.

{% codeblock language="bash" %}
# Execute fix phases created by verification
/maxsim:execute
{% /codeblock %}

The execute workflow detects which plans still need completion and runs only those. You do not need to specify individual fix phases — MAXSIM figures it out from the filesystem by checking which plans lack a SUMMARY.md.

After closing all gaps, verification re-runs automatically as part of execution to confirm the fixes. The phase is marked complete only when a verification pass finds no broken items.

{% callout type="tip" %}
You can also use `/maxsim:go` to handle gap closure. It detects the pending fix phases and dispatches execution automatically.
{% /callout %}
