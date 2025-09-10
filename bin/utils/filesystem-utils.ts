import { readdirSync, statSync } from 'node:fs';

export function getDirectoriesInCwd(): string[] {
  try {
    return readdirSync('.')
      .filter((item) => {
        try {
          return statSync(item).isDirectory();
        } catch {
          return false;
        }
      })
      .map((dir) => `./${dir}`)
      .slice(0, 10);
  } catch {
    return ['./'];
  }
}

export function getCommonWorkspaceDirs(): string[] {
  const common = ['packages', 'apps', 'libs', 'modules', 'components'];
  const existing = [];

  for (const dir of common) {
    try {
      if (statSync(dir).isDirectory()) {
        existing.push(`./${dir}`);
      }
    } catch {}
  }

  return existing;
}

export function directoryExists(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Get directories that match a pattern (e.g., containing 'lib' or 'module')
export function getDirectoriesMatching(pattern: string): string[] {
  try {
    return getDirectoriesInCwd().filter((dir) =>
      dir.toLowerCase().includes(pattern.toLowerCase())
    );
  } catch {
    return [];
  }
}
