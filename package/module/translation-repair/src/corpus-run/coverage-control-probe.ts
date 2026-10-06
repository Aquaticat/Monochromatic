import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { reportingRefusals, } from './cli-refusal.ts';
import { runCoverageControl, } from './coverage-control-probe-run.ts';
import { coverageControlHolds, } from './coverage-control.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_ROSTER,
} from './run-config.ts';

//region Coverage control probe
// Asks whether the coverage roster can vote absence at all: it deletes the
// spans the roster itself anchored on and asks again. SPENDS QUOTA. Wiring
// only: the walk is `coverage-control-probe-run.ts`, the passages
// `coverage-control-probe-cases.ts`, the printed lines
// `coverage-control-probe-lines.ts`.

if (import.meta.main)
  await reportingRefusals({
    what: 'coverage-control-probe',
    argv: process.argv,
    run: function runCoverageControlProbe({ line, },) {
      return runCoverageControl({
        line,
        pin: RUN_CORPUS_PIN,
        newClient: createRunClient,
        holds: coverageControlHolds,
        roster: RUN_ROSTER,
        exchangeTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        l: tagged({ tag: 'coverage-control', },),
      },);
    },
  },);

//endregion Coverage control probe
