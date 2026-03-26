---
id: commands-quick
title: Quick Command
group: Commands Reference
---

Use `/maxsim:quick` for small, ad-hoc tasks that fall outside the main phase workflow. Quick tasks are tracked as GitHub Issues with the `type:quick` label and appear on your Project Board alongside phase work.

{% codeblock language="bash" %}
# Run a quick task with a description
/maxsim:quick "Add pagination to the API"

# Run interactively — MaxsimCLI will ask for a description
/maxsim:quick
{% /codeblock %}

### How quick tasks work

`/maxsim:quick` skips the researcher, plan-checker, and verifier agents for speed. It still gives you MaxsimCLI guarantees: atomic commits, conventional commit messages, and GitHub Issue tracking.

{% codeblock language="text" %}
1. Gets a task description from the argument or via a clarifying question
2. Creates a GitHub Issue labeled type:quick
3. Moves the Issue to In Progress on the Project Board
4. Spawns a planner agent (quick mode) for a concise implementation plan
5. Spawns executor agent(s) to implement the plan
6. Commits atomically with a message referencing the GitHub Issue
7. Closes the Issue with a completion summary
{% /codeblock %}

### When to use `/maxsim:quick`

Use quick tasks for work that fits in one sentence and has no dependencies on planned phases. Good candidates include:

- Small bug fixes ("fix the broken date format in the sidebar")
- One-off scripts ("add a migration script for the new column")
- Minor UI tweaks ("change the button color on the settings page")
- Documentation updates ("update the API response examples in the README")

If the task involves multiple sub-tasks, needs research, or is part of a planned phase, use `/maxsim:plan` and `/maxsim:execute` instead.

{% callout type="note" %}
Quick tasks appear on your GitHub project board alongside phase tasks. Use /maxsim:progress to see all open quick tasks alongside phase work.
{% /callout %}
