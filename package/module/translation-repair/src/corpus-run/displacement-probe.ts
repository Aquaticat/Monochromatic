import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { readCorpusFile, } from '../corpus-source.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { probeDisplacement, } from './displacement-probe-run.ts';
import {
  resolveRunsDir,
  RUN_CORPUS_PIN,
} from './run-config.ts';
import {
  carveSettled,
  listSettledEntryIds,
} from './settled-carve.ts';

//region Displacement probe
// Walks the settled entries and reports where the corpus carries a passage the
// translator moved across a section boundary, and what else the same size
// reading turns up. Costs nothing and decides nothing. Wiring only: the walk is
// `displacement-probe-run.ts`, the readings `displacement-probe-row.ts` and
// `displacement-probe-totals.ts`, the lines `displacement-probe-report.ts`.

/**
 Writes the rows document to the process's standard output.

 @param text - rows document, with its closing newline

 @example
 ```ts
 writeOut('{}\n',);
 ```
 */
function writeOut(text: string,): void {
  process.stdout
    .write(text,);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'displacement-probe',
    argv: process.argv,
    run: async function runDisplacementProbe(): Promise<void> {
      /**
       Runs directory whose settled artifacts name the population.
       */
      const runsDir = await resolveRunsDir();
      return probeDisplacement({
        log: tagged({ tag: 'displacement-probe', },),
        listEntryIds: function listEntries() {
          return listSettledEntryIds({ runsDir, },);
        },
        carve: function carveEntry(entryId,) {
          return carveSettled({
            entryId,
            runsDir,
            cloneDir: RUN_CORPUS_PIN.cloneDir,
            readFile: readCorpusFile,
          },);
        },
        writeOut,
      },);
    },
  },);

//endregion Displacement probe
