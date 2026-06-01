/**
 * User-local spawn-pi CLI symlink setup.
 *
 * @module
 */

import { execFileSync, } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import {
  basename,
  dirname,
  join,
  resolve,
} from 'node:path';

//region Sentinels

/**
 * Sentinel returned when no CLI setup warning needs to be shown.
 *
 * @example
 * ```typescript
 * if (warning === NO_CLI_SETUP_WARNING) return;
 * ```
 */
const NO_CLI_SETUP_WARNING: unique symbol = Symbol('spawn-pi/cli-setup-ok',);

//endregion Sentinels

//region Path derivation

/**
 * Resolves ancestor directory by walking a fixed number of parent links.
 *
 * @param startPath - path whose ancestors are inspected.
 *
 * @param levels - number of `dirname` steps.
 *
 * @returns ancestor directory path.
 *
 * @example
 * ```typescript
 * ancestorDir({ startPath: '/a/b/c', levels: 2 }); // '/a'
 * ```
 */
function ancestorDir(
  {
    startPath,
    levels,
  }: {
    readonly startPath: string;
    readonly levels: number;
  },
): string {
  for (let currentPath = startPath, remainingLevels = levels; remainingLevels >= 0;) {
    if (remainingLevels === 0)
      return currentPath;
    remainingLevels -= 1;
    currentPath = dirname(currentPath,);
  }

  return startPath;
}

/**
 * Detects tsdown Node build output path shape.
 *
 * @param extensionPath - extension module path.
 *
 * @returns whether path appears under `dist/final/node`.
 *
 * @example
 * ```typescript
 * isBuiltExtensionPath('/pkg/dist/final/node/index.mjs');
 * ```
 */
function isBuiltExtensionPath(extensionPath: string,): boolean {
  /**
   * Directory containing extension module.
   */
  const moduleDir = dirname(extensionPath,);
  /**
   * Directory one level above module directory.
   */
  const finalDir = dirname(moduleDir,);
  /**
   * Directory two levels above module directory.
   */
  const distDir = dirname(finalDir,);

  return (basename(moduleDir,) === 'node')
    && (basename(finalDir,) === 'final')
    && (basename(distDir,) === 'dist');
}

/**
 * Resolves package root from source or built extension path.
 *
 * @param extensionPath - current extension entry path.
 *
 * @returns package root path.
 *
 * @example
 * ```typescript
 * packageRootFromExtensionPath('/pkg/src/index.ts'); // '/pkg'
 * ```
 */
function packageRootFromExtensionPath(extensionPath: string,): string {
  if (isBuiltExtensionPath(extensionPath,)) {
    return resolve(
      ancestorDir(
        {
          startPath: dirname(extensionPath,),
          levels: 3,
        },
      ),
    );
  }

  return resolve(
    dirname(extensionPath,),
    '..',
  );
}

/**
 * Resolves source CLI path shipped with package.
 *
 * @param extensionPath - current extension entry path.
 *
 * @returns CLI entry path matching extension mode.
 *
 * @example
 * ```typescript
 * cliPathFromExtensionPath('/pkg/src/index.ts'); // '/pkg/src/cli.ts'
 * cliPathFromExtensionPath('/pkg/dist/final/node/index.mjs'); // '/pkg/dist/final/node/cli.mjs'
 * ```
 */
function cliPathFromExtensionPath(extensionPath: string,): string {
  if (isBuiltExtensionPath(extensionPath,)) {
    return join(
      dirname(extensionPath,),
      'cli.mjs',
    );
  }

  return join(
    packageRootFromExtensionPath(extensionPath,),
    'src',
    'cli.ts',
  );
}

//endregion Path derivation

//region CLI setup

/**
 * Detects whether `spawn-pi` is already discoverable on PATH.
 *
 * @returns whether `which spawn-pi` succeeds.
 *
 * @example
 * ```typescript
 * if (cliIsOnPath()) return;
 * ```
 */
function cliIsOnPath(): boolean {
  try {
    execFileSync(
      'which',
      ['spawn-pi',],
      { stdio: 'ignore', },
    );
    return true;
  }
  catch {
    return false;
  }
}

/**
 * Symlinks `spawn-pi` into user-local bin when no CLI is on PATH.
 *
 * @param extensionPath - current extension entry path.
 *
 * @param env - environment values used for `HOME` and `PATH`.
 *
 * @returns warning text, or `NO_CLI_SETUP_WARNING` when setup is complete.
 *
 * @example
 * ```typescript
 * autoSetupCli({ extensionPath: '/pkg/dist/final/node/index.mjs' });
 * ```
 */
function autoSetupCli(
  {
    extensionPath,
    env = process.env,
  }: {
    readonly extensionPath: string;
    readonly env?: Readonly<NodeJS.ProcessEnv>;
  },
): string | typeof NO_CLI_SETUP_WARNING {
  if (cliIsOnPath())
    return NO_CLI_SETUP_WARNING;

  /**
   * CLI path that symlink should execute with Node shebang.
   */
  const cliSource = cliPathFromExtensionPath(extensionPath,);
  /**
   * User-local bin directory.
   */
  const localBin = join(
    env.HOME
      ?? '/tmp',
    '.local',
    'bin',
  );
  /**
   * Destination symlink path for command discovery.
   */
  const symlinkPath = join(
    localBin,
    'spawn-pi',
  );

  try {
    mkdirSync(
      localBin,
      { recursive: true, },
    );

    /**
     * Unix executable permission bits.
     */
    const EXECUTABLE_PERMISSION = 0o755;
    chmodSync(
      cliSource,
      EXECUTABLE_PERMISSION,
    );

    try {
      unlinkSync(symlinkPath,);
    }
    catch {
      // Missing stale symlink is acceptable.
    }

    symlinkSync(
      cliSource,
      symlinkPath,
    );

    /**
     * PATH entries available to current process.
     */
    const pathDirs = (env.PATH ?? '').split(':',);
    return pathDirs.includes(localBin,)
      ? NO_CLI_SETUP_WARNING
      : [
        '[spawn-pi] Symlinked spawn-pi to ~/.local/bin/spawn-pi,',
        'but ~/.local/bin is not on PATH. Add it to your shell profile:',
        '  export PATH="$HOME/.local/bin:$PATH"',
      ].join('\n',);
  }
  catch {
    return [
      '[spawn-pi] Could not auto-setup spawn-pi CLI.',
      `Symlink target: ${cliSource}`,
      `Symlink path: ${symlinkPath}`,
      'Create the symlink manually or add the package bin directory to PATH.',
    ].join('\n',);
  }
}

//endregion CLI setup

export {
  autoSetupCli,
  cliIsOnPath,
  cliPathFromExtensionPath,
  isBuiltExtensionPath,
  NO_CLI_SETUP_WARNING,
  packageRootFromExtensionPath,
};
