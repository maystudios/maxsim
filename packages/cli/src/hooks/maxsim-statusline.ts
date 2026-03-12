#!/usr/bin/env node
/**
 * Claude Code Statusline - MAXSIM Edition
 * Shows: [update] model | P{N} {BoardColumn} | {milestone}: {pct}% | dirname
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { readStdinJson, CLAUDE_DIR } from './shared';

export interface StatuslineInput {
  model?: { display_name?: string };
  workspace?: { current_dir?: string; project_dir?: string };
  session_id?: string;
}

export interface ProgressCache {
  phase_number: string | null;
  milestone_title: string | null;
  milestone_pct: number;
  board_column: string | null;
  offline?: boolean;
  updated: number;
}

const CACHE_TTL_SECONDS = 60;

/**
 * Spawn a detached Node child process to refresh the progress cache in the background.
 * The child runs gh CLI commands to detect owner/repo, find the first open milestone,
 * compute progress, and find the current phase label.
 */
function spawnBackgroundRefresh(cacheDir: string, cacheFile: string): void {
  try {
    const script = `
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Detect owner/repo
  const nameWithOwner = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
    encoding: 'utf8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();

  if (!nameWithOwner || !nameWithOwner.includes('/')) {
    process.exit(0);
  }

  const [owner, repo] = nameWithOwner.split('/');

  // Get milestones
  let milestoneTitle = null;
  let milestonePct = 0;
  try {
    const milestonesRaw = execSync(
      'gh api repos/' + owner + '/' + repo + '/milestones --jq "."',
      { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    ).trim();
    if (milestonesRaw) {
      const milestones = JSON.parse(milestonesRaw);
      const openMilestone = milestones.find(function(m) { return m.state === 'open'; });
      if (openMilestone) {
        milestoneTitle = openMilestone.title || null;
        const total = (openMilestone.open_issues || 0) + (openMilestone.closed_issues || 0);
        if (total > 0) {
          milestonePct = Math.round(((openMilestone.closed_issues || 0) / total) * 100);
        }
      }
    }
  } catch (e) {
    // gh api failed for milestones, continue with defaults
  }

  // Get current phase from open issues with 'phase' label, parse number from title
  let phaseNumber = null;
  let issueNumber = null;
  try {
    const phaseRaw = execSync(
      'gh api "repos/' + owner + '/' + repo + '/issues?state=open&labels=phase&per_page=1&sort=updated&direction=desc" --jq ".[0] | {number: .number, title: .title}"',
      { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    ).trim();
    const phaseData = JSON.parse(phaseRaw || '{}');
    const titleMatch = (phaseData.title || '').match(/^\\[Phase\\s+(\\S+)\\]/);
    if (titleMatch) {
      phaseNumber = titleMatch[1];
    }
    issueNumber = phaseData.number || null;
  } catch (e) {
    // gh api failed for phase, continue with null
  }

  // Get board column via GraphQL
  let boardColumn = null;
  if (issueNumber) {
    try {
      const gqlQuery = '{ repository(owner: "' + owner + '", name: "' + repo + '") { issue(number: ' + issueNumber + ') { projectItems(first: 5, includeArchived: false) { nodes { fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }';
      const boardRaw = execSync(
        'gh api graphql -f query=@-',
        { input: gqlQuery, encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
      ).trim();
      const boardData = JSON.parse(boardRaw);
      const nodes = boardData?.data?.repository?.issue?.projectItems?.nodes || [];
      if (nodes.length > 0 && nodes[0]?.fieldValueByName?.name) {
        boardColumn = nodes[0].fieldValueByName.name;
      }
    } catch (e) {
      boardColumn = null;
    }
  }

  // Write cache
  const cacheData = JSON.stringify({
    phase_number: phaseNumber,
    milestone_title: milestoneTitle,
    milestone_pct: milestonePct,
    board_column: boardColumn,
    updated: Math.floor(Date.now() / 1000),
  });

  const dir = ${JSON.stringify(cacheDir)};
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(${JSON.stringify(cacheFile)}, cacheData);
} catch (e) {
  try {
    const dir = ${JSON.stringify(cacheDir)};
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(${JSON.stringify(cacheFile)}, JSON.stringify({
      phase_number: null,
      milestone_title: null,
      milestone_pct: 0,
      board_column: null,
      offline: true,
      updated: Math.floor(Date.now() / 1000),
    }));
  } catch (_) {}
  process.exit(0);
}
`;

    const isWindows = process.platform === 'win32';
    const child = spawn(process.execPath, ['-e', script], {
      stdio: 'ignore',
      windowsHide: true,
      detached: !isWindows,
    });
    child.unref();
  } catch {
    // Silent fail -- never break statusline
  }
}

export function formatStatusline(data: StatuslineInput): string {
  const model = data.model?.display_name || 'Claude';
  const dir = data.workspace?.project_dir || data.workspace?.current_dir || process.cwd();
  const dirname = path.basename(dir);

  const SEP = ' \u2502 ';
  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';

  // MAXSIM update available?
  let updateIndicator = '';
  const updateCacheFile = path.join(dir, CLAUDE_DIR, 'cache', 'maxsim-update-check.json');
  if (fs.existsSync(updateCacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(updateCacheFile, 'utf8'));
      if (cache.update_available) {
        updateIndicator = '\x1b[33m\u2B06\x1b[0m ';
      }
    } catch {
      // ignore
    }
  }

  // Check if this is a MAXSIM project
  const planningDir = path.join(dir, '.planning');
  const isMaxsimProject = fs.existsSync(planningDir);

  if (!isMaxsimProject) {
    return `${updateIndicator}${DIM}${model}${RESET}${SEP}${DIM}${dirname}${RESET}`;
  }

  // Read progress cache
  const cacheDir = path.join(dir, CLAUDE_DIR, 'cache');
  const cacheFile = path.join(cacheDir, 'maxsim-progress.json');
  let cache: ProgressCache | null = null;
  let cacheAge = Infinity;

  if (fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as ProgressCache;
      cacheAge = Math.floor(Date.now() / 1000) - (cache.updated || 0);
    } catch {
      cache = null;
    }
  }

  // Spawn background refresh if cache is stale or missing
  if (cacheAge > CACHE_TTL_SECONDS) {
    spawnBackgroundRefresh(cacheDir, cacheFile);
  }

  // Offline fallback
  if (cache?.offline) {
    return `${updateIndicator}${DIM}${model}${RESET}${SEP}${DIM}P? offline${RESET}${SEP}${DIM}${dirname}${RESET}`;
  }

  // Build phase segment: P{N} {BoardColumn}
  let phaseSegment = '';
  if (cache?.phase_number) {
    const column = cache.board_column ? ` ${cache.board_column}` : '';
    phaseSegment = `${SEP}${DIM}P${cache.phase_number}${column}${RESET}`;
  }

  // Build milestone segment
  let milestoneSegment = '';
  if (cache?.milestone_title) {
    milestoneSegment = `${SEP}${DIM}${cache.milestone_title}: ${cache.milestone_pct}%${RESET}`;
  }

  return `${updateIndicator}${DIM}${model}${RESET}${phaseSegment}${milestoneSegment}${SEP}${DIM}${dirname}${RESET}`;
}

// Standalone entry
if (require.main === module) {
  readStdinJson<StatuslineInput>((data) => {
    process.stdout.write(formatStatusline(data));
  });
}
