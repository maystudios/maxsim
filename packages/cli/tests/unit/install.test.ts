import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkNodeVersion } from '../../src/install/index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Temporarily override `process.versions.node` for the duration of `fn`. */
function withNodeVersion<T>(version: string, fn: () => T): T {
  const original = process.versions;
  Object.defineProperty(process, 'versions', {
    value: { ...original, node: version },
    configurable: true,
  });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'versions', { value: original, configurable: true });
  }
}

describe('checkNodeVersion', () => {
  it('does not exit when the current Node.js major version meets the minimum', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    // The test process runs Node >= 22 (engines field enforces it).
    checkNodeVersion(22);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not exit when minMajor is set lower than the current version', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    checkNodeVersion(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit(1) when the major version is below the minimum', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    withNodeVersion('18.20.0', () => checkNodeVersion(22));

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('MaxsimCLI requires Node.js >= 22'),
    );
  });

  it('prints the current Node version in the error message', () => {
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    withNodeVersion('16.0.0', () => checkNodeVersion(22));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('16.0.0'));
  });
});
