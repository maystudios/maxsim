---
id: milestones
title: Milestones
group: Workflow
---

Milestones group phases into shippable deliverables. Each milestone maps to a GitHub Milestone, and its progress is tracked by the ratio of open to closed phase Issues under that milestone. The milestone lifecycle -- creating, auditing, gap-closing, and completing milestones -- is managed through `/maxsim:init`.

{% codeblock language="bash" %}
# Launch init to manage milestones
/maxsim:init
{% /codeblock %}

### Milestone lifecycle

{% doctable headers=["Operation", "What Happens"] rows=[["New milestone", "Creates a GitHub Milestone and links placeholder phase Issues to it. Each phase Issue gets a title, description, and deliverables list. The milestone appears on the Project Board immediately."], ["Audit milestone", "Reads all phase completion comments and the GitHub Wiki requirements page. Identifies unmet deliverables, partially implemented features, and missing requirements. Produces a structured audit report as a GitHub Issue comment."], ["Plan gaps", "Creates one new phase Issue per gap, each with task sub-Issues ready to execute. Gap phases use decimal numbering (e.g. 3.1, 3.2) so they sort correctly after the phase that produced the gap."], ["Complete milestone", "Closes all phase Issues under the milestone, marks the GitHub Milestone as complete, and archives the milestone on the Project Board."]] %}
{% /doctable %}

### How milestones relate to phases

A milestone is a container. Phases are the units of work inside it. When you run `/maxsim:init` to create a new milestone, MaxsimCLI creates the GitHub Milestone and then creates one phase Issue for each unit of work. Each phase follows the full plan-execute-verify lifecycle independently.

The milestone completion percentage on GitHub reflects how many of its phase Issues are closed. A milestone is not complete until every phase Issue under it is closed and verified. If verification creates gap-closure phases, those must also close before the milestone can complete.

### Viewing milestone progress

Use `/maxsim:progress` to see the current milestone status, including phase completion counts and overall percentage:

{% codeblock language="bash" %}
/maxsim:progress
{% /codeblock %}

### Milestone auditing

When you tell `/maxsim:init` to complete a milestone, it first runs an audit. The audit reads:

- Phase completion comments on each GitHub Issue
- The original requirements from the GitHub Wiki requirements page for the milestone
- Task sub-Issue status (open vs. closed)

If the audit finds unmet requirements, it creates focused gap-closure phases instead of completing the milestone. You must execute and verify these gap phases before the milestone can close. This prevents milestones from being marked complete when deliverables are missing.

{% callout type="tip" %}
Define clear, testable requirements in the GitHub Wiki requirements page for each milestone. The clearer the requirements, the more accurate the audit. Vague requirements lead to vague audits.
{% /callout %}
