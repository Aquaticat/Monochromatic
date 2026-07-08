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

import { createRequire, } from 'node:module';
import { rm, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  packager,
  type OfficialArch,
  type OfficialPlatform,
} from '@electron/packager';

import {
  DISTRIBUTION_TARGETS,
  targetKey,
  type DistributionTarget,
} from './distribution-targets.js';

/** CommonJS require rooted at this compiled tool for package metadata reads. */
const require = createRequire(import.meta.url,);

/** Package directory used as task working directory. */
const packageRoot = process.cwd();

/** Staged app directory produced by the build task. */
const appDir = join(packageRoot, 'dist', 'app',);

/** Directory receiving Packager output bundles. */
const distributionDir = join(packageRoot, 'dist', 'distribution',);

/** Dry-run manifest path documenting intended targets without downloading Electron. */
const dryRunManifestPath = join(distributionDir, 'manifest.json',);

/** Stable Electron application bundle identifier. */
const appBundleId = 'dev.monochromatic.electron-counter';

/** macOS Finder category for this demonstrator. */
const appCategoryType = 'public.app-category.developer-tools';

/** Executable basename used across target platforms. */
const executableName = 'monochromatic-electron-counter';

/**
 * Shape read from `electron/package.json`.
 *
 * @example
 * ```ts
 * const metadata: ElectronPackageMetadata = { version: '42.0.0' };
 * ```
 */
type ElectronPackageMetadata = {
  readonly version: string;
};

/**
 * Parsed CLI arguments for this distribution wrapper.
 *
 * @example
 * ```ts
 * const options: DistributionOptions = { dryRun: true, selectedTargetKeys: [] };
 * ```
 */
type DistributionOptions = {
  readonly dryRun: boolean;
  readonly selectedTargetKeys: readonly string[];
};

/**
 * Throws when `value` is not Electron's package metadata shape.
 *
 * @param value - Package metadata loaded through `createRequire`.
 *
 * @returns Electron package metadata with version.
 *
 * @example
 * ```ts
 * parseElectronPackageMetadata({ value: { version: '42.0.0' } });
 * ```
 */
function parseElectronPackageMetadata(
  { value, }: { readonly value: unknown; },
): ElectronPackageMetadata {
  if (
    typeof value !== 'object'
    || value === null
    || !('version' in value)
  )
    throw new Error('electron/package.json did not expose a version.',);

  /** Metadata after structural narrowing. */
  const metadata = value as { readonly version: unknown; };

  if (typeof metadata.version !== 'string')
    throw new Error('electron/package.json version must be a string.',);

  return { version: metadata.version, };
}

/**
 * Reads the installed Electron version used by Packager downloads.
 *
 * @returns Electron version string from installed package metadata.
 *
 * @example
 * ```ts
 * const version = readElectronVersion();
 * ```
 */
function readElectronVersion(): string {
  return parseElectronPackageMetadata({
    value: require('electron/package.json',) as unknown,
  },).version;
}

/**
 * Parses distribution CLI arguments.
 *
 * @param argv - Argument vector after node and script path.
 *
 * @returns Dry-run flag plus optional target-key filters.
 *
 * @example
 * ```ts
 * parseDistributionArgs({ argv: ['--dry-run', '--target', 'linux-x64'] });
 * ```
 */
function parseDistributionArgs({ argv, }: { readonly argv: readonly string[]; },): DistributionOptions {
  /** Whether Packager should be skipped and only a manifest written. */
  let dryRun = false;

  /** Target-key filters requested through repeated `--target KEY` pairs. */
  const selectedTargetKeys: string[] = [];

  /** Cursor over CLI arguments. */
  let index = 0;
  while (index < argv.length) {
    /** Current CLI token. */
    const token = argv[index];

    if (token === '--dry-run') {
      dryRun = true;
      index += 1;
    }
    else if (token === '--target') {
      /** Target key following `--target`. */
      const target = argv[index + 1];
      if (target === undefined)
        throw new Error('--target requires a target key.',);
      selectedTargetKeys.push(target,);
      index += 2;
    }
    else {
      throw new Error(`Unknown distribution argument: ${String(token,)}`,
      );
    }
  }

  return {
    dryRun,
    selectedTargetKeys,
  };
}

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

  /** Known target keys available in this package. */
  const knownKeys = new Set(DISTRIBUTION_TARGETS.map(function toTargetKey(target,) {
    return targetKey({ target, },);
  },),);

  /** Unknown target keys requested by the caller. */
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
 * Writes a machine-readable manifest for dry-run and completed distribution runs.
 *
 * @param electronVersion - Electron version used for target bundles.
 *
 * @param targets - Distribution targets represented in the manifest.
 *
 * @example
 * ```ts
 * await writeDistributionManifest({ electronVersion: '42.0.0', targets: DISTRIBUTION_TARGETS });
 * ```
 */
async function writeDistributionManifest(
  {
    electronVersion,
    targets,
  }: {
    readonly electronVersion: string;
    readonly targets: readonly DistributionTarget[];
  },
): Promise<void> {
  await writeFile(
    dryRunManifestPath,
    `${JSON.stringify({
      appBundleId,
      electronVersion,
      targets: targets.map(function toManifestTarget(target,) {
        return {
          ...target,
          key: targetKey({ target, },),
        };
      },),
    }, null, 2,)}\n`,
    'utf8',
  );
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
    arch: target.arch as OfficialArch,
    asar: true,
    dir: appDir,
    electronVersion,
    executableName,
    name: 'Monochromatic ESM TS Counter',
    out: distributionDir,
    overwrite: true,
    platform: target.platform as OfficialPlatform,
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
  /** Electron version installed in this package. */
  const electronVersion = readElectronVersion();

  /** Distribution targets selected for this run. */
  const targets = selectTargets({ selectedTargetKeys, },);

  await rm(distributionDir, { recursive: true, force: true, },);
  await writeDistributionManifest({ electronVersion, targets, },);

  if (dryRun)
    return;

  for (const target of targets)
    await packageTarget({ electronVersion, target, },);
}

await distributeElectronCounter(parseDistributionArgs({ argv: process.argv.slice(2,), },),);
