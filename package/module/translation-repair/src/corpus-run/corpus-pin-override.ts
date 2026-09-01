import { isAbsolute, } from 'node:path';

import type { CorpusPin, } from '../corpus-source.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';

//region Corpus pin override
// Which clone and commit a run reads its corpus from.
//
// The pinned defaults serve every benchmark and calibration run; fixture runs
// against an unmerged corpus pull request need a different clone and commit
// WITHOUT editing source, which is what the 2026-08-29 Carena runs did and
// what this dial replaces. Refusal over fallback for the same reason as the
// overlap dial: a mistyped override that silently became the pin would run
// the wrong corpus and record its conclusion as the fixture's.

/**
 * Environment variable naming the corpus clone directory a run reads.
 */
export const CORPUS_CLONE_DIR_VAR = 'TRANSLATION_REPAIR_CORPUS_CLONE_DIR';

/**
 * Environment variable naming the corpus commit every read resolves against.
 */
export const CORPUS_COMMIT_VAR = 'TRANSLATION_REPAIR_CORPUS_COMMIT';

/**
 * Where each half of a pin came from, for launch logs.
 *
 * @example
 * ```ts
 * const source: CorpusPinSource = 'fallback';
 * ```
 */
export type CorpusPinSource =
  | 'fallback'
  | typeof CORPUS_CLONE_DIR_VAR
  | typeof CORPUS_COMMIT_VAR;

/**
 * One resolved pin beside where each half came from.
 *
 * @example
 * ```ts
 * const setting: CorpusPinSetting = {
 *   pin: { cloneDir: '/cats/corpus', commitSha: 'a'.repeat(40,), },
 *   cloneDirSource: 'fallback',
 *   commitSource: 'fallback',
 * };
 * ```
 */
export type CorpusPinSetting = {
  /**
   * Pin every corpus read resolves through.
   */
  readonly pin: CorpusPin;

  /**
   * Fallback or environment variable that supplied the clone directory.
   */
  readonly cloneDirSource: CorpusPinSource;

  /**
   * Fallback or environment variable that supplied the commit.
   */
  readonly commitSource: CorpusPinSource;
};

/**
 * Length of one full git object name.
 */
const COMMIT_SHA_LENGTH = 40;

/**
 * Whether written text is one full lowercase hexadecimal commit name.
 * Abbreviated names are refused because the pin must stay unambiguous
 * across clones that resolve abbreviations differently.
 *
 * @param written - text as the invoking environment wrote it
 *
 * @returns Whether every position is lowercase hexadecimal at full length
 *
 * @example
 * ```ts
 * isFullCommitSha({ written: 'a'.repeat(40,), },);
 * ```
 */
function isFullCommitSha(
  { written, }: { readonly written: string; },
): boolean {
  if (written.length !== COMMIT_SHA_LENGTH)
    return false;
  // Indexed scan instead of iteration: sha positions are single code units,
  // and grapheme-aware decomposition would hide a multi-unit intruder.
  for (let position = 0; position < written.length; position += 1) {
    if (!'0123456789abcdef'.includes(written.charAt(position,),))
      return false;
  }
  return true;
}

/**
 * Reads the corpus pin, overriding either half from the environment.
 *
 * Refuses rather than falls back on invalid input, because a run against
 * the wrong corpus records fixture conclusions as pinned-corpus ones.
 *
 * @param fallback - pin used for any half the environment leaves unset
 *
 * @returns Valid pin beside a per-half source
 *
 * @throws StatedRefusalError when the clone dir is not absolute or the commit is not one full lowercase sha
 *
 * @example
 * ```ts
 * const setting = readCorpusPinSetting({ fallback: RUN_CORPUS_PIN, },);
 * ```
 */
export function readCorpusPinSetting(
  { fallback, }: { readonly fallback: CorpusPin; },
): CorpusPinSetting {
  /**
   * Clone directory as the invoking environment wrote it, empty when unset.
   */
  const writtenDir = process.env[CORPUS_CLONE_DIR_VAR] ?? '';
  if ((writtenDir !== '') && (!isAbsolute(writtenDir,))) {
    throw new StatedRefusalError({
      says: `${CORPUS_CLONE_DIR_VAR} must be an absolute path, and ${writtenDir} is not one`,
    },);
  }

  /**
   * Commit as the invoking environment wrote it, empty when unset.
   */
  const writtenCommit = process.env[CORPUS_COMMIT_VAR] ?? '';
  if ((writtenCommit !== '') && (!isFullCommitSha({ written: writtenCommit, },))) {
    throw new StatedRefusalError({
      says: `${CORPUS_COMMIT_VAR} must be one full lowercase hexadecimal commit name,`
        + ` and ${writtenCommit} is not one`,
    },);
  }

  return {
    pin: {
      ...fallback,
      ...((writtenDir === '') ? {} : { cloneDir: writtenDir, }),
      ...((writtenCommit === '') ? {} : { commitSha: writtenCommit, }),
    },
    cloneDirSource: (writtenDir === '') ? 'fallback' : CORPUS_CLONE_DIR_VAR,
    commitSource: (writtenCommit === '') ? 'fallback' : CORPUS_COMMIT_VAR,
  };
}

//endregion Corpus pin override
