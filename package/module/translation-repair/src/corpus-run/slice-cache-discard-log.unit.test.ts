/**
 * Tests that the slice cache SAYS what it threw away, and only when it did.
 *
 * WHY THE LINE MATTERS. Slices are bought from the roster, so discarding a
 * lane's cache costs real calls to rebuy. The count is the only notice an
 * operator gets that a generation change just spent that money, and the module
 * beside it records six occasions where an unregistered prefix made the repair
 * lane delete another lane's work while reporting it as its own.
 *
 * WHAT WAS MEASURED. On 2026-08-25, inverting the guard that decides whether to
 * print at all failed no test in this package. A cache holding nothing of this
 * lane's would then announce that it discarded zero slices on every run, which
 * is the line an operator reads as "money was spent" appearing where none was.
 *
 * THE QUIET CASE IS THE ONE THAT PROVES IT. Any guard at all satisfies "a
 * discard says so"; only "a lane owning nothing here says nothing" separates a
 * count that is read from a line that is always printed.
 *
 * OWNERSHIP IS ASSERTED ALONGSIDE, since the same call removes what it names:
 * another lane's files and this lane's own marker must survive a discard, and a
 * count that was right while the removal was wrong would still be a defect.
 *
 * THE SUITE RUNS AT `concurrency: 1`, since each case diverts the one global
 * `console.log` across an await. Run concurrently they capture each other's
 * lines, and the assertions then describe whichever case happened to be inside
 * the window rather than the one under test.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  discardNamespace,
  type SliceNamespace,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Lane under test, owning every `.json` name carrying its prefix.
 */
const MITTENS: SliceNamespace = {
  prefix: 'mittens.',
  marker: 'mittens.filled-by',
};

/**
 * File another lane owns, which a discard must leave alone.
 */
const OTHER_LANE_FILE = 'whiskers.c.json';

/**
 * Diverts `console.log` into a list until disposed.
 *
 * @param lines - where diverted lines are appended
 *
 * @returns Capture holding those lines, which restores logging on disposal
 *
 * @example
 * ```ts
 * using capture = collectingInto({ lines, },);
 * ```
 */
function collectingInto(
  { lines, }: { readonly lines: string[]; },
): { readonly lines: readonly string[]; } & Disposable {
  /**
   * Real logger, put back on disposal.
   */
  const printed = console.log;
  console.log = (...parts: readonly unknown[]) => {
    lines.push(parts.map(String,)
      .join(' ',),);
  };
  return {
    lines,
    [Symbol.dispose]: () => {
      console.log = printed;
    },
  };
}

/**
 * Builds a throwaway cache directory holding the named files, each empty.
 *
 * @param names - file names to create
 *
 * @returns Directory holding them
 *
 * @example
 * ```ts
 * const dir = await cacheHolding({ names: ['mittens.a.json',], },);
 * ```
 */
async function cacheHolding(
  { names, }: { readonly names: readonly string[]; },
): Promise<string> {
  /**
   * Throwaway directory standing in for a shared slice cache.
   */
  const dir = await mkdtemp(join(
    tmpdir(),
    'translation-repair-slice-cache-',
  ),);

  await Promise.all(names.map(async function writeOne(name,): Promise<void> {
    await writeFile(
      join(
        dir,
        name,
      ),
      '{}',
      'utf8',
    );
  },),);

  return dir;
}

/**
 * Discards one lane's slices and reports what was printed and what survived.
 *
 * @param names - files the cache holds beforehand
 *
 * @param cached - pipeline stamp the discarded slices were filled by
 *
 * @returns Printed lines and the names still on disk afterwards
 *
 * @example
 * ```ts
 * const { lines, left, } = await discarding({ names, cached: 'nap-3', },);
 * ```
 */
async function discarding(
  {
    names,
    cached,
  }: {
    readonly names: readonly string[];
    readonly cached: string;
  },
): Promise<{ readonly lines: readonly string[]; readonly left: readonly string[]; }> {
  /**
   * Cache to discard from.
   */
  const dir = await cacheHolding({ names, },);

  /**
   * Lines the discard printed.
   */
  const lines: string[] = [];

  using capture = collectingInto({ lines, },);

  await discardNamespace({
    dir,
    namespace: MITTENS,
    cached,
  },);

  /**
   * Names still on disk, sorted so the assertion does not depend on readdir
   * order.
   */
  const left = (await readdir(dir,)).toSorted();

  await rm(
    dir,
    {
      recursive: true,
      force: true,
    },
  );

  return {
    lines: [...capture.lines,],
    left,
  };
}

//endregion Fixtures

await describe({
  name: discardNamespace.name,
  // SEQUENTIAL BECAUSE THE CAPTURE IS GLOBAL. `console.log` is one binding, and
  // each case here holds it across an await while the discard runs. Run
  // concurrently, the cases divert each other's lines into each other's lists,
  // which is how this file first failed: one case saw none of its own and
  // another saw two.
  concurrency: 1,
  children: [
    it({
      name: 'COUNTS what it removed and NAMES who filled it, since slices are bought from the roster '
        + 'and this line is the only notice that a generation change just spent that money again',
      fn: async () => {
        /**
         * A cache holding two of this lane's slices, one of another lane's, and
         * this lane's own marker, which is deliberately not a `.json` name.
         */
        const { lines, left, } = await discarding({
          names: [
            'mittens.a.json',
            'mittens.b.json',
            OTHER_LANE_FILE,
            MITTENS.marker,
          ],
          cached: 'nap-3',
        },);

        /**
         * Lines announcing a discard, which is the only kind this asks about.
         */
        const announced = lines.filter(function isDiscard(line,): boolean {
          return line.startsWith('SLICE discarding',);
        },);

        expect(announced.length,).toBe(1,);
        expect(announced[0],).toContain('discarding 2 cached slices',);
        expect(announced[0],).toContain('filled by nap-3',);
        expect(left,).toStrictEqual([
          MITTENS.marker,
          OTHER_LANE_FILE,
        ],);
      },
    },),

    it({
      name: 'STAYS QUIET when this lane owned nothing here, which is what keeps the line above worth '
        + 'reading rather than printed on every run',
      fn: async () => {
        /**
         * A cache holding only another lane's slice.
         */
        const { lines, left, } = await discarding({
          names: [OTHER_LANE_FILE,],
          cached: 'nap-3',
        },);

        expect(lines.filter(function isDiscard(line,): boolean {
          return line.startsWith('SLICE discarding',);
        },),).toStrictEqual([],);
        expect(left,).toStrictEqual([OTHER_LANE_FILE,],);
      },
    },),

    it({
      name: 'SAYS unstamped where no pipeline claimed the slices, so a reader is never shown an empty '
        + 'name and left to guess whether one was recorded',
      fn: async () => {
        /**
         * A cache whose lane never wrote a marker.
         */
        const { lines, } = await discarding({
          names: ['mittens.a.json',],
          cached: '',
        },);

        expect(lines.length,).toBe(1,);
        expect(lines[0],).toContain('filled by (unstamped)',);
      },
    },),
  ],
},);
