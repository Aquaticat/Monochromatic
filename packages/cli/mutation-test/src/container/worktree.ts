/**
 * Container work-tree preparation: rsync source, recreate dependency
 * symlink farms from the baked layer.
 *
 * Ported from the proven dev-script-mutation-test worktree module; the
 * mechanics (excluding heavyweight artifacts, copying symlink farms
 * without following them, sharing the pnpm store by symlink) encode
 * hard-won container lessons and are not Stryker-shaped.
 *
 * @example
 * ```ts
 * await prepareWorkTree();
 * ```
 */

import type { Dirent, } from 'node:fs';
import {
  access,
  mkdir,
  readdir,
  symlink,
} from 'node:fs/promises';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  BAKED_ROOT,
  SOURCE_MOUNT,
  WORK_MOUNT,
} from '../mounts.ts';

/**
 * Module logger for work-tree preparation.
 */
const l = tagged({ tag: 'mutation-test-container', },);

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
        return [
          '--exclude',
          pattern,
        ];
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
    tagged({
      tag: pathExists.name,
      l,
    },)
      .debug(`path probe negative for ${path}: ${String(error,)}`,);
    return false;
  }
}

/**
 * Recreates root node_modules from the baked layer, sharing the pnpm
 * store by symlink instead of copying it.
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
 * Copies one package-local node_modules symlink farm from the baked layer.
 *
 * @param options - Package category and package name.
 *
 * @example
 * ```ts
 * await symlinkPackageNodeModules({ category: 'module', packageName: 'fs-path' });
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
   * Writable work-tree package node_modules path.
   */
  const workNodeModules = join(
    WORK_MOUNT,
    'packages',
    options.category,
    options.packageName,
    NODE_MODULES,
  );
  await mkdir(
    workNodeModules,
    { recursive: true, },
  );
  await spawn(
    'rsync',
    [
      '--archive',
      '--delete',
      `${bakedNodeModules}/`,
      `${workNodeModules}/`,
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
}

/**
 * Recreates every package-local node_modules symlink farm.
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
  await Promise.all(packageCategories
    .filter(function isDirectory(category: ForeignBorrowed<Dirent>,): boolean {
      return category.isDirectory();
    },)
    .map(async function symlinkCategory(category: ForeignBorrowed<Dirent>,): Promise<void> {
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
        .filter(function isDirectory(packageEntry: ForeignBorrowed<Dirent>,): boolean {
          return packageEntry.isDirectory();
        },)
        .map(async function symlinkPackage(packageEntry: ForeignBorrowed<Dirent>,): Promise<void> {
          await symlinkPackageNodeModules({
            category: category.name,
            packageName: packageEntry.name,
          },);
        },),);
    },),);
}

/**
 * Prepares the full work tree: source rsync plus dependency farms.
 *
 * Also materialises an empty `.git` directory marker: the work tree is
 * a copy of a git repository, and package tests may legitimately assume
 * an upward repo marker exists (fs-path's findGitRepoRoot does).
 *
 * @example
 * ```ts
 * await prepareWorkTree();
 * ```
 */
export async function prepareWorkTree(): Promise<void> {
  await rsyncSourceToWorkTree();
  await recreateRootNodeModules();
  await symlinkWorkspacePackageNodeModules();
  await mkdir(
    join(
      WORK_MOUNT,
      '.git',
    ),
    { recursive: true, },
  );
}
