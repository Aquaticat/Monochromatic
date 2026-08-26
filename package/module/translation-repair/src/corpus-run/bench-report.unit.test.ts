/**
 * Tests for the roster bench report writer.
 *
 * The report is the only durable record of a width sweep, and it is written
 * atomically under the runs directory; the write was unproven until this suite.
 *
 * @module
 */

import { mkdtemp, readFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { writeBenchReport, } from '../../dist/final/node/index.mjs';

await describe({
  name: writeBenchReport.name,
  children: [
    it({
      name: 'LANDS roster-bench/rows.json under the runs directory carrying the commit, the widths, the repeat '
        + 'and the roster beside the rows, readable as JSON',
      fn: async () => {
        /**
         * Disposable runs directory the writer resolves through the variable.
         */
        const runsDir = await mkdtemp(join(tmpdir(), 'bench-report-',),);
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
         * What landed, parsed.
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
