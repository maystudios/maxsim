---
id: installation
title: Installation
group: Introduction
---

MaxsimCLI requires Node.js 22 or later. It installs markdown files into your project's `.claude/` directory — no long-running process, no global binary, no daemon.

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
├── commands/maxsim/   # 9 user-facing commands (/maxsim:*)
├── agents/            # 4 specialized subagent prompts
├── skills/            # 21 reusable skill modules
└── workflows/         # Workflow orchestration templates
{% /codeblock %}

{% callout type="note" %}
MaxsimCLI does not modify your project files during install. The .planning/ directory is created per-project when you run /maxsim:init inside a project.
{% /callout %}
