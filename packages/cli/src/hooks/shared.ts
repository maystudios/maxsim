/** Shared utilities for MAXSIM hooks. */

export function readStdinJson<T>(callback: (data: T) => void): void {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input) as T;
      callback(data);
    } catch {
      process.exit(0);
    }
  });
}

export const CLAUDE_DIR = '.claude';
