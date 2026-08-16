/**
 * Tests for the resume guard that keeps one accumulation at one artifact shape.
 *
 * WHAT THIS EXISTS FOR is one narrow case, and the tests say which. The
 * pipeline guard already refuses an ordinary mixed-generation resume, because a
 * build writing one artifact shape cannot share a digest with a build writing
 * another. Its drift opt-in is what lets a mixed directory through, on a promise
 * that a rate over the pool stays usable once it names a required commit. That
 * promise holds across BUILDS and not across SHAPES: a version 1 artifact
 * cannot answer a two-lane question at any commit.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertResumableGeneration,
  assertResumableSchemaGeneration,
  censusBySchema,
} from '../../dist/final/node/index.mjs';

/**
 * One built pipeline, as a digest-shaped invention.
 */
const DIGEST_A = `sha256-tree-v1:${'a'.repeat(64,)}`;

/**
 * A second built pipeline, differing from {@link DIGEST_A} everywhere.
 */
const DIGEST_B = `sha256-tree-v1:${'b'.repeat(64,)}`;

/**
 * Commit every fixture artifact records, since nothing here turns on provenance.
 */
const FIXED_TIP = '1111111111111111111111111111111111111111';

/**
 * Environment variable the pipeline guard reads for an explicit drift opt-in.
 */
const ALLOW_DRIFT_VAR = 'TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT';

/**
 * What one fixture artifact records about its generation.
 */
type Fixture = {
  /**
   * Schema generation it names, absent when it carries no version field.
   */
  readonly version?: number;

  /**
   * Built pipeline it records.
   */
  readonly digest: string;
};

/**
 * Sets the drift opt-in for the life of a scope and restores it on exit.
 *
 * Restored rather than left set, since a leaked opt-in would silently disarm the
 * pipeline guard for every later case in this process.
 *
 * @param value - value to set, exact opt-in or otherwise
 *
 * @returns Disposable restoring the previous value, including its absence
 *
 * @example
 * ```ts
 * using _override = withDriftVar({ value: 'yes', },);
 * ```
 */
function withDriftVar({ value, }: { readonly value: string; },): Disposable {
  /**
   * Value before this scope; absent means the variable was unset.
   */
  const original = process.env[ALLOW_DRIFT_VAR];
  process.env[ALLOW_DRIFT_VAR] = value;
  return {
    [Symbol.dispose](): void {
      if (original === undefined)
        Reflect.deleteProperty(process.env, ALLOW_DRIFT_VAR,);
      else
        process.env[ALLOW_DRIFT_VAR] = original;
    },
  };
}

/**
 * Writes a throwaway artifacts directory.
 *
 * Written to a fresh temporary directory every time rather than to any real runs
 * directory, which holds hours of ungraded work.
 *
 * @param entries - one fixture per entry id
 *
 * @returns Path of the artifacts directory
 *
 * @example
 * ```ts
 * const dir = await writeArtifacts({ entries: { Mittens: { version: 2, digest: DIGEST_A, }, }, },);
 * ```
 */
async function writeArtifacts(
  { entries, }: { readonly entries: Readonly<Record<string, Fixture>>; },
): Promise<string> {
  /**
   * Disposable root for this case.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'pass-schema-guard-',
  ),);

  await Promise.all(
    Object.entries(entries,)
      .map(async function writeOne([
        entryId,
        {
          version,
          digest,
        },
      ],): Promise<void> {
        /**
         * Fields every fixture carries, whatever generation it claims: these are
         * what the PIPELINE guard reads, so a case can reach the schema guard.
         */
        const common = {
          id: entryId,
          tip: FIXED_TIP,
          pipelineDigest: digest,
        };

        await writeFile(
          join(
            dir,
            `${entryId}.json`,
          ),
          JSON.stringify(
            (version === undefined)
              ? common
              : {
                ...common,
                artifactSchemaVersion: version,
              },
          ),
          'utf8',
        );
      },),
  );

  return dir;
}

await describe({
  name: assertResumableSchemaGeneration.name,
  children: [
    it({
      name:
        'ACCEPTS a fresh directory and one this pass wrote, which are the two ordinary cases and the '
        + 'only ones that must stay silent',
      fn: async () => {
        await assertResumableSchemaGeneration({ artifactsDir: await writeArtifacts({ entries: {}, },), },);
        await assertResumableSchemaGeneration({
          artifactsDir: await writeArtifacts({
            entries: {
              Mittens: {
                version: 2,
                digest: DIGEST_A,
              },
              Pouncer: {
                version: 2,
                digest: DIGEST_A,
              },
            },
          },),
        },);
      },
    },),
    it({
      name:
        'REFUSES a version 1 artifact that the drift opt-in just waved past, which is the whole reason '
        + 'this guard is separate: the pipeline guard accepts that directory once an operator opts in, '
        + 'and the promise it made them, that naming a required commit keeps the pool readable, is a '
        + 'promise about builds rather than about shapes',
      fn: async () => {
        /**
         * A directory holding one artifact of each generation, both stamped with
         * pipelines this invocation is not.
         */
        const artifactsDir = await writeArtifacts({
          entries: {
            Mittens: {
              version: 1,
              digest: DIGEST_A,
            },
            Pouncer: {
              version: 2,
              digest: DIGEST_A,
            },
          },
        },);

        using _override = withDriftVar({ value: 'yes', },);

        // POSITIVE CONTROL, and the point of the case: the pipeline guard is
        // silent here. Without it this would be checking a directory two guards
        // refuse and proving nothing about which one did the work.
        await assertResumableGeneration({
          artifactsDir,
          digest: DIGEST_B,
        },);

        await expect(assertResumableSchemaGeneration({ artifactsDir, },),).rejects
          .toThrow('schema version 1: 1 settled, Mittens',);
      },
    },),
    it({
      name:
        'ACCEPTS a directory of several BUILDS all writing this generation, so the guard is not a second '
        + 'digest check: an operator who opted into build drift keeps exactly what they opted into',
      fn: async () => {
        using _override = withDriftVar({ value: 'yes', },);

        await assertResumableSchemaGeneration({
          artifactsDir: await writeArtifacts({
            entries: {
              Mittens: {
                version: 2,
                digest: DIGEST_A,
              },
              Pouncer: {
                version: 2,
                digest: DIGEST_B,
              },
            },
          },),
        },);
      },
    },),
    it({
      name:
        'REFUSES an artifact carrying NO version field, which is the generation the pipeline guard is '
        + 'least likely to catch: those files record a digest, so they are neither unplaceable nor '
        + 'legacy, and one written by this very build would pass every check but this one',
      fn: async () => {
        await expect(
          assertResumableSchemaGeneration({
            artifactsDir: await writeArtifacts({
              entries: {
                // No `version` key at all rather than one holding `undefined`,
                // which is also what such an artifact looks like on disk.
                Mittens: { digest: DIGEST_A, },
              },
            },),
          },),
        ).rejects
          .toThrow('no schema version at all',);
      },
    },),
    it({
      name:
        'REFUSES a generation written AFTER this build, rather than reading it as one it knows: a reader '
        + 'meeting a later shape knows only that it does not know the shape',
      fn: async () => {
        await expect(
          assertResumableSchemaGeneration({
            artifactsDir: await writeArtifacts({
              entries: {
                Mittens: {
                  version: 99,
                  digest: DIGEST_A,
                },
              },
            },),
          },),
        ).rejects
          .toThrow('a schema generation this build cannot read',);
      },
    },),
    it({
      name:
        'names both ways forward and neither of them is deleting anything, since the entries already '
        + 'there are sound results of the generation that wrote them and re-running them costs money '
        + 'nobody here is entitled to spend',
      fn: async () => {
        /**
         * Whatever the refusal said, or a sentinel that fails the assertions
         * below rather than passing them vacuously.
         */
        const message = await assertResumableSchemaGeneration({
          artifactsDir: await writeArtifacts({
            entries: {
              Mittens: {
                version: 1,
                digest: DIGEST_A,
              },
            },
          },),
        },)
          .then(
            function accepted(): string {
              return 'the guard accepted it';
            },
            function refused(error: unknown,): string {
              return caughtValueText(error,);
            },
          );

        expect(message,).toContain('TRANSLATION_REPAIR_RUNS_DIR',);
        expect(message,).toContain('Restore the code those entries were settled under',);
        expect(message,).toContain('Deleting them is NOT the remedy',);
        expect(message,).toContain('this pass writes schema version 2',);
      },
    },),
  ],
},);

await describe({
  name: censusBySchema.name,
  children: [
    it({
      name:
        'groups every settled entry by the generation its artifact names, in directory order, so a '
        + 'refusal over a corpus-sized directory names counts rather than a wall of ids',
      fn: async () => {
        /**
         * A directory holding three generations at once.
         */
        const census = await censusBySchema({
          artifactsDir: await writeArtifacts({
            entries: {
              Pouncer: {
                version: 1,
                digest: DIGEST_A,
              },
              Mittens: {
                version: 1,
                digest: DIGEST_A,
              },
              Tabby: {
                version: 2,
                digest: DIGEST_B,
              },
              Whiskers: { digest: DIGEST_B, },
            },
          },),
        },);

        expect(census.get('schema version 1',),).toEqual([
          'Mittens',
          'Pouncer',
        ],);
        expect(census.get('schema version 2',),).toEqual(['Tabby',],);
        expect(census.get('no schema version at all',),).toEqual(['Whiskers',],);
      },
    },),
  ],
},);
