import { readFileSync } from 'node:fs';

export function getWorkspacePatterns(): string[] {
  try {
    let content: string;
    try {
      content = readFileSync('pnpm-workspace.yaml', 'utf8');
    } catch {
      content = readFileSync('pnpm-workspace.yml', 'utf8');
    }

    const packagesMatch = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)*)/);
    if (!packagesMatch) return [];

    const patterns = packagesMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-'))
      .map((line) => line.substring(1).trim())
      .filter((pattern) => pattern && !pattern.startsWith('#'));

    return patterns;
  } catch {
    return [];
  }
}
