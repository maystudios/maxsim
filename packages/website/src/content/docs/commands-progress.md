---
id: commands-progress
title: Progress & Milestone Commands
group: Commands Reference
---

`/maxsim:progress` shows your current project status by reading live data from the GitHub Project Board. It reports phase completion, milestone progress, open blockers, and recommends the next action.

{% codeblock language="bash" %}
# Show project progress and next recommended action
/maxsim:progress
{% /codeblock %}

### What progress shows

`/maxsim:progress` queries the GitHub Project Board and Milestones API to build a real-time status report:

{% doctable headers=["Section", "What It Shows"] rows=[["Phase overview", "Each phase with its status (Backlog, To Do, In Progress, In Review, Done), task completion counts, and the Issue number"], ["Milestone progress", "Open vs. closed Issues under the active GitHub Milestone, expressed as a percentage"], ["Blockers", "Open Issues labeled type:blocker or type:bug that may need attention"], ["Quick tasks", "Open Issues labeled type:quick that are in progress or pending"], ["Recommendation", "The next action MaxsimCLI suggests based on current board state — e.g. 'Run /maxsim:plan 3' or 'Run /maxsim:execute 2'"]] %}
{% /doctable %}

The recommendation engine follows a simple priority: if a phase has plans but has not been executed, it suggests execution. If a phase needs planning, it suggests planning. If gaps exist from a failed verification, it suggests gap closure. If all phases in the current milestone are done, it suggests starting a new milestone.

### Milestone lifecycle through `/maxsim:init`

Milestone creation, auditing, and completion are managed through `/maxsim:init`, not through `/maxsim:progress`. Progress is read-only — it reports status but does not modify state.

{% doctable headers=["Operation", "Command", "Description"] rows=[["Create milestone", "/maxsim:init", "Add a new milestone to the Project Board with placeholder phase Issues"], ["Audit milestone", "/maxsim:init", "Read all phase completion comments, identify unmet deliverables"], ["Complete milestone", "/maxsim:init", "Archive phases, close the GitHub Milestone, advance to the next one"]] %}
{% /doctable %}

{% codeblock language="bash" %}
# Manage milestones (create, audit, complete)
/maxsim:init
{% /codeblock %}

{% callout type="tip" %}
Run /maxsim:progress at the start of any session to orient yourself. It reads GitHub state and tells you exactly where the project stands and what to do next — no scrolling through Issues required.
{% /callout %}
