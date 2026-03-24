/**
 * Hook installation — registers MaxsimCLI hooks in Claude Code settings.json.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { copyDir, getHooksDir } from './copy.js';

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

    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  } catch {
    // Ignore parse errors during cleanup
  }
}
