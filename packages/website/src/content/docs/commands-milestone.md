---
id: commands-milestone
title: Milestone Commands
group: Commands Reference
---

Milestone lifecycle is managed through `/maxsim:init`. This single entry point handles all milestone operations.

{% codeblock language="bash" %}
/maxsim:init
{% /codeblock %}

### Operations available through `/maxsim:init`

{% doctable headers=["Operation", "Description"] rows=[["new-project", "Initialize a new project — Creates GitHub repo, Project Board, Milestones with phase issues."], ["init-existing", "Onboard an existing codebase into MaxsimCLI (auto-detected when the repo already has code)"], ["new-milestone", "Add a new milestone to the Project Board with placeholder phase issues"], ["complete-milestone", "Archive milestone phases and advance to the next milestone"]] %}
{% /doctable %}

{% codeblock language="bash" %}
# Initialize a new project or onboard an existing one (auto-detected)
/maxsim:init
{% /codeblock %}

Milestone auditing and gap planning are handled as part of the init workflow. When completing a milestone, MaxsimCLI audits deliverables against original requirements, identifies gaps, and creates fix phases before archiving.
