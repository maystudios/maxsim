---
id: installation
title: Installation
group: Introduction
---

MaxsimCLI requires Node.js 22 or later. It installs markdown files into your project's `.claude/` directory. There is no long-running process, no global binary, no daemon.

### Run the installer

From inside Claude Code, run:

{% codeblock language="bash" %}
npx maxsimcli@latest
{% /codeblock %}

The installer detects your project and copies the appropriate files into `.claude/` in your project directory.

### What gets installed

MaxsimCLI installs into `.claude/` at your project root:

{% codeblock language="text" %}
.claude/
├── commands/maxsim/      # 9 user-facing commands (/maxsim:*)
├── agents/               # 4 specialized subagent prompts
├── skills/               # 14 reusable skill modules
├── rules/                # Standing rules loaded into every session
├── agent-memory/         # Per-agent persistent memory files
├── settings.json         # Project-level Claude Code settings
├── settings.local.json   # Local overrides (gitignored)
└── maxsim/
    ├── hooks/            # Lifecycle hooks (maxsim-check-update, maxsim-statusline, etc.)
    ├── workflows/        # Workflow orchestration templates
    ├── references/       # Reference documents for agents
    └── templates/        # Document templates
{% /codeblock %}

{% callout type="note" %}
MaxsimCLI does not modify your project files during install. GitHub Issues and milestones are created per-project when you run /maxsim:init inside a project.
{% /callout %}
