---
id: dashboard-overview
title: Skills & Workflows
group: Advanced
---

MAXSIM includes 21 skills and 23 workflows that give agents domain-specific knowledge and multi-step orchestration capabilities. Skills are loaded into agents at dispatch time based on the task. Workflows chain multiple agents together to complete structured operations.

### Skills

Skills provide procedures and domain knowledge that agents reference during execution. Each skill is a focused document covering one area of expertise.

{% doctable headers=["Skill", "Purpose"] rows=[["agent-system-map", "Map of all agents, their roles, and dispatch rules"], ["brainstorming", "Structured ideation and option exploration"], ["code-review", "Code quality, security, and correctness review procedures"], ["commit-conventions", "Conventional commit formatting and scope rules"], ["evidence-collection", "Gathering and documenting evidence for decisions"], ["github-artifact-protocol", "Working with GitHub artifacts in CI/CD"], ["github-tools-guide", "Using GitHub CLI and API tools effectively"], ["handoff-contract", "Agent-to-agent handoff format and expectations"], ["input-validation", "Validating inputs before processing"], ["maxsim-batch", "Running batch operations across multiple tasks"], ["maxsim-simplify", "Reducing complexity in code and plans"], ["memory-management", "Reading and writing project memory correctly"], ["research-methodology", "Systematic research and analysis procedures"], ["roadmap-writing", "Writing clear, actionable roadmaps"], ["sdd", "Specification-Driven Development workflow"], ["systematic-debugging", "Scientific method approach to debugging"], ["tdd", "Test-Driven Development workflow"], ["tool-priority-guide", "Choosing the right tool for each task"], ["using-maxsim", "End-user guide for MAXSIM commands"], ["verification-before-completion", "Pre-completion verification checklist"], ["verification-gates", "Quality gates that must pass before merging"]] %}
{% /doctable %}

### Workflows

Workflows are multi-step orchestrations that coordinate agents, state, and user interaction. Each workflow defines the sequence of agents dispatched and the conditions for moving between steps.

{% doctable headers=["Workflow", "Purpose"] rows=[["batch", "Run multiple tasks in sequence or parallel"], ["diagnose-issues", "Investigate and diagnose project issues"], ["discuss-phase", "Discuss a phase plan with the user before execution"], ["execute-plan", "Execute a single plan within a phase"], ["execute", "Execute a full phase end-to-end"], ["go", "Fast-start execution with minimal prompts"], ["health", "Check project health and configuration"], ["help", "Display help and available commands"], ["init-existing", "Initialize MAXSIM in an existing codebase"], ["init", "Initialize a new MAXSIM project from scratch"], ["new-milestone", "Create a new milestone in the roadmap"], ["new-project", "Scaffold a new project with MAXSIM structure"], ["plan-create", "Create a detailed plan for a phase"], ["plan-discuss", "Discuss plan details interactively"], ["plan-research", "Research context needed for planning"], ["plan", "Full planning workflow (research + create + discuss)"], ["progress", "Show current progress across phases"], ["quick", "Run a one-off task outside the phase workflow"], ["research-phase", "Deep research for a specific phase"], ["sdd", "Specification-Driven Development full workflow"], ["settings", "View and edit MAXSIM settings"], ["verify-phase", "Run verification agents against a completed phase"], ["verify-work", "Verify specific work items"]] %}
{% /doctable %}

{% callout type="tip" %}
Skills and workflows are extensible. You can add custom skills to your project by placing markdown files in the appropriate directory structure. Custom workflows can override or extend the built-in set.
{% /callout %}
