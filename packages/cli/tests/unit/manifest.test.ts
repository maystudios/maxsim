import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getManifestPath,
  writeManifest,
  readManifest,
  removeManifested,
} from '../../src/install/manifest.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-manifest-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getManifestPath', () => {
  it('returns path under .claude/maxsim/manifest.json', () => {
    const p = getManifestPath('/some/project');
    expect(p).toBe(path.join('/some/project', '.claude', 'maxsim', 'manifest.json'));
  });
});

describe('writeManifest', () => {
  it('creates the manifest file with correct JSON content', () => {
    const files = ['.claude/maxsim/config.json', '.claude/commands/maxsim/go.md'];
    writeManifest(tmpDir, files);

    const manifestPath = getManifestPath(tmpDir);
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual(files);
  });

  it('creates parent directories when they do not exist', () => {
    writeManifest(tmpDir, ['some/file.txt']);
    expect(fs.existsSync(getManifestPath(tmpDir))).toBe(true);
  });

  it('writes an empty array correctly', () => {
    writeManifest(tmpDir, []);
    const raw = fs.readFileSync(getManifestPath(tmpDir), 'utf8');
    expect(JSON.parse(raw)).toEqual([]);
  });
});

describe('readManifest', () => {
  it('returns the file list written by writeManifest', () => {
    const files = ['a/b.md', 'c/d.json'];
    writeManifest(tmpDir, files);
    expect(readManifest(tmpDir)).toEqual(files);
  });

  it('returns an empty array when no manifest exists', () => {
    expect(readManifest(tmpDir)).toEqual([]);
  });

  it('returns an empty array when the manifest contains corrupt JSON', () => {
    const manifestPath = getManifestPath(tmpDir);
    const dir = path.dirname(manifestPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(manifestPath, 'not valid json{{{', 'utf8');

    expect(readManifest(tmpDir)).toEqual([]);
  });

  it('returns an empty array when the manifest contains a non-array value', () => {
    const manifestPath = getManifestPath(tmpDir);
    const dir = path.dirname(manifestPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({ key: 'value' }), 'utf8');

    expect(readManifest(tmpDir)).toEqual([]);
  });
});

describe('removeManifested', () => {
  it('removes all files listed in the manifest and returns the count', () => {
    const subDir = path.join(tmpDir, 'tracked');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'a.md'), 'content-a');
    fs.writeFileSync(path.join(subDir, 'b.md'), 'content-b');

    writeManifest(tmpDir, ['tracked/a.md', 'tracked/b.md']);

    const count = removeManifested(tmpDir);
    expect(count).toBe(2);
    expect(fs.existsSync(path.join(subDir, 'a.md'))).toBe(false);
    expect(fs.existsSync(path.join(subDir, 'b.md'))).toBe(false);
  });

  it('removes the manifest file itself after cleaning up tracked files', () => {
    writeManifest(tmpDir, []);
    const manifestPath = getManifestPath(tmpDir);
    expect(fs.existsSync(manifestPath)).toBe(true);

    removeManifested(tmpDir);
    expect(fs.existsSync(manifestPath)).toBe(false);
  });

  it('handles already-deleted files gracefully and does not count them', () => {
    writeManifest(tmpDir, ['nonexistent/file.txt']);
    const count = removeManifested(tmpDir);
    expect(count).toBe(0);
  });

  it('returns 0 and does nothing when no manifest exists', () => {
    const count = removeManifested(tmpDir);
    expect(count).toBe(0);
  });

  it('only counts files that actually existed', () => {
    const subDir = path.join(tmpDir, 'mixed');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'real.md'), 'hello');

    writeManifest(tmpDir, ['mixed/real.md', 'mixed/ghost.md']);

    const count = removeManifested(tmpDir);
    expect(count).toBe(1);
    expect(fs.existsSync(path.join(subDir, 'real.md'))).toBe(false);
  });
});
