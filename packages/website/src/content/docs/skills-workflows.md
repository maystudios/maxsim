---
id: skills-workflows
title: Skills & Workflows
group: Advanced
---

MaxsimCLI includes 15 skills and 18 workflows that give agents domain-specific knowledge and multi-step orchestration capabilities. Skills are loaded into agents at dispatch time based on the task. Workflows chain multiple agents together to complete structured operations.

### Skills

Skills provide procedures and domain knowledge that agents reference during execution. Each skill is a focused document covering one area of expertise.

{% doctable headers=["Skill", "Purpose"] rows=[["tdd", "Test-Driven Development workflow"], ["systematic-debugging", "Scientific method approach to debugging"], ["brainstorming", "Structured ideation and option exploration"], ["roadmap-writing", "Writing clear, actionable roadmaps"], ["handoff-contract", "Agent-to-agent handoff format and expectations"], ["commit-conventions", "Conventional commit formatting and scope rules"], ["maxsim-batch", "Running batch operations across multiple tasks"], ["code-review", "Code quality, security, and correctness review procedures"], ["verification", "Verification procedures and quality checks"], ["github-operations", "Using GitHub CLI and API tools effectively"], ["research", "Systematic research and analysis procedures"], ["project-memory", "Reading and writing project memory correctly"], ["using-maxsim", "End-user guide for MaxsimCLI commands"], ["maxsim-simplify", "Reducing complexity in code and plans"], ["autoresearch", "Autonomous optimization loop powering /maxsim:improve, /maxsim:fix-loop, /maxsim:debug-loop, and /maxsim:security commands"]] %}
{% /doctable %}

### Workflows

Workflows are multi-step orchestrations that coordinate agents, state, and user interaction. Each workflow defines the sequence of agents dispatched and the conditions for moving between steps.

{% doctable headers=["Workflow", "Purpose"] rows=[["debug", "Structured debugging session for a known issue"], ["execute-plan", "Execute a single plan within a phase"], ["execute", "Execute a full phase end-to-end"], ["go", "Fast-start execution with minimal prompts"], ["health", "Check project health and configuration"], ["help", "Display help and available commands"], ["init-existing", "Initialize MaxsimCLI in an existing codebase"], ["init", "Initialize a new MaxsimCLI project from scratch"], ["new-milestone", "Create a new milestone in the roadmap"], ["new-project", "Scaffold a new project with MaxsimCLI structure"], ["plan-create", "Create a detailed plan for a phase"], ["plan-discuss", "Discuss plan details interactively"], ["plan-research", "Research context needed for planning"], ["plan", "Full planning workflow (research + create + discuss)"], ["progress", "Show current progress across phases"], ["quick", "Run a one-off task outside the phase workflow"], ["settings", "View and edit MaxsimCLI settings"], ["verify-phase", "Run verification agents against a completed phase"]] %}
{% /doctable %}

{% callout type="tip" %}
Skills and workflows are extensible. You can add custom skills to your project by placing markdown files in the appropriate directory structure. Custom workflows can override or extend the built-in set.
{% /callout %}
