/**
 * Exact configured-project fingerprint for semantic cache invalidation.
 *
 * @module
 */

import { createHash, } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  statSync,
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
 * Synthetic signature key for resolved compiler options.
 */
const COMPILER_OPTIONS_SIGNATURE_KEY = '\0compiler-options';

/**
 * Synthetic signature key for governing lockfile.
 */
const LOCKFILE_SIGNATURE_KEY = '\0pnpm-lockfile';

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
 * Computes process snapshot signatures for project files.
 *
 * Active overlay uses content digest.
 * Disk files use inode,
 * size,
 * modification time,
 * and change time so dependency edits invalidate final fixed-point indexes
 * before their own Oxlint visitor runs.
 *
 * @param project - Configured TypeScript project.
 *
 * @param activeSourceFile - Current overlay source.
 *
 * @param fileNames - Stable configured project membership.
 *
 * @returns source signatures keyed by exact path.
 *
 * @example
 * ```ts
 * effectProjectSourceSignatures({ project, activeSourceFile, fileNames });
 * ```
 */
export function effectProjectSourceSignatures({
  project,
  activeSourceFile,
  fileNames,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
  readonly fileNames: readonly string[];
}): ReadonlyMap<string, string> {
  /**
   * Process snapshot signatures keyed by program source path.
   */
  const signatures = new Map<string, string>();
  fileNames.forEach(function sourceSignature(fileName,): void {
    if (fileName === activeSourceFile.fileName) {
      try {
        /* oxlint-disable no-restricted-syntax/no-sync -- Active overlay comparison reads only current disk file to preserve cross-file cache hits. */
        /**
         * Current disk source used to detect in-memory overlay divergence.
         */
        const diskText = readFileSync(
          fileName,
          'utf8',
        );
        /* oxlint-enable no-restricted-syntax/no-sync */
        if (diskText !== activeSourceFile.text) {
          signatures.set(
            fileName,
            `content:${contentDigest(activeSourceFile.text,)}`,
          );
          return;
        }
      }
      catch (error) {
        l.debug(`active source metadata fallback for ${fileName}: ${String(error,)}`,);
        signatures.set(
          fileName,
          `content:${contentDigest(activeSourceFile.text,)}`,
        );
        return;
      }
    }
    try {
      /* oxlint-disable no-restricted-syntax/no-sync -- Process-local final-index validation reads source metadata without decoding unchanged files. */
      /**
       * Filesystem metadata changed by ordinary file content replacement.
       */
      const metadata = statSync(fileName,);
      /* oxlint-enable no-restricted-syntax/no-sync */
      signatures.set(
        fileName,
        `disk:${String(metadata.dev,)}:${String(metadata.ino,)}:${String(metadata.size,)}:${String(metadata.mtimeMs,)}:${String(metadata.ctimeMs,)}`,
      );
    }
    catch (error) {
      /**
       * Virtual or bundled source fallback loaded by TypeScript program.
       */
      const sourceText = project.program
        .getSourceFile(fileName,)
        ?.text;
      if (sourceText === undefined)
        throw new Error(
          `Cannot identify project source ${fileName}: ${String(error,)}`,
          { cause: error },
        );
      signatures.set(
        fileName,
        `content:${contentDigest(sourceText,)}`,
      );
    }
  },);
  /**
   * Resolved compiler-option identity including extended configuration.
   */
  const optionsDigest = createHash('sha256',);
  updateHashPlainValue({
    digest: optionsDigest,
    value: project.compilerOptions,
  },);
  signatures.set(
    COMPILER_OPTIONS_SIGNATURE_KEY,
    optionsDigest.digest('hex',),
  );
  /**
   * Governing lockfile whose version graph affects package inference.
   */
  const lockfile = nearestLockfile(project.configFileName,);
  if ((typeof lockfile) !== 'symbol') {
    try {
      /* oxlint-disable no-restricted-syntax/no-sync -- Process-local final-index validation checks governing lockfile metadata. */
      /**
       * Lockfile metadata changed by dependency graph updates.
       */
      const metadata = statSync(lockfile,);
      /* oxlint-enable no-restricted-syntax/no-sync */
      signatures.set(
        LOCKFILE_SIGNATURE_KEY,
        `disk:${String(metadata.dev,)}:${String(metadata.ino,)}:${String(metadata.size,)}:${String(metadata.mtimeMs,)}:${String(metadata.ctimeMs,)}`,
      );
    }
    catch (error) {
      l.debug(`lockfile metadata unavailable for ${lockfile}: ${String(error,)}`,);
      signatures.set(
        LOCKFILE_SIGNATURE_KEY,
        'unavailable',
      );
    }
  }
  return signatures;
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
