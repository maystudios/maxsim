# Multi-Runtime Adapter Architecture

> **REMOVED FEATURE — MaxsimCLI v6 supports Claude Code only.**
>
> This document describes the multi-runtime adapter system that was removed in v6. OpenCode, Gemini CLI, and Codex support no longer exist in the codebase. This document is retained as a reference for developers who might re-add multi-runtime support in the future. Do not rely on any of the interfaces or file paths described here — they have been deleted.

## Overview

MAXSIM supported four AI runtimes: Claude Code, OpenCode, Gemini CLI, and Codex. Each runtime has different config directory conventions, command formats, frontmatter schemas, and tool naming. The adapter pattern abstracts these differences behind a shared `AdapterConfig` interface, allowing the install pipeline to write the same markdown templates to any runtime.

## 1. Adapter Interface

Defined in `packages/cli/src/core/types.ts`:

```typescript
type RuntimeName = 'claude' | 'opencode' | 'gemini' | 'codex';

interface AdapterConfig {
  runtime: RuntimeName;
  dirName: string;
  getGlobalDir(explicitDir?: string | null): string;
  getConfigDirFromHome(isGlobal: boolean): string;
  transformContent(content: string, pathPrefix: string): string;
  commandStructure: 'nested' | 'flat' | 'skills';
}
```

### Field Reference

| Field | Type | Purpose |
|-------|------|---------|
| `runtime` | `RuntimeName` | Identifier for the runtime |
| `dirName` | `string` | Local config directory name (e.g., `.claude`, `.opencode`, `.gemini`, `.codex`) |
| `getGlobalDir` | `(explicitDir?) => string` | Resolves the global config directory, respecting env vars and explicit overrides |
| `getConfigDirFromHome` | `(isGlobal) => string` | Returns a quoted path segment for `path.join(homeDir, ...)` in hook templating |
| `transformContent` | `(content, pathPrefix) => string` | Applies all runtime-specific content transformations to a markdown file |
| `commandStructure` | `'nested' \| 'flat' \| 'skills'` | How commands are organized on disk (see below) |

### Command Structure Types

| Value | Layout | Runtime(s) |
|-------|--------|------------|
| `nested` | `commands/maxsim/help.md` | Claude Code, Gemini CLI |
| `flat` | `command/maxsim-help.md` | OpenCode |
| `skills` | `skills/maxsim-help/SKILL.md` | Codex |

## 2. Per-Runtime Adapters

All adapters are in `packages/cli/src/adapters/` and follow the same pattern: define `getGlobalDir`, `getConfigDirFromHome`, `transformContent`, then export an `AdapterConfig` object.

### 2.1 Claude Code (`adapters/claude.ts`)

The simplest adapter. Claude Code is the "native" format -- all templates are authored for Claude first, so transformations are minimal.

| Property | Value / Behavior |
|----------|-----------------|
| `runtime` | `'claude'` |
| `dirName` | `'.claude'` |
| `getGlobalDir` | Priority: `explicitDir` > `CLAUDE_CONFIG_DIR` env > `~/.claude` |
| `getConfigDirFromHome` | Always returns `"'.claude'"` (same for global and local) |
| `transformContent` | Replaces `~/.claude/` with `pathPrefix`, replaces `./.claude/` with `./.claude/` |
| `commandStructure` | `'nested'` |

### 2.2 OpenCode (`adapters/opencode.ts`)

OpenCode follows the XDG Base Directory Specification, resulting in more complex directory resolution. It uses a flat command structure where nested directory names become hyphenated prefixes.

| Property | Value / Behavior |
|----------|-----------------|
| `runtime` | `'opencode'` |
| `dirName` | `'.opencode'` |
| `getGlobalDir` | Priority: `explicitDir` > `OPENCODE_CONFIG_DIR` > `dirname(OPENCODE_CONFIG)` > `XDG_CONFIG_HOME/opencode` > `~/.config/opencode` |
| `getConfigDirFromHome` | Local: `"'.opencode'"`, Global: `"'.config', 'opencode'"` (for `path.join` in hooks) |
| `transformContent` | Calls `replacePathReferences` (`.claude/` -> `.opencode/`), replaces `~/.opencode/` with `pathPrefix`, then calls `convertClaudeToOpencodeFrontmatter` |
| `commandStructure` | `'flat'` |

**Key differences from Claude:**
- XDG-compliant directory resolution (4 env var fallbacks)
- `getConfigDirFromHome` returns different values for global vs local
- Frontmatter conversion: `allowed-tools:` array becomes `tools:` object with `tool: true` entries
- Tool names are remapped (e.g., `AskUserQuestion` -> `question`, `SlashCommand` -> `skill`)
- Color names converted to hex codes
- `name:` field stripped (OpenCode uses filename)
- Slash commands: `/maxsim:` -> `/maxsim-`
- Path references: `~/.claude` -> `~/.config/opencode`
- Agent type: `subagent_type="general-purpose"` -> `subagent_type="general"`

### 2.3 Gemini CLI (`adapters/gemini.ts`)

Gemini uses a nested structure like Claude but converts command files to TOML format instead of markdown. Agent files remain as markdown but undergo tool name remapping and frontmatter restructuring.

| Property | Value / Behavior |
|----------|-----------------|
| `runtime` | `'gemini'` |
| `dirName` | `'.gemini'` |
| `getGlobalDir` | Priority: `explicitDir` > `GEMINI_CONFIG_DIR` env > `~/.gemini` |
| `getConfigDirFromHome` | Always returns `"'.gemini'"` |
| `transformContent` | Calls `replacePathReferences`, `stripSubTags` (HTML `<sub>` -> italic), `convertClaudeToGeminiToml` |
| `commandStructure` | `'nested'` |

**Key differences from Claude:**
- Commands are converted to TOML: `description = "..."` and `prompt = "..."` (file extension changes from `.md` to `.toml`)
- HTML `<sub>` tags stripped and converted to italic `*(text)*`
- Agent frontmatter: `allowed-tools:` becomes `tools:` YAML array
- Tool names remapped via Gemini tool map (e.g., `Read` -> `read_file`, `Bash` -> `run_shell_command`, `Edit` -> `replace`)
- `mcp__*` tools excluded (auto-discovered at runtime in Gemini)
- `Task` tool excluded (agents are auto-registered as tools)
- `color:` field removed (causes validation errors)
- `${VAR}` patterns escaped to `$$VAR` for Gemini template compatibility
- Install also enables `settings.experimental.enableAgents = true`

### 2.4 Codex (`adapters/codex.ts`)

Codex uses a skills-based structure where each command becomes a directory containing a `SKILL.md` file with a special adapter header.

| Property | Value / Behavior |
|----------|-----------------|
| `runtime` | `'codex'` |
| `dirName` | `'.codex'` |
| `getGlobalDir` | Priority: `explicitDir` > `CODEX_HOME` env > `~/.codex` |
| `getConfigDirFromHome` | Always returns `"'.codex'"` |
| `transformContent` | Calls `replacePathReferences`, replaces `~/.codex/` with `pathPrefix`, calls `convertClaudeCommandToCodexSkill` |
| `commandStructure` | `'skills'` |

**Key differences from Claude:**
- Each command becomes `skills/<name>/SKILL.md` (directory per command)
- Slash commands converted: `/maxsim:help` -> `$maxsim-help`
- `$ARGUMENTS` placeholder -> `{{MAXSIM_ARGS}}`
- Each skill file gets a `<codex_skill_adapter>` header block explaining invocation and legacy orchestration compatibility
- Frontmatter includes: `name`, `description`, and `metadata.short-description` (truncated to 180 chars)
- `Task(...)` patterns documented as legacy; mapped to Codex collaboration tools (`spawn_agent`, `wait`, `send_input`, `close_agent`)
- Hooks and `package.json` (CommonJS mode) are NOT installed for Codex
- MCP server is NOT configured for Codex

## 3. Transform Pipeline

Transforms live in `packages/cli/src/adapters/transforms/` and are composed by each adapter's `transformContent` function. There are three modules:

### 3.1 Tool Maps (`transforms/tool-maps.ts`)

Maps Claude Code tool names to their equivalents in other runtimes.

**Claude -> OpenCode mapping:**

| Claude Tool | OpenCode Tool |
|-------------|---------------|
| `AskUserQuestion` | `question` |
| `SlashCommand` | `skill` |
| `TodoWrite` | `todowrite` |
| `WebFetch` | `webfetch` |
| `WebSearch` | `websearch` |
| Other tools | lowercased (e.g., `Read` -> `read`) |
| `mcp__*` tools | kept as-is |

**Claude -> Gemini mapping:**

| Claude Tool | Gemini Tool |
|-------------|-------------|
| `Read` | `read_file` |
| `Write` | `write_file` |
| `Edit` | `replace` |
| `Bash` | `run_shell_command` |
| `Glob` | `glob` |
| `Grep` | `search_file_content` |
| `WebSearch` | `google_web_search` |
| `WebFetch` | `web_fetch` |
| `TodoWrite` | `write_todos` |
| `AskUserQuestion` | `ask_user` |
| `mcp__*` tools | excluded (null) |
| `Task` | excluded (null) |
| Other tools | lowercased |

### 3.2 Frontmatter (`transforms/frontmatter.ts`)

Handles YAML frontmatter conversion between runtimes.

**`convertClaudeToOpencodeFrontmatter(content)`**
1. Replaces tool name references in body text (`AskUserQuestion` -> `question`, etc.)
2. Replaces `/maxsim:` with `/maxsim-` (flat command refs)
3. Replaces `~/.claude` with `~/.config/opencode`
4. Replaces `subagent_type="general-purpose"` with `subagent_type="general"`
5. Parses frontmatter if present:
   - Converts `allowed-tools:` YAML array to `tools:` object with `tool: true` entries
   - Converts color names to hex codes (using `colorNameToHex` map)
   - Removes `name:` field
   - Applies OpenCode tool name mapping

**`convertClaudeToGeminiToml(content)`**
1. If no frontmatter: wraps entire content as `prompt = "..."` in TOML
2. If frontmatter present: extracts `description:` field and body
3. Outputs TOML: `description = "..."` (if present) and `prompt = "..."`

**`convertClaudeCommandToCodexSkill(content, skillName)`**
1. Runs `convertClaudeToCodexMarkdown` first (slash commands and `$ARGUMENTS`)
2. Extracts frontmatter `description:` field (or generates default)
3. Truncates description to 180 chars for `short-description`
4. Generates `<codex_skill_adapter>` header via `getCodexSkillAdapterHeader`
5. Assembles final SKILL.md with `name`, `description`, `metadata.short-description` frontmatter

### 3.3 Content (`transforms/content.ts`)

Handles body content transformations.

**`convertSlashCommandsToCodexSkillMentions(content)`** -- Converts `/maxsim:command-name` to `$maxsim-command-name`

**`convertClaudeToCodexMarkdown(content)`** -- Applies slash command conversion and replaces `$ARGUMENTS` with `{{MAXSIM_ARGS}}`

**`stripSubTags(content)`** -- Converts `<sub>text</sub>` to `*(text)*` for terminal compatibility

**`convertClaudeToGeminiAgent(content)`** -- Full agent file conversion for Gemini:
1. Parses frontmatter, collects tools from `allowed-tools:` or `tools:`
2. Maps each tool via `convertGeminiToolName` (excludes `mcp__*` and `Task`)
3. Removes `color:` field
4. Outputs `tools:` as YAML array with dashes
5. Escapes `${VAR}` to `$$VAR` in body
6. Strips `<sub>` tags

**`replacePathReferences(content, pathPrefix, dirName)`** -- Generic path replacement used by all non-Claude adapters: `~/.claude/` -> `pathPrefix`, `./.claude/` -> `./<dirName>/`

### 3.4 Base Utilities (`adapters/base.ts`)

Shared utilities used across all adapters:
- `expandTilde(path)` -- Expands `~/` to the OS home directory
- `extractFrontmatterAndBody(content)` -- Splits markdown into frontmatter and body
- `processAttribution(content, attribution)` -- Handles `Co-Authored-By:` lines (remove, keep, or replace)
- `buildHookCommand(configDir, hookName)` -- Generates `node "<path>/hooks/<hookName>"` commands
- `readSettings(path)` / `writeSettings(path, obj)` -- JSON settings file I/O

## 4. Install Integration

The install pipeline in `packages/cli/src/install/` uses adapters to handle per-runtime differences.

### 4.1 Adapter Resolution (`install/shared.ts`)

The `adapterMap` registry maps `RuntimeName` to `AdapterConfig`:

```typescript
const adapterMap: Record<RuntimeName, AdapterConfig> = {
  claude: claudeAdapter,
  opencode: opencodeAdapter,
  gemini: geminiAdapter,
  codex: codexAdapter,
};
```

Helper functions delegate to adapters: `getGlobalDir(runtime, dir)`, `getDirName(runtime)`, `getConfigDirFromHome(runtime, isGlobal)`.

### 4.2 Install Flow (`install/index.ts`)

The `install(isGlobal, runtime)` function handles per-runtime branching:

1. **Command installation** -- Branched by `commandStructure`:
   - OpenCode (`flat`): `copyFlattenedCommands()` -- flattens `commands/maxsim/*.md` to `command/maxsim-*.md`
   - Codex (`skills`): `copyCommandsAsCodexSkills()` -- creates `skills/maxsim-*/SKILL.md` per command
   - Claude/Gemini (`nested`): `copyWithPathReplacement()` -- preserves directory structure

2. **Workflow/template installation** -- `copyWithPathReplacement()` for all runtimes

3. **Agent installation** -- Per-runtime content transformation:
   - OpenCode: `convertClaudeToOpencodeFrontmatter()`
   - Gemini: `convertClaudeToGeminiAgent()`
   - Codex: `convertClaudeToCodexMarkdown()`

4. **Binary/hook installation** -- Skipped for Codex (no CLI binary or hooks)

5. **MCP server configuration** -- `.mcp.json` written only for Claude (not OpenCode, Gemini, or Codex)

6. **Gemini-specific** -- Enables `settings.experimental.enableAgents`

### 4.3 Copy Functions (`install/copy.ts`)

| Function | Used By | Description |
|----------|---------|-------------|
| `copyFlattenedCommands` | OpenCode | Recursively flattens nested commands into `prefix-name.md` files, applies OpenCode transforms |
| `copyCommandsAsCodexSkills` | Codex | Creates `skills/<name>/SKILL.md` per command with Codex skill adapter header |
| `copyWithPathReplacement` | All | Generic recursive copy with path replacement; branches on runtime for format conversion |
| `listCodexSkillNames` | Codex | Lists installed skill directories matching a prefix |

### 4.4 Attribution (`install/adapters.ts`)

`getCommitAttribution(runtime, explicitConfigDir)` reads per-runtime settings to determine `Co-Authored-By` handling:
- **Claude/Gemini**: Reads `settings.json` -> `attribution.commit`
- **OpenCode**: Reads `opencode.json` -> `disable_ai_attribution`
- **Codex**: Returns `undefined` (keep default)

Also contains `configureOpencodePermissions()` which sets `permission.read` and `permission.external_directory` in `opencode.json` so OpenCode can read MAXSIM reference docs.

### 4.5 Uninstall (`install/uninstall.ts`)

`uninstall(isGlobal, runtime, explicitConfigDir)` removes MAXSIM files for a specific runtime. Uses `getDirName(runtime)` and `getGlobalDir(runtime)` from the adapter registry.

## 5. Adapter Registry (`adapters/index.ts`)

Central barrel file that re-exports all adapters, transforms, and base utilities:

```typescript
function getAllAdapters(): AdapterConfig[] {
  return [claudeAdapter, opencodeAdapter, geminiAdapter, codexAdapter];
}
```

## 6. Runtime Selection (`install/index.ts`)

Users select runtimes via CLI flags or interactive prompt:

| Flag | Effect |
|------|--------|
| `--claude` | Install for Claude Code only |
| `--opencode` | Install for OpenCode only |
| `--gemini` | Install for Gemini only |
| `--codex` | Install for Codex only |
| `--all` | Install for all four runtimes |
| `--both` | Legacy flag: Claude + OpenCode |
| (none) | Interactive multi-select checkbox prompt |

## 7. Files Referencing Non-Claude Runtimes

The following files contain references to OpenCode, Gemini, or Codex and would need modification to remove multi-runtime support:

### Adapter files (remove entirely)
- `packages/cli/src/adapters/opencode.ts`
- `packages/cli/src/adapters/gemini.ts`
- `packages/cli/src/adapters/codex.ts`

### Transform files (remove entirely or gut non-Claude functions)
- `packages/cli/src/adapters/transforms/tool-maps.ts` -- Claude-to-OpenCode and Claude-to-Gemini tool maps
- `packages/cli/src/adapters/transforms/frontmatter.ts` -- `convertClaudeToOpencodeFrontmatter`, `convertClaudeToGeminiToml`, `convertClaudeCommandToCodexSkill`, `getCodexSkillAdapterHeader`
- `packages/cli/src/adapters/transforms/content.ts` -- `convertSlashCommandsToCodexSkillMentions`, `convertClaudeToCodexMarkdown`, `stripSubTags`, `convertClaudeToGeminiAgent`, `replacePathReferences`

### Adapter registry
- `packages/cli/src/adapters/index.ts` -- imports and re-exports all four adapters and all transform functions

### Type definitions
- `packages/cli/src/core/types.ts` -- `RuntimeName` union includes `'opencode' | 'gemini' | 'codex'`

### Install pipeline
- `packages/cli/src/install/index.ts` -- runtime selection flags, `promptRuntime()` choices, per-runtime branching in `install()`, Gemini experimental agents, Codex skip logic
- `packages/cli/src/install/copy.ts` -- `copyFlattenedCommands` (OpenCode), `copyCommandsAsCodexSkills` (Codex), per-runtime branches in `copyWithPathReplacement`
- `packages/cli/src/install/adapters.ts` -- `getCommitAttribution` per-runtime branches, `configureOpencodePermissions`, `getOpencodeGlobalDir` import
- `packages/cli/src/install/shared.ts` -- imports all four adapters, `adapterMap` registry, `getOpencodeGlobalDir` export
- `packages/cli/src/install/hooks.ts` -- imports `configureOpencodePermissions`
- `packages/cli/src/install/uninstall.ts` -- per-runtime uninstall labels and logic
- `packages/cli/src/install/manifest.ts` -- `listCodexSkillNames` import (Codex manifest generation)
- `packages/cli/src/install/patches.ts` -- uses `RuntimeName` type (no runtime-specific logic)

## 8. Data Flow Diagram

```
Template file (Claude-native .md)
        |
        v
+-------------------+
| Path Replacement  |  ~/.claude/ -> pathPrefix, ./.claude/ -> ./.<runtime>/
+-------------------+
        |
        v
+-------------------+
| Attribution       |  Co-Authored-By processing per runtime settings
+-------------------+
        |
        v
+-------------------+
| Content Transform |  Runtime-specific: frontmatter, tool names, format
+-------------------+
        |
        v
+-------------------+
| File Output       |  .md (Claude/OpenCode/Codex) or .toml (Gemini commands)
+-------------------+
        |
        v
+-------------------+
| Disk Layout       |  nested/ flat/ skills/ per commandStructure
+-------------------+
```
