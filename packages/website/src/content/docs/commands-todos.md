---
id: commands-todos
title: Todo Management
group: Commands Reference
---

{% doctable headers=["Command", "Description"] rows=[["/maxsim:quick --todo \"desc\"", "Capture a task or idea as a GitHub Issue with label 'todo'"], ["/maxsim:quick --todo list", "Show open todo Issues from GitHub"], ["/maxsim:quick --todo done N", "Close GitHub Issue #N as completed"], ["/maxsim:quick --todo triage", "Prioritize todos and cross-reference with the roadmap"]] %}
{% /doctable %}

Todo management uses GitHub Issues as the sole source of truth. Todos are created as Issues with the `todo` label and closed when completed — no local files are involved.

{% codeblock language="bash" %}
# Capture an idea as a GitHub Issue
/maxsim:quick --todo "Refactor auth module to use refresh tokens"

# List pending todos (open Issues labeled 'todo')
/maxsim:quick --todo list

# Mark a todo complete by closing Issue #12
/maxsim:quick --todo done 12

# Triage: prioritize todos against the current roadmap
/maxsim:quick --todo triage
{% /codeblock %}
