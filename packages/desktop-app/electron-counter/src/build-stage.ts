/**
 * Stages static files and package metadata for Electron Packager.
 *
 * TypeScript emits JavaScript modules, and this script adds files that are not
 * TypeScript outputs: HTML, CSS, and the minimal app `package.json` consumed by
 * Electron at runtime.
 *
 * @example
 * ```ts
 * await stageElectronApp();
 * ```
 */

import {
  access,
  cp,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

/**
 * Package directory used as task working directory.
 */
const packageRoot = process.cwd();

/**
 * Source directory containing static renderer assets.
 */
const sourceRoot = join(
  packageRoot,
  'src',
);

/**
 * Staged Electron app directory consumed by Electron and Packager.
 */
const appOutDir = join(
  packageRoot,
  'dist',
  'app',
);

/**
 * Package-local license directory managed by file-enforcer.
 */
const licenseDir = join(
  packageRoot,
  'LICENSES',
);

/**
 * Minimal package metadata read from this workspace package's root manifest.
 *
 * @example
 * ```ts
 * const metadata: RootPackageMetadata = { name: 'x', productName: 'X', version: '0.0.1' };
 * ```
 */
type RootPackageMetadata = {
  readonly description?: string;
  readonly license?: string;
  readonly name: string;
  readonly productName: string;
  readonly version: string;
};

/**
 * Runtime package metadata written into `dist/app` for Electron.
 *
 * @example
 * ```ts
 * const manifest: StagedPackageMetadata = { name: 'x', productName: 'X', version: '0.0.1', type: 'module', main: 'main.mjs' };
 * ```
 */
type StagedPackageMetadata = RootPackageMetadata & {
  readonly main: 'main.mjs';
  readonly type: 'module';
};

/**
 * Asserts that parsed JSON contains the manifest fields this package needs.
 *
 * @param value - Parsed JSON value from root package manifest.
 *
 * @returns Narrowed root package metadata.
 *
 * @throws Error when required package metadata is missing.
 *
 * @example
 * ```ts
 * parseRootPackageMetadata({ value: JSON.parse('{"name":"x","productName":"X","version":"0.0.1"}') });
 * ```
 */
function parseRootPackageMetadata({ value, }: { readonly value: unknown; },): RootPackageMetadata {
  if (
    ((typeof value) !== 'object')
    || (value === null)
      || (!('name' in value))
      || (!('productName' in value))
      || (!('version' in value))
  )
    throw new Error('Package manifest is missing name, productName, or version.',);

  /**
   * Manifest after structural checks have proven required keys exist.
   */
  const manifest = value as {
    readonly description?: unknown;
    readonly license?: unknown;
    readonly name: unknown;
    readonly productName: unknown;
    readonly version: unknown;
  };

  if (
    ((typeof manifest.name) !== 'string')
    || ((typeof manifest.productName) !== 'string')
      || ((typeof manifest.version) !== 'string')
  )
    throw new Error('Package manifest name, productName, and version must be strings.',);

  /**
   * Required package metadata shared by root and staged manifests.
   */
  const metadata: RootPackageMetadata = {
    name: manifest.name,
    productName: manifest.productName,
    version: manifest.version,
  };

  return {
    ...metadata,
    ...((typeof manifest.description) === 'string'
      ? { description: manifest.description, }
      : {}),
    ...((typeof manifest.license) === 'string'
      ? { license: manifest.license, }
      : {}),
  };
}

/**
 * Reads root package metadata from `package.json`.
 *
 * @returns Package metadata required for the staged app manifest.
 *
 * @example
 * ```ts
 * await readRootPackageMetadata();
 * ```
 */
async function readRootPackageMetadata(): Promise<RootPackageMetadata> {
  /**
   * Raw package manifest text.
   */
  const manifestText = await readFile(
    join(
      packageRoot,
      'package.json',
    ),
    'utf8',
  );
  return parseRootPackageMetadata({ value: JSON.parse(manifestText,), },);
}

/**
 * Copies optional package license texts into the staged app.
 *
 * @example
 * ```ts
 * await copyLicenseTexts();
 * ```
 */
async function copyLicenseTexts(): Promise<void> {
  try {
    await access(licenseDir,);
  }
  catch (error: unknown) {
    if (
      Error.isError(error,)
      && ('code' in error)
        && (error.code === 'ENOENT')
    )
      return;

    throw error;
  }

  await cp(
    licenseDir,
    join(
      appOutDir,
      'LICENSES',
    ),
    {
      force: true,
      recursive: true,
    },
  );
}

/**
 * Writes static assets and runtime manifest into `dist/app`.
 *
 * @example
 * ```ts
 * await stageElectronApp();
 * ```
 */
async function stageElectronApp(): Promise<void> {
  await mkdir(
    appOutDir,
    { recursive: true, },
  );
  await cp(
    join(
      sourceRoot,
      'index.html',
    ),
    join(
      appOutDir,
      'index.html',
    ),
  );
  await cp(
    join(
      sourceRoot,
      'styles.css',
    ),
    join(
      appOutDir,
      'styles.css',
    ),
  );
  await copyLicenseTexts();

  /**
   * Root package metadata that should survive into the staged runtime manifest.
   */
  const rootMetadata = await readRootPackageMetadata();

  /**
   * Runtime manifest consumed by Electron inside the staged app directory.
   */
  const stagedMetadata: StagedPackageMetadata = {
    ...rootMetadata,
    main: 'main.mjs',
    type: 'module',
  };

  await writeFile(
    join(
      appOutDir,
      'package.json',
    ),
    `${JSON.stringify(
      stagedMetadata,
      null,
      2,
    )}\n`,
    'utf8',
  );
}

await stageElectronApp();
