import { contextRoot, } from '../log-context.ts';
import { readAttemptMap, } from './attempt-store.ts';
import {
  CORPUS_PAIR_TARGET,
  HARD_CAP_MINUTES,
  PLAN_PREVIEW_COUNT,
  SOFT_BUDGET_MS,
} from './corpus-pass-limits.ts';
import type { CorpusPassInput, } from './corpus-pass-input.ts';
import {
  passDoneLine,
  passLaunchLines,
  passPlanLine,
  passRequiredLines,
  passStartLine,
} from './corpus-pass-lines.ts';
import { assertPassResumable, } from './corpus-pass-guards.ts';
import { runPassQueue, } from './corpus-pass-queue.ts';
import { selectPendingEntries, } from './corpus-pass-select.ts';
import {
  entriesFinishedThisRun,
  finishedEntryIds,
} from './pass-finished.ts';
import type { EntryOutcome, } from './pass-entry-contract.ts';
import { republishRunPages, } from './pass-republish.ts';
import { countSettled, } from './pass-settled.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import {
  assertRequiredProvidersReady,
  readRequiredProviders,
} from './required-providers.ts';
import { RUN_PER_CALL_TIMEOUT_MS, } from './run-config.ts';
import { prepareRunsLayout, } from './runs-layout.ts';
import { lockRunsDir, } from './runs-lock.ts';

//region Corpus pass run
// Runs the pipeline over every complete zh/en pair at the pinned commit,
// one entry at a time: skips entries that already have an artifact, orders the
// rest to resume cached progress first, then interleave the size bands by
// within-band rank so coverage fills evenly (then fewest-attempts-first), and
// stops starting new entries at the soft budget while a per-entry hard ceiling
// aborts an entry that overruns. Each settled
// entry writes one JSON artifact and one TALLY line. The entry file
// `corpus-pass.ts` reads what only a process has (the environment, the clock,
// the git tip, the client) and hands it to this procedure, which reads none of
// it itself.

/**
 Logger the republish lines go through.
 */
const republishLog = contextRoot({ tag: 'republish', },);

/**
 Runs one accumulation pass over the corpus, writing artifacts and TALLY lines.
 Performs model calls through the client it is handed unless `--plan` is on the
 command line, which verifies setup at zero quota and returns.

 @param input - what the pass needs from the process that runs it

 @throws {@link StatedRefusalError} for any refusal the pass states in its own words, such as a
 runs directory another pass holds, a required provider that is not ready, or a flag naming
 an entry the corpus does not hold

 @example
 ```ts
 await runCorpusPassOver({ ...input, },);
 ```
 */
export async function runCorpusPassOver(input: CorpusPassInput,): Promise<void> {
  /**
   Everything the pass reads from the process.
   */
  const {
    line,
    runsDir,
    pinSetting,
    hardCapMs,
    spendCeilingUsd,
    now,
  } = input;

  /**
   Corpus clone and commit this run reads.
   */
  const { pin, } = pinSetting;

  // Taken before anything is read, and held for the whole pass. Two passes
  // sharing one directory overwrite each other attempt counts, delete each
  // other cached slices whenever their pipelines differ, and the later write of
  // any entry replaces the earlier one, all of it looking like ordinary output.
  /**
   Exclusive claim on this runs directory, released when the pass returns.
   */
  await using _lock = await lockRunsDir({ runsDir, },);

  /**
   Every path this pass reads and writes under its runs dir; the artifacts
   directory and the published tree are created now so a pass that settles
   nothing still leaves what it promised (`runs-layout.ts`).
   */
  const {
    artifactsDir,
    publishDir,
    declinedDir,
    sliceCacheDir,
    promptPayloadDir,
    attemptsPath,
  } = await prepareRunsLayout({ runsDir, },);

  /**
   Pipeline tip recorded into every artifact.
   */
  const tip = await input.readTip();

  /**
   Identity of the built pipeline this invocation is running, taken over the
   directory the runner was loaded from.

   `tip` cannot answer this and never could: it moves for a documentation
   commit that changes nothing that runs, and stays put across an uncommitted
   edit that changes everything. Every corpus-run task builds before it runs
   and runs its built file, so the files beside the entry file ARE the pipeline.
   */
  const {
    digest: pipelineDigest,
    fileCount,
  } = await digestPipeline({ dir: input.pipelineDir, },);

  await assertPassResumable({
    artifactsDir,
    pipelineDigest,
    driftAllowed: input.driftAllowed,
  },);

  /**
   Entry ids already carrying an artifact this pass, or a decline record.
   */
  const done = await finishedEntryIds({
    artifactsDir,
    declinedDir,
  },);

  /**
   Attempt counts from prior runs, or empty on the first.
   */
  const attempts = await readAttemptMap(attemptsPath,);

  /**
   Pending entries in run order, the restriction and the pairs it could not
   read already said (`corpus-pass-select.ts`).
   */
  const pending = await selectPendingEntries({
    line,
    pin,
    done,
    attempts,
    sliceCacheDir,
  },);

  console.log(passStartLine({
    facts: {
      tip,
      pipelineDigest,
      fileCount,
      pending: pending.length,
      done: done.size,
      softBudgetMs: SOFT_BUDGET_MS,
      hardCapMs,
    },
  },),);

  for (const launchLine of passLaunchLines({
    hardCapMs,
    builtInCapMinutes: HARD_CAP_MINUTES,
    perCallMs: RUN_PER_CALL_TIMEOUT_MS,
    spendCeilingUsd,
    graceNote: input.graceNote,
    writerNote: input.writerNote,
    pinSetting,
  },))
    console.log(launchLine,);

  /**
   Providers validation or performance arm explicitly requires wet.
   */
  const requiredProviders = readRequiredProviders({ line, },);
  await assertRequiredProvidersReady({
    required: requiredProviders,
    env: input.env,
    transport: input.transport,
    signal: new AbortController().signal,
  },);

  for (const requiredLine of passRequiredLines({ providers: requiredProviders, },))
    console.log(requiredLine,);

  /**
   Shared client using measured production provider concurrency.
   */
  const client = input.newClient({ promptPayloadDir, },);

  if (line.switched('plan',)) {
    console.log(passPlanLine({
      tip,
      pipelineDigest,
      pendingIds: pending.map(function toPlanId(entry,): string {
        return entry.id;
      },),
      previewCount: PLAN_PREVIEW_COUNT,
    },),);
    return;
  }

  // AFTER THE PLAN RETURNS, which promises no write, and after the build
  // guards, so a page is rewritten only under a build the operator let resume
  // here: every page the artifacts here say should ship differently, or that
  // is missing, is rewritten from its artifact before any entry runs, and a
  // page standing for a declined entry is removed (ledger A16c).
  await republishRunPages({
    runsDir,
    artifactsDir,
    declinedDir,
    publishDir,
    cloneDir: pin.cloneDir,
    l: republishLog,
  },);

  /**
   Start of the processing loop on the monotonic clock (ledger B78).
   */
  const start = now();

  /**
   Shared base signal each entry's deadline forwards from; the driver
   never aborts it, so only a per-entry timeout ever fires.
   */
  const neverAbort = new AbortController().signal;

  await runPassQueue({
    pending,
    attempts,
    attemptsPath,
    sliceCacheDir,
    pipelineDigest,
    softBudgetMs: SOFT_BUDGET_MS,
    spendCeilingUsd,
    start,
    now,
    settle: function settleOne({ entry, },): Promise<EntryOutcome> {
      return input.settle({
        client,
        entry,
        artifactsDir,
        publishDir,
        declinedDir,
        sliceCacheDir,
        tip,
        pipelineDigest,
        hardCapMs,
        baseSignal: neverAbort,
        outsideReads: input.outsideReads,
        pictureSources: input.pictureSources,
      },);
    },
  },);

  /**
   Artifacts present after this run, against the pair target.
   */
  const total = await countSettled({ artifactsDir, },);

  /**
   Entries this run finished, an artifact or a decline each.
   */
  const processed = await entriesFinishedThisRun({
    before: done,
    artifactsDir,
    declinedDir,
  },);
  console.log(passDoneLine({
    processed,
    pending: pending.length,
    total,
    target: CORPUS_PAIR_TARGET,
    elapsedMs: now() - start,
  },),);
}

//endregion Corpus pass run
