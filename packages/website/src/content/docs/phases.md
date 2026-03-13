---
id: phases
title: Phases
group: Core Concepts
---

A phase is a cohesive unit of work that advances the project toward a milestone. Phases are defined in ROADMAP.md and tracked in STATE.md. Each phase contains one or more plans — a plan is a specific task breakdown for one workstream within the phase.

Phases have a lifecycle: planned, researched, executing, complete. The lifecycle is tracked in ROADMAP.md with status symbols. You can query current status any time with `/maxsim:progress`.

### Phase numbering

Phases support decimal and letter suffixes to accommodate gap closure and parallel tracks:

{% doctable headers=["Number", "Meaning"] rows=[["01", "First phase"], ["01A", "Parallel track A alongside phase 01"], ["01B", "Parallel track B alongside phase 01"], ["01.1", "Gap closure sub-phase after phase 01 verification"], ["01.2", "Second gap closure sub-phase"], ["02", "Second major phase"]] %}
{% /doctable %}

Sort order is: 01 < 01A < 01B < 01.1 < 01.2 < 02. The `normalizePhaseName()` function in the MAXSIM CLI handles this ordering for state tracking.

### Phase lifecycle

{% codeblock language="text" %}
planned     → Phase exists in ROADMAP.md, not yet researched
researched  → /maxsim:plan has run, RESEARCH.md and PLAN.md exist
executing   → /maxsim:execute is in progress
complete    → All plans have SUMMARY.md, verification passed
{% /codeblock %}
