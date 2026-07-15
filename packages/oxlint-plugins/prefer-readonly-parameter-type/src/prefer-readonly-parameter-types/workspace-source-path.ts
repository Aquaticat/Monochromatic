/**
 * Workspace source recognition for symlink-resolved package imports.
 *
 * pnpm workspace dependencies resolve through `node_modules` symlinks to
 * real repository paths,
 * so TypeScript classifies their source files as external-library modules
 * while their real paths carry no `node_modules` segment.
 * External dependencies always keep a real `node_modules` segment
 * because the package store lives inside it.
 *
 * @module
 */

/**
 * Path segment marking externally installed modules on POSIX paths.
 */
const POSIX_MODULES_SEGMENT = '/node_modules/';

/**
 * Path segment marking externally installed modules on Windows paths.
 */
const WINDOWS_MODULES_SEGMENT = '\\node_modules\\';

/**
 * Tests whether resolved file name is repository workspace source.
 *
 * @param fileName - Real resolved source path reported by TypeScript.
 *
 * @returns whether path lies outside every installed-module directory.
 *
 * @example
 * ```ts
 * isWorkspaceSourceFileName('/repo/packages/module/toml-edit/src/toml-set.ts');
 * ```
 */
export function isWorkspaceSourceFileName(fileName: string,): boolean {
  return (!fileName.includes(POSIX_MODULES_SEGMENT,))
    && (!fileName.includes(WINDOWS_MODULES_SEGMENT,));
}
