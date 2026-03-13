---
id: milestones
title: Milestones
group: Workflow
---

Milestones group phases into shippable deliverables. The milestone lifecycle — creating, auditing, gap-closing, and completing milestones — is managed through `/maxsim:init`.

{% codeblock language="bash" %}
# Launch init to manage milestones
/maxsim:init
{% /codeblock %}

`/maxsim:init` is the entry point for all milestone lifecycle operations. It handles creating new milestones, auditing completed ones for gaps, planning fixes for those gaps, and archiving milestones when they are done.

### Milestone lifecycle

{% doctable headers=["Operation", "What Happens"] rows=[["New milestone", "Adds a new milestone to ROADMAP.md with placeholder phases"], ["Audit milestone", "Reads all phase SUMMARYs and requirements, identifies unmet deliverables"], ["Plan gaps", "Creates one new phase per gap with full PLAN.md files ready to execute"], ["Complete milestone", "Archives milestone phases and advances to the next milestone"]] %}
{% /doctable %}

The audit reads all phase SUMMARY.md files and original REQUIREMENTS.md entries for the milestone, then identifies unmet requirements, partially implemented features, and missing deliverables. The result is a structured audit report that feeds directly into gap planning.
