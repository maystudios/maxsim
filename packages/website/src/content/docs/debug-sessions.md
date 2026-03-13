---
id: debug-sessions
title: Debug Sessions
group: Advanced
---

`/maxsim:debug` runs the debugger agent with persistent state. Unlike a regular conversation, debugging state is written to a file after each step. If the context window fills up, you can start a fresh session and continue from where you stopped.

{% codeblock language="bash" %}
# Start a debug session
/maxsim:debug "auth token not refreshing after 401"

# Hierarchical debugging for complex multi-layered bugs
/maxsim:debug --hierarchical "intermittent 502 errors under load"
{% /codeblock %}

The `--hierarchical` flag is designed for bugs that span multiple layers of the stack. It decomposes the problem into sub-investigations, each tracked separately, and synthesizes findings across layers to identify root causes that would not be visible from any single layer.

The debugger uses a scientific method approach: it forms a hypothesis, tests it, records the result, and forms the next hypothesis based on evidence. Each step is committed to the debug state file. If the issue spans multiple sessions, the next session reads the existing state and continues the investigation.

Debugging state is stored in `.planning/debug/`. Each debug session has a slug derived from the issue description. You can have multiple concurrent debug sessions for different issues.
