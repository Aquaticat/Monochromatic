/**
 Tests for the roster bench report writer.
 
 The report is the only durable record of a width sweep, and it is written
 atomically under the runs directory; the write was unproven until this suite.
 
 @module
 */

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { writeBenchReport, } from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

await describe({
  name: writeBenchReport.name,
  // ONE AT A TIME: its case points the process-wide runs directory across
  // awaits (ledger B79).
  concurrency: 1,
  children: [
    it({
      name: 'LANDS roster-bench/rows.json under the runs directory carrying the commit, the widths, the repeat '
        + 'and the roster beside the rows, readable as JSON',
      fn: async () => {
        /**
         The variable as this process found it.
         */
        const found = process.env.TRANSLATION_REPAIR_RUNS_DIR;
        /**
         Disposable runs directory the writer resolves through the variable.
         */
        await using scratch = await scratchDir({ prefix: 'bench-report-', },);
        /**
         Working path of the runs directory.
         */
        const runsDir = scratch.path;
        // PUT BACK when the case ends, disposed before `scratch` removes the
        // directory: the case left the variable pointing at its directory
        // for the rest of the process, and the directory on disk (ledger
        // B79).
        using restore = {
          [Symbol.dispose]: function restoreRunsDir(): void {
            if (found === undefined)
              Reflect.deleteProperty(process.env, 'TRANSLATION_REPAIR_RUNS_DIR',);
            else
              process.env.TRANSLATION_REPAIR_RUNS_DIR = found;
          },
        };
        process.env.TRANSLATION_REPAIR_RUNS_DIR = runsDir;

        await writeBenchReport({
          rows: [],
          headSha: 'a'.repeat(40,),
          widths: [
            3,
            6,
          ],
          repeated: 3,
          roster: ['hf:cat/Cat-A',],
        },);

        /**
         What landed, parsed.
         */
        const landed: unknown = JSON.parse(
          await readFile(join(runsDir, 'roster-bench', 'rows.json',), 'utf8',),
        );

        expect(landed,).toEqual({
          headSha: 'a'.repeat(40,),
          widths: [
            3,
            6,
          ],
          repeated: 3,
          roster: ['hf:cat/Cat-A',],
          rows: [],
        },);
      },
    },),
  ],
},);
