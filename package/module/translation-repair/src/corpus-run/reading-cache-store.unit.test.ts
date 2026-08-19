/**
 * Tests for the store that lets a resumed run reuse what a picture was read as.
 *
 * WHY THIS FILE EXISTS. The store's guard checks the DISCRIMINANT before the
 * fields, so a reading whose kind it has not been told about is rejected and the
 * picture reads as never gathered. That is silent by construction: the run
 * simply reads the picture again, writes the same record, and rejects it again
 * next pass. `no-text` was added to `PairedReading` on 2026-08-19 and not to the
 * guard, so for the length of that afternoon every textless picture in the
 * corpus, two thirds of them, was re-read on every resume.
 *
 * THE FIRST FOUR TESTS ARE THE CURE. One per shape a reading can end in, each
 * persisted through the real store and read back through a second open, so a
 * kind added to the type without being added to the guard fails here rather
 * than costing a subprocess per picture per pass forever.
 *
 * THE REST PIN THE REFUSALS, because a guard that accepts everything resumes a
 * malformed record into a translate slice key and is worse than no guard.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  openPictureReadingCache,
  type PairedReading,
} from '../../dist/final/node/index.mjs';

/**
 * Pipeline identity every case writes under, since a store only resumes what
 * the generation now running produced.
 */
const GENERATION = 'whiskers-pipeline-1';

/**
 * Key each case persists under, shaped like the hash a real key carries.
 */
const KEY = 'a1b2c3d4e5f60789';

/**
 * Throwaway directory holding one case's store, removed on scope exit.
 *
 * @returns Disposable directory handle
 *
 * @example
 * ```ts
 * await using scratch = await scratchDirectory();
 * ```
 */
async function scratchDirectory(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   * Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-readings-',
  ),);
  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch() {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Persists one record and reads back whatever a second open resumes for it.
 *
 * THROUGH THE REAL STORE RATHER THAN THE GUARD DIRECTLY, because the guard is
 * private and because what matters is not whether it returns true: it is
 * whether a settled reading survives the write, the envelope, the file name and
 * the generation marker between one pass and the next.
 *
 * @param record - value to persist, which may be a shape the guard refuses
 *
 * @param reopenGeneration - identity the second open runs under, defaulting to
 * the one that wrote, so only the generation case has to name it
 *
 * @returns Every reading the second open resumed, which is empty when it
 * resumed none
 *
 * @example
 * ```ts
 * const resumed = await roundTrip({ record: { kind: 'no-text', characters: 0, }, },);
 * ```
 */
async function roundTrip(
  {
    record,
    reopenGeneration = GENERATION,
  }: {
    readonly record: unknown;
    readonly reopenGeneration?: string;
  },
): Promise<ReadonlyMap<string, PairedReading>> {
  await using scratch = await scratchDirectory();

  /**
   * Store as the pass that read the picture saw it.
   */
  const wrote = await openPictureReadingCache({
    dir: scratch.path,
    generation: GENERATION,
  },);
  await wrote.persist({
    key: KEY,
    serialized: JSON.stringify(record,),
  },);

  /**
   * Store as a later pass over the same entry sees it.
   */
  const reopened = await openPictureReadingCache({
    dir: scratch.path,
    generation: reopenGeneration,
  },);
  return reopened.resumed;
}

await describe({
  name: openPictureReadingCache.name,
  children: [
    it({
      name: 'RESUMES a corroborated reading with both transcriptions and its overlap, which '
        + 'is the shape every picture-bearing translate slice keys on',
      fn: async () => {
      /**
       * Two readers agreeing about a picture of a cat, as the pair stage
       * records one.
       */
      const record = {
        kind: 'corroborated',
        readings: [
          {
            modelId: 'whiskers/reader-a',
            text: '喵喵 sat on the mat',
          },
          {
            modelId: 'whiskers/reader-b',
            text: '喵喵 sits on a mat',
          },
        ],
        overlap: 0.71,
      };

      expect((await roundTrip({ record, },)).get(KEY,),).toStrictEqual(record,);
      },
    },),
    it({
      name: 'RESUMES a no-text verdict, so a picture with nothing on it is not read again. '
        + 'This is the case the guard used to reject: two thirds of the corpus ends here, '
        + 'so rejecting it re-ran the deterministic reader for 119 of 191 assets on every '
        + 'resume while reporting nothing wrong',
      fn: async () => {
      /**
       * A photograph of a cat, which the deterministic reader found nothing on.
       */
      const record = {
        kind: 'no-text',
        characters: 3,
      };

      expect((await roundTrip({ record, },)).get(KEY,),).toStrictEqual(record,);
      },
    },),
    it({
      name: 'RESUMES an unavailable reading that kept what the readers said, since the kept '
        + 'readings are what makes a disagreement diagnosable rather than only counted',
      fn: async () => {
      /**
       * A disagreement, with both readings kept.
       */
      const record = {
        kind: 'unavailable',
        reason: 'readers-disagree',
        perReader: [
          '',
          '',
        ],
        overlap: 0.11,
        readings: [
          {
            modelId: 'whiskers/reader-a',
            text: 'a tabby beside a bowl',
          },
          {
            modelId: 'whiskers/reader-b',
            text: 'handwritten notes about kibble',
          },
        ],
      };

      expect((await roundTrip({ record, },)).get(KEY,),).toStrictEqual(record,);
      },
    },),
    it({
      name: 'RESUMES an unavailable reading that kept nothing, which is what a picture '
        + 'nobody could send produces and what every record written before the readings '
        + 'were kept looks like',
      fn: async () => {
      /**
       * A picture no reader was available for, where there was no reading to
       * keep.
       */
      const record = {
        kind: 'unavailable',
        reason: 'no-reader-available',
        perReader: [ 'no vision reader in the roster', ],
      };

      expect((await roundTrip({ record, },)).get(KEY,),).toStrictEqual(record,);
      },
    },),
    it({
      name: 'REFUSES a no-text record carrying no character count, since the count is what '
        + 'separates a clean nothing from a few characters below the line',
      fn: async () => {
      expect((await roundTrip({ record: { kind: 'no-text', }, },)).has(KEY,),).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a corroborated record carrying no overlap, so a record written before '
        + 'agreement was measured cannot resume as though it had been',
      fn: async () => {
      expect(
        (await roundTrip({
          record: {
            kind: 'corroborated',
            readings: [
              {
                modelId: 'whiskers/reader-a',
                text: 'a cat',
              },
            ],
          },
        },)).has(KEY,),
      ).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a corroborated record whose reading does not name its model, because a '
        + 'transcription nobody is attributed for cannot be shown to a judge as evidence',
      fn: async () => {
      expect(
        (await roundTrip({
          record: {
            kind: 'corroborated',
            readings: [ { text: 'a cat', }, ],
            overlap: 0.9,
          },
        },)).has(KEY,),
      ).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES an unavailable record whose reason this shape does not carry. '
        + '`reader-failed` is a real way one READER fails and not a way the PAIR ends, so '
        + 'a record carrying it was written by something that confused the two',
      fn: async () => {
      expect(
        (await roundTrip({
          record: {
            kind: 'unavailable',
            reason: 'reader-failed',
            perReader: [ 'the call was lost', ],
          },
        },)).has(KEY,),
      ).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES an unavailable record whose kept readings are malformed, so the '
        + 'optional field is checked when present rather than waved through for being '
        + 'optional',
      fn: async () => {
      expect(
        (await roundTrip({
          record: {
            kind: 'unavailable',
            reason: 'readers-disagree',
            perReader: [
              '',
              '',
            ],
            readings: [ 'a tabby beside a bowl', ],
          },
        },)).has(KEY,),
      ).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a record whose kind this package does not define, which is what a file '
        + 'written by a later pipeline looks like to an earlier one',
      fn: async () => {
      expect(
        (await roundTrip({
          record: {
            kind: 'transcribed',
            text: 'a cat',
          },
        },)).has(KEY,),
      ).toBe(false,);
      },
    },),
    it({
      name: 'REFUSES a record that is not an object at all, since a truncated or '
        + 'hand-edited file can parse into a bare string',
      fn: async () => {
      expect((await roundTrip({ record: 'no-text', },)).has(KEY,),).toBe(false,);
      },
    },),
    it({
      name: 'RESUMES nothing when the pipeline generation moved, because a reading produced '
        + 'by a different pipeline may have been produced under a different instruction',
      fn: async () => {
      expect(
        (await roundTrip({
          record: {
            kind: 'no-text',
            characters: 0,
          },
          reopenGeneration: 'whiskers-pipeline-2',
        },)).has(KEY,),
      ).toBe(false,);
      },
    },),
  ],
},);
