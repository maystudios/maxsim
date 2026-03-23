---
id: milestones
title: Milestones
group: Workflow
---

Milestones group phases into shippable deliverables. The milestone lifecycle (creating, auditing, gap-closing, and completing milestones) is managed through `/maxsim:init`.

{% codeblock language="bash" %}
# Launch init to manage milestones
/maxsim:init
{% /codeblock %}

`/maxsim:init` is the entry point for all milestone lifecycle operations. It handles creating new milestones, auditing completed ones for gaps, planning fixes for those gaps, and archiving milestones when they are done.

### Milestone lifecycle

{% doctable headers=["Operation", "What Happens"] rows=[["New milestone", "Creates a GitHub Milestone and links placeholder phase Issues to it"], ["Audit milestone", "Reads all phase completion comments and the GitHub Wiki requirements page, identifies unmet deliverables"], ["Plan gaps", "Creates one new phase Issue per gap with task sub-Issues ready to execute"], ["Complete milestone", "Closes all phase Issues under the milestone and marks the GitHub Milestone as complete"]] %}
{% /doctable %}

The audit reads phase completion comments on each GitHub Issue and the original requirements from the GitHub Wiki requirements page for the milestone. It then identifies unmet requirements, partially implemented features, and missing deliverables. The result is a structured audit report written as a GitHub Issue comment that feeds directly into gap planning.
