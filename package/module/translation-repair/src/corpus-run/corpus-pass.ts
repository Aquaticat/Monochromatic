import {
  graceOverrideNote,
  resolveStragglerGraceMs,
} from '../grace-override.ts';
import { STRAGGLER_GRACE_MS, } from '../stage-round.ts';
import { fetchTransport, } from '../synthetic-transport.ts';
import {
  readWriterGrace,
  writerGraceOverrideNote,
} from '../writer-grace-override.ts';
import { monotonicMs, } from '../monotonic-clock.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import { resolveHardCapMinutes, } from './cap-override.ts';
import {
  HARD_CAP_MINUTES,
  PASS_MS_PER_MINUTE,
} from './corpus-pass-limits.ts';
import { runCorpusPassOver, } from './corpus-pass-run.ts';
import { readDriftOptIn, } from './pass-generation-guard.ts';
import { settleEntry, } from './pass-entry.ts';
import { RUN_OUTSIDE_READS, } from './pass-outside-reads.ts';
import { RUN_PICTURE_SOURCES, } from './pass-visual-evidence.ts';
import {
  createRunClient,
  readHeadSha,
  resolveRunsDir,
  RUN_CORPUS_PIN_SETTING,
} from './run-config.ts';
import {
  resolveSpendCeilingUsd,
  SPEND_CEILING_USD,
} from './spend-ceiling.ts';

//region Corpus pass
// Runs the pipeline over every complete zh/en corpus pair at the pinned commit
// (`corpus-pass-run.ts`). This file is the wiring only: it reads what a process
// has (the environment, the clock, the git tip, the client) and hands it over.
// Run it with `mise run //package/module/translation-repair:corpus-pass` (append
// `-- --plan` for a zero-quota setup check).

/**
 Reads the launch's overrides and runs the pass over them.

 EVERY OVERRIDE IS READ HERE, INSIDE THE REFUSAL BOUNDARY, in the order a
 launch's mistakes should surface: the per-entry ceiling, the spend allowance,
 then both windows, before the lock is claimed and before anything is read, so
 an unreadable value refuses the pass before it claims a directory or spends
 anything, as a stated refusal and not as a fault at load.

 @param line - the pass's command line, read whole by `reportingRefusals`

 @example
 ```ts
 await runCorpusPass({ line, },);
 ```
 */
async function runCorpusPass({ line, }: { readonly line: CommandLineOf<'corpus-pass'>; },): Promise<void> {
  /**
   Hard ceiling in milliseconds, after any environment override.

   OVERRIDABLE so the re-attempt queue can be exercised against an entry that
   fits in one run: the queue only does anything to an entry the cap CUTS, and
   the shipped ceiling means the smallest such entry needs thirteen hours.
   `cap-override.ts` carries why an unreadable override throws.
   */
  const hardCapMs = resolveHardCapMinutes({ fallback: HARD_CAP_MINUTES, },) * PASS_MS_PER_MINUTE;

  /**
   USD this run may spend on the provider that bills in USD before it stops
   starting entries, after any environment override (`spend-ceiling.ts`).
   */
  const spendCeilingUsd = resolveSpendCeilingUsd({ fallback: SPEND_CEILING_USD, },);

  /**
   Note naming the straggler window when it is not the built-in one.
   */
  const graceNote = graceOverrideNote({
    effectiveMs: resolveStragglerGraceMs({ fallback: STRAGGLER_GRACE_MS, },),
    builtInMs: STRAGGLER_GRACE_MS,
  },);

  /**
   Note naming the writer rounds' window when a launch gave them their own.
   */
  const writerNote = writerGraceOverrideNote({ grace: readWriterGrace(), },);

  return runCorpusPassOver({
    line,
    runsDir: await resolveRunsDir(),
    graceNote,
    writerNote,
    pinSetting: RUN_CORPUS_PIN_SETTING,
    hardCapMs,
    spendCeilingUsd,
    driftAllowed: readDriftOptIn(),
    pipelineDir: import.meta.dirname,
    readTip: readHeadSha,
    env: process.env,
    transport: fetchTransport,
    newClient: createRunClient,
    settle: settleEntry,
    outsideReads: RUN_OUTSIDE_READS,
    pictureSources: RUN_PICTURE_SOURCES,
    now: monotonicMs,
  },);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'corpus-pass',
    argv: process.argv,
    run: runCorpusPass,
  },);

//endregion Corpus pass
