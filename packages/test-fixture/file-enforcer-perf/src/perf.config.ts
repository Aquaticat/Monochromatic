/**
 * Performance benchmark configuration for file-enforcer.
 * Exercises all major operations: cat (array + glob), overwrite,
 * overwriteEach, dedup, getJsonProperty, and deep glob traversal.
 *
 * Writes ~68 destination files from ~240 source files.
 * Run via `bun perf.config.ts` after setup-fixture.ts creates the fixture.
 */

import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  cat,
  dedup,
  getJsonProperty,
  overwrite,
  overwriteEach,
  readCache,
  reset,
} from '@monochromatic-dev/dev-script-file-enforcer/ts';

import type { GlobResults, } from '@monochromatic-dev/dev-script-file-enforcer/ts';

// Reset tracker so each run starts clean (critical for watch mode and repeated benchmarks)
reset();
// Log cache stats for benchmark diagnostics
console.error(`[perf.config] readCache size: ${String(readCache.size,)} entries`,);

/** Absolute path to the fixture root, respects $TMPDIR for sandbox compatibility */
const BASE = join(tmpdir(), 'file-enforcer-perf',);
/** Absolute path to the source directory within the fixture */
const SRC = `${BASE}/src`;
/** Absolute path to the destination directory within the fixture */
const DEST = `${BASE}/dest`;
/** Absolute path to the staleness manifest within the fixture */
const MANIFEST_PATH = `${BASE}/staleness-manifest.json`;

/**
 * Returns the fixture path for a package by index.
 *
 * @param pkgIndex - Package index (0-19)
 *
 * @returns Absolute path to the package directory
 */
function pkgPath(pkgIndex: number,): string {
  return `${SRC}/pkg-${String(pkgIndex,).padStart(2, '0',)}`;
}

/** Number of packages per concat group */
const PACKAGES_PER_GROUP = 4;
/** Total concat groups (5 groups * 4 packages = 20 packages covered) */
const CONCAT_GROUP_COUNT = 5;

//region All rules: single Promise.all to minimize CFS yield points

/** Glob mirror configurations: source subdirectory + filename */
const MIRROR_CONFIGS = [
  { dir: 'lib', file: 'index.ts', },
  { dir: 'lib', file: 'utils.ts', },
  { dir: 'types', file: 'index.d.ts', },
] as const;

/**
 * Generates the readme path for a given package index.
 *
 * @param _unused - Unused array element placeholder
 *
 * @param pkgIndex - Package index (0-19)
 *
 * @returns Absolute path to the package's readme
 */
function readmePath(_unused: unknown, pkgIndex: number,): string {
  return `${pkgPath(pkgIndex,)}/docs/readme.md`;
}

/** All readme paths for the dedup rule */
const allReadmeSources = Array.from(
  { length: 20, },
  readmePath,
);

/** Deep glob patterns for 6-level nested mirroring (source) */
const deepSourceGlob = `${SRC}/pkg-*/lib/deep/nested/very/deep/module.ts`;
/** Deep glob patterns for 6-level nested mirroring (destination) */
const deepDestGlob = `${DEST}/deep-mirror/*/module.ts`;

/**
 * Concatenates readme.md files from a group of 4 packages and writes the combined result.
 *
 * @param _unused - Unused array element placeholder
 *
 * @param groupIndex - Group index (0-4)
 */
async function concatGroup(_unused: unknown, groupIndex: number,): Promise<void> {
  /**
   * Generates the readme path for a package within a concat group.
   *
   * @param _inner - Unused array element placeholder
   *
   * @param pkgOffset - Offset within the group (0-3)
   *
   * @returns Absolute path to the package's readme
   */
  function groupReadmePath(_inner: unknown, pkgOffset: number,): string {
    return `${pkgPath(groupIndex * PACKAGES_PER_GROUP + pkgOffset,)}/docs/readme.md`;
  }

  /** Source readme paths for this group of 4 packages */
  const sources = Array.from(
    { length: PACKAGES_PER_GROUP, },
    groupReadmePath,
  );
  /**
   * Builds the concatenated content for this group.
   *
   * @returns Combined readme content.
   *
   * @example
   * ```ts
   * const content = await buildConcatContent();
   * ```
   */
  async function buildConcatContent(): Promise<string> {
    return await cat(sources,);
  }

  await overwrite({
    dest: `${DEST}/combined-${String(groupIndex,)}.md`,
    content: buildConcatContent,
    manifestPath: MANIFEST_PATH,
  },);
}

/**
 * Mirrors source files matching a glob pattern to corresponding destination paths.
 *
 * @param config - Mirror configuration with dir and file properties
 */
async function mirrorConfig(
  config: { readonly dir: string; readonly file: string; },
): Promise<void> {
  const destGlob = `${DEST}/mirror-${config.dir}/*/${config.file}`;
  /**
   * Reads source files for this mirror rule.
   *
   * @returns Glob results for the mirror rule.
   *
   * @example
   * ```ts
   * const files = await readMirrorFiles();
   * ```
   */
  async function readMirrorFiles(): Promise<GlobResults> {
    return await cat(`${SRC}/pkg-*/${config.dir}/${config.file}`,);
  }

  await overwriteEach({
    destGlob,
    files: readMirrorFiles,
    manifestPath: MANIFEST_PATH,
  },);
}

/**
 * Extracts the `.name` property from pkg-00's settings.json and writes it.
 */
async function extractName(): Promise<void> {
  /**
   * Builds extracted package name content.
   *
   * @returns Extracted name.
   *
   * @example
   * ```ts
   * const name = await buildExtractedName();
   * ```
   */
  async function buildExtractedName(): Promise<string> {
    const content = await cat([`${pkgPath(0,)}/config/settings.json`,],);
    return getJsonProperty({ path: ['name',], content, },);
  }

  await overwrite({
    dest: `${DEST}/name-0.txt`,
    content: buildExtractedName,
    manifestPath: MANIFEST_PATH,
  },);
}

/**
 * Extracts the `.config.features` property from pkg-01's settings.json and writes it.
 */
async function extractFeatures(): Promise<void> {
  /**
   * Builds extracted feature-list content.
   *
   * @returns Extracted feature list.
   *
   * @example
   * ```ts
   * const features = await buildExtractedFeatures();
   * ```
   */
  async function buildExtractedFeatures(): Promise<string> {
    const content = await cat([`${pkgPath(1,)}/config/settings.json`,],);
    return getJsonProperty({ path: ['config', 'features',], content, },);
  }

  await overwrite({
    dest: `${DEST}/features-1.txt`,
    content: buildExtractedFeatures,
    manifestPath: MANIFEST_PATH,
  },);
}

/**
 * Combines all 20 package readmes and removes duplicate lines.
 */
async function dedupAllReadmes(): Promise<void> {
  /**
   * Builds deduplicated readme content.
   *
   * @returns Deduplicated readme content.
   *
   * @example
   * ```ts
   * const content = await buildDedupedReadmes();
   * ```
   */
  async function buildDedupedReadmes(): Promise<string> {
    const allReadmes = await cat(allReadmeSources,);
    return dedup(allReadmes,);
  }

  await overwrite({
    dest: `${DEST}/all-readmes-deduped.md`,
    content: buildDedupedReadmes,
    manifestPath: MANIFEST_PATH,
  },);
}

/**
 * Mirrors 6-level nested source files to destination paths.
 */
async function mirrorDeepFiles(): Promise<void> {
  /**
   * Reads deeply nested source files.
   *
   * @returns Deep source glob results.
   *
   * @example
   * ```ts
   * const files = await readDeepFiles();
   * ```
   */
  async function readDeepFiles(): Promise<GlobResults> {
    return await cat(deepSourceGlob,);
  }

  await overwriteEach({
    destGlob: deepDestGlob,
    files: readDeepFiles,
    manifestPath: MANIFEST_PATH,
  },);
}

await Promise.all([
  // Concat rules: combine readme.md from groups of 4 packages
  ...Array.from({ length: CONCAT_GROUP_COUNT, }, concatGroup,),

  // Glob mirror rules: mirror lib and type files across packages
  ...MIRROR_CONFIGS.map(function runMirror(config,) {
    return mirrorConfig(config,);
  },),

  // getJsonProperty extractions: parse JSON and extract nested values
  extractName(),
  extractFeatures(),

  // Dedup: combine all 20 readmes and remove duplicate lines
  dedupAllReadmes(),

  // Deep glob: mirror 6-level nested files
  mirrorDeepFiles(),
],);

//endregion All rules
