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

/**
 * Baked dependency tree path inside the runtime image.
 */
const BAKED_ROOT = '/baked';

/**
 * Copies current repository source into the writable work tree.
 *
 * @returns Promise that resolves after rsync completes.
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
      '--exclude',
      '**/node_modules',
      '--exclude',
      '**/dist',
      '--exclude',
      '**/.git',
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
  catch {
    return false;
  }
}

/**
 * Recreates root node_modules symlink from the baked layer.
 *
 * @returns Promise that resolves after the root symlink exists.
 *
 * @example
 * ```ts
 * await symlinkRootNodeModules();
 * ```
 */
async function symlinkRootNodeModules(): Promise<void> {
  await symlink(
    join(BAKED_ROOT, 'node_modules',),
    join(WORK_MOUNT, 'node_modules',),
  );
}

/**
 * Recreates one package-local node_modules symlink when the baked package has one.
 *
 * @param options - Package category and package name.
 *
 * @returns Promise resolving after optional symlink work.
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
  const bakedNodeModules = join(
    BAKED_ROOT,
    'packages',
    options.category,
    options.packageName,
    'node_modules',
  );

  if (!await pathExists(bakedNodeModules,))
    return;

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
  await symlink(
    bakedNodeModules,
    join(workPackage, 'node_modules',),
  );
}

/**
 * Recreates package-local node_modules symlinks from the baked layer.
 *
 * @returns Promise resolving after all package symlinks are considered.
 *
 * @example
 * ```ts
 * await symlinkWorkspacePackageNodeModules();
 * ```
 */
async function symlinkWorkspacePackageNodeModules(): Promise<void> {
  const packageCategories = await readdir(
    join(BAKED_ROOT, 'packages',),
    { withFileTypes: true, },
  );

  for (const category of packageCategories) {
    if (!category.isDirectory())
      continue;

    const packages = await readdir(
      join(BAKED_ROOT, 'packages', category.name,),
      { withFileTypes: true, },
    );

    for (const packageEntry of packages) {
      if (!packageEntry.isDirectory())
        continue;

      await symlinkPackageNodeModules({
        category: category.name,
        packageName: packageEntry.name,
      },);
    }
  }
}

/**
 * Recreates root and package-local node_modules symlinks from the baked layer.
 *
 * @returns Promise that resolves when symlink farm exists.
 *
 * @example
 * ```ts
 * await recreateNodeModulesSymlinks();
 * ```
 */
export async function recreateNodeModulesSymlinks(): Promise<void> {
  await symlinkRootNodeModules();
  await symlinkWorkspacePackageNodeModules();
}
