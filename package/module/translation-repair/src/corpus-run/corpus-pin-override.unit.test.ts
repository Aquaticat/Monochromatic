/**
 * Tests that the corpus pin dial overrides either half and REFUSES rather
 * than falling back, because a mistyped override silently becoming the pin
 * would run the wrong corpus and record fixture conclusions as pinned ones.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  CORPUS_CLONE_DIR_VAR,
  CORPUS_COMMIT_VAR,
  readCorpusPinSetting,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Pin used when the environment says nothing.
 */
const FALLBACK_PIN = {
  cloneDir: '/cats/corpus/clone',
  commitSha: 'a'.repeat(40,),
} as const;

/**
 * Sets both dials for one case and restores whatever was there on dispose.
 *
 * @param cloneDir - clone dir value to write, absent to leave the dial unset
 *
 * @param commit - commit value to write, absent to leave the dial unset
 *
 * @returns Disposable whose disposal restores the prior environment
 *
 * @example
 * ```ts
 * using cleanup = pinEnvironment({ commit: 'b'.repeat(40,), },);
 * ```
 */
function pinEnvironment(
  {
    cloneDir,
    commit,
  }: {
    readonly cloneDir?: string;
    readonly commit?: string;
  },
): Disposable {
  /**
   * Clone dial value before this case, for restoration.
   */
  const dirBefore = process.env[CORPUS_CLONE_DIR_VAR];

  /**
   * Commit dial value before this case, for restoration.
   */
  const commitBefore = process.env[CORPUS_COMMIT_VAR];

  if (cloneDir === undefined)
    delete process.env.TRANSLATION_REPAIR_CORPUS_CLONE_DIR;
  else
    process.env[CORPUS_CLONE_DIR_VAR] = cloneDir;
  if (commit === undefined)
    delete process.env.TRANSLATION_REPAIR_CORPUS_COMMIT;
  else
    process.env[CORPUS_COMMIT_VAR] = commit;

  return {
    [Symbol.dispose]: function restorePinEnvironment() {
      if (dirBefore === undefined)
        delete process.env.TRANSLATION_REPAIR_CORPUS_CLONE_DIR;
      else
        process.env[CORPUS_CLONE_DIR_VAR] = dirBefore;
      if (commitBefore === undefined)
        delete process.env.TRANSLATION_REPAIR_CORPUS_COMMIT;
      else
        process.env[CORPUS_COMMIT_VAR] = commitBefore;
    },
  };
}

/**
 * Reads the setting under one commit dial value and returns what was thrown.
 *
 * @param commit - commit value the environment writes for this reading
 *
 * @returns Whatever the reading threw
 *
 * @example
 * ```ts
 * const thrown = commitRefusal({ commit: 'abc123', },);
 * ```
 */
function commitRefusal(
  { commit, }: { readonly commit: string; },
): unknown {
  using cleanup = pinEnvironment({ commit, },);
  return caught(function readsUnderBadCommit() {
    readCorpusPinSetting({ fallback: FALLBACK_PIN, },);
  },);
}

//endregion Fixtures

await describe({
  name: readCorpusPinSetting.name,
  children: [
    it({
      name: 'returns the fallback pin with both sources named fallback when unset',
      fn: async () => {
        using cleanup = pinEnvironment({},);
        expect(readCorpusPinSetting({ fallback: FALLBACK_PIN, },),).toEqual({
          pin: FALLBACK_PIN,
          cloneDirSource: 'fallback',
          commitSource: 'fallback',
        },);
      },
    },),

    it({
      name: 'overrides the clone dir alone and names its variable as the source',
      fn: async () => {
        using cleanup = pinEnvironment({ cloneDir: '/cats/fixture/clone', },);
        expect(readCorpusPinSetting({ fallback: FALLBACK_PIN, },),).toEqual({
          pin: {
            cloneDir: '/cats/fixture/clone',
            commitSha: FALLBACK_PIN.commitSha,
          },
          cloneDirSource: CORPUS_CLONE_DIR_VAR,
          commitSource: 'fallback',
        },);
      },
    },),

    it({
      name: 'overrides the commit alone and names its variable as the source',
      fn: async () => {
        using cleanup = pinEnvironment({ commit: 'b'.repeat(40,), },);
        expect(readCorpusPinSetting({ fallback: FALLBACK_PIN, },),).toEqual({
          pin: {
            cloneDir: FALLBACK_PIN.cloneDir,
            commitSha: 'b'.repeat(40,),
          },
          cloneDirSource: 'fallback',
          commitSource: CORPUS_COMMIT_VAR,
        },);
      },
    },),

    it({
      name: 'REFUSES a relative clone dir rather than falling back',
      fn: async () => {
        using cleanup = pinEnvironment({ cloneDir: 'cats/relative/clone', },);
        /**
         * Refusal thrown for a clone dir no read could pin down.
         */
        const thrown = caught(function readsUnderRelativeDir() {
          readCorpusPinSetting({ fallback: FALLBACK_PIN, },);
        },);
        expect(thrown instanceof StatedRefusalError,).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES an abbreviated or non-hexadecimal commit rather than falling back',
      fn: async () => {
        expect(
          commitRefusal({ commit: 'abc123', },) instanceof StatedRefusalError,
        ).toBe(true,);
        expect(
          commitRefusal({ commit: 'B'.repeat(40,), },) instanceof StatedRefusalError,
        ).toBe(true,);
        expect(
          commitRefusal({ commit: 'g'.repeat(40,), },) instanceof StatedRefusalError,
        ).toBe(true,);
      },
    },),
  ],
},);
