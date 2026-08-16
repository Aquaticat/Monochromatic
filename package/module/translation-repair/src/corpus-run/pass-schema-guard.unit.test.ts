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
 * AND ONE CASE THE FIRST VERSION MISSED, which an independent review found: the
 * guard read the version LABEL and never the body, so a version 1 artifact
 * relabelled as version 2 passed it.
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
 * Preparation identity every fixture claims, syntactically valid and describing
 * nothing, which is all a standalone reader checks.
 */
const PREPARATION_IDENTITY = `sha256-preparation-v1:${'a7'.repeat(32,)}`;

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

  /**
   * Whether the body must satisfy the generation it names, rather than merely
   * carrying the label.
   */
  readonly wellFormed?: boolean;
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
 * A complete version 2 artifact describing a document with NO slices.
 *
 * EMPTY ON PURPOSE. Every per-slice relation the reader runs is vacuous here,
 * so this is the smallest body that genuinely satisfies the generation rather
 * than merely claiming it, which is what these cases need to tell a real
 * artifact from a relabelled one.
 *
 * @param entryId - entry it settles
 *
 * @param digest - built pipeline it records
 *
 * @returns Artifact as JSON
 *
 * @example
 * ```ts
 * const artifact = emptyVersionTwoArtifact({ entryId: 'Mittens', digest: DIGEST_A, },);
 * ```
 */
function emptyVersionTwoArtifact(
  {
    entryId,
    digest,
  }: {
    readonly entryId: string;
    readonly digest: string;
  },
): Record<string, unknown> {
  return {
    artifactSchemaVersion: 2,
    id: entryId,
    tip: FIXED_TIP,
    pipelineDigest: digest,
    corpusSha: 'b'.repeat(40,),
    callConfig: { perCallTimeoutMs: 600_000, },
    durationMs: 40,
    timestamp: '2026-08-17T04:00:00.000Z',
    preparation: {
      identity: PREPARATION_IDENTITY,
      sliceCount: 0,
      sourceChars: 0,
      targetChars: 0,
      sourceBytes: 0,
      alignmentPairCount: 0,
      alignmentFindings: [],
    },
    lanes: {
      repair: {
        result: {
          status: 'unchanged',
          sliceCount: 0,
          shippedChunkIndices: [],
          withdrawnChunkIndices: [],
          findings: [],
          sliceTexts: [],
        },
        delivery: [],
      },
      translate: {
        result: {
          status: 'complete',
          sliceCount: 0,
          changedSliceCount: 0,
          refusedSliceCount: 0,
          withdrawnSliceCount: 0,
          shippedChunkIndices: [],
          withdrawnChunkIndices: [],
          sliceTexts: [],
        },
        delivery: [],
      },
    },
    comparison: [],
    laneSelection: { kind: 'pending-human-decision', },
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
          wellFormed = false,
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

        /**
         * Body this fixture writes: a real version 2 artifact when the case
         * needs one, and otherwise the label alone over a body that is not one.
         */
        const body = wellFormed
          ? emptyVersionTwoArtifact({
            entryId,
            digest,
          },)
          : {
            ...common,
            ...((version === undefined) ? {} : { artifactSchemaVersion: version, }),
          };

        await writeFile(
          join(
            dir,
            `${entryId}.json`,
          ),
          JSON.stringify(body,),
          'utf8',
        );
      },),
  );

  return dir;
}

/**
 * Runs the guard and reports what it said, or that it accepted.
 *
 * @param artifactsDir - directory to check
 *
 * @returns Refusal text, or a sentinel no assertion here matches
 *
 * @example
 * ```ts
 * const said = await refusalOf({ artifactsDir, },);
 * ```
 */
async function refusalOf(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<string> {
  try {
    await assertResumableSchemaGeneration({ artifactsDir, },);
    return 'the guard accepted it';
  } catch (error) {
    return caughtValueText(error,);
  }
}

await describe({
  name: assertResumableSchemaGeneration.name,
  children: [
    it({
      name:
        'ACCEPTS a fresh directory and one holding real artifacts of the generation this pass writes, '
        + 'which are the two ordinary cases and the only ones that must stay silent',
      fn: async () => {
        await assertResumableSchemaGeneration({ artifactsDir: await writeArtifacts({ entries: {}, },), },);
        await assertResumableSchemaGeneration({
          artifactsDir: await writeArtifacts({
            entries: {
              Mittens: {
                version: 2,
                digest: DIGEST_A,
                wellFormed: true,
              },
              Pouncer: {
                version: 2,
                digest: DIGEST_A,
                wellFormed: true,
              },
            },
          },),
        },);
      },
    },),
    it({
      name:
        'REFUSES a body that DECLARES this generation and is not one, which the first version of this '
        + 'guard accepted: it read the label and never the body, so a version 1 artifact relabelled as '
        + 'version 2 was counted as settled, never re-run, and left for whichever reader asked it a '
        + 'two-lane question first',
      fn: async () => {
        /**
         * A version 1 body carrying a version 2 label and nothing else of that
         * generation.
         */
        const artifactsDir = await writeArtifacts({
          entries: {
            Mittens: {
              version: 2,
              digest: DIGEST_A,
            },
          },
        },);

        /**
         * What the guard said about it.
         */
        const said = await refusalOf({ artifactsDir, },);
        expect(said,).toContain('Mittens declares schema version 2',);
        expect(said,).toContain('and is not one',);
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
              wellFormed: true,
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
        expect(await refusalOf({ artifactsDir, },),).toContain('schema version 1: 1 settled, Mittens',);
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
                wellFormed: true,
              },
              Pouncer: {
                version: 2,
                digest: DIGEST_B,
                wellFormed: true,
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
        expect(
          await refusalOf({
            artifactsDir: await writeArtifacts({
              entries: {
                // No `version` key at all rather than one holding `undefined`,
                // which is also what such an artifact looks like on disk.
                Mittens: { digest: DIGEST_A, },
              },
            },),
          },),
        ).toContain('no schema version at all',);
      },
    },),
    it({
      name:
        'REFUSES a generation written AFTER this build, rather than reading it as one it knows: a reader '
        + 'meeting a later shape knows only that it does not know the shape',
      fn: async () => {
        expect(
          await refusalOf({
            artifactsDir: await writeArtifacts({
              entries: {
                Mittens: {
                  version: 99,
                  digest: DIGEST_A,
                },
              },
            },),
          },),
        ).toContain('a schema generation this build cannot read',);
      },
    },),
    it({
      name:
        'names every way forward including moving the incompatible artifacts aside, and names deleting '
        + 'them as the one thing to avoid rather than as no remedy at all: a moved file is re-run and a '
        + 'deleted one is re-run too, and only one of the two keeps the result it already was',
      fn: async () => {
        /**
         * Whatever the refusal said.
         */
        const said = await refusalOf({
          artifactsDir: await writeArtifacts({
            entries: {
              Mittens: {
                version: 1,
                digest: DIGEST_A,
              },
            },
          },),
        },);
        expect(said,).toContain('TRANSLATION_REPAIR_RUNS_DIR',);
        expect(said,).toContain('Restore the code those entries were settled under',);
        expect(said,).toContain('Move the incompatible artifacts to an archive directory',);
        expect(said,).toContain('Deleting them outright is the one thing to avoid',);
        expect(said,).toContain('this pass writes schema version 2',);
      },
    },),
  ],
},);

await describe({
  name: censusBySchema.name,
  children: [
    it({
      name:
        'classifies every settled entry rather than grouping them by the sentence a refusal would '
        + 'print, so a file that is not an artifact at all stays distinguishable from a sound artifact '
        + 'of a generation this build cannot read, and each can be offered the remedy that fits',
      fn: async () => {
        /**
         * A directory holding four different answers at once.
         */
        const artifactsDir = await writeArtifacts({
          entries: {
            Pouncer: {
              version: 1,
              digest: DIGEST_A,
            },
            Mittens: {
              version: 2,
              digest: DIGEST_B,
              wellFormed: true,
            },
            Whiskers: { digest: DIGEST_B, },
            Tabby: {
              version: 99,
              digest: DIGEST_A,
            },
          },
        },);

        // A file that is not JSON at all, written directly since no fixture
        // shape produces one.
        await writeFile(
          join(
            artifactsDir,
            'Smudge.json',
          ),
          'not json {',
          'utf8',
        );

        /**
         * Every entry, in directory order.
         */
        const rows = await censusBySchema({ artifactsDir, },);
        expect(
          rows.map(function toPair({ entryId, classification, },): readonly [
            string,
            string,
          ] {
            return [
              entryId,
              classification.kind,
            ];
          },),
        ).toEqual([
          [
            'Mittens',
            'declared',
          ],
          [
            'Pouncer',
            'declared',
          ],
          [
            'Smudge',
            'malformed',
          ],
          [
            'Tabby',
            'unreadable-version',
          ],
          [
            'Whiskers',
            'unversioned',
          ],
        ],);
      },
    },),
  ],
},);
