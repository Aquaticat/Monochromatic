import { createRequire } from 'node:module';
import { join } from 'node:path';

import { l, tagged } from './log.ts';

/**
 * Attempts to resolve a bare specifier from a given base directory.
 * Returns the resolved path or `undefined` if resolution fails.
 *
 * @param specifier - ESM import specifier (e.g. `lodash`, `@scope/pkg/sub`)
 * @param baseDir - Directory to resolve from
 * @returns Resolved file URL string, or `undefined` on failure
 *
 * @example
 * ```ts
 * resolveFrom('lodash', '/home/user/project');
 * // => 'file:///home/user/project/node_modules/lodash/index.js'
 * ```
 */
function resolveFrom({ specifier, baseDir }: { specifier: string; baseDir: string }): string | undefined {
  const rl = tagged({ tag: resolveFrom.name, l });
  rl.info(`trying base ${baseDir}`);
  try {
    const require = createRequire(join(baseDir, 'noop.js'));
    const resolved = require.resolve(specifier);
    rl.info(`resolved to ${resolved}`);
    return resolved;
  } catch {
    rl.info(`not found in ${baseDir}`);
    return undefined;
  }
}

/**
 * Walks up from `startDir` looking for a directory containing a `package.json`
 * with a `workspaces` field, indicating a monorepo root.
 * Returns the path or `undefined` if none found.
 *
 * @param startDir - Directory to start searching from
 * @returns Path to monorepo root, or `undefined`
 *
 * @example
 * ```ts
 * findMonorepoRoot('/home/user/project/packages/foo');
 * // => '/home/user/project'
 * ```
 */
async function findMonorepoRoot({ startDir }: { startDir: string }): Promise<string | undefined> {
  const rl = tagged({ tag: findMonorepoRoot.name, l });
  let dir = startDir;
  /** Filesystem root sentinel -- stop when parent equals self */
  const ROOT = '/';
  while (dir !== ROOT) {
    const pkgPath = join(dir, 'package.json');
    try {
      const content = await Bun.file(pkgPath).text();
      const pkg = JSON.parse(content) as Record<string, unknown>;
      if ('workspaces' in pkg) {
        rl.info(`found monorepo root at ${dir}`);
        return dir;
      }
    } catch {
      // No package.json here, keep walking
    }
    const parent = join(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  rl.info('no monorepo root found');
  return undefined;
}

/**
 * Finds the global node_modules directory by checking common global install locations.
 * Returns the path or `undefined` if none found.
 *
 * @returns Path to global node_modules, or `undefined`
 *
 * @example
 * ```ts
 * findGlobalNodeModules();
 * // => '/home/user/.bun/install/global/node_modules'
 * ```
 */
function findGlobalNodeModules(): string | undefined {
  const rl = tagged({ tag: findGlobalNodeModules.name, l });
  const home = process.env['HOME'] ?? process.env['USERPROFILE'];
  if (home === undefined) {
    rl.info('no HOME or USERPROFILE set');
    return undefined;
  }
  /** Candidate global node_modules paths, ordered by priority */
  const candidates = [
    join(home, '.bun', 'install', 'global', 'node_modules'),
    join(home, '.local', 'lib', 'node_modules'),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
  ];
  for (const candidate of candidates) {
    try {
      const stat = Bun.file(join(candidate, '.package-lock.json'));
      if (stat) {
        rl.info(`found global node_modules at ${candidate}`);
        return candidate;
      }
    } catch {
      // Not here
    }
  }
  rl.info('no global node_modules found');
  return undefined;
}

/**
 * Resolves an ESM specifier by searching CWD node_modules, monorepo root node_modules,
 * and global node_modules in that order.
 *
 * @param specifier - Bare import specifier to resolve
 * @returns Resolved file path
 * @throws When the specifier cannot be resolved from any location
 *
 * @example
 * ```ts
 * await resolveSpecifier({ specifier: 'lodash' });
 * // => '/home/user/project/node_modules/lodash/lodash.js'
 * ```
 */
export async function resolveSpecifier({ specifier }: { specifier: string }): Promise<string> {
  const rl = tagged({ tag: resolveSpecifier.name, l });
  const cwd = process.cwd();

  //region CWD resolution
  rl.info(`resolving "${specifier}" from CWD: ${cwd}`);
  const fromCwd = resolveFrom({ specifier, baseDir: cwd });
  if (fromCwd !== undefined) {
    return fromCwd;
  }
  //endregion CWD resolution

  //region Monorepo root resolution
  const monorepoRoot = await findMonorepoRoot({ startDir: cwd });
  if (monorepoRoot !== undefined && monorepoRoot !== cwd) {
    rl.info(`trying monorepo root: ${monorepoRoot}`);
    const fromMonorepo = resolveFrom({ specifier, baseDir: monorepoRoot });
    if (fromMonorepo !== undefined) {
      return fromMonorepo;
    }
  }
  //endregion Monorepo root resolution

  //region Global resolution
  const globalDir = findGlobalNodeModules();
  if (globalDir !== undefined) {
    rl.info(`trying global: ${globalDir}`);
    const fromGlobal = resolveFrom({ specifier, baseDir: join(globalDir, '..') });
    if (fromGlobal !== undefined) {
      return fromGlobal;
    }
  }
  //endregion Global resolution

  throw new Error(
    `Cannot resolve "${specifier}" from any of:\n`
    + `  - CWD: ${cwd}\n`
    + (monorepoRoot !== undefined ? `  - Monorepo root: ${monorepoRoot}\n` : '')
    + (globalDir !== undefined ? `  - Global: ${globalDir}\n` : '')
    + 'Install the package first (e.g. bun add <package>)',
  );
}
