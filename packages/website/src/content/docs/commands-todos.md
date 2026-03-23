---
id: commands-todos
title: Quick Tasks
group: Commands Reference
---

Use `/maxsim:quick` for small, ad-hoc tasks that fall outside the main phase workflow. Quick tasks are tracked as GitHub Issues with the `quick` label.

{% codeblock language="bash" %}
# Run a quick task with a description
/maxsim:quick "Add pagination to the API"

# Run interactively — MaxsimCLI will ask for a description
/maxsim:quick
{% /codeblock %}

### How quick tasks work

`/maxsim:quick` skips research, plan-checker, and verifier by default for speed. It still gives you MaxsimCLI guarantees: atomic commits and GitHub tracking.

1. Gets a task description from the argument or via a clarifying question
2. Creates a GitHub Issue labeled `quick`
3. Spawns a planner agent (quick mode) for a concise implementation plan
4. Spawns executor agent(s) to implement the plan
5. Commits with an atomic message referencing the GitHub Issue
6. Closes the Issue with a completion summary

{% callout type="note" %}
Quick tasks appear on your GitHub project board alongside phase tasks. Use /maxsim:progress to see all open quick tasks alongside phase work.
{% /callout %}
