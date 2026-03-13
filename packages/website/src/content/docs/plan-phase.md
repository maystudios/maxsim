---
id: plan-phase
title: Go (Auto-Dispatch)
group: Workflow
---

`/maxsim:go` is the recommended entry point for most users. It detects your project's current state and runs the correct workflow. You never need to remember which command comes next.

{% codeblock language="bash" %}
/maxsim:go
{% /codeblock %}

### How auto-dispatch works

`/maxsim:go` inspects your `.planning/` directory and decides what to do:

{% doctable headers=["State Detected", "Action Taken"] rows=[["No project initialized", "Runs the init workflow to set up your project"], ["Project exists but no plan for the current phase", "Runs the plan workflow (discussion, research, planning)"], ["Plan exists but not yet executed", "Runs the execute workflow with parallel agents"], ["Execution complete but unverified", "Runs verification"], ["Everything done", "Reports completion and suggests next steps"]] %}
{% /doctable %}

You can run `/maxsim:go` repeatedly throughout your workflow. It picks up where you left off and moves the project forward.

### When to use something else

For most workflows, `/maxsim:go` is all you need. Use specific commands when you want direct control:

- `/maxsim:plan` to re-plan a phase without executing
- `/maxsim:execute` to re-run execution with specific flags
- `/maxsim:quick` for standalone tasks outside the phase workflow
- `/maxsim:debug` for structured debugging sessions
