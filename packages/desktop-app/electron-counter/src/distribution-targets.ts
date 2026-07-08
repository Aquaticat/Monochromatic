/**
 * Distribution target matrix for the Electron counter sample.
 *
 * The matrix intentionally uses Electron release architecture names while the
 * README describes them in user-facing CPU families.
 *
 * @example
 * ```ts
 * console.log(DISTRIBUTION_TARGETS.map(targetKey));
 * ```
 *
 * @packageDocumentation
 */

/**
 * Electron platform values used by `@electron/packager` for this package.
 *
 * @example
 * ```ts
 * const platform: ElectronCounterPlatform = 'linux';
 * ```
 */
export type ElectronCounterPlatform = 'linux' | 'win32' | 'darwin';

/**
 * Electron architecture values used by `@electron/packager` for this package.
 *
 * @example
 * ```ts
 * const arch: ElectronCounterArch = 'arm64';
 * ```
 */
export type ElectronCounterArch = 'x64' | 'arm64';

/**
 * One platform and architecture bundle target.
 *
 * @example
 * ```ts
 * const target: DistributionTarget = { platform: 'linux', arch: 'x64' };
 * ```
 */
export type DistributionTarget = {
  readonly arch: ElectronCounterArch;
  readonly platform: ElectronCounterPlatform;
};

/**
 * Number of supported operating system families in the target matrix.
 *
 * @example
 * ```ts
 * console.log(platformFamilyCount);
 * ```
 */
const platformFamilyCount = 3;

/**
 * Number of supported CPU families in the target matrix.
 *
 * @example
 * ```ts
 * console.log(cpuFamilyCount);
 * ```
 */
const cpuFamilyCount = 2;

/**
 * Expected Cartesian-product size for platform family by CPU family.
 *
 * @example
 * ```ts
 * console.log(DISTRIBUTION_TARGET_COUNT);
 * ```
 */
export const DISTRIBUTION_TARGET_COUNT = platformFamilyCount * cpuFamilyCount;

/**
 * Bundles the app for Linux, Windows, and macOS on x64 and arm64.
 *
 * @example
 * ```ts
 * console.log(DISTRIBUTION_TARGETS.length === DISTRIBUTION_TARGET_COUNT);
 * ```
 */
export const DISTRIBUTION_TARGETS = [
  { platform: 'linux', arch: 'x64', },
  { platform: 'linux', arch: 'arm64', },
  { platform: 'win32', arch: 'x64', },
  { platform: 'win32', arch: 'arm64', },
  { platform: 'darwin', arch: 'x64', },
  { platform: 'darwin', arch: 'arm64', },
] as const satisfies readonly DistributionTarget[];

/**
 * Returns a stable key for a distribution target.
 *
 * @param target - Distribution platform and architecture pair.
 *
 * @returns Stable key used in CLI filtering and manifest output.
 *
 * @example
 * ```ts
 * targetKey({ platform: 'linux', arch: 'x64' });
 * ```
 */
export function targetKey({ target, }: { readonly target: DistributionTarget; },): string {
  return `${target.platform}-${target.arch}`;
}
