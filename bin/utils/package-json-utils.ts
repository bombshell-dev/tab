import { readFileSync } from 'fs';

export function getPackageJsonScripts(): string[] {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    return Object.keys(packageJson.scripts || {});
  } catch {
    return [];
  }
}

export function getPackageJsonDependencies(): string[] {
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    };
    return Object.keys(deps);
  } catch {
    return [];
  }
}
