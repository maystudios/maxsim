/** MaxsimCLI version — auto-injected from package.json at build time. */
export const VERSION = '5.12.0';

/**
 * Parse a semantic version string into components.
 * Returns null if the string is not a valid semver.
 */
export function parseVersion(versionStr: string): { major: number; minor: number; patch: number } | null {
  const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

/**
 * Check if the current VERSION is at least the given minimum version.
 */
export function isVersionAtLeast(minimum: string): boolean {
  const current = parseVersion(VERSION);
  const target = parseVersion(minimum);
  if (!current || !target) return false;
  if (current.major !== target.major) return current.major > target.major;
  if (current.minor !== target.minor) return current.minor > target.minor;
  return current.patch >= target.patch;
}

/** Get the current version string. */
export function getVersion(): string {
  return VERSION;
}
