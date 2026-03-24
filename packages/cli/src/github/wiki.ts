/**
 * GitHub Wiki — read and write wiki pages via git clone.
 *
 * GitHub's REST API does not expose wiki page endpoints, so this module
 * uses the git-based approach: clone the wiki repo (at {repo}.wiki.git),
 * read/write Markdown files, commit, and push.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ghExec, getRepoInfo } from './client.js';
import type { GhResult, GhWikiPage, RepoInfo } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────

function slugToTitle(slug: string): string {
  return slug.replace(/[-_]/g, ' ');
}

/**
 * Clone the wiki repo into a fresh temp directory and return the path.
 * Throws if the clone fails (e.g. wiki is not enabled or is empty).
 */
function cloneWiki(owner: string, repo: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'maxsim-wiki-'));
  try {
    execFileSync(
      'git',
      ['clone', '--depth', '1', `https://github.com/${owner}/${repo}.wiki.git`, dir],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch (err) {
    // Clean up the empty dir we just created before re-throwing.
    cleanupDir(dir);
    throw err;
  }
  return dir;
}

/** Remove the temp directory tree (best-effort). */
function cleanupDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures — temp files will be swept by the OS.
  }
}

/** Classify a caught error into a GhResult error object. */
function classifyError(err: unknown): GhResult<never> {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('404') || msg.includes('Not Found') || msg.includes('not found')) {
    return { ok: false, error: msg, code: 'NOT_FOUND' };
  }
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('auth')) {
    return { ok: false, error: msg, code: 'UNAUTHORIZED' };
  }
  if (msg.includes('403') || msg.includes('Forbidden')) {
    return { ok: false, error: msg, code: 'FORBIDDEN' };
  }
  return { ok: false, error: msg, code: 'UNKNOWN' };
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Check whether the wiki is enabled for the given repo.
 * Returns `{ ok: true, data: true }` when the wiki exists, or an error result
 * when the API call fails.
 */
export function checkWikiEnabled(repo?: RepoInfo): GhResult<boolean> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  const result = ghExec(['api', `repos/${owner}/${repoName}`, '-q', '.has_wiki']);
  if (!result.ok) return result;
  return { ok: true, data: result.data === 'true' };
}

/**
 * Fetch a single wiki page by slug.
 *
 * Clones the wiki repo into a temporary directory, reads the Markdown file
 * whose name matches `slug`, then removes the temporary directory.
 */
export function getWikiPage(slug: string, repo?: RepoInfo): GhResult<GhWikiPage> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  let dir: string | null = null;
  try {
    dir = cloneWiki(owner, repoName);
    let content: string;
    try {
      content = readFileSync(join(dir, `${slug}.md`), 'utf8');
    } catch {
      return { ok: false, error: `Wiki page not found: ${slug}`, code: 'NOT_FOUND' };
    }
    return { ok: true, data: { slug, title: slugToTitle(slug), content } };
  } catch (err) {
    return classifyError(err);
  } finally {
    if (dir) cleanupDir(dir);
  }
}

/**
 * Create or overwrite a wiki page.
 *
 * Clones the wiki repo, writes the Markdown file, commits with a standard
 * message, and pushes. The wiki must already be initialised (at least one
 * page must exist) for the clone to succeed.
 */
export function createOrUpdateWikiPage(
  slug: string,
  title: string,
  content: string,
  repo?: RepoInfo,
): GhResult<GhWikiPage> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  let dir: string | null = null;
  try {
    dir = cloneWiki(owner, repoName);
    const filename = `${slug}.md`;
    writeFileSync(join(dir, filename), content, 'utf8');
    execFileSync('git', ['-C', dir, 'add', filename], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    execFileSync('git', ['-C', dir, 'commit', '--allow-empty', '-m', `Update ${title}`], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    execFileSync('git', ['-C', dir, 'push'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, data: { slug, title, content } };
  } catch (err) {
    return classifyError(err);
  } finally {
    if (dir) cleanupDir(dir);
  }
}

/**
 * Delete a wiki page by slug.
 *
 * Clones the wiki repo, removes the Markdown file for the given slug, commits,
 * and pushes. Returns NOT_FOUND if the page does not exist.
 */
export function deleteWikiPage(slug: string, repo?: RepoInfo): GhResult<void> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  let dir: string | null = null;
  try {
    dir = cloneWiki(owner, repoName);
    const filename = `${slug}.md`;
    try {
      unlinkSync(join(dir, filename));
    } catch {
      return { ok: false, error: `Wiki page not found: ${slug}`, code: 'NOT_FOUND' };
    }
    execFileSync('git', ['-C', dir, 'add', filename], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    execFileSync('git', ['-C', dir, 'commit', '-m', `Delete ${slugToTitle(slug)}`], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    execFileSync('git', ['-C', dir, 'push'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, data: undefined };
  } catch (err) {
    return classifyError(err);
  } finally {
    if (dir) cleanupDir(dir);
  }
}

/**
 * List all wiki pages.
 *
 * Clones the wiki repo and returns metadata for every `.md` file found.
 * File content is included in each entry.
 */
export function listWikiPages(repo?: RepoInfo): GhResult<GhWikiPage[]> {
  const { owner, repo: repoName } = repo ?? getRepoInfo();
  let dir: string | null = null;
  try {
    dir = cloneWiki(owner, repoName);
    const wikiDir = dir;
    const pages: GhWikiPage[] = readdirSync(wikiDir)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => {
        const slug = entry.slice(0, -3);
        return { slug, title: slugToTitle(slug), content: readFileSync(join(wikiDir, entry), 'utf8') };
      });
    return { ok: true, data: pages };
  } catch (err) {
    return classifyError(err);
  } finally {
    if (dir) cleanupDir(dir);
  }
}
