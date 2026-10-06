import { contextRoot, } from '../log-context.ts';
import {
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';
import { runPick, } from './window-trial-pick.ts';
import { runWindowTrial, } from './window-trial-probe-run.ts';

//region Window trial probe
// The window trial, run end to end: the wiring only. It asks models and writes
// a trial ledger, so it SPENDS QUOTA: point `TRANSLATION_REPAIR_RUNS_DIR` at a
// throwaway directory. What the walk does is in `window-trial-probe-run.ts`
// with `window-trial-probe-draw.ts`, `window-trial-probe-tally.ts`,
// `window-trial-probe-check.ts` and `window-trial-probe-lines.ts`; the ledger,
// the draw, the per-slice arms and the report each have their own file and tests.

/**
 Logger the run writes under.
 */
const l = contextRoot({ tag: 'window-trial', },);

/**
 Runs the trial over the pinned corpus, with the runs directory the
 environment names and the head this checkout stands at.

 @example
 ```ts
 await main();
 ```
 */
async function main(): Promise<void> {
  /**
   Run directory the ledger lives under.
   */
  const runsDir = await resolveRunsDir();
  return runWindowTrial({
    runsDir,
    headSha: await readHeadSha(),
    makeClient: createRunClient,
    pin: RUN_CORPUS_PIN,
    listPeople: listCorpusPeople,
    readPage: readCorpusFile,
    pickSlice: runPick,
    roster: RUN_ROSTER,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'window-trial-probe',
    argv: process.argv,
    run: main,
  },);

//endregion Window trial probe
