---
id: phases
title: Phases
group: Core Concepts
---

A phase is a cohesive unit of work that advances the project toward a milestone. Phases are defined as GitHub Issues with label `type:phase` and tracked on the GitHub Project Board. Each phase contains one or more task sub-Issues. A task is a specific unit of work within the phase.

Phases have a lifecycle: planned, researched, executing, complete. The lifecycle is tracked via GitHub Issue labels and Project Board column position. You can query current status any time with `/maxsim:progress`.

### Phase numbering

Phases support decimal and letter suffixes to accommodate gap closure and parallel tracks:

{% doctable headers=["Number", "Meaning"] rows=[["01", "First phase"], ["01A", "Parallel track A alongside phase 01"], ["01B", "Parallel track B alongside phase 01"], ["01.1", "Gap closure sub-phase after phase 01 verification"], ["01.2", "Second gap closure sub-phase"], ["02", "Second major phase"]] %}
{% /doctable %}

Sort order is: 01 < 01A < 01B < 01.1 < 01.2 < 02. The `normalizePhaseName()` function in the MaxsimCLI CLI handles this ordering for state tracking.

### Phase lifecycle

{% codeblock language="text" %}
planned     → Phase Issue exists on Project Board (Backlog column)
researched  → Discussion and research comments posted on phase Issue (To Do column)
executing   → Executor agents running (In Progress column)
complete    → All task sub-Issues closed, verification passed, phase completion
              comment written on the GitHub Issue (Done column)
{% /codeblock %}
