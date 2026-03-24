/**
 * Unit tests for github/wiki.ts
 *
 * The wiki module uses:
 *   - `execFileSync` from `node:child_process` for git operations
 *   - `mkdtempSync`, `writeFileSync`, `readFileSync`, `readdirSync`, `rmSync`
 *     from `node:fs`
 *   - `tmpdir` from `node:os`
 *   - `ghExec` and `getRepoInfo` from `./client.js`
 *
 * All external calls are mocked so no real git, gh CLI, or filesystem access
 * is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn() };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    mkdtempSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
  };
});

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, tmpdir: vi.fn().mockReturnValue('/tmp') };
});

vi.mock('../../src/github/client.js', () => ({
  ghExec: vi.fn(),
  getRepoInfo: vi.fn(),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { ghExec, getRepoInfo } from '../../src/github/client.js';
import {
  checkWikiEnabled,
  getWikiPage,
  createOrUpdateWikiPage,
  listWikiPages,
} from '../../src/github/wiki.js';
import type { GhWikiPage } from '../../src/github/types.js';

// ── Typed mock references ──────────────────────────────────────────────────

const mockExecFileSync = vi.mocked(execFileSync);
const mockMkdtempSync = vi.mocked(mkdtempSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockRmSync = vi.mocked(rmSync);
const mockGhExec = vi.mocked(ghExec);
const mockGetRepoInfo = vi.mocked(getRepoInfo);

// ── Fixtures ──────────────────────────────────────────────────────────────

const REPO_INFO = { owner: 'test-owner', repo: 'test-repo', isOrg: false };
const WIKI_DIR = '/tmp/maxsim-wiki-abc123';

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepoInfo.mockReturnValue(REPO_INFO);
  // mkdtempSync always returns a predictable temp path for assertions.
  mockMkdtempSync.mockReturnValue(WIKI_DIR);
  // rmSync is a no-op by default (cleanup is best-effort).
  mockRmSync.mockReturnValue(undefined);
  // execFileSync (git clone, add, commit, push) is a no-op by default.
  mockExecFileSync.mockReturnValue('' as never);
});

// ── checkWikiEnabled ──────────────────────────────────────────────────────

describe('checkWikiEnabled', () => {
  it('returns ok:true with data:true when has_wiki is "true"', () => {
    mockGhExec.mockReturnValue({ ok: true, data: 'true' });

    const result = checkWikiEnabled();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toBe(true);
  });

  it('returns ok:true with data:false when has_wiki is "false"', () => {
    mockGhExec.mockReturnValue({ ok: true, data: 'false' });

    const result = checkWikiEnabled();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toBe(false);
  });

  it('calls gh api with the correct repo path', () => {
    mockGhExec.mockReturnValue({ ok: true, data: 'true' });

    checkWikiEnabled();

    expect(mockGhExec).toHaveBeenCalledWith([
      'api',
      'repos/test-owner/test-repo',
      '-q',
      '.has_wiki',
    ]);
  });

  it('uses the provided repo override instead of getRepoInfo()', () => {
    const customRepo = { owner: 'custom-owner', repo: 'custom-repo', isOrg: true };
    mockGhExec.mockReturnValue({ ok: true, data: 'true' });

    checkWikiEnabled(customRepo);

    expect(mockGhExec).toHaveBeenCalledWith([
      'api',
      'repos/custom-owner/custom-repo',
      '-q',
      '.has_wiki',
    ]);
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('propagates ghExec error results', () => {
    mockGhExec.mockReturnValue({ ok: false, error: 'Not Found', code: 'NOT_FOUND' });

    const result = checkWikiEnabled();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── getWikiPage ───────────────────────────────────────────────────────────

describe('getWikiPage', () => {
  it('returns the page with slug, title, and content on success', () => {
    mockReadFileSync.mockReturnValue('# Hello\nWiki content here.' as never);

    const result = getWikiPage('Home');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toEqual<GhWikiPage>({
      slug: 'Home',
      title: 'Home',
      content: '# Hello\nWiki content here.',
    });
  });

  it('converts hyphens in slug to spaces for the title', () => {
    mockReadFileSync.mockReturnValue('content' as never);

    const result = getWikiPage('Getting-Started');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data.title).toBe('Getting Started');
  });

  it('converts underscores in slug to spaces for the title', () => {
    mockReadFileSync.mockReturnValue('content' as never);

    const result = getWikiPage('API_Reference');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data.title).toBe('API Reference');
  });

  it('clones the wiki repo with the correct URL', () => {
    mockReadFileSync.mockReturnValue('content' as never);

    getWikiPage('Home');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', 'https://github.com/test-owner/test-repo.wiki.git', WIKI_DIR],
      expect.any(Object),
    );
  });

  it('reads the file with the slug as filename + .md extension', () => {
    mockReadFileSync.mockReturnValue('content' as never);

    getWikiPage('My-Page');

    // readFileSync should be called with a path ending in My-Page.md inside the wiki dir.
    expect(mockReadFileSync).toHaveBeenCalledWith(
      expect.stringContaining('My-Page.md'),
      'utf8',
    );
  });

  it('returns NOT_FOUND when the .md file does not exist', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    const result = getWikiPage('nonexistent-page');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND when git clone indicates the wiki is missing', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Repository not found');
    });

    const result = getWikiPage('Home');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNAUTHORIZED when git clone fails with auth error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Authentication required: please run gh auth login');
    });

    const result = getWikiPage('Home');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('cleans up the temp directory after a successful read', () => {
    mockReadFileSync.mockReturnValue('content' as never);

    getWikiPage('Home');

    expect(mockRmSync).toHaveBeenCalledWith(WIKI_DIR, expect.objectContaining({ recursive: true }));
  });

  it('cleans up the temp directory even when readFileSync throws', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });

    getWikiPage('missing');

    expect(mockRmSync).toHaveBeenCalledWith(WIKI_DIR, expect.objectContaining({ recursive: true }));
  });

  it('uses the provided repo override instead of getRepoInfo()', () => {
    const customRepo = { owner: 'other-owner', repo: 'other-repo', isOrg: false };
    mockReadFileSync.mockReturnValue('content' as never);

    getWikiPage('Home', customRepo);

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['https://github.com/other-owner/other-repo.wiki.git']),
      expect.any(Object),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── createOrUpdateWikiPage ────────────────────────────────────────────────

describe('createOrUpdateWikiPage', () => {
  it('returns the saved page with slug, title, and content on success', () => {
    const result = createOrUpdateWikiPage('Home', 'Home', '# Welcome\nContent.');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toEqual<GhWikiPage>({
      slug: 'Home',
      title: 'Home',
      content: '# Welcome\nContent.',
    });
  });

  it('writes the content to the correct file path', () => {
    createOrUpdateWikiPage('My-Page', 'My Page', 'page content');

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('My-Page.md'),
      'page content',
      'utf8',
    );
  });

  it('stages the file via git add', () => {
    createOrUpdateWikiPage('Home', 'Home', 'content');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['-C', WIKI_DIR, 'add', 'Home.md'],
      expect.any(Object),
    );
  });

  it('commits with a message derived from the title', () => {
    createOrUpdateWikiPage('Home', 'My Title', 'content');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['-C', WIKI_DIR, 'commit', '--allow-empty', '-m', 'Update My Title'],
      expect.any(Object),
    );
  });

  it('pushes the commit', () => {
    createOrUpdateWikiPage('Home', 'Home', 'content');

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['-C', WIKI_DIR, 'push'],
      expect.any(Object),
    );
  });

  it('returns NOT_FOUND when git clone fails with a not-found error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Repository not found');
    });

    const result = createOrUpdateWikiPage('Home', 'Home', 'content');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNKNOWN for unexpected errors', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOSPC: no space left on device');
    });

    const result = createOrUpdateWikiPage('Home', 'Home', 'content');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNKNOWN');
  });

  it('cleans up the temp directory after a successful write', () => {
    createOrUpdateWikiPage('Home', 'Home', 'content');

    expect(mockRmSync).toHaveBeenCalledWith(WIKI_DIR, expect.objectContaining({ recursive: true }));
  });

  it('cleans up the temp directory when git push fails', () => {
    // Allow clone and write to succeed, but make push throw.
    mockExecFileSync
      .mockReturnValueOnce('' as never)   // git clone
      .mockReturnValueOnce('' as never)   // git add
      .mockReturnValueOnce('' as never)   // git commit
      .mockImplementationOnce(() => { throw new Error('push rejected'); }); // git push

    createOrUpdateWikiPage('Home', 'Home', 'content');

    expect(mockRmSync).toHaveBeenCalledWith(WIKI_DIR, expect.objectContaining({ recursive: true }));
  });

  it('uses the provided repo override instead of getRepoInfo()', () => {
    const customRepo = { owner: 'fork-owner', repo: 'fork-repo', isOrg: false };

    createOrUpdateWikiPage('Home', 'Home', 'content', customRepo);

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['https://github.com/fork-owner/fork-repo.wiki.git']),
      expect.any(Object),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── listWikiPages ─────────────────────────────────────────────────────────

describe('listWikiPages', () => {
  it('returns an empty array when the wiki has no .md files', () => {
    mockReaddirSync.mockReturnValue([] as never);

    const result = listWikiPages();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toEqual([]);
  });

  it('returns one page for each .md file in the cloned wiki', () => {
    mockReaddirSync.mockReturnValue(['Home.md', 'Getting-Started.md'] as never);
    mockReadFileSync
      .mockReturnValueOnce('# Home page' as never)
      .mockReturnValueOnce('# Getting Started' as never);

    const result = listWikiPages();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toHaveLength(2);
  });

  it('maps slug, title, and content correctly for each page', () => {
    mockReaddirSync.mockReturnValue(['My-Page.md'] as never);
    mockReadFileSync.mockReturnValue('page content' as never);

    const result = listWikiPages();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data[0]).toEqual<GhWikiPage>({
      slug: 'My-Page',
      title: 'My Page',
      content: 'page content',
    });
  });

  it('skips non-.md files (e.g. .git directory entries)', () => {
    mockReaddirSync.mockReturnValue(['Home.md', 'sidebar.html', '_Footer.md'] as never);
    mockReadFileSync
      .mockReturnValueOnce('home content' as never)
      .mockReturnValueOnce('footer content' as never);

    const result = listWikiPages();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    // Only .md files are included.
    expect(result.data).toHaveLength(2);
    const slugs = result.data.map((p) => p.slug);
    expect(slugs).toContain('Home');
    expect(slugs).toContain('_Footer');
    expect(slugs).not.toContain('sidebar.html');
  });

  it('returns NOT_FOUND when the wiki repo clone fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Repository not found');
    });

    const result = listWikiPages();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('cleans up the temp directory after listing', () => {
    mockReaddirSync.mockReturnValue([] as never);

    listWikiPages();

    expect(mockRmSync).toHaveBeenCalledWith(WIKI_DIR, expect.objectContaining({ recursive: true }));
  });

  it('cleans up the temp directory when readdirSync throws', () => {
    mockExecFileSync.mockReturnValue('' as never);
    mockReaddirSync.mockImplementation(() => {
      throw new Error('EPERM: operation not permitted');
    });

    listWikiPages();

    expect(mockRmSync).toHaveBeenCalledWith(WIKI_DIR, expect.objectContaining({ recursive: true }));
  });

  it('uses the provided repo override instead of getRepoInfo()', () => {
    const customRepo = { owner: 'org-owner', repo: 'org-repo', isOrg: true };
    mockReaddirSync.mockReturnValue([] as never);

    listWikiPages(customRepo);

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['https://github.com/org-owner/org-repo.wiki.git']),
      expect.any(Object),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('calls getRepoInfo() when no repo override is provided', () => {
    mockReaddirSync.mockReturnValue([] as never);

    listWikiPages();

    expect(mockGetRepoInfo).toHaveBeenCalledOnce();
  });
});
