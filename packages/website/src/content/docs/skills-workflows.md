---
id: skills-workflows
title: Skills & Workflows
group: Advanced
---

MaxsimCLI includes 15 skills and 18 workflows that give agents domain-specific knowledge and multi-step orchestration capabilities. Skills are loaded into agents at dispatch time based on the task. Workflows chain multiple agents together to complete structured operations.

### Skills

Skills provide procedures and domain knowledge that agents reference during execution. Each skill is a focused document covering one area of expertise. Skills are stored in `.claude/skills/` and loaded into agent prompts by the orchestrator.

{% doctable headers=["Skill", "Purpose", "Used By"] rows=[["tdd", "Test-Driven Development workflow: red-green-refactor cycle with test-first discipline", "executor"], ["systematic-debugging", "Scientific method approach to debugging: reproduce, hypothesize, isolate, verify, fix, confirm", "executor (via /maxsim:debug)"], ["brainstorming", "Structured ideation and option exploration for phase planning", "planner"], ["roadmap-writing", "Writing clear, actionable roadmaps with phased deliverables", "planner"], ["handoff-contract", "Agent-to-agent handoff format — defines what was done, what is next, and constraints", "all agents"], ["commit-conventions", "Conventional commit formatting, scope rules, and atomic commit practices", "executor"], ["maxsim-batch", "Running batch operations across multiple tasks for efficiency", "executor"], ["code-review", "Code quality, security, and correctness review procedures", "verifier"], ["verification", "Verification procedures, evidence blocks, and quality gate checks", "verifier"], ["github-operations", "Using GitHub CLI and API tools effectively for issue and project management", "all agents"], ["research", "Systematic research and analysis procedures for codebase investigation", "researcher"], ["project-memory", "Reading and writing project memory correctly using .claude/agent-memory/", "all agents"], ["using-maxsim", "End-user guide for MaxsimCLI commands — loaded when the user asks for help", "orchestrator"], ["maxsim-simplify", "Reducing complexity in code and plans by identifying over-engineering", "planner, executor"], ["autoresearch", "Autonomous optimization loop powering /maxsim:improve, /maxsim:fix-loop, /maxsim:debug-loop, and /maxsim:security", "executor (autonomous commands)"]] %}
{% /doctable %}

### Workflows

Workflows are multi-step orchestrations that coordinate agents, state, and user interaction. Each workflow defines the sequence of agents dispatched and the conditions for moving between steps. Workflows are stored in `.claude/maxsim/workflows/`.

{% doctable headers=["Workflow", "Purpose", "Triggers"] rows=[["go", "Auto-detect project state from GitHub and dispatch the right workflow", "/maxsim:go"], ["init", "Router: delegates to new-project, init-existing, or new-milestone based on project state", "/maxsim:init"], ["new-project", "Full initialization for a new project — interview, GitHub setup, roadmap creation", "init router (no existing code)"], ["init-existing", "Onboard an existing codebase — parallel mapper agents, GitHub setup, analysis", "init router (existing code detected)"], ["new-milestone", "Create a new GitHub Milestone with phase Issues", "init router (project already initialized)"], ["plan", "Orchestrator for the three-stage planning workflow: discuss, research, create", "/maxsim:plan"], ["plan-discuss", "Discussion stage — adaptive questioning to gather context and decisions", "plan orchestrator"], ["plan-research", "Research stage — parallel researcher agents investigate the codebase", "plan orchestrator"], ["plan-create", "Planning stage — create task breakdown, run plan-checker, post to GitHub", "plan orchestrator"], ["execute", "Wave-based parallel execution of a phase with worktree isolation", "/maxsim:execute"], ["execute-plan", "Template for individual executor agents — one plan per agent", "execute orchestrator"], ["verify-phase", "Post-execution verification against success criteria and quality gates", "execute orchestrator"], ["quick", "Simplified task flow — create issue, plan, execute, close", "/maxsim:quick"], ["debug", "Structured debugging with persistent state and hypothesis tracking", "/maxsim:debug"], ["progress", "Query GitHub Project Board and display status with next-action recommendation", "/maxsim:progress"], ["settings", "Interactive configuration viewer and editor", "/maxsim:settings"], ["health", "Check MaxsimCLI installation and GitHub connectivity", "internal"], ["help", "Display command reference with syntax and examples", "/maxsim:help"]] %}
{% /doctable %}

### Extending skills and workflows

Skills and workflows are plain markdown files. You can add custom skills to your project by placing markdown files in `.claude/skills/`. Custom workflows can be added to `.claude/maxsim/workflows/`. Custom files override built-in ones with the same name, so you can extend or replace any skill or workflow.

{% callout type="tip" %}
Skills and workflows are the extensibility mechanism for MaxsimCLI. If your project has domain-specific conventions (like a particular testing framework or deployment process), create a custom skill that documents the procedure. Agents will follow it during execution.
{% /callout %}
