/**
 * Hook installation — registers MaxsimCLI hooks in Claude Code settings.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { copyDir, getHooksDir, getTemplatesDir } from './copy.js';

interface HookEntry {
  type: 'command';
  command: string;
}

interface HookMatcher {
  hooks: HookEntry[];
}

interface SettingsJson {
  hooks?: Record<string, HookMatcher[]>;
  statusLine?: { type: 'command'; command: string };
  env?: Record<string, string>;
  permissions?: { allow?: string[]; deny?: string[] };
  [key: string]: unknown;
}

/** Install hook scripts to .claude/hooks/ and register them in settings.json. */
export function installHooks(projectDir: string): { installed: string[] } {
  const claudeDir = path.join(projectDir, '.claude');
  const hooksDestDir = path.join(claudeDir, 'maxsim', 'hooks');
  const settingsPath = path.join(claudeDir, 'settings.json');

  // Copy hook scripts from bundled assets
  const hooksSrcDir = getHooksDir();
  const copied = copyDir(hooksSrcDir, hooksDestDir);
  const installed: string[] = [];

  if (copied === 0) {
    // Guarantee settings.json exists even if no hooks were copied
    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, `${JSON.stringify({ hooks: {} }, null, 2)}\n`, 'utf8');
    }
    return { installed };
  }

  // Read or create settings.json
  let settings: SettingsJson = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }

  // Ensure hooks section exists
  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Register SessionStart hook (update check)
  const updateCheckPath = path.join(hooksDestDir, 'maxsim-check-update.cjs');
  if (fs.existsSync(updateCheckPath)) {
    registerHook(settings, 'SessionStart', `node "${updateCheckPath}"`);
    installed.push('maxsim-check-update (SessionStart)');
  }

  // Register Notification hook (question sound)
  const notifSoundPath = path.join(hooksDestDir, 'maxsim-notification-sound.cjs');
  if (fs.existsSync(notifSoundPath)) {
    registerHook(settings, 'Notification', `node "${notifSoundPath}"`);
    installed.push('maxsim-notification-sound (Notification)');
  }

  // Register Stop hook (completion sound)
  const stopSoundPath = path.join(hooksDestDir, 'maxsim-stop-sound.cjs');
  if (fs.existsSync(stopSoundPath)) {
    registerHook(settings, 'Stop', `node "${stopSoundPath}"`);
    installed.push('maxsim-stop-sound (Stop)');
  }

  // Register Stop hook (capture session learnings)
  const captureLearningsPath = path.join(hooksDestDir, 'maxsim-capture-learnings.cjs');
  if (fs.existsSync(captureLearningsPath)) {
    registerHook(settings, 'Stop', `node "${captureLearningsPath}"`);
    installed.push('maxsim-capture-learnings (Stop)');
  }

  // Register SessionStart hook (session context injection)
  const sessionStartPath = path.join(hooksDestDir, 'maxsim-session-start.cjs');
  if (fs.existsSync(sessionStartPath)) {
    registerHook(settings, 'SessionStart', `node "${sessionStartPath}"`);
    installed.push('maxsim-session-start (SessionStart)');
  }

  // Register TeammateIdle hook (pending task check)
  const teammateIdlePath = path.join(hooksDestDir, 'maxsim-teammate-idle.cjs');
  if (fs.existsSync(teammateIdlePath)) {
    registerHook(settings, 'TeammateIdle', `node "${teammateIdlePath}"`);
    installed.push('maxsim-teammate-idle (TeammateIdle)');
  }

  // Register TaskCompleted hook (verification gates)
  const taskCompletedPath = path.join(hooksDestDir, 'maxsim-task-completed.cjs');
  if (fs.existsSync(taskCompletedPath)) {
    registerHook(settings, 'TaskCompleted', `node "${taskCompletedPath}"`);
    installed.push('maxsim-task-completed (TaskCompleted)');
  }

  // Register statusLine (only if not already set, or if it's already ours)
  const statusLinePath = path.join(hooksDestDir, 'maxsim-statusline.cjs');
  if (fs.existsSync(statusLinePath)) {
    const existingStatusLine = settings.statusLine;
    if (!existingStatusLine || existingStatusLine.command.includes('maxsim-statusline')) {
      settings.statusLine = { type: 'command', command: `node "${statusLinePath}"` };
      installed.push('maxsim-statusline (statusLine)');
    }
  }

  // Enable Agent Teams
  if (!settings.env) settings.env = {};
  settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';

  // Add permissions for MaxsimCLI tools (§5.3)
  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!settings.permissions.allow) {
    settings.permissions.allow = [];
  }

  // Add default MaxsimCLI permissions
  const maxsimPermissions = [
    'Bash(npm run build)',
    'Bash(npm test)',
    'Bash(npx biome check *)',
    'Bash(gh *)',
    'Bash(git *)',
    'Bash(node *)',
  ];

  for (const perm of maxsimPermissions) {
    if (!settings.permissions.allow.includes(perm)) {
      settings.permissions.allow.push(perm);
    }
  }

  // Write settings
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

  return { installed };
}

/** Register a hook in the settings object (idempotent). */
function registerHook(
  settings: SettingsJson,
  event: string,
  command: string,
): void {
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks[event]) settings.hooks[event] = [];

  // Check if already registered (by command substring)
  const existing = settings.hooks[event].some((m) =>
    m.hooks.some((h) => h.command.includes(command.split('"')[1] ?? command)),
  );

  if (!existing) {
    settings.hooks[event].push({
      hooks: [{ type: 'command', command }],
    });
  }
}

/**
 * Load the static settings-reference.json template bundled with MaxsimCLI.
 * Returns the parsed template or null if unavailable.
 */
export function getSettingsTemplate(): SettingsJson | null {
  try {
    const templatePath = path.join(getTemplatesDir(), 'templates', 'settings-reference.json');
    if (!fs.existsSync(templatePath)) return null;
    const raw = fs.readFileSync(templatePath, 'utf8');
    const parsed = JSON.parse(raw) as SettingsJson;
    // Strip the documentation-only $comment field
    delete (parsed as Record<string, unknown>).$comment;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Restore settings.json from the static reference template.
 *
 * Merges MaxsimCLI hook entries from the template into the existing
 * settings.json (or creates a fresh one). Preserves non-maxsim user entries.
 *
 * The hook command paths are rewritten to point at the actual hooks directory
 * inside the project's .claude/maxsim/hooks/.
 *
 * @returns true if the template was applied, false if the template was unavailable.
 */
export function restoreSettingsFromTemplate(projectDir: string): boolean {
  const template = getSettingsTemplate();
  if (!template) return false;

  const claudeDir = path.join(projectDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const hooksDestDir = path.join(claudeDir, 'maxsim', 'hooks');

  // Read existing settings or start fresh
  let settings: SettingsJson = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }

  // First remove any existing maxsim hooks to avoid duplicates
  if (settings.hooks) {
    for (const event of Object.keys(settings.hooks)) {
      settings.hooks[event] = settings.hooks[event].filter(
        (m) => !m.hooks.some((h) => h.command.includes('maxsim')),
      );
      if (settings.hooks[event].length === 0) {
        delete settings.hooks[event];
      }
    }
  }

  // Merge hooks from template, rewriting paths to the project's hooks dir
  if (!settings.hooks) settings.hooks = {};
  if (template.hooks) {
    for (const [event, matchers] of Object.entries(template.hooks)) {
      if (!settings.hooks[event]) settings.hooks[event] = [];
      for (const matcher of matchers) {
        const rewrittenHooks = matcher.hooks.map((h) => {
          // Rewrite the generic ".claude/maxsim/hooks/..." to the absolute path
          const rewritten = h.command.replace(
            /\.claude\/maxsim\/hooks\//g,
            `${hooksDestDir.replace(/\\/g, '/')}/`,
          );
          return { type: h.type, command: rewritten };
        });
        settings.hooks[event].push({ hooks: rewrittenHooks });
      }
    }
  }

  // Apply statusLine from template (rewrite path)
  if (template.statusLine) {
    const existingStatusLine = settings.statusLine;
    if (!existingStatusLine || existingStatusLine.command.includes('maxsim-statusline')) {
      settings.statusLine = {
        type: 'command',
        command: template.statusLine.command.replace(
          /\.claude\/maxsim\/hooks\//g,
          `${hooksDestDir.replace(/\\/g, '/')}/`,
        ),
      };
    }
  }

  // Apply env from template
  if (template.env) {
    if (!settings.env) settings.env = {};
    Object.assign(settings.env, template.env);
  }

  // Apply permissions from template
  if (template.permissions?.allow) {
    if (!settings.permissions) settings.permissions = {};
    if (!settings.permissions.allow) settings.permissions.allow = [];
    for (const perm of template.permissions.allow) {
      if (!settings.permissions.allow.includes(perm)) {
        settings.permissions.allow.push(perm);
      }
    }
  }

  // Write settings.json
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

  return true;
}

/** Remove all MaxsimCLI hooks from settings.json. */
export function removeHooks(projectDir: string): void {
  const settingsPath = path.join(projectDir, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return;

  try {
    const settings: SettingsJson = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    // Remove hooks containing 'maxsim'
    if (settings.hooks) {
      for (const event of Object.keys(settings.hooks)) {
        settings.hooks[event] = settings.hooks[event].filter(
          (m) => !m.hooks.some((h) => h.command.includes('maxsim')),
        );
        if (settings.hooks[event].length === 0) {
          delete settings.hooks[event];
        }
      }
    }

    // Remove statusLine if it's ours
    if (settings.statusLine?.command?.includes('maxsim')) {
      delete settings.statusLine;
    }

    // Remove our env var
    if (settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS) {
      delete settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    }

    // Remove MaxsimCLI permissions
    if (settings.permissions?.allow) {
      const maxsimPermissions = [
        'Bash(npm run build)',
        'Bash(npm test)',
        'Bash(npx biome check *)',
        'Bash(gh *)',
        'Bash(git *)',
        'Bash(node *)',
      ];
      settings.permissions.allow = settings.permissions.allow.filter(
        (p) => !maxsimPermissions.includes(p),
      );
      if (settings.permissions.allow.length === 0) {
        delete settings.permissions.allow;
      }
      if (Object.keys(settings.permissions).length === 0) {
        delete settings.permissions;
      }
    }

    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  } catch {
    // Ignore parse errors during cleanup
  }
}
