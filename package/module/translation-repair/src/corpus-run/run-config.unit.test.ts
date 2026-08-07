/**
 * Tests for where run artifacts are written.
 *
 * `resolveRunsDir` had no test. Everything durable a run produces lands under
 * the path it returns: artifacts, logs, the attempts map, and the grading
 * sheets a human spends hours on. The sheet-path guard refuses to overwrite a
 * final sheet, but that guard only protects paths under whatever this function
 * resolved, so a wrong answer here relocates the entire protected area rather
 * than defeating one check.
 *
 * The empty-string case is the one worth having. An exported-but-empty
 * environment variable is a normal shell accident, and a bare truthiness check
 * would treat it as an override, resolving every artifact path relative to the
 * process working directory instead of the runs directory.
 *
 * The override is injected as a disposable so the variable is restored however
 * a case ends, following the pattern in
 * `package/pi-plugin/morph-compact/src/api-key.unit.test.ts`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { join, } from 'node:path';

import { resolveRunsDir, } from '../../dist/final/node/index.mjs';

/**
 * Environment variable that overrides the runs directory.
 */
const RUNS_DIR_VAR = 'TRANSLATION_REPAIR_RUNS_DIR';

/**
 * Sets the override for the life of a scope and restores it on exit.
 *
 * @param value - override to install; the empty string is meaningful here
 *
 * @returns Disposable restoring the previous value, including its absence
 *
 * @example
 * ```ts
 * using _override = withRunsDir({ value: '/tmp/whiskers', },);
 * ```
 */
function withRunsDir({ value, }: { readonly value: string; },): Disposable {
  /**
   * Value before this scope; absent means the variable was unset.
   */
  const original = process.env[RUNS_DIR_VAR];
  process.env[RUNS_DIR_VAR] = value;
  return {
    [Symbol.dispose](): void {
      if (original === undefined)
        Reflect.deleteProperty(process.env, RUNS_DIR_VAR,);
      else
        process.env[RUNS_DIR_VAR] = original;
    },
  };
}

/**
 * Removes the override for the life of a scope and restores it on exit.
 *
 * @returns Disposable restoring the previous value
 *
 * @example
 * ```ts
 * using _unset = withoutRunsDir();
 * ```
 */
function withoutRunsDir(): Disposable {
  /**
   * Value before this scope; absent means the variable was already unset.
   */
  const original = process.env[RUNS_DIR_VAR];
  Reflect.deleteProperty(process.env, RUNS_DIR_VAR,);
  return {
    [Symbol.dispose](): void {
      if (original !== undefined)
        process.env[RUNS_DIR_VAR] = original;
    },
  };
}

await describe({
  name: resolveRunsDir.name,
  children: [
    it({
      name: 'honors an explicit override exactly, so a run can be pointed at a '
        + 'throwaway directory without touching the real one',
      fn: async () => {
        using _override = withRunsDir({ value: '/tmp/whiskers-runs', },);

        expect(await resolveRunsDir(),).toBe('/tmp/whiskers-runs',);
      },
    },),

    it({
      name: 'IGNORES an empty override and falls back to the default. An '
        + 'exported-but-empty variable is an ordinary shell accident, and '
        + 'treating it as an override would resolve every artifact path '
        + 'relative to the process working directory instead of the runs '
        + 'directory, scattering a run and moving the sheet guard\'s protected '
        + 'area with it',
      fn: async () => {
        using _empty = withRunsDir({ value: '', },);

        /**
         * Resolved directory under an empty override.
         */
        const resolved = await resolveRunsDir();

        expect(resolved,).not.toBe('',);
        expect(resolved,).toContain(join(
          'node_modules',
          '.monochromatic',
          'translation-repair-runs',
        ),);
      },
    },),

    it({
      name: 'defaults under the worktree\'s gitignored node_modules when no '
        + 'override is set, so artifacts are durable across runs yet can never '
        + 'be committed: the corpus they derive from is unlicensed',
      fn: async () => {
        using _unset = withoutRunsDir();

        /**
         * Resolved directory with no override present.
         */
        const resolved = await resolveRunsDir();

        expect(resolved,).toContain(join(
          'node_modules',
          '.monochromatic',
          'translation-repair-runs',
        ),);
        expect(resolved.startsWith('/',),).toBe(true,);
      },
    },),

    it({
      name: 'returns an ABSOLUTE path in both branches, since callers join '
        + 'sheet and artifact names onto it from working directories they do '
        + 'not control',
      fn: async () => {
        {
          using _override = withRunsDir({ value: '/tmp/whiskers-runs', },);

          expect((await resolveRunsDir()).startsWith('/',),).toBe(true,);
        }

        using _unset = withoutRunsDir();

        expect((await resolveRunsDir()).startsWith('/',),).toBe(true,);
      },
    },),

    it({
      name: 'restores the environment after each case, so one case cannot '
        + 'silently decide where a later one writes',
      fn: async () => {
        /**
         * Value outside any override scope.
         */
        const outside = process.env[RUNS_DIR_VAR];

        {
          using _override = withRunsDir({ value: '/tmp/whiskers-runs', },);

          expect(process.env[RUNS_DIR_VAR],).toBe('/tmp/whiskers-runs',);
        }

        expect(process.env[RUNS_DIR_VAR],).toBe(outside,);
      },
    },),
  ],
},);
