import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { reportingRefusals, } from './cli-refusal.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import { probeTranslate, } from './translate-probe-run.ts';

//region Translate probe
// PROTOTYPE for the translate-first re-design: asks whether a translate stage
// can render a section the corpus never translated, over the sparsest aligned
// section of the entry named by `PROBE_ENTRY`. SPENDS QUOTA. Wiring only: the walk is
// `translate-probe-run.ts`, the printed lines `translate-probe-lines.ts` and
// the choice of section `translate-probe-coverage.ts`.

/**
 Entry carrying the worst measured coverage gap.
 */
const PROBE_ENTRY = 'XingZ60';

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await reportingRefusals({
    what: 'translate-probe',
    argv: process.argv,
    env: process.env,
    run: function runTranslateProbe() {
      return probeTranslate({
        entryId: PROBE_ENTRY,
        pin: RUN_CORPUS_PIN,
        newClient: createRunClient,
        editorModelIds: RUN_MODELS.editorModelIds,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        log: tagged({ tag: 'translate-probe', },),
      },);
    },
  },);

//endregion Translate probe
