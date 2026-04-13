/**
 * Build-time source code URL resolver for the doodle widget.
 *
 * Constructs a browsable GitHub URL from the git remote and
 * `package.json` repository metadata. Both parts fall back to
 * hardcoded literals when their primary source is unavailable
 * (e.g. archive builds without `.git`, or a missing field).
 */
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { findMonorepoRoot, } from '@monochromatic-dev/module-es/find-monorepo-root';
import spawn from 'nano-spawn';

/** Fallback base repository URL when git remote is unavailable */
const FALLBACK_REPO_URL = 'https://github.com/Aquaticat/Monochromatic';

/** Fallback subdirectory when `repository.directory` is missing from package.json */
const FALLBACK_DIRECTORY = 'packages/webapp-productivity/doodle-widget';

/**
 * Queries `git remote get-url origin` and strips a trailing `.git` suffix.
 *
 * @returns browsable repository URL, or {@link FALLBACK_REPO_URL} on failure
 */
async function resolveRepoUrl(): Promise<string> {
  try {
    const repoRoot = await findMonorepoRoot();
    const result = await spawn('git', ['remote', 'get-url', 'origin',], { cwd: repoRoot, },);
    return result.output.trim().replace(/\.git$/, '',);
  } catch {
    return FALLBACK_REPO_URL;
  }
}

/**
 * Reads `repository.directory` from the package's `package.json`.
 *
 * @param packageDir - absolute path to the package root directory
 *
 * @returns subdirectory string, or {@link FALLBACK_DIRECTORY} on failure
 */
async function resolveDirectory(packageDir: string,): Promise<string> {
  try {
    const raw = await readFile(join(packageDir, 'package.json',), 'utf8',);
    const pkg = JSON.parse(raw,) as Record<string, unknown>;
    const repo = pkg.repository as Record<string, unknown> | undefined;

    if (typeof repo?.directory === 'string') {
      return repo.directory;
    }

    return FALLBACK_DIRECTORY;
  } catch {
    return FALLBACK_DIRECTORY;
  }
}

/**
 * Resolves the full source code URL for this package.
 *
 * Combines the git remote (or fallback) with the package.json
 * directory (or fallback) into a `/tree/main/{directory}` GitHub URL.
 *
 * @param packageDir - absolute path to the package root directory
 *
 * @returns browsable source code URL
 *
 * @example
 * ```ts
 * const url = await resolveSourceUrl('/path/to/doodle-widget');
 * // 'https://github.com/Aquaticat/Monochromatic/tree/main/packages/webapp-productivity/doodle-widget'
 * ```
 */
export async function resolveSourceUrl(packageDir: string,): Promise<string> {
  const [repoUrl, directory,] = await Promise.all([
    resolveRepoUrl(),
    resolveDirectory(packageDir,),
  ],);

  return `${repoUrl}/tree/main/${directory}`;
}
