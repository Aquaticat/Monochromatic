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
 * Declaration-file suffixes excluded from incremental dependency closures.
 */
const DECLARATION_SURFACE_SUFFIXES: readonly string[] = [
  '.d.ts',
  '.d.mts',
  '.d.cts',
];

/**
 * Tests whether file participates in declaration surface.
 *
 * @param fileName - Program source path.
 *
 * @returns whether path names a declaration file.
 *
 * @example
 * ```ts
 * isDeclarationSurfaceFileName('/repo/src/env.d.ts');
 * ```
 */
export function isDeclarationSurfaceFileName(fileName: string,): boolean {
  return DECLARATION_SURFACE_SUFFIXES.some(function declaration(suffix,): boolean {
    return fileName.endsWith(suffix,);
  },);
}

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
 * Reads exact source text from active overlay or filesystem.
 *
 * @param project - TypeScript project providing fallback decoded source.
 *
 * @param activeSourceFile - Active Oxlint overlay source.
 *
 * @param fileName - Program source path to fingerprint.
 *
 * @returns exact source text.
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
  try {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor hashes project files once on cache lookup. */
    /**
     * Disk source text matching configured project snapshot.
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
 * Fingerprint over on-disk text alone, per project.
 *
 * `projectSourceText` returns the overlay for the active file and reads every other from disk,
 * so one derivation reads some four thousand files and hashes them, once per worker-project
 * pair. Measured at 20.7ms each and 15.0 warm seconds in
 * `doc/planning/oxlint-warm-sweep-attribution.md`.
 *
 * Stored only from a call whose overlay already matched disk, so what is kept is always the
 * all-disk fingerprint and never one carrying unsaved text.
 */
const diskFingerprintByProject = new WeakMap<Project, EffectProjectFingerprint>();

/**
 * Reads one file's text from disk, for comparing an overlay against it.
 *
 * Absent rather than throwing when the file cannot be read, since a file the overlay describes
 * but disk does not is exactly the case where the fingerprint must be computed rather than
 * reused.
 *
 * @param fileName - File whose disk text is wanted.
 *
 * @returns disk text, or sentinel when it cannot be read.
 *
 * @example
 * ```ts
 * activeFileDiskText({ fileName });
 * ```
 */
function activeFileDiskText(
  { fileName, }: { readonly fileName: string; },
): string | typeof DISK_TEXT_UNAVAILABLE {
  try {
    /* oxlint-disable no-restricted-syntax/no-sync -- One read deciding whether four thousand can be skipped, in the same synchronous visitor that already reads them. */
    return readFileSync(
      fileName,
      'utf8',
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
  }
  catch (error) {
    void error;
    return DISK_TEXT_UNAVAILABLE;
  }
}

/**
 * Sentinel for a file whose disk text cannot be read.
 */
const DISK_TEXT_UNAVAILABLE: unique symbol = Symbol('file has no readable disk text',);

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
   * Whether the active file's overlay says the same as that file on disk.
   *
   * Costs one read to establish. When it holds, every text this function goes on to read is the
   * disk text, since `projectSourceText` substitutes the overlay for that file alone, so a
   * stored all-disk fingerprint describes this call exactly.
   *
   * Required rather than defensive. The overlay exists so an unsaved buffer can differ, and
   * reusing a fingerprint across that difference would select an index built for other text.
   */
  const overlayMatchesDisk = activeSourceFile.text === activeFileDiskText({
    fileName: activeSourceFile.fileName,
  },);
  /**
   * All-disk fingerprint this project settled on an earlier call, when one applies.
   */
  const storedDiskFingerprint = diskFingerprintByProject.get(project,);
  if (overlayMatchesDisk && (storedDiskFingerprint !== undefined))
    return storedDiskFingerprint;
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
    if (isDeclarationSurfaceFileName(fileName,)) {
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
  /**
   * Fingerprint for this call, kept only when it describes disk text alone.
   */
  const fingerprint: EffectProjectFingerprint = {
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
  if (overlayMatchesDisk) {
    diskFingerprintByProject.set(
      project,
      fingerprint,
    );
  }
  return fingerprint;
}
