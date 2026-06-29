/**
 * Container work-tree preparation helpers.
 *
 * @example
 * ```ts
 * await rsyncSourceToWorkTree();
 * ```
 */

import {
  access,
  mkdir,
  readdir,
  symlink,
} from 'node:fs/promises';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import {
  SOURCE_MOUNT,
  WORK_MOUNT,
} from './container-args.ts';
import { caughtErrorMessage, } from './error-format.ts';

/**
 * Baked dependency tree path inside the runtime image.
 */
const BAKED_ROOT = '/baked';

/**
 * Node dependency directory name.
 */
const NODE_MODULES = 'node_modules';

/**
 * pnpm virtual store directory name inside node_modules.
 */
const PNPM_STORE = '.pnpm';

/**
 * Rsync exclude patterns for generated or heavyweight repository artifacts.
 */
const RSYNC_EXCLUDES: readonly string[] = [
  '**/node_modules',
  '**/dist',
  '**/.git',
  '**/target',
  '**/output',
  '**/corpus',
];

/**
 * Converts one rsync exclude pattern into argv tokens.
 *
 * @param pattern - Pattern excluded from rsync traversal.
 *
 * @returns Rsync exclude flag and value.
 *
 * @example
 * ```ts
 * rsyncExcludeArgs('**\\/node_modules');
 * ```
 */
function rsyncExcludeArgs(pattern: string,): readonly string[] {
  return [
    '--exclude',
    pattern,
  ];
}

/**
 * Copies current repository source into the writable work tree.
 *
 * @example
 * ```ts
 * await rsyncSourceToWorkTree();
 * ```
 */
export async function rsyncSourceToWorkTree(): Promise<void> {
  await spawn(
    'rsync',
    [
      '--archive',
      '--delete',
      ...RSYNC_EXCLUDES.flatMap(function excludeArgs(pattern,): readonly string[] {
        return rsyncExcludeArgs(pattern,);
      },),
      `${SOURCE_MOUNT}/`,
      `${WORK_MOUNT}/`,
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
}

/**
 * Returns whether a path exists.
 *
 * @param path - Path to probe.
 *
 * @returns True when path is accessible.
 *
 * @example
 * ```ts
 * await pathExists('/tmp');
 * ```
 */
async function pathExists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error) {
    console.warn(
      `[mutation-test] path existence probe failed for ${path}: ${caughtErrorMessage(error,)}`,
    );
    return false;
  }
}

/**
 * Copies one package-local node_modules symlink farm from the baked layer.
 *
 * @param options - Baked and work-tree node_modules paths.
 *
 * @example
 * ```ts
 * await copyNodeModulesSymlinkFarm({
 *   bakedNodeModules: '/baked/packages/dev-script/x/node_modules',
 *   workNodeModules: '/work/packages/dev-script/x/node_modules',
 * });
 * ```
 */
async function copyNodeModulesSymlinkFarm(options: {
  readonly bakedNodeModules: string;
  readonly workNodeModules: string;
},): Promise<void> {
  await mkdir(
    options.workNodeModules,
    { recursive: true, },
  );
  await spawn(
    'rsync',
    [
      '--archive',
      '--delete',
      `${options.bakedNodeModules}/`,
      `${options.workNodeModules}/`,
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
}

/**
 * Recreates root node_modules symlink farm from the baked layer.
 *
 * @example
 * ```ts
 * await recreateRootNodeModules();
 * ```
 */
async function recreateRootNodeModules(): Promise<void> {
  /**
   * Root node_modules directory in writable work tree.
   */
  const workRootNodeModules = join(
    WORK_MOUNT,
    NODE_MODULES,
  );
  await mkdir(
    workRootNodeModules,
    { recursive: true, },
  );
  await spawn(
    'rsync',
    [
      '--archive',
      '--delete',
      '--exclude',
      PNPM_STORE,
      `${join(
        BAKED_ROOT,
        NODE_MODULES,
      )}/`,
      `${workRootNodeModules}/`,
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  await symlink(
    join(
      BAKED_ROOT,
      NODE_MODULES,
      PNPM_STORE,
    ),
    join(
      workRootNodeModules,
      PNPM_STORE,
    ),
  );
}

/**
 * Recreates one package-local node_modules symlink when the baked package has one.
 *
 * @param options - Package category and package name.
 *
 * @example
 * ```ts
 * await symlinkPackageNodeModules({ category: 'dev-script', packageName: 'file-enforcer' });
 * ```
 */
async function symlinkPackageNodeModules(options: {
  readonly category: string;
  readonly packageName: string;
},): Promise<void> {
  /**
   * Baked package-local node_modules path.
   */
  const bakedNodeModules = join(
    BAKED_ROOT,
    'packages',
    options.category,
    options.packageName,
    NODE_MODULES,
  );

  if (!await pathExists(bakedNodeModules,))
    return;

  /**
   * Writable work-tree package directory receiving node_modules symlink.
   */
  const workPackage = join(
    WORK_MOUNT,
    'packages',
    options.category,
    options.packageName,
  );
  await mkdir(
    workPackage,
    { recursive: true, },
  );
  await copyNodeModulesSymlinkFarm({
    bakedNodeModules,
    workNodeModules: join(
      workPackage,
      NODE_MODULES,
    ),
  },);
}

/**
 * Recreates package-local node_modules symlinks from the baked layer.
 *
 * @example
 * ```ts
 * await symlinkWorkspacePackageNodeModules();
 * ```
 */
async function symlinkWorkspacePackageNodeModules(): Promise<void> {
  /**
   * Workspace package category directories under baked tree.
   */
  const packageCategories = await readdir(
    join(
      BAKED_ROOT,
      'packages',
    ),
    { withFileTypes: true, },
  );
  /**
   * Symlink work for each package category.
   */
  const categoryTasks = packageCategories
    .filter(function isDirectory(category,): boolean {
      return category.isDirectory();
    },)
    .map(async function symlinkCategory(category,): Promise<void> {
      /**
       * Package directories under current category.
       */
      const packages = await readdir(
        join(
          BAKED_ROOT,
          'packages',
          category.name,
        ),
        { withFileTypes: true, },
      );
      await Promise.all(packages
        .filter(function isDirectory(packageEntry,): boolean {
          return packageEntry.isDirectory();
        },)
        .map(async function symlinkPackage(packageEntry,): Promise<void> {
          await symlinkPackageNodeModules({
            category: category.name,
            packageName: packageEntry.name,
          },);
        },),);
    },);

  await Promise.all(categoryTasks,);
}

/**
 * Recreates root and package-local node_modules symlinks from the baked layer.
 *
 * @example
 * ```ts
 * await recreateNodeModulesSymlinks();
 * ```
 */
export async function recreateNodeModulesSymlinks(): Promise<void> {
  await recreateRootNodeModules();
  await symlinkWorkspacePackageNodeModules();
}
