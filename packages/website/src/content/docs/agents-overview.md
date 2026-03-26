---
id: agents-overview
title: How Agents Work
group: Agents
---

MaxsimCLI uses four generic agents: executor, planner, researcher, and verifier. Each agent is a markdown prompt file stored in `.claude/agents/`. They are not executable binaries. They are specifications that the AI reads and executes with a fresh context window.

### Specialization through skills

Specialization comes from prompts and preloaded skills, not from having many dedicated agents. The planner agent loads brainstorming and roadmap-writing skills. The researcher loads the research skill. The executor loads commit conventions and verification rules. This approach keeps the agent count small while allowing each one to handle a wide range of tasks through its skill set.

### Dispatch and isolation

Agents do not spawn subagents. The orchestrator dispatches agents directly. Each agent runs in isolation using worktree mode, with only its specific skills loaded. When an agent finishes, control returns to the orchestrator, which decides what happens next.

### Handoff contracts

Agents communicate via the handoff-contract skill. Instead of reading and writing loose markdown files, each agent produces a structured handoff contract that the next agent consumes. This contract defines what was done, what needs to happen next, and any constraints the receiving agent must respect. The handoff contract persists as a GitHub Issue comment alongside the rest of the project state.

### Why fresh context matters

Each agent starts with a clean context window containing only the information it needs: the plan, the relevant research, and its skill set. This prevents context rot -- the degradation of AI output quality that happens as conversations grow long. A planner that has been running for 30 minutes does not influence the executor. The executor sees only the finished plan, not the iterations that produced it.

### Agent lifecycle

{% codeblock language="text" %}
1. Orchestrator reads GitHub state to determine the next action
2. Orchestrator selects an agent type and assembles its prompt
3. Skills are loaded into the prompt based on the task
4. Agent receives a handoff contract (plan, research, or phase context)
5. Agent performs focused work (plan, execute, verify, or research)
6. Agent writes output as a GitHub Issue comment
7. Control returns to the orchestrator for the next dispatch decision
{% /codeblock %}

{% callout type="note" %}
Agents are stateless between invocations. All state persists in GitHub Issues and comments. An agent spawned today and an agent spawned next week reading the same Issue will produce consistent results because they read the same persistent context.
{% /callout %}
