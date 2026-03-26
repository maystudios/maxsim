---
id: commands-utils
title: Utility Commands
group: Commands Reference
---

Utility commands handle configuration, help, and project health. They do not modify project code or GitHub state (except for settings changes).

### `/maxsim:settings`

View or modify MaxsimCLI configuration interactively. Settings are stored in `.claude/maxsim/config.json` and take effect on the next agent dispatch.

{% codeblock language="bash" %}
# Open the interactive settings menu
/maxsim:settings

# Set a specific profile directly
/maxsim:settings profile quality
{% /codeblock %}

Available configuration options:

{% doctable headers=["Setting", "Values", "Description"] rows=[["model_profile", "quality, balanced, budget", "Controls which Claude model each agent uses. Affects cost and output quality."], ["workflow.research", "true, false", "Run the researcher agent during phase planning. Disable for well-known domains."], ["workflow.plan_checker", "true, false", "Run the plan-checker to validate phase plans before execution."], ["workflow.verifier", "true, false", "Run the verifier after execution to check deliverables against success criteria."], ["workflow.auto_advance", "true, false", "Automatically advance to the next phase after successful execution. Default is false (manual advance)."]] %}
{% /doctable %}

### `/maxsim:help`

Show all available MaxsimCLI commands with descriptions, syntax, and examples.

{% codeblock language="bash" %}
/maxsim:help
{% /codeblock %}

The help output lists every command, its description, accepted arguments, and available flags. You can also type `/maxsim:` and browse the command list interactively in Claude Code.

### `/maxsim:security`

Run a read-only security audit against a specified scope. The audit uses STRIDE threat modeling, OWASP Top 10 checks, and red-team analysis to identify vulnerabilities.

{% codeblock language="bash" %}
# Audit the entire project
/maxsim:security

# Audit a specific scope
/maxsim:security "authentication flow"
{% /codeblock %}

The security command never modifies code. It produces a report with findings, severity ratings, and remediation suggestions. Use `/maxsim:quick` or a dedicated phase to implement fixes.

{% callout type="note" %}
Settings changes are written to .claude/maxsim/config.json immediately. The file is tracked in git, so settings changes appear in your next commit.
{% /callout %}
