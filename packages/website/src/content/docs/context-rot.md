---
id: context-rot
title: Context Rot
group: Core Concepts
---

Context rot is the degradation of AI output quality that happens as a conversation grows long. Every message you send to an AI agent adds to the context window. Debugging sessions add stack traces. Planning sessions add half-formed ideas and rejected alternatives. Execution sessions add file contents, test output, and error messages.

By the time you are 20,000 tokens into a session, the model pays more attention to recent tokens than early ones. It may forget that you rejected a particular approach in hour one and suggest it again in hour three. It may lose track of the agreed-upon architecture and start making local decisions that contradict the global design.

### How MaxsimCLI solves context rot

MaxsimCLI's solution is structural: never ask one agent to hold the entire project in mind. Instead, each subagent receives only the context it needs for its specific job.

{% doctable headers=["Agent", "Context it receives", "Context it does NOT receive"] rows=[["Executor", "The plan and task list for the current phase", "Research notes, discussion history, rejected alternatives"], ["Verifier", "The plan and the deliverables to check", "Execution logs, intermediate commit history"], ["Researcher", "The phase description and the codebase", "Plans from other phases, previous research iterations"], ["Planner", "Discussion output and research findings", "Executor logs, verification results from other phases"]] %}
{% /doctable %}

### GitHub as durable memory

Structured GitHub Issue comments (plan, summary, research, context) serve as the hand-off medium between agents. Because these are stored in GitHub, they do not decay. An agent spawned six months later reads the same issue history as the one spawned yesterday.

This is fundamentally different from keeping everything in a single conversation. In a conversation, old messages get pushed out of the attention window. In GitHub, every decision, blocker, and progress note is equally accessible regardless of when it was written.

### When context rot still happens

Context rot can still occur within a single agent session if that session runs very long. MaxsimCLI mitigates this by keeping agent sessions focused and short-lived. A typical executor session handles one plan (3-7 tasks) and then terminates. If you use `/maxsim:debug` for a long investigation, the debug workflow persists state to a GitHub Issue after each step so you can start a fresh session and continue from where you stopped.

{% callout type="note" %}
MaxsimCLI does not prevent you from having long conversations. It makes long conversations unnecessary for implementation work. Research, planning, execution, and verification each happen in a clean, scoped context.
{% /callout %}
