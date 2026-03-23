---
id: debug-sessions
title: Debug Sessions
group: Advanced
---

`/maxsim:debug` runs the debugger agent with persistent state. Unlike a regular conversation, debugging state is written after each step so that if the context window fills up, you can start a fresh session and continue from where you stopped.

{% codeblock language="bash" %}
# Start a debug session
/maxsim:debug "auth token not refreshing after 401"

# Hierarchical debugging for complex multi-layered bugs
/maxsim:debug --hierarchical "intermittent 502 errors under load"
{% /codeblock %}

The `--hierarchical` flag is designed for bugs that span multiple layers of the stack. It decomposes the problem into sub-investigations, each tracked separately, and synthesizes findings across layers to identify root causes that would not be visible from any single layer.

The debugger uses a scientific method approach: it forms a hypothesis, tests it, records the result, and forms the next hypothesis based on evidence. Each step is persisted so that the next session can continue the investigation.

### Debugging state storage

Debugging state is stored as a GitHub Issue with label `debug`, or in `.claude/agent-memory/` for offline sessions. Each debug session has a slug derived from the issue description. You can have multiple concurrent debug sessions for different issues — each gets its own Issue or memory file. The session record includes the hypothesis log, evidence gathered, and current investigation position.
