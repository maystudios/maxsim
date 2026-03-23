---
id: agents-overview
title: How Agents Work
group: Agents
---

MaxsimCLI uses four generic agents: executor, planner, researcher, and verifier. Each agent is a markdown prompt file stored in `.claude/agents/`. They are not executable binaries. They are specifications that the AI reads and executes with a fresh context window.

Specialization comes from prompts and preloaded skills, not from having many dedicated agents. The planner agent loads brainstorming and roadmap-writing skills. The researcher loads the research skill. The executor loads commit conventions and verification rules. This approach keeps the agent count small while allowing each one to handle a wide range of tasks through its skill set.

Agents do not spawn subagents. The orchestrator dispatches agents directly. Each agent runs in isolation using worktree mode, with only its specific skills loaded. When an agent finishes, control returns to the orchestrator, which decides what happens next.

Agents communicate via the handoff-contract skill. Instead of reading and writing loose markdown files, each agent produces a structured handoff contract that the next agent consumes. This contract defines what was done, what needs to happen next, and any constraints the receiving agent must respect. The handoff contract persists in git alongside the rest of the project state.
