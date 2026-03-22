# Comprehensive Skill-Writing Guide for Claude Code

> Synthesized from Anthropic's official documentation, the Agent Skills open standard, internal
> reference implementations (/simplify, /batch), and production-validated patterns from the
> superpowers skill library. Current as of March 2026.

---

## Table of Contents

1. [What Is a Skill?](#1-what-is-a-skill)
2. [The Three Loading Levels Architecture](#2-the-three-loading-levels-architecture)
3. [Skill Discovery: How Claude Finds and Selects Skills](#3-skill-discovery-how-claude-finds-and-selects-skills)
4. [Skills vs Commands vs Agents: The Three Categories](#4-skills-vs-commands-vs-agents-the-three-categories)
5. [Complete YAML Frontmatter Specification](#5-complete-yaml-frontmatter-specification)
6. [Writing Descriptions That Trigger Correctly (CSO)](#6-writing-descriptions-that-trigger-correctly-cso)
7. [Body Structure Best Practices](#7-body-structure-best-practices)
8. [Reference File Organization](#8-reference-file-organization)
9. [Dynamic Context Injection](#9-dynamic-context-injection)
10. [How Skills Invoke Other Skills](#10-how-skills-invoke-other-skills)
11. [Auto-Triggering vs Manual Triggering](#11-auto-triggering-vs-manual-triggering)
12. [Performance: Limits, Budgets, Context Impact](#12-performance-limits-budgets-context-impact)
13. [Testing Skills with Subagents (TDD Approach)](#13-testing-skills-with-subagents-tdd-approach)
14. [Anthropic's Own Skill Implementations as Examples](#14-anthropics-own-skill-implementations-as-examples)
15. [Common Anti-Patterns and How to Avoid Them](#15-common-anti-patterns-and-how-to-avoid-them)
16. [Portability Considerations](#16-portability-considerations)
17. [Quick Reference Checklist](#17-quick-reference-checklist)

---

## 1. What Is a Skill?

A **skill** is a folder containing structured instructions that teaches Claude how to handle a specific domain, task, or workflow. Skills are reusable, composable, and portable across Claude surfaces. They load on-demand, eliminating the need to re-explain workflows in every conversation.

Skills are powerful when you have repeatable workflows: generating documentation from specs, conducting research with consistent methodology, creating documents following a style guide, or orchestrating multi-step processes.

### Anatomy of a Skill Directory

```
your-skill-name/
├── SKILL.md           # Required - main instructions + YAML frontmatter
├── reference.md       # Optional - detailed API docs or reference material
├── examples.md        # Optional - usage examples and expected output
├── scripts/           # Optional - executable code
│   ├── process.py
│   └── validate.sh
└── assets/            # Optional - templates, fonts, icons
    └── report-template.md
```

### Critical Naming Rules

- The main file MUST be named exactly `SKILL.md` (case-sensitive). `SKILL.MD`, `skill.md`, and `Skill.md` are all rejected.
- The skill folder MUST use `kebab-case`: `my-skill-name`. No spaces, no underscores, no capitals.
- Do NOT include a `README.md` inside the skill folder. All documentation goes in `SKILL.md` or `references/`.
- The folder name should match the `name` field in frontmatter.

### Where Skills Live

| Scope      | Path                                              | Applies To                     |
| ---------- | ------------------------------------------------- | ------------------------------ |
| Enterprise | Managed settings (see org admin docs)             | All users in the organization  |
| Personal   | `~/.claude/skills/<skill-name>/SKILL.md`          | All your projects              |
| Project    | `.claude/skills/<skill-name>/SKILL.md`            | This project only              |
| Plugin     | `<plugin>/skills/<skill-name>/SKILL.md`           | Where the plugin is enabled    |

**Priority order when names conflict:** Enterprise > Personal > Project. Plugin skills use `plugin-name:skill-name` namespacing and cannot conflict with other levels.

**Monorepo support:** Claude Code automatically discovers skills from nested `.claude/skills/` directories when you are editing files in subdirectories. If you are editing `packages/frontend/src/App.tsx`, Claude Code also looks for skills in `packages/frontend/.claude/skills/`.

**Live reload:** Skills in directories added via `--add-dir` are picked up by live change detection. You can edit them during a session without restarting.

---

## 2. The Three Loading Levels Architecture

Skills use **progressive disclosure**: information loads in stages as needed, not all at once. This minimizes token usage while maintaining specialized expertise.

### Level 1: Metadata (Always Loaded)

**What:** YAML frontmatter only — the `name` and `description` fields.

**When:** At startup, before any conversation begins.

**Token cost:** Approximately 100 tokens per skill.

**Purpose:** Lets Claude know each skill exists and when to use it, without loading any instructions into context.

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---
```

This fragment is what appears in Claude's system prompt for every skill at all times.

### Level 2: Instructions (Loaded When Triggered)

**What:** The full body of `SKILL.md` after the frontmatter.

**When:** When Claude determines the skill is relevant to the current task and invokes it via the `Skill` tool.

**Token cost:** Under 5,000 tokens (target: under 500 lines).

**Mechanism:** Claude calls `Skill(skill-name)`. The tool result delivers the `SKILL.md` body content and the skill's base directory path, enabling relative path references to scripts.

### Level 3: Resources and Code (Loaded As Needed)

**What:** Additional files bundled in the skill directory — `reference.md`, `examples.md`, scripts, templates, data files.

**When:** Only when explicitly referenced during execution and Claude decides to read or run them.

**Token cost:** Effectively unlimited for bundled content that is not accessed. Script output consumes tokens; script source code does not.

**Key insight:** A skill can bundle 50 reference files without any context penalty. Claude reads only the files the current task actually needs.

### Loading Table Summary

| Level | Content | Loaded When | Token Cost |
| ----- | ------- | ----------- | ---------- |
| 1: Metadata | YAML frontmatter (`name`, `description`) | Always, at startup | ~100 per skill |
| 2: Instructions | `SKILL.md` body | When skill is triggered | < 5k tokens |
| 3: Resources | Bundled files and scripts | As needed during execution | Zero until accessed |

---

## 3. Skill Discovery: How Claude Finds and Selects Skills

### The Discovery Mechanism

Skill selection is **entirely text-based**. There is no algorithmic intent detection or keyword matching at the code level. Claude makes the decision to invoke a skill based purely on the descriptions presented in its system prompt.

At startup, Claude Code scans:
- `~/.claude/skills/` (personal skills)
- `.claude/skills/` in the current project (project skills)
- `.claude/skills/` in any directories added via `--add-dir`
- Plugin-provided skills
- Built-in bundled skills

For each discovered skill, only the `name` and `description` from the frontmatter are extracted and injected into the `<available_skills>` section of the Skill tool definition in the system prompt.

### The Character Budget

Skill metadata competes for a fixed character budget:

- **Default budget:** 2% of the context window, with a fallback of 16,000 characters.
- **Per-skill overhead:** Each skill's description length plus approximately 109 characters of XML wrapping.
- **Practical capacity at typical description lengths:**
  - 263-char descriptions: ~42 skills fit
  - 200-char descriptions: ~52 skills fit
  - 130-char descriptions: ~67 skills fit
- **Overflow behavior:** Skills that exceed the budget are **silently excluded**. Claude does not know they exist. No warning is shown unless you run `/context`.
- **Override:** Set the `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable to increase the budget.

The implication: keep descriptions concise. Every character in a description is a character that could have let another skill exist in context.

### How Claude Selects a Skill

When a user sends a message:

1. Claude reads the `<available_skills>` section of its tool definition.
2. For each skill, it reads the `name` and `description`.
3. It reasons about whether the current request matches any skill's description.
4. If matched, it invokes the `Skill` tool with the skill name.
5. The tool response delivers the full `SKILL.md` body and base path.
6. Claude proceeds using the skill's instructions.

The description field is the **sole input** to this selection process for auto-triggering. Getting it right is the most important authoring decision.

### Debugging Discovery

If a skill is not triggering when expected:
- Ask Claude: "What skills are available?" — it will list all skills in context.
- Ask Claude: "When would you use the [skill-name] skill?" — Claude will quote the description back. Adjust based on what is missing.
- Run `/context` to check for a budget warning about excluded skills.
- Invoke the skill directly with `/skill-name` to verify it works at all.

---

## 4. Skills vs Commands vs Agents: The Three Categories

### Skills

Skills are **self-contained instruction packages** that extend what Claude knows and can do. They:
- Are discovered and loaded automatically when relevant
- Can also be invoked manually with `/skill-name`
- Bundle supporting files, scripts, and reference material
- Are portable across Claude.ai, Claude Code, and the API
- Can run inline (in the main context) or in a forked subagent

**Use skills for:** Domain expertise, workflow patterns, style guides, reusable processes, MCP workflow knowledge.

### Commands (Slash Commands / Built-in Commands)

Commands are **user-initiated shortcuts** that inject a predefined prompt into the conversation. They are:
- Always manually triggered (users type `/command-name`)
- Static prompts compiled into the binary or stored as markdown files
- Not auto-discovered or auto-triggered by Claude
- Implemented as `getPromptForCommand()` functions in Claude Code's binary

**Built-in examples:** `/simplify`, `/batch`, `/debug`, `/loop`, `/claude-api`

**Custom commands** (legacy): A file at `.claude/commands/deploy.md` creates a `/deploy` command. Custom commands have been merged into the skills system — a skill at `.claude/skills/deploy/SKILL.md` also creates `/deploy` and works identically, but adds frontmatter control and supporting file support. Skills take precedence when names conflict.

**Use commands for:** Workflows you always want to trigger manually, where auto-triggering would be inappropriate (deploys, commits, sends).

### Agents (Subagents)

Agents are **specialized AI instances** with their own context windows, system prompts, and tool permissions. They:
- Execute in isolation from the main conversation
- Handle discrete tasks independently and return results
- Are defined in `.claude/agents/<agent-name>.md`
- Can be spawned by skills using `context: fork` frontmatter

**Use agents for:** Parallel task execution, context isolation, specialized tool access, tasks that should not contaminate the main conversation.

### The Key Distinction

| Dimension | Skills | Commands | Agents |
| --------- | ------ | -------- | ------ |
| Trigger | Auto or manual | Manual only | Spawned by orchestrator |
| What changes | What Claude knows | What Claude is told to do | Who does the work |
| Context | Inline or forked | Injected into main | Isolated context window |
| Portability | Cross-platform | Claude Code only | Claude Code / Agent SDK |
| Discovery | Description-based | Slash menu | Explicit invocation |

**Summary:** Skills change what the agent knows. Commands change what the user asks. Agents change who is doing the work.

---

## 5. Complete YAML Frontmatter Specification

The frontmatter MUST be the first thing in `SKILL.md`, delimited by `---` markers.

### Claude Code Frontmatter Fields

```yaml
---
name: my-skill                          # Required (recommended)
description: What it does and when     # Recommended
argument-hint: "[issue-number]"         # Optional
disable-model-invocation: true          # Optional, default: false
user-invocable: false                   # Optional, default: true
allowed-tools: Read, Grep, Glob         # Optional
model: claude-opus-4-6                  # Optional
effort: high                            # Optional
context: fork                           # Optional
agent: Explore                          # Optional
hooks: ...                              # Optional
---
```

### Field Reference

**`name`**
- Type: String
- Max length: 64 characters
- Format: Lowercase letters, numbers, and hyphens only (`[a-z0-9-]+`)
- Constraints: No spaces, no capitals, no XML angle brackets (`<` `>`), no reserved words (`anthropic`, `claude`)
- Behavior: Becomes the `/slash-command` name. If omitted, the directory name is used.
- Example: `pdf-processing`, `my-skill`, `sprint-planning`

**`description`**
- Type: String
- Required: Recommended (if omitted, the first paragraph of markdown content is used)
- Max length: 1024 characters
- Constraints: No XML angle brackets. Must be non-empty if specified.
- Purpose: The primary mechanism for skill discovery. Claude uses this text to decide when to invoke the skill from potentially 100+ available skills.
- Format: Third person. Include both what the skill does AND when to use it (trigger conditions).
- Best practice: Keep under 500 characters to preserve budget for other skills.

**`argument-hint`**
- Type: String
- Purpose: Hint shown in the autocomplete menu when the user types `/skill-name`.
- Example: `[issue-number]`, `[filename] [format]`

**`disable-model-invocation`**
- Type: Boolean
- Default: `false`
- Effect when `true`: The skill description is NOT loaded into context at startup. Claude cannot auto-trigger it. Only the user can invoke it via `/skill-name`.
- Use for: Deploy scripts, commit workflows, any action with side effects you want to control timing of.

**`user-invocable`**
- Type: Boolean
- Default: `true`
- Effect when `false`: The skill is hidden from the `/` slash menu. Claude can still auto-trigger it; users cannot.
- Use for: Background knowledge (e.g., `legacy-system-context`) that Claude should know but that isn't a meaningful user action.

**Invocation Matrix:**

| Frontmatter | User can `/invoke` | Claude can auto-trigger | Description in context |
| ----------- | ------------------ | ----------------------- | ---------------------- |
| (default) | Yes | Yes | Yes |
| `disable-model-invocation: true` | Yes | No | No |
| `user-invocable: false` | No | Yes | Yes |

**`allowed-tools`**
- Type: String or list
- Purpose: Tools Claude can use without per-use approval when this skill is active.
- Example: `Read, Grep, Glob` (read-only skill), `Bash(python *)` (only Python bash calls)
- Syntax for Bash: `Bash(gh *)` allows only `gh` commands; `Bash` allows all bash.

**`model`**
- Type: String
- Purpose: Override the model used when this skill is active.
- Example: `claude-opus-4-6`, `claude-haiku-4-6`

**`effort`**
- Type: Enum
- Options: `low`, `medium`, `high`, `max` (Opus 4.6 only)
- Purpose: Override the session effort level for this skill.
- Behavior: Overrides the session-level effort setting.

**`context`**
- Type: String
- Option: `fork`
- Purpose: When set to `fork`, the skill runs in an isolated subagent context. The skill content becomes the subagent's task prompt. The subagent does NOT have access to the main conversation history.
- Warning: Only use with skills that contain explicit task instructions. A skill that contains only guidelines (e.g., "use these API conventions") will receive those guidelines but have no actionable task and return without meaningful output.

**`agent`**
- Type: String
- Default: `general-purpose`
- Purpose: Specifies which subagent configuration to use when `context: fork` is set.
- Options: Built-in agents (`Explore`, `Plan`, `general-purpose`) or any custom agent from `.claude/agents/`.

**`hooks`**
- Type: Object
- Purpose: Hooks scoped to this skill's lifecycle.
- See: Claude Code Hooks documentation for configuration format.

### Agent Skills Open Standard Frontmatter (Claude.ai / API)

When writing skills for the open standard (distributed as zip files or via API), the frontmatter specification adds additional optional fields from the Anthropic guide:

```yaml
---
name: your-skill-name              # Required: kebab-case
description: What it does. Use when user asks to [specific phrases].  # Required
license: MIT                       # Optional: open source license
compatibility: Requires Python 3.10+, network access  # Optional: 1-500 chars
metadata:                          # Optional: custom key-value pairs
  author: Your Name
  version: 1.2.0
  mcp-server: notion-mcp
---
```

**`license`** — Use for open-source skills. Common values: `MIT`, `Apache-2.0`.

**`compatibility`** — 1–500 characters. Documents environment requirements: required packages, network access needs, intended product surface.

**`metadata`** — Freeform key-value pairs. Suggested: `author`, `version`, `mcp-server`.

---

## 6. Writing Descriptions That Trigger Correctly (CSO)

Claude Search Optimization (CSO) is the practice of writing skill metadata so that Claude reliably finds and triggers your skill when appropriate — and does not trigger it when inappropriate.

### The Core Principle: Description = When, Not What

**The description field should describe triggering conditions only. It should NOT summarize the skill's workflow or process.**

This is the most important and most commonly violated rule in skill writing.

**Why it matters:** Testing has revealed a critical failure mode. When a description summarizes the skill's workflow, Claude may follow the description as a shortcut instead of reading the full `SKILL.md` body. The description becomes the skill — Claude skips loading the actual instructions.

**Observed failure:** A description saying "executes tasks with code review between tasks" caused Claude to perform one review, even though the skill's flowchart clearly showed two distinct review stages. When the description was changed to "Use when executing implementation plans with independent tasks" (no workflow detail), Claude correctly read the full skill and followed the two-stage process.

**The trap:** Workflow summaries in descriptions create a shortcut Claude will take. The skill body becomes documentation Claude skips.

### Description Format

```
[What it does] + [When to use it: specific phrases, file types, symptoms]
```

Written in **third person**. The description is injected into the system prompt, and inconsistent point-of-view causes discovery problems.

- Good: "Processes Excel files and generates reports"
- Bad: "I can help you process Excel files"
- Bad: "You can use this to process Excel files"

### Good Description Examples

```yaml
# Specific capabilities + explicit trigger phrases
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# File types + trigger conditions
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Triggering symptoms, not workflow
description: Use when tests have race conditions, timing dependencies, or pass/fail inconsistently.

# Explicit user phrases
description: Manages Linear project workflows including sprint planning, task creation, and status tracking. Use when user mentions "sprint", "Linear tasks", "project planning", or asks to "create tickets".
```

### Bad Description Examples

```yaml
# Too vague
description: Helps with projects.

# Missing triggers
description: Creates sophisticated multi-page documentation systems.

# Summarizes workflow (anti-pattern)
description: Use when executing plans — dispatches subagent per task with code review between tasks.

# Too technical, no user triggers
description: Implements the Project entity model with hierarchical relationships.

# First person
description: I can help you with async tests when they're flaky.

# Technology-specific when skill is not
description: Use when tests use setTimeout/sleep and are flaky.
```

### Negative Triggers

Add negative triggers when a skill is over-triggering:

```yaml
description: Advanced data analysis for CSV files. Use for statistical modeling, regression, clustering. Do NOT use for simple data exploration or visualization (use data-viz skill instead).
```

### Keyword Coverage

Include words Claude would search for:
- **Error messages:** "ENOTEMPTY", "race condition", "Connection refused"
- **Symptoms:** "flaky", "hanging", "zombie", "inconsistent"
- **Synonyms:** "timeout/hang/freeze", "cleanup/teardown"
- **Tools and file types:** Actual command names, library names, extensions

### Description Length vs Budget Tradeoff

Every character in a description reduces capacity for other skills. With the default 16,000-character budget:

- A 263-char description costs ~372 chars with XML overhead: ~42 skills
- A 130-char description costs ~239 chars with XML overhead: ~67 skills

Keep descriptions focused. If you have many skills, shorter descriptions preserve budget for all of them to be discoverable.

---

## 7. Body Structure Best Practices

### Recommended SKILL.md Structure

```markdown
---
name: your-skill
description: [Specific triggering conditions only, third person]
---

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to Use
[Optional: small flowchart only if the decision is non-obvious]

Bullet list of symptoms and contexts
When NOT to use (scope boundaries)

## Quick Reference
Table or bullets for scanning common operations

## Core Instructions / Workflow
Step-by-step or conditional logic

## Examples
Concrete input/output pairs

## Common Mistakes
What goes wrong + fixes

## Additional Resources
- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

### Conciseness

The context window is a shared resource. Every token in `SKILL.md` competes with conversation history, other skill metadata, and your actual request once the skill is loaded.

**Default assumption:** Claude is already very smart. Only add context Claude does not already have.

Challenge every paragraph:
- "Does Claude really need this explanation?"
- "Can I assume Claude knows this?"
- "Does this paragraph justify its token cost?"

**Concise (approximately 50 tokens):**
```markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
```

**Verbose (approximately 150 tokens — avoid):**
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well.
First, you'll need to install it using pip...
```

### Degrees of Freedom

Match instruction specificity to the task's fragility:

**High freedom** (text-based instructions):
- Use when multiple approaches are valid, decisions depend on context
- Example: Code review, documentation writing, analysis

**Medium freedom** (pseudocode or scripts with parameters):
- Use when a preferred pattern exists but some variation is acceptable
- Example: Report generation, data processing

**Low freedom** (exact scripts, no parameters):
- Use when operations are fragile, consistency is critical, or a specific sequence must be followed
- Example: Database migrations, deployment steps

**Analogy:** Narrow bridge with cliffs = low freedom. Open field = high freedom.

### Be Specific and Actionable

```markdown
# Bad
Validate the data before proceeding.

# Good
Run `python scripts/validate.py --input {filename}` to check data format.
If validation fails, common issues include:
- Missing required fields (add them to the CSV)
- Invalid date formats (use YYYY-MM-DD)
```

### Include Error Handling

```markdown
## Common Issues

### MCP Connection Failed
If you see "Connection refused":
1. Verify MCP server is running: Check Settings > Extensions
2. Confirm API key is valid
3. Try reconnecting: Settings > Extensions > [Your Service] > Reconnect
```

### Workflows with Checklists

For complex multi-step workflows, provide a checklist Claude can copy into its response and check off:

```markdown
## PDF Form Filling Workflow

Copy this checklist and track your progress:

```
Task Progress:
- [ ] Step 1: Analyze the form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill the form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)
```
```

This prevents Claude from skipping critical validation steps and gives you visibility into progress.

### Feedback Loops

Include validation loops for quality-critical tasks:

```markdown
## Document Editing Process

1. Make your edits to `word/document.xml`
2. **Validate immediately:** `python scripts/validate.py unpacked_dir/`
3. If validation fails:
   - Review the error message carefully
   - Fix the issues in the XML
   - Run validation again
4. **Only proceed when validation passes**
5. Rebuild: `python scripts/pack.py unpacked_dir/ output.docx`
```

### Consistent Terminology

Choose one term and use it throughout. Mixing "API endpoint", "URL", "API route", and "path" causes Claude to treat these as different concepts. Same for "field"/"box"/"element" or "extract"/"pull"/"get"/"retrieve".

### Avoid Time-Sensitive Information

```markdown
# Bad
If you're doing this before August 2025, use the old API.
After August 2025, use the new API.

# Good
## Current method
Use the v2 API endpoint: `api.example.com/v2/messages`

## Old patterns
<details>
<summary>Legacy v1 API (deprecated)</summary>
The v1 API used: `api.example.com/v1/messages`
This endpoint is no longer supported.
</details>
```

---

## 8. Reference File Organization

### When to Use Separate Files

Put content in separate reference files when:
- The content is over 100 lines
- It is domain-specific and only needed for some tasks
- It would bloat `SKILL.md` beyond 500 lines

Keep content inline in `SKILL.md` when:
- It is always needed regardless of the task
- It is under 50 lines
- It is the core pattern or principle

### Directory Patterns

**Self-contained skill (small):**
```
defense-in-depth/
  SKILL.md    # Everything inline
```

**Skill with heavy reference:**
```
pdf/
├── SKILL.md              # Overview + navigation (main instructions)
├── FORMS.md              # Form-filling guide
├── reference.md          # API reference
├── examples.md           # Usage examples
└── scripts/
    ├── analyze_form.py
    └── validate.py
```

**Domain-organized skill:**
```
bigquery-skill/
├── SKILL.md              # Overview and navigation
└── reference/
    ├── finance.md        # Revenue, billing metrics
    ├── sales.md          # Opportunities, pipeline
    ├── product.md        # API usage, features
    └── marketing.md      # Campaigns, attribution
```

### Referencing Files from SKILL.md

Always reference supporting files explicitly from `SKILL.md` so Claude knows what each file contains and when to load it:

```markdown
## Additional Resources

- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
- For form filling, see [FORMS.md](FORMS.md)
```

Claude loads referenced files only when the current task requires them.

### The One-Level-Deep Rule

Keep references one level deep from `SKILL.md`. Never chain references.

**Bad — too deep:**
```markdown
# SKILL.md
See [advanced.md](advanced.md)...

# advanced.md
See [details.md](details.md)...

# details.md
Here's the actual information...
```

**Good — one level deep:**
```markdown
# SKILL.md

**Basic usage**: [instructions inline]
**Advanced features**: See [advanced.md](advanced.md)
**API reference**: See [reference.md](reference.md)
**Examples**: See [examples.md](examples.md)
```

When encountering nested references, Claude may use `head -100` to preview content rather than reading entire files, resulting in incomplete information.

### Table of Contents in Long Reference Files

For reference files longer than 100 lines, include a table of contents at the top:

```markdown
# API Reference

## Contents
- Authentication and setup
- Core methods (create, read, update, delete)
- Advanced features (batch operations, webhooks)
- Error handling patterns
- Code examples

## Authentication and setup
...
```

This ensures Claude can see the full scope of available information even when previewing.

### Scripts vs Reference Files

| Content Type | How Claude Uses It | Token Cost |
| ------------ | ------------------ | ---------- |
| Reference `.md` | Read into context | Loaded tokens when read |
| Script `.py`, `.sh` | Executed via bash | Only output enters context |

Prefer scripts for deterministic operations. Write `validate_form.py` rather than asking Claude to generate validation code. The script code never enters context; only its output does.

Make execution intent explicit:
- "Run `analyze_form.py` to extract fields" → Claude executes it
- "See `analyze_form.py` for the extraction algorithm" → Claude reads it

---

## 9. Dynamic Context Injection

The `!`<command>`` ` syntax (backtick-prefixed shell commands) runs shell commands as preprocessing before the skill content reaches Claude. Output replaces the placeholder in the skill's text.

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request focusing on the key changes and their impact.
```

When this skill runs:
1. Each `!`<command>`` ` executes immediately (before Claude sees anything)
2. Output replaces the placeholder in the skill content
3. Claude receives the fully-rendered prompt with actual live data

This is preprocessing — Claude only sees the final rendered result, not the shell command syntax.

### Available String Substitutions

| Variable | Description |
| -------- | ----------- |
| `$ARGUMENTS` | All arguments passed when invoking the skill |
| `$ARGUMENTS[N]` | Specific argument by 0-based index (`$ARGUMENTS[0]`, `$ARGUMENTS[1]`) |
| `$N` | Shorthand: `$0` = first arg, `$1` = second arg |
| `${CLAUDE_SESSION_ID}` | Current session ID — useful for logging or creating session-specific files |
| `${CLAUDE_SKILL_DIR}` | Directory containing the skill's `SKILL.md` — use for referencing bundled scripts portably |

**Example using `${CLAUDE_SKILL_DIR}` for portable script references:**

```yaml
---
name: analyze-codebase
description: Generate a structural analysis of the current project
---

Run the analysis:

```bash
python ${CLAUDE_SKILL_DIR}/scripts/analyze.py .
```
```

This ensures the script path works regardless of where the skill is installed or what directory the user is working in.

**Example using `$ARGUMENTS`:**

```yaml
---
name: fix-issue
description: Fix a GitHub issue by number
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description with `gh issue view $ARGUMENTS`
2. Understand the requirements
3. Implement the fix
4. Write tests
5. Create a commit
```

Run `/fix-issue 123` and `$ARGUMENTS` becomes `123`.

**Positional arguments:**

```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---

Migrate the $0 component from $1 to $2.
Preserve all existing behavior and tests.
```

Run `/migrate-component SearchBar React Vue`:
- `$0` → `SearchBar`
- `$1` → `React`
- `$2` → `Vue`

---

## 10. How Skills Invoke Other Skills

### Cross-Referencing in Skill Body

Reference other skills by name with explicit requirement markers:

```markdown
# Good
**REQUIRED SUB-SKILL:** Use superpowers:test-driven-development before writing any code.

# Good
**REQUIRED BACKGROUND:** You MUST understand the simplify skill before using this.

# Bad — path reference, unclear if required
See skills/testing/test-driven-development

# Bad — @ syntax force-loads immediately, burning context
@skills/testing/test-driven-development/SKILL.md
```

**Why no `@` links:** The `@` syntax in CLAUDE.md force-loads the entire referenced file immediately, consuming context before it is needed. Skill cross-references should be by name only.

### Using the Skill Tool from Instructions

Skill bodies can instruct Claude to invoke other skills via the Skill tool:

```markdown
## After Completing Implementation

1. **Simplify** — Invoke the `Skill` tool with `skill: "simplify"` to review and clean up your changes.
2. **Run tests** — Run the project's test suite.
```

This is how `/batch` workers are instructed to call `/simplify` — it is a documented pattern in Anthropic's own built-in skills.

### Skill Composition via `context: fork`

A skill with `context: fork` spawns an isolated subagent. That subagent can receive pre-loaded skills:

```yaml
---
name: deep-research
description: Research a topic thoroughly using the codebase explorer
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

Skills and subagents compose in two directions:

| Approach | System Prompt | Task |
| -------- | ------------- | ---- |
| Skill with `context: fork` | From agent type (Explore, Plan, etc.) | SKILL.md content |
| Subagent with `skills` field | Subagent's markdown body | Claude's delegation message |

### Enabling Extended Thinking

To enable extended thinking in a skill, include the word "ultrathink" anywhere in the skill content. No additional configuration is required.

---

## 11. Auto-Triggering vs Manual Triggering

### Auto-Triggering (Default)

By default, both the user and Claude can invoke any skill. Claude auto-triggers a skill when it determines the current task matches the skill's description.

**When auto-triggering is appropriate:**
- Knowledge skills (API conventions, style guides, domain knowledge)
- Skills that enhance any relevant task without side effects
- Reference material that should load transparently

### Manual-Only Triggering (`disable-model-invocation: true`)

Setting `disable-model-invocation: true` in frontmatter:
- Removes the skill description from the context entirely
- Prevents Claude from knowing the skill exists
- Only the user can trigger it via `/skill-name`

**When manual-only is appropriate:**
- Deploy scripts (`/deploy`)
- Commit workflows (`/commit`)
- Anything with side effects you want explicit control over
- Workflows where Claude deciding "it looks ready" would be dangerous

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy $ARGUMENTS to production:
1. Run the test suite
2. Build the application
3. Push to the deployment target
4. Verify the deployment succeeded
```

### Background Knowledge (`user-invocable: false`)

Setting `user-invocable: false`:
- Hides the skill from the `/` slash menu
- Claude can still auto-trigger it
- Users cannot type `/skill-name` to invoke it

**When background-only is appropriate:**
- Legacy system context that Claude should know but that is not a user action
- Conventions that should always apply silently
- Reference knowledge that is not meant to be a command

### Restricting Claude's Access to Specific Skills

Use permission rules to control which skills Claude can invoke:

```text
# In /permissions — deny all skills
Skill

# Allow only specific skills
Skill(commit)
Skill(review-pr *)

# Deny specific skills (allow all others)
Skill(deploy *)
```

Permission syntax: `Skill(name)` for exact match, `Skill(name *)` for prefix match.

Note: `user-invocable: false` only hides from the menu. Use `disable-model-invocation: true` to actually block Claude's programmatic access.

---

## 12. Performance: Limits, Budgets, Context Impact

### The 500-Line Target

Keep `SKILL.md` body under 500 lines for optimal performance. This is a soft target, not a hard limit, but exceeding it degrades response quality as the skill competes for context.

If your skill is growing beyond 500 lines:
- Move detailed documentation to reference files
- Split into multiple focused skills
- Use progressive disclosure patterns to defer loading

### Description Character Budget

| Budget Type | Value |
| ----------- | ----- |
| Default budget | 2% of context window, fallback to 16,000 characters |
| Per-skill overhead | Description length + ~109 chars XML |
| Overflow behavior | Silent exclusion — Claude does not know excluded skills exist |
| Override env var | `SLASH_COMMAND_TOOL_CHAR_BUDGET` |

Keep descriptions concise. The practical capacity at typical lengths:
- 130-char descriptions: ~67 skills before budget exceeded
- 200-char descriptions: ~52 skills
- 263-char descriptions: ~42 skills

Check `/context` for budget warnings.

### Token Costs by Loading Level

| Content | Token Cost | Notes |
| ------- | ---------- | ----- |
| Skill metadata (name + description) | ~100 tokens | Always loaded |
| SKILL.md body (average skill) | ~2,000–4,000 tokens | Loaded when triggered |
| Reference file (100 lines) | ~800 tokens | Only when read |
| Script execution | 0 tokens (code) + output tokens | Code never enters context |

### Enabling Extended Thinking

To enable extended thinking (higher-quality reasoning at the cost of more tokens) for a skill, include "ultrathink" anywhere in the skill content.

### Multiple Models

Skills act as additions to models. The same skill may work differently across models:
- **Claude Haiku:** May need more explicit guidance; benefits from more detailed instructions
- **Claude Sonnet:** Balanced — clear, efficient instructions work best
- **Claude Opus:** Powerful reasoning — avoid over-explaining; trust it to infer

Test with all models you plan to use. What works for Opus may need more detail for Haiku.

### Reducing Simultaneous Skills

If you have more than 50 skills enabled, consider:
- Disabling skills not relevant to current work
- Organizing into "packs" for related capabilities
- Using `disable-model-invocation: true` for rarely-needed skills to remove them from the budget

---

## 13. Testing Skills with Subagents (TDD Approach)

The superpowers reference library applies Test-Driven Development principles to skill creation: write a failing test before writing the skill, verify the skill causes the test to pass, then refactor to close loopholes.

### The Iron Law

**No skill without a failing test first.**

This applies to new skills AND edits to existing skills. The rule exists because:
- "Clear to you" does not equal "clear to an agent under pressure"
- Skills can have gaps that only appear in real execution
- Untested skills have issues. Always.

### RED-GREEN-REFACTOR for Skills

**RED — Write Failing Test (Baseline)**

Run a pressure scenario with a subagent WITHOUT the skill. Document exact behavior:
- What choices did the agent make?
- What rationalizations did it use (verbatim)?
- Which pressures triggered violations?

This is "watch the test fail." You must see what agents naturally do before writing the skill.

**GREEN — Write Minimal Skill**

Write the skill addressing those specific rationalizations. Run the same scenarios WITH the skill. The agent should now comply.

**REFACTOR — Close Loopholes**

Did the agent find a new rationalization? Add an explicit counter. Re-test until bulletproof.

### Test Types by Skill Category

**Discipline-enforcing skills** (TDD, code review, verification gates):
- Academic questions: Do they understand the rules?
- Pressure scenarios: Do they comply under stress (time + sunk cost + exhaustion)?
- Combined pressures: Multiple rationalizations simultaneously
- Success: Agent follows rule under maximum pressure

**Technique skills** (how-to guides, implementation patterns):
- Application scenarios: Can they apply the technique correctly?
- Variation scenarios: Do they handle edge cases?
- Missing information tests: Are there gaps in instructions?
- Success: Agent successfully applies technique to a new scenario

**Reference skills** (API docs, command references):
- Retrieval scenarios: Can they find the right information?
- Application scenarios: Can they use what they found correctly?
- Gap testing: Are common use cases covered?
- Success: Agent finds and correctly applies reference information

### Testing Against Rationalization

Agents are smart and will find loopholes under pressure. Bulletproof skill writing:

**Close every loophole explicitly:**
```markdown
# Bad
Write code before test? Delete it.

# Good
Write code before test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete
```

**Address "spirit vs letter" arguments:**
```markdown
**Violating the letter of the rules is violating the spirit of the rules.**
```

**Build a rationalization table:**
```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = what does this do? Tests-first = what should this do? |
```

### Testing Reference Skills

Reference skills need different tests:
- Run retrieval scenarios where you know what information the agent should find
- Ask the agent to apply the reference to a concrete task
- Identify gaps by noting when the agent had to guess or invent

### The Subagent Testing Pattern

Launch a fresh subagent with no memory of the skill creation process. Give it a task that requires the skill. Observe what it does. If it behaves correctly: GREEN. If it rationalizes or fails: RED — document the rationalization and plug the gap.

The subagent should have the skill available but should not have been told "use this skill." Discovery should happen naturally via the description.

---

## 14. Anthropic's Own Skill Implementations as Examples

### `/simplify` — Bundled Skill

`/simplify` reviews recently changed files for code reuse, quality, and efficiency, then fixes issues. It is a bundled skill compiled into the Claude Code binary.

**What it demonstrates:**
- A skill that spawns three parallel subagents (Reuse Review, Quality Review, Efficiency Review)
- Collecting and aggregating parallel findings before fixing
- Integration as a building block: `/batch` workers auto-invoke `/simplify` after completing their units
- Invocation from another skill's instructions: `Invoke the Skill tool with skill: "simplify"`

**Key structural pattern:**
1. Phase 1: Identify changes (`git diff`)
2. Phase 2: Launch three agents in parallel with the full diff
3. Phase 3: Wait for all agents, aggregate findings, fix each issue

### `/batch` — Bundled Skill

`/batch` orchestrates large-scale parallel changes across a codebase. It is a manual-only skill (`disable-model-invocation: true` equivalent behavior, requiring explicit argument) compiled into the binary.

**What it demonstrates:**
- Research phase using Plan mode before execution
- Decomposing work into 5–30 independent units
- Spawning one background agent per unit with `isolation: "worktree"` and `run_in_background: true`
- Tracking progress via a status table updated as agents complete
- Worker instructions that are fully self-contained (each worker gets the full context it needs)
- Embedding sub-skill invocation in worker instructions: each worker runs `/simplify` before creating its PR

**Key structural pattern:**
1. Phase 1: Research and Plan (Enter Plan Mode → research → decompose → define e2e test recipe → write plan → Exit Plan Mode)
2. Phase 2: Spawn Workers (one Agent per unit, all in parallel, all in isolated worktrees)
3. Phase 3: Track Progress (status table, parse PR URLs from agent output)

### The `simplify → batch` Relationship

These two skills compose: `/batch` uses `/simplify` as a quality gate. Every batch worker, after completing implementation, invokes `Skill(simplify)` before running tests and creating a PR. This demonstrates the skill composition pattern in production.

### Anthropic Pre-Built Skills (PDF, DOCX, XLSX, PPTX)

The four document-processing skills demonstrate the reference file organization pattern at scale:

```
pdf/
├── SKILL.md              # Overview, quick start, links to supporting files
├── FORMS.md              # Form-filling guide (loaded only for form tasks)
├── reference.md          # Complete API reference (loaded only when needed)
├── examples.md           # Usage examples (loaded only when needed)
└── scripts/
    ├── analyze_form.py   # Executed, never loaded into context
    ├── fill_form.py
    └── validate.py
```

**Lessons from these implementations:**
- `SKILL.md` provides a quick start + navigation to deeper material
- Heavy reference is in separate files, linked explicitly
- Scripts handle deterministic operations — no code generation in context
- The main file stays under 500 lines because detailed content is elsewhere

---

## 15. Common Anti-Patterns and How to Avoid Them

### Anti-Pattern 1: Workflow Summary in Description

**Problem:** Description summarizes the workflow process. Claude uses the description as a shortcut instead of reading the full skill.

**Bad:**
```yaml
description: Use when executing plans — dispatches subagent per task with code review between tasks
```

**Good:**
```yaml
description: Use when executing implementation plans with independent tasks
```

### Anti-Pattern 2: Vague Description Without Triggers

**Problem:** Description tells Claude what the skill is, but not when to use it.

**Bad:**
```yaml
description: Creates sophisticated multi-page documentation systems.
```

**Good:**
```yaml
description: Creates multi-page documentation systems. Use when user asks to "write docs", "create documentation", or produce technical reference material.
```

### Anti-Pattern 3: Force-Loading with @ Syntax

**Problem:** Using `@` syntax to reference other skill files in skill body. This force-loads the entire referenced file immediately, consuming 200k+ context before it is needed.

**Bad:**
```markdown
See @skills/testing/test-driven-development/SKILL.md for background.
```

**Good:**
```markdown
**REQUIRED BACKGROUND:** You MUST understand the test-driven-development skill.
```

### Anti-Pattern 4: Deeply Nested References

**Problem:** `SKILL.md` → `advanced.md` → `details.md`. Claude may use `head -100` to preview instead of reading full files.

**Rule:** All reference files must link directly from `SKILL.md`. Maximum one level of indirection.

### Anti-Pattern 5: Narrative Storytelling

**Problem:** Skill body reads like a case study: "In session 2025-10-03, we found that..."

Skills are reference guides for patterns, not narratives about how a problem was solved once. Narratives are too specific to be reusable.

**Fix:** Extract the generalizable pattern. Write it in present tense as a technique.

### Anti-Pattern 6: Multi-Language Code Examples

**Problem:** Providing the same example in 5 languages creates maintenance burden and mediocre quality in each.

**Rule:** One excellent example beats many mediocre ones. Choose the most relevant language for the skill's domain. Claude can port it.

### Anti-Pattern 7: Windows-Style Paths

**Problem:** Skills with backslash paths (`scripts\helper.py`) fail on Unix systems.

**Rule:** Always use forward slashes in all file paths, even when writing on Windows.

### Anti-Pattern 8: Assuming Tool Availability

**Problem:** Skill assumes `pip install` can run, network is accessible, or specific packages are pre-installed.

**Fix:** List required packages explicitly. Check runtime constraints for each platform. See the Portability section for platform-specific constraints.

### Anti-Pattern 9: Too Many Choices

**Problem:** Presenting 5 different library options paralyzes Claude and produces inconsistent results.

**Bad:**
```markdown
You can use pypdf, or pdfplumber, or PyMuPDF, or pdf2image, or...
```

**Good:**
```markdown
Use pdfplumber for text extraction.

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

Provide a default with a single escape hatch for the known exception case.

### Anti-Pattern 10: Not Testing Before Deployment

**Problem:** Writing a skill that "looks correct" without running a failing test first. Every untested skill has issues. The issues only become visible under real conditions, often after the skill has been in production for a while.

**Fix:** Follow the TDD cycle. Run a subagent on the target task without the skill first. Document what it does wrong. Write the skill to fix specifically those failures.

### Anti-Pattern 11: Skill Body Contains README-Style Content

**Problem:** Skill includes installation instructions, version history, or contributor guidelines. This is documentation for humans, not instructions for Claude.

**Fix:** Keep skill body focused on what Claude needs to execute the skill's purpose. Human-facing documentation goes in a repo-level `README.md` outside the skill folder.

### Anti-Pattern 12: `README.md` Inside Skill Folder

**Problem:** Including a `README.md` in the skill directory. The system expects `SKILL.md`. A `README.md` is ignored by the skills system and confuses the directory structure.

**Fix:** All documentation goes in `SKILL.md` or reference files. Repo-level `README.md` lives outside the skill folder.

---

## 16. Portability Considerations

### The Open Standard

Anthropic published Agent Skills as an open standard ([agentskills.io](https://agentskills.io)). The same `SKILL.md` format works across Claude.ai, Claude Code, the Claude API, and other AI tools that have adopted the standard (including Codex CLI and ChatGPT as of December 2025).

The compatibility field in frontmatter documents surface-specific requirements.

### Platform Comparison

| Feature | Claude.ai | Claude Code | Claude API |
| ------- | --------- | ----------- | ---------- |
| Pre-built skills (PDF, DOCX, etc.) | Yes | No | Yes |
| Custom skills | Yes (zip upload) | Yes (filesystem) | Yes (API upload) |
| Skill sync across surfaces | No | No | No |
| Network access in skills | Varies (user/admin settings) | Full (same as user's machine) | No network access |
| Runtime package installation | Yes (npm/PyPI/GitHub) | Discouraged (install locally) | No (pre-installed only) |
| Organization-wide deployment | Not currently | Via managed settings | Workspace-wide |
| Sharing scope | Individual user | Personal/project/plugin | Workspace |

### Key Portability Constraints

**Network access:**
- Claude.ai: May have full, partial, or no network access depending on settings
- Claude Code: Full network access (same as running code on the user's machine)
- Claude API: No network access whatsoever — skills cannot make external API calls

A skill that calls external APIs will work in Claude Code but fail in Claude API. If cross-platform portability matters, design skills to work without network access, or document the requirement in the `compatibility` field.

**Package installation:**
- Claude.ai: Can install packages at runtime
- Claude Code: Can install packages, but should install locally to avoid affecting the user's system
- Claude API: Cannot install packages at runtime; only pre-installed packages in the code execution environment are available

**Custom skills are not synced:**
- A skill uploaded to Claude.ai is NOT available in Claude Code or the API
- A skill in `~/.claude/skills/` is only available in Claude Code
- Manage and deploy skills separately for each surface

### Writing Portable Skills

To maximize portability:
1. Use forward slashes in all paths
2. Use `${CLAUDE_SKILL_DIR}` for script references instead of hardcoded paths
3. Document network and package requirements in the `compatibility` field
4. Do not assume any packages are pre-installed without verification
5. Design workflows that degrade gracefully when external dependencies are unavailable
6. Test on each target surface independently

### API-Specific Considerations

For skills deployed via the Claude API:
- Requires three beta headers: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- Skills are managed via the `/v1/skills` endpoint
- Added to Messages API requests via the `container.skills` parameter
- Custom skills are workspace-wide (not per-user)
- Pre-built skills are referenced by `skill_id` (e.g., `pptx`, `xlsx`)

### Claude Code Specific Features

These features work in Claude Code but NOT in Claude.ai or the raw API:
- `disable-model-invocation`
- `user-invocable`
- `context: fork` with `agent` field
- `allowed-tools`
- `effort`
- `model` override
- Dynamic context injection with `` !`command` ``
- `${CLAUDE_SESSION_ID}` and `${CLAUDE_SKILL_DIR}` substitutions
- `argument-hint`
- Live reload from `--add-dir` directories
- Monorepo nested skill discovery
- Hooks integration

---

## 17. Quick Reference Checklist

### Before You Start

- [ ] Identified 2–3 concrete use cases with specific triggers
- [ ] Decided: inline skill or does it need reference files?
- [ ] Planned the directory structure
- [ ] Decided: auto-trigger or manual-only?

### During Development (GREEN Phase)

**File structure:**
- [ ] Folder named in kebab-case
- [ ] Main file named exactly `SKILL.md` (case-sensitive)
- [ ] No `README.md` inside skill folder

**Frontmatter:**
- [ ] Opening and closing `---` delimiters
- [ ] `name` in kebab-case, lowercase letters/numbers/hyphens, max 64 chars
- [ ] `description` in third person, includes WHAT and WHEN, max 1024 chars
- [ ] No XML tags (`<` `>`) anywhere in frontmatter
- [ ] No reserved words (`anthropic`, `claude`) in name
- [ ] Invocation control set correctly (`disable-model-invocation` or `user-invocable` if needed)

**Description (CSO):**
- [ ] Third person
- [ ] Describes triggering conditions, not workflow process
- [ ] Includes specific trigger phrases users would naturally say
- [ ] Mentions file types if relevant
- [ ] Under 500 characters (to preserve budget for other skills)

**Body:**
- [ ] Clear overview in 1–2 sentences
- [ ] Instructions are specific and actionable
- [ ] Error handling included
- [ ] Concrete examples provided
- [ ] Reference files explicitly linked
- [ ] Under 500 lines
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Forward slashes in all file paths

**Reference files:**
- [ ] All reference files linked from `SKILL.md` (one level deep only)
- [ ] Long reference files (100+ lines) have a table of contents
- [ ] Scripts documented with usage examples and expected output

### Testing (RED → GREEN → REFACTOR)

- [ ] Ran baseline scenario WITHOUT skill — documented failures and rationalizations
- [ ] Wrote skill addressing those specific failures
- [ ] Ran scenario WITH skill — agent now complies
- [ ] Identified new rationalizations → plugged them → re-tested
- [ ] Tested triggering on obvious task descriptions
- [ ] Tested triggering on paraphrased requests
- [ ] Verified skill does NOT trigger on unrelated topics
- [ ] Tested with all target models (Haiku, Sonnet, Opus)

### Before Publishing

- [ ] Run `/context` to verify skill is within character budget
- [ ] Test directly with `/skill-name` to verify it loads and runs correctly
- [ ] Ask Claude "When would you use the [skill-name] skill?" — adjust description if the answer is wrong
- [ ] If distributing: test on each target surface (Claude.ai, Claude Code, API)
- [ ] If open-source: add `license` field; add repo-level `README.md` (outside skill folder)

---

## Sources

- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Agent Skills overview — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Skill authoring best practices — Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [The Complete Guide to Building Skills for Claude — Anthropic PDF](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)
- [Equipping agents for the real world with Agent Skills — Anthropic Engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Inside Claude Code Skills: Structure, prompts, invocation — Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-skills/)
- [Claude Agent Skills: A First Principles Deep Dive — Lee Hanchung](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Agent Skills — The New Stack](https://thenewstack.io/agent-skills-anthropics-next-bid-to-define-ai-standards/)
- [Skills explained: How Skills compares to prompts, Projects, MCP, and subagents — Claude Blog](https://claude.com/blog/skills-explained)
- [Claude Code Skills Structure and Usage Guide — GitHub Gist (mellanon)](https://gist.github.com/mellanon/50816550ecb5f3b239aa77eef7b8ed8d)
- [claude-code-skill-budget-research — GitHub Gist (alexey-pelykh)](https://gist.github.com/alexey-pelykh/faa3c304f731d6a962efc5fa2a43abe1)
- Local reference: `/c/Development/cli/maxsim/docs/anthropic-skills-guide-summary.md`
- Local reference: `/c/Development/cli/maxsim/docs/superpowers-reference/skills/writing-skills/SKILL.md`
- Local reference: `/c/Development/cli/maxsim/docs/superpowers-reference/skills/writing-skills/anthropic-best-practices.md`
- Local reference: `/c/Development/cli/maxsim/docs/claude-own-skills-ref/commands-internals.md`
- Local reference: `/c/Development/cli/maxsim/docs/claude-own-skills-ref/simplify.md`
- Local reference: `/c/Development/cli/maxsim/docs/claude-own-skills-ref/batch.md`
