/**
 * Exact configured-project fingerprint for semantic cache invalidation.
 *
 * @module
 */

import { createHash, } from 'node:crypto';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { Project, } from 'typescript/unstable/sync';
import type { SourceFile, } from 'typescript/unstable/ast';

import { ancestorDirectories, } from './ancestor-directories.ts';
import { isDeclarationFileName, } from './declaration-file-name.ts';
import {
  updateHashPlainValue,
  updateHashString,
} from './effect-hash-value.ts';
import { contentDigest, } from './effect-summary-cache-identity.ts';

/**
 * Project fingerprint logger.
 */
const l = tagged({ tag: 'effect-project-fingerprint', },);

/**
 * Whole-scope invalidation surfaces validating incremental cache entries.
 *
 * Each digest binds one channel through which a file's semantics can change
 * without any of its resolved module dependencies changing: project
 * membership, ambient and external declaration files, global or module
 * augmentations authored in non-declaration sources, resolved compiler
 * options, and governing lockfile content.
 */
export type EffectProjectSurfaces = {
  readonly fileListDigest: string;
  readonly declarationSurfaceDigest: string;
  readonly augmentationSurfaceDigest: string;
  readonly compilerOptionsDigest: string;
  readonly lockfileDigest: string;
};

/**
 * Fingerprint and per-source identities for one project snapshot.
 */
export type EffectProjectFingerprint = {
  readonly digest: string;
  readonly fileListDigest: string;
  readonly sourceDigests: ReadonlyMap<string, string>;
  readonly surfaces: EffectProjectSurfaces;
};

/**
 * Tests whether source text can carry global or module augmentation.
 *
 * Token containment over-approximates: comment or string occurrences also
 * bind, which only widens invalidation and never misses a real augmentation.
 *
 * @param sourceText - Non-declaration source text.
 *
 * @returns whether text contains an augmentation token.
 */
function containsAugmentationToken(sourceText: string,): boolean {
  return sourceText.includes('declare global',)
    || sourceText.includes('declare module',);
}

/**
 * Sentinel when no governing pnpm lockfile exists.
 */
const LOCKFILE_NOT_FOUND: unique symbol = Symbol('governing pnpm lockfile not found',);

/**
 * Finds nearest pnpm lockfile governing configured project.
 *
 * @param configFileName - TypeScript configuration path.
 *
 * @returns lockfile path or domain-specific absent sentinel.
 */
function nearestLockfile(
  configFileName: string,
): string | typeof LOCKFILE_NOT_FOUND {
  for (const directory of ancestorDirectories(dirname(configFileName,),)) {
    /**
     * Candidate pnpm lockfile at current ancestor.
     */
    const candidate = join(
      directory,
      'pnpm-lock.yaml',
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous semantic visitor resolves cache identity before analysis.
    if (existsSync(candidate,))
      return candidate;
  }
  return LOCKFILE_NOT_FOUND;
}

/**
 * Reads exact source text from active overlay, analysed snapshot, or disk.
 *
 * The fingerprint names the state the summaries beneath it were derived from, and that state is
 * the snapshot. Reading disk instead pairs an unchanged syntax tree with a digest of whatever a
 * concurrent write left behind, and stores summaries under a key describing text nothing
 * analysed. That entry then persists, and a later ordinary run can reuse it.
 *
 * So the snapshot answers for every source the rule walks. It costs nothing to ask, because
 * `indexedSourceFileMap` has already decoded exactly the non-declaration sources by the time this
 * runs.
 *
 * Declaration files are still read from disk, and that is a deliberate, measured limit rather
 * than an oversight. Nothing else decodes them: asking the snapshot for all 574 sources of one
 * project cost 136.9ms against 13.0ms for the whole disk pass, and 6.2 warm seconds across the
 * repository, because the 303 declarations are decoded for this and nothing else. The residual
 * hole is a declaration file rewritten during a sweep, which in practice means a workspace
 * `.d.ts` rebuilt underneath a running lint. Closing that means asking the snapshot for them too
 * and paying the decode.
 *
 * @param project - TypeScript project providing analysed source.
 *
 * @param activeSourceFile - Active Oxlint overlay source.
 *
 * @param fileName - Program source path to fingerprint.
 *
 * @returns exact source text.
 *
 * @throws {@link Error} when neither snapshot nor filesystem can produce source.
 */
function projectSourceText({
  project,
  activeSourceFile,
  fileName,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
  readonly fileName: string;
},): string {
  if (fileName === activeSourceFile.fileName)
    return activeSourceFile.text;
  if (!isDeclarationFileName(fileName,)) {
    /**
     * Source text as the analysed snapshot holds it, already decoded by the scope derivation.
     */
    const snapshotText = project.program
      .getSourceFile(fileName,)
      ?.text;
    if (snapshotText !== undefined)
      return snapshotText;
  }
  try {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor hashes declaration files once on cache lookup. */
    /**
     * Disk source text for a declaration, or for a path the snapshot omits.
     */
    const text = readFileSync(
      fileName,
      'utf8',
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    return text;
  }
  catch (error) {
    /**
     * Decoded virtual or bundled source unavailable through ordinary filesystem.
     */
    const fallback = project.program
      .getSourceFile(fileName,)
      ?.text;
    if (fallback !== undefined)
      return fallback;
    throw new Error(
      `Cannot fingerprint project source ${fileName}: ${String(error,)}`,
      { cause: error },
    );
  }
}

/**
 * Computes exact semantic project fingerprint and source digest map.
 *
 * @param project - Configured TypeScript project.
 *
 * @param activeSourceFile - Current overlay source.
 *
 * @returns project digest,
 * file-list digest,
 * and per-source digests.
 *
 * @example
 * ```ts
 * const fingerprint = effectProjectFingerprint({ project, activeSourceFile });
 * ```
 */
export function effectProjectFingerprint({
  project,
  activeSourceFile,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
},): EffectProjectFingerprint {
  /**
   * Stable program file order independent from TypeScript insertion order.
   */
  const fileNames = project.program
    .getSourceFileNames()
    .toSorted();
  /**
   * Digest detecting project graph membership changes.
   */
  const fileListDigest = contentDigest(fileNames.join('\0',),);
  /**
   * Per-source content identities retained for process-local active-file hits.
   */
  const sourceDigests = new Map<string, string>();
  /**
   * Complete semantic identity digest.
   */
  const digest = createHash('sha256',);
  /**
   * Declaration-file surface digest covering ambient and external types.
   */
  const declarationSurface = createHash('sha256',);
  /**
   * Augmentation surface digest covering non-declaration ambient authorship.
   */
  const augmentationSurface = createHash('sha256',);
  updateHashString({
    digest,
    value: project.configFileName,
  },);
  updateHashPlainValue({
    digest,
    value: project.compilerOptions,
  },);
  /**
   * Resolved compiler-option identity validated by incremental entries.
   */
  const optionsDigest = createHash('sha256',);
  updateHashPlainValue({
    digest: optionsDigest,
    value: project.compilerOptions,
  },);
  fileNames.forEach(function hashSource(fileName,): void {
    /**
     * Exact source text from overlay or configured snapshot.
     */
    const sourceText = projectSourceText({
      project,
      activeSourceFile,
      fileName,
    },);
    /**
     * Source content identity.
     */
    const sourceDigest = contentDigest(sourceText,);
    sourceDigests.set(
      fileName,
      sourceDigest,
    );
    updateHashString({
      digest,
      value: fileName,
    },);
    updateHashString({
      digest,
      value: sourceDigest,
    },);
    if (isDeclarationFileName(fileName,)) {
      updateHashString({
        digest: declarationSurface,
        value: fileName,
      },);
      updateHashString({
        digest: declarationSurface,
        value: sourceDigest,
      },);
      return;
    }
    if (containsAugmentationToken(sourceText,)) {
      updateHashString({
        digest: augmentationSurface,
        value: fileName,
      },);
      updateHashString({
        digest: augmentationSurface,
        value: sourceDigest,
      },);
    }
  },);
  /**
   * Governing lockfile whose package identities affect resolution.
   */
  const lockfile = nearestLockfile(project.configFileName,);
  /**
   * Lockfile content identity, or absence marker when no lockfile governs.
   */
  const lockfileState = { digest: 'lockfile-absent', };
  if ((typeof lockfile) !== 'symbol') {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor includes exact lockfile identity once per project cache miss. */
    /**
     * Lockfile text for package-resolution invalidation.
     */
    const lockfileText = readFileSync(
      lockfile,
      'utf8',
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    updateHashString({
      digest,
      value: lockfile,
    },);
    lockfileState.digest = contentDigest(`${lockfile}\0${contentDigest(lockfileText,)}`,);
    updateHashString({
      digest,
      value: contentDigest(lockfileText,),
    },);
  }
  return {
    digest: digest.digest('hex',),
    fileListDigest,
    sourceDigests,
    surfaces: {
      fileListDigest,
      declarationSurfaceDigest: declarationSurface.digest('hex',),
      augmentationSurfaceDigest: augmentationSurface.digest('hex',),
      compilerOptionsDigest: optionsDigest.digest('hex',),
      lockfileDigest: lockfileState.digest,
    },
  };
}
