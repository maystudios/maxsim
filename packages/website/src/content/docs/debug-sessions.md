---
id: debug-sessions
title: Debug Sessions
group: Advanced
---

`/maxsim:debug` runs the debugger agent with persistent state. Unlike a regular conversation, debugging state is written to a GitHub Issue after each step so that if the context window fills up, you can start a fresh session and continue from where you stopped.

{% codeblock language="bash" %}
# Start a debug session with a symptom description
/maxsim:debug "auth token not refreshing after 401"

# Hierarchical debugging for complex multi-layered bugs
/maxsim:debug --hierarchical "intermittent 502 errors under load"

# Resume an existing debug session (MaxsimCLI lists open sessions)
/maxsim:debug
{% /codeblock %}

### Scientific method approach

The debugger uses a structured diagnostic cycle inspired by the scientific method:

{% codeblock language="text" %}
1. Reproduce  → Confirm the symptom is observable
2. Hypothesize → Form a theory about the root cause
3. Isolate    → Narrow the search area based on evidence
4. Verify     → Test the hypothesis with targeted checks
5. Fix        → Apply the correction
6. Confirm    → Verify the fix resolves the symptom
{% /codeblock %}

Each step is persisted as a comment on the debug GitHub Issue. The hypothesis log, evidence gathered, and current investigation position are all recorded so that the next session can continue the investigation without losing progress.

### Hierarchical debugging

The `--hierarchical` flag is designed for bugs that span multiple layers of the stack. It decomposes the problem into sub-investigations, each tracked as a separate thread within the debug Issue. For example, a "502 under load" issue might spawn sub-investigations for the load balancer configuration, database connection pool limits, and application memory leaks. Findings are synthesized across layers to identify root causes that would not be visible from any single layer.

### Debug state storage

Debug state is stored as a GitHub Issue with label `type:bug`. Each debug session has a slug derived from the issue description. You can have multiple concurrent debug sessions for different issues -- each gets its own Issue. The session record includes:

{% doctable headers=["State", "Where Stored"] rows=[["Symptom description", "GitHub Issue body"], ["Hypothesis log", "GitHub Issue comments (one per hypothesis cycle)"], ["Evidence gathered", "GitHub Issue comments with code snippets, stack traces, command output"], ["Current investigation position", "Latest GitHub Issue comment with status marker"], ["Sub-investigations (hierarchical)", "Threaded comments or linked sub-Issues"]] %}
{% /doctable %}

### Resuming sessions

When you run `/maxsim:debug` without arguments, MaxsimCLI lists open debug Issues (labeled `type:bug`) and asks which session to resume. The debugger reads the full comment thread on the selected Issue to restore its investigation context. This means you can debug across multiple Claude Code sessions without manually tracking where you left off.

### Autonomous debugging with `/maxsim:debug-loop`

For bugs where you have a clear symptom but want MaxsimCLI to investigate autonomously, use `/maxsim:debug-loop [symptom]`. This runs the hypothesis-test-iterate cycle in a loop until the bug is confirmed fixed or the retry budget is exhausted. It uses the `autoresearch` skill to drive autonomous investigation.

{% callout type="tip" %}
For quick bug fixes where you already know the cause, use /maxsim:quick instead of /maxsim:debug. Debug sessions are designed for investigation -- when you need to find the root cause, not just apply a known fix.
{% /callout %}
