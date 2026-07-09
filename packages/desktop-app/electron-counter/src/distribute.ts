/**
 * Creates platform-native Electron bundles for every supported target.
 *
 * This is intentionally a small `@electron/packager` wrapper, not Vite, Forge,
 * or electron-builder. The package has no runtime dependencies in `dist/app`,
 * so Packager only has to copy the staged ESM app and Electron itself.
 *
 * @example
 * ```ts
 * await distributeElectronCounter({ dryRun: true, selectedTargetKeys: [] });
 * ```
 */

import { rm, } from 'node:fs/promises';
import { join, } from 'node:path';

import { packager, } from '@electron/packager';

import {
  DISTRIBUTION_TARGETS,
  targetKey,
  type DistributionTarget,
} from './distribution-targets.js';
import {
  parseDistributionArgs,
  type DistributionOptions,
} from './distribution-args.js';
import { readElectronVersion, } from './electron-version.js';
import {
  appBundleId,
  appCategoryType,
  executableName,
  writeDistributionManifest,
} from './distribution-manifest.js';

/**
 * Package directory used as task working directory.
 *
 * @example
 * ```ts
 * console.log(packageRoot);
 * ```
 */
const packageRoot = process.cwd();

/**
 * Staged app directory produced by the build task.
 *
 * @example
 * ```ts
 * console.log(appDir);
 * ```
 */
const appDir = join(
  packageRoot,
  'dist',
  'app',
);

/**
 * Directory receiving Packager output bundles.
 *
 * @example
 * ```ts
 * console.log(distributionDir);
 * ```
 */
const distributionDir = join(
  packageRoot,
  'dist',
  'distribution',
);

/**
 * Dry-run manifest path documenting intended targets without downloading Electron.
 *
 * @example
 * ```ts
 * console.log(distributionManifestPath);
 * ```
 */
const distributionManifestPath = join(
  distributionDir,
  'manifest.json',
);

/**
 * Applies optional target-key filters to the full distribution matrix.
 *
 * @param selectedTargetKeys - Requested target keys, or empty for every target.
 *
 * @returns Distribution targets selected for this run.
 *
 * @example
 * ```ts
 * selectTargets({ selectedTargetKeys: ['linux-x64'] });
 * ```
 */
function selectTargets(
  { selectedTargetKeys, }: { readonly selectedTargetKeys: readonly string[]; },
): readonly DistributionTarget[] {
  if (selectedTargetKeys.length === 0)
    return DISTRIBUTION_TARGETS;

  /**
   * Known target keys available in this package.
   */
  const knownKeys = new Set(DISTRIBUTION_TARGETS.map(function toTargetKey(target,) {
    return targetKey({ target, },);
  },),);

  /**
   * Unknown target keys requested by the caller.
   */
  const unknownKeys = selectedTargetKeys.filter(function isUnknownKey(key,) {
    return !knownKeys.has(key,);
  },);

  if (unknownKeys.length > 0)
    throw new Error(`Unknown distribution target(s): ${unknownKeys.join(', ')}`,
    );

  return DISTRIBUTION_TARGETS.filter(function isSelectedTarget(target,) {
    return selectedTargetKeys.includes(targetKey({ target, },),);
  },);
}

/**
 * Runs Electron Packager for a single distribution target.
 *
 * @param electronVersion - Electron version to download and embed.
 *
 * @param target - Platform and architecture target.
 *
 * @example
 * ```ts
 * await packageTarget({ electronVersion: '42.0.0', target: { platform: 'linux', arch: 'x64' } });
 * ```
 */
async function packageTarget(
  {
    electronVersion,
    target,
  }: {
    readonly electronVersion: string;
    readonly target: DistributionTarget;
  },
): Promise<void> {
  await packager({
    appBundleId,
    appCategoryType,
    appCopyright: 'Copyright Monochromatic contributors',
    appVersion: '0.0.1',
    arch: target.arch,
    asar: true,
    dir: appDir,
    electronVersion,
    executableName,
    name: 'Monochromatic ESM TS Counter',
    out: distributionDir,
    overwrite: true,
    platform: target.platform,
    prune: true,
    quiet: false,
    win32metadata: {
      CompanyName: 'Monochromatic',
      FileDescription: 'Monochromatic ESM TS Counter',
      OriginalFilename: `${executableName}.exe`,
      ProductName: 'Monochromatic ESM TS Counter',
      InternalName: executableName,
    },
  },);
}

/**
 * Creates all requested distribution bundles or records the dry-run manifest.
 *
 * @param dryRun - Whether to skip Packager and only write the target manifest.
 *
 * @param selectedTargetKeys - Optional target keys to package.
 *
 * @example
 * ```ts
 * await distributeElectronCounter({ dryRun: true, selectedTargetKeys: [] });
 * ```
 */
async function distributeElectronCounter(
  {
    dryRun,
    selectedTargetKeys,
  }: DistributionOptions,
): Promise<void> {
  /**
   * Electron version installed in this package.
   */
  const electronVersion = readElectronVersion();

  /**
   * Distribution targets selected for this run.
   */
  const targets = selectTargets({ selectedTargetKeys, },);

  await rm(
    distributionDir,
    {
      recursive: true,
      force: true,
    },
  );
  await writeDistributionManifest({
    electronVersion,
    manifestPath: distributionManifestPath,
    targets,
  },);

  if (dryRun)
    return;

  await Promise.all(targets.map(function packageSelectedTarget(target,): Promise<void> {
    return packageTarget({
      electronVersion,
      target,
    },);
  },),);
}

await distributeElectronCounter(parseDistributionArgs({
  argv: process.argv
    .slice(2,),
},),);
