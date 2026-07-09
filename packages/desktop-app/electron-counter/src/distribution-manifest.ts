/**
 * Manifest writer for Electron counter distribution outputs.
 *
 * @example
 * ```ts
 * await writeDistributionManifest({
 *   electronVersion: '42.0.0',
 *   manifestPath: '/tmp/manifest.json',
 *   targets: [],
 * });
 * ```
 *
 * @packageDocumentation
 */

import { writeFile, } from 'node:fs/promises';

import {
  targetKey,
  type DistributionTarget,
} from './distribution-targets.js';

/**
 * Stable Electron application bundle identifier.
 *
 * @example
 * ```ts
 * console.log(appBundleId);
 * ```
 */
export const appBundleId = 'dev.monochromatic.electron-counter';

/**
 * macOS Finder category for this demonstrator.
 *
 * @example
 * ```ts
 * console.log(appCategoryType);
 * ```
 */
export const appCategoryType = 'public.app-category.developer-tools';

/**
 * Executable basename used across target platforms.
 *
 * @example
 * ```ts
 * console.log(executableName);
 * ```
 */
export const executableName = 'monochromatic-electron-counter';

/**
 * Writes a machine-readable manifest for dry-run and completed distribution runs.
 *
 * @param electronVersion - Electron version used for target bundles.
 *
 * @param manifestPath - JSON path receiving the manifest.
 *
 * @param targets - Distribution targets represented in the manifest.
 *
 * @example
 * ```ts
 * await writeDistributionManifest({ electronVersion: '42.0.0', manifestPath: '/tmp/manifest.json', targets: [] });
 * ```
 */
export async function writeDistributionManifest(
  {
    electronVersion,
    manifestPath,
    targets,
  }: {
    readonly electronVersion: string;
    readonly manifestPath: string;
    readonly targets: readonly DistributionTarget[];
  },
): Promise<void> {
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        appBundleId,
        electronVersion,
        targets: targets.map(function toManifestTarget(target,) {
          return {
            ...target,
            key: targetKey({ target, },),
          };
        },),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}
