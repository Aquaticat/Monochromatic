import { repairTranslation, } from '../repair-entry.ts';
import { monotonicMs, } from '../monotonic-clock.ts';
import {
  createRunClient,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { probeCorpusEntries, } from './sentinel-probe-run.ts';

//region Sentinel probe
// Runs a set of named, known-behavior corpus entries through the pipeline and
// prints one PROBE line each (status, issue counts, findings). Wiring only:
// the walk is `sentinel-probe-run.ts` and the line is `sentinel-probe-line.ts`.
// Run it with `mise run //package/module/translation-repair:sentinel-probe -- Anilovr Aniloviraw`.

if (import.meta.main)
  await reportingRefusals({
    what: 'sentinel-probe',
    argv: process.argv,
    env: process.env,
    run: function runSentinelProbe({ line, },) {
      return probeCorpusEntries({
        line,
        pin: RUN_CORPUS_PIN,
        newClient: createRunClient,
        repair: repairTranslation,
        models: RUN_MODELS,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        now: monotonicMs,
      },);
    },
  },);

//endregion Sentinel probe
