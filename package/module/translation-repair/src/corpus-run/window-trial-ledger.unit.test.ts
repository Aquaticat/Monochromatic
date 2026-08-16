/**
 * Tests for the window trial's durable ledger.
 *
 * WHAT THESE PIN is survivability of a run that spends roughly 1760 real
 * exchanges and has no cache behind it, because `#108` calls the stage directly
 * and the slice cache is read by the document driver. Everything here is about
 * what happens when the process does NOT reach the end, which is the case the
 * ledger exists for and the case that never happens in a passing test unless it
 * is written on purpose.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only. Each case
 * writes into its own throwaway directory.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  appendTrialRow,
  completedArms,
  readTrialLedger,
  trialKey,
  type WindowTrialRow,
} from '../../dist/final/node/index.mjs';

/**
 * Protocol digest the ordinary cases buy under.
 */
const PROTOCOL = 'protocol-one';

/**
 * Builds one completed arm.
 *
 * @param arm - which arm this row is
 *
 * @param chunkIndex - slice position
 *
 * @param protocol - digest it was bought under
 *
 * @returns Row shaped like one a runner appends
 *
 * @example
 * ```ts
 * const row = rowFor({ arm: 'wide', chunkIndex: 3, },);
 * ```
 */
function rowFor(
  {
    arm,
    chunkIndex,
    protocol = PROTOCOL,
  }: {
    readonly arm: string;
    readonly chunkIndex: number;
    readonly protocol?: string;
  },
): WindowTrialRow {
  return {
    protocol,
    entryId: 'Mittens',
    chunkIndex,
    arm,
    sliceClass: 'relocation',
    shipped: arm === 'wide',
    decision: 'judged',
    winnerText: 'The cat sleeps on the windowsill.\n',
    judgesHeard: 6,
    judgesSeated: 6,
    position: 0,
  };
}

/**
 * Fresh throwaway ledger path, so no case can read another's writes.
 *
 * @returns Path inside a new temporary directory
 *
 * @example
 * ```ts
 * const path = await freshLedger();
 * ```
 */
async function freshLedger(): Promise<string> {
  return join(
    await mkdtemp(join(
      tmpdir(),
      'window-trial-',
    ),),
    'nested',
    'trial.jsonl',
  );
}

await describe({
  name: 'window trial ledger',
  children: [
    it({
      name: 'reads back every arm it appended, in order, and CREATES THE DIRECTORY on the way, so '
        + 'a runner pointed at a fresh output path does not lose its first arm to a missing parent',
      fn: async () => {
        const path = await freshLedger();
        for (const arm of ['narrow-a',
          'narrow-b',
          'wide',]) {
          // SEQUENTIAL ON PURPOSE, which is what this case asserts: the ledger
          // is append-ordered and a runner appends one arm at a time as it
          // completes. Racing these would test a shape no runner produces.
          /* oxlint-disable-next-line no-await-in-loop -- append order is the assertion */
          await appendTrialRow({
            path,
            row: rowFor({
              arm,
              chunkIndex: 3,
            },),
          },);
        }

        const rows = await readTrialLedger({ path, },);
        expect(rows.length,).toBe(3,);
        expect(rows.map(function toArm(row,) {
          return row.arm;
        },),).toEqual(['narrow-a',
          'narrow-b',
          'wide',],);
      },
    },),
    it({
      name: 'reports an ABSENT ledger as empty rather than throwing, since that is the ordinary '
        + 'state before the first arm is bought and a runner should not need to pre-create it',
      fn: async () => {
        expect((await readTrialLedger({ path: await freshLedger(), },)).length,).toBe(0,);
      },
    },),
    it({
      name: 'DROPS A TORN FINAL LINE and keeps everything before it, which is the whole case this '
        + 'exists for: a process killed mid-append leaves a fragment, and losing the run rather '
        + 'than one arm would defeat the point of appending as it goes',
      fn: async () => {
        const path = await freshLedger();
        await appendTrialRow({
          path,
          row: rowFor({
            arm: 'narrow-a',
            chunkIndex: 1,
          },),
        },);
        // A kill in the middle of the second append.
        await appendTrialRow({
          path,
          row: rowFor({
            arm: 'narrow-b',
            chunkIndex: 1,
          },),
        },);
        const whole = await readTrialLedger({ path, },);
        expect(whole.length,).toBe(2,);

        /**
         * The same file with its last line truncated mid-JSON.
         */
        const torn = `${JSON.stringify(rowFor({
          arm: 'narrow-a',
          chunkIndex: 1,
        },),)}\n{"protocol":"protocol-one","entr`;
        await writeFile(
          path,
          torn,
        );

        const rows = await readTrialLedger({ path, },);
        expect(rows.length,).toBe(1,);
        expect(rows[0]?.arm,).toBe('narrow-a',);
      },
    },),
    it({
      name: 'REFUSES a torn line that is not the last, because a fragment in the middle means two '
        + 'runners interleaved rather than one being killed, and a ledger written concurrently '
        + 'cannot be trusted to say what was actually bought',
      fn: async () => {
        const path = await freshLedger();
        // This case writes the file by hand rather than appending, so the
        // parent has to exist: only `appendTrialRow` creates it.
        await mkdir(
          dirname(path,),
          { recursive: true, },
        );
        await writeFile(
          path,
          `{"protocol":"protocol-one","entr\n${JSON.stringify(rowFor({
            arm: 'wide',
            chunkIndex: 1,
          },),)}\n`,
        );

        /**
         * Read that must not succeed.
         */
        const read = readTrialLedger({ path, },);
        await expect(read,).rejects
          .toBeInstanceOf(SyntaxError,);
      },
    },),
    it({
      name: 'skips only arms bought under THIS protocol, so a trial re-run after the rosters or '
        + 'the corpus pin moved buys fresh rather than mixing two experiments into one tally',
      fn: async () => {
        const path = await freshLedger();
        await appendTrialRow({
          path,
          row: rowFor({
            arm: 'wide',
            chunkIndex: 5,
          },),
        },);
        await appendTrialRow({
          path,
          row: rowFor({
            arm: 'wide',
            chunkIndex: 6,
            protocol: 'protocol-two',
          },),
        },);

        /**
         * Arms the current run may skip.
         */
        const done = completedArms({
          rows: await readTrialLedger({ path, },),
          protocol: PROTOCOL,
        },);
        expect(done.size,).toBe(1,);

        /**
         * Key of the arm this run bought.
         */
        const ownKey = trialKey({
          row: rowFor({
            arm: 'wide',
            chunkIndex: 5,
          },),
        },);

        /**
         * Key of the arm an earlier protocol bought.
         */
        const otherKey = trialKey({
          row: rowFor({
            arm: 'wide',
            chunkIndex: 6,
            protocol: 'protocol-two',
          },),
        },);
        expect(done.has(ownKey,),).toBe(true,);
        // The other protocol's arm is not skippable, and was not deleted either.
        expect(done.has(otherKey,),).toBe(false,);
        expect((await readTrialLedger({ path, },)).length,).toBe(2,);
      },
    },),
    it({
      name: 'keys an arm by protocol, entry, slice AND arm together, so the two narrow runs of one '
        + 'slice are distinguishable: pooling them would erase the run-to-run band the whole '
        + 'comparison is read against',
      fn: async () => {
        expect(trialKey({
          row: rowFor({
            arm: 'narrow-a',
            chunkIndex: 2,
          },),
        },),).not
          .toBe(trialKey({
            row: rowFor({
              arm: 'narrow-b',
              chunkIndex: 2,
            },),
          },),);
      },
    },),
  ],
},);
