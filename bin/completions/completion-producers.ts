import type { Complete } from '../../src/t.js';
import {
  getPackageJsonScripts,
  getPackageJsonDependencies,
} from '../utils/package-json-utils.js';

// provides completions for npm scripts from package.json.. like: start,dev,build
export const packageJsonScriptCompletion = async (
  complete: Complete
): Promise<void> => {
  getPackageJsonScripts().forEach((script) => complete(script, ' '));
};

// provides completions for package dependencies from package.json.. for commands like remove `pnpm remove <dependency>`
export const packageJsonDependencyCompletion = async (
  complete: Complete
): Promise<void> => {
  getPackageJsonDependencies().forEach((dep) => complete(dep, ''));
};
