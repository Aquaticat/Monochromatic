import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import type { CorpusPin, } from '../corpus-source.ts';
import { hashContent, } from '../document-node.ts';
import type {
  FidelityReferenceSpec,
  ReviewedFidelityReference,
} from '../fidelity-reference-model.ts';
import { reviewedFidelityRequest, } from '../fidelity-reference-request.ts';
import { reviewedFidelityTrials, } from '../fidelity-reference-trials.ts';
import { runFidelityTrial, } from '../judge-fidelity.ts';
import { mapOverlapped, } from '../overlapped-map.ts';
import { readFidelityArguments, } from './judge-fidelity-args.ts';
import {
  boundFidelityMatrix,
  fidelityJudgedLine,
  fidelityKeptLine,
  fidelityKeptRun,
  fidelityPartialWarning,
  fidelityPlan,
  fidelityPreflightLine,
  fidelityRowResult,
  type FidelityRowResult,
} from './judge-fidelity-probe-plan.ts';
import type { CommandLineOf, } from './command-lines.ts';
import {
  probeRosterWith,
  readCandidateIds,
  readCandidatesAlone,
} from './probe-candidates.ts';
import { persistProbeRun, } from './probe-store.ts';
import type { RunnerClosure, } from './runner-closure.ts';

//region Judge fidelity probe run
// Source-reviewed judge calibration, once the process has handed it the
// things only a real process has: the command line, the corpus pin, the
// reference reader, the runs directory, the client builder, the clock, the
// build's identity, the logger and the standard output.
//
// An unchanged archive is not automatically correct. Review locks the
// reference and every intentional delta.

/**
 Where the run's one JSON document goes, which is standard output in a run.

 @example
 ```ts
 const out: FidelityProbeSink = process.stdout;
 ```
 */
export type FidelityProbeSink = {
  /**
   Writes the text whole.
   */
  readonly write: (text: string,) => unknown;
};

/**
 Runs only source-reviewed, hash-locked comparisons through the production
 selector. Individual ballots are retained; a singleton judge's underweight
 merged verdict is not a quality score. This never changes role admission itself.

 @param line - the probe's command line, read whole by `reportingRefusals`

 @param pin - corpus commit and clone the reviewed references are read at

 @param readReferences - reads the selected references out of the pinned clone,
 which is the one step that touches the corpus

 @param resolveRuns - names the runs directory, called only once a run has
 something to keep, so a request that is refused or a zero cap needs none

 @param newClient - builds the client the judges are asked through, called only
 after the plan is on disk so a refused request needs no key

 @param now - the clock, read for the start and for the finish

 @param pipelineDigest - digest of the built output, read when the process started

 @param runnerClosure - chunks the executing entry imports, read when the process started

 @param perCallTimeoutMs - deadline of every exchange

 @param log - progress and diagnostic logger

 @param out - where the rows document is written

 @throws {@link FidelityReferenceError} for unreviewed requests or reference drift

 @throws StatedRefusalError when the command line asks for something the probe does not run

 @example
 ```ts
 await runFidelityProbe({ line, pin, readReferences, resolveRuns, newClient, now, pipelineDigest, runnerClosure, perCallTimeoutMs, log, out, },);
 ```
 */
export async function runFidelityProbe(
  {
    line,
    pin,
    readReferences,
    resolveRuns,
    newClient,
    now,
    pipelineDigest,
    runnerClosure,
    perCallTimeoutMs,
    log,
    out,
  }: {
    readonly line: CommandLineOf<'judge-fidelity-probe'>;
    readonly pin: CorpusPin;
    readonly readReferences: (
      input: {
        readonly pin: CorpusPin;
        readonly specs: readonly FidelityReferenceSpec[];
      },
    ) => Promise<readonly ReviewedFidelityReference[]>;
    readonly resolveRuns: () => Promise<string>;
    readonly newClient: (options: { readonly promptPayloadDir: string; },) => SyntheticClient;
    readonly now: () => string;
    readonly pipelineDigest: string;
    readonly runnerClosure: RunnerClosure;
    readonly perCallTimeoutMs: number;
    readonly log: Logger;
    readonly out: FidelityProbeSink;
  },
): Promise<void> {
  /**
   Existing flags retain their names; unreviewed context cannot become new gold evidence.
   */
  const {
    onlyIds,
    cap,
    damageKinds,
    withContext,
  } = readFidelityArguments({ line, },);
  /**
   Approved candidates can be measured without acquiring a production seat.
   */
  const judgeModelIds = probeRosterWith({
    candidates: readCandidateIds({ line, },),
    alone: readCandidatesAlone({ line, },),
  },);
  /**
   Request and authorship checks precede all corpus and provider activity.
   */
  const specs = reviewedFidelityRequest({
    corpusSha: pin.commitSha,
    onlyEntryIds: onlyIds,
    damageKinds,
    judgeModelIds,
    cap,
    withContext,
  },);
  log.info(`judges: ${judgeModelIds.join(', ',)}`,);
  if (cap === 0) {
    log.info(fidelityPreflightLine({ selected: specs.length, },),);
    return;
  }
  /**
   Exact source and locally reviewed reference, never a newly discovered long archive block.
   */
  const references = await readReferences({
    pin,
    specs,
  },);
  /**
   Fixed complete matrix, bounded in attempted rows before any calls begin.
   */
  const matrix = reviewedFidelityTrials({
    references,
    damageKinds,
  },);
  /**
   Completeness describes the requested population, not automatic role eligibility.
   */
  const bound = boundFidelityMatrix({
    matrix,
    cap,
  },);
  if (!bound.complete)
    log.warn(fidelityPartialWarning({
      planned: bound.planned
        .length,
      total: matrix.length,
    },),);
  /**
   Operator-selected output root; calibration callers use a disposable directory.
   */
  const runsDir = await resolveRuns();
  await mkdir(
    runsDir,
    {
      recursive: true,
      mode: 0o700,
    },
  );
  /**
   Fresh per-invocation state cannot replay old ballots or synthetic planner responses.
   */
  const runDir = await mkdtemp(join(
    runsDir,
    'judge-fidelity-',
  ),);
  /**
   Completed payloads remain available for explicit audit after interruption.
   */
  const promptPayloadDir = join(
    runDir,
    'payloads',
  );
  /**
   Every exchange has the existing measured per-call deadline.
   */
  const controller = new AbortController();
  /**
   A durable plan cannot be mistaken for a completed result if execution is interrupted.
   */
  const plan = fidelityPlan({
    startedAt: now(),
    pipelineDigest,
    runnerClosure,
    referenceManifestDigest: hashContent({ content: JSON.stringify(specs,), },),
    specs,
    judgeModelIds,
    matrix,
    bound,
  },);
  await writeFile(
    join(
      runDir,
      'plan.json',
    ),
    JSON.stringify(
      plan,
      undefined,
      2,
    ),
    {
      mode: 0o600,
      flag: 'wx',
    },
  );
  /**
   Client construction follows all input verification and durable plan publication.
   */
  const client = newClient({ promptPayloadDir, },);
  /**
   Sequential native driver retains every outcome and its actual ballots.
   */
  const rows = await mapOverlapped({
    items: bound.planned,
    overlap: 1,
    oneItem: async function runReviewedTrial({
      item: row,
      position,
    },): Promise<FidelityRowResult> {
      /**
       Existing selector and unchanged criteria evaluate the reviewed comparison.
       */
      const outcome = await runFidelityTrial({
        client,
        trial: row.trial,
        judgeModelIds,
        signal: controller.signal,
        perCallTimeoutMs,
        l: log,
      },);
      /**
       A completed row remains readable even if a later row interrupts the invocation.
       */
      const result = fidelityRowResult({
        row,
        outcome,
      },);
      await writeFile(
        join(
          runDir,
          `row-${String(position,)}.json`,
        ),
        JSON.stringify(
          result,
          undefined,
          2,
        ),
        {
          mode: 0o600,
          flag: 'wx',
        },
      );
      return result;
    },
  },);
  log.info(fidelityJudgedLine({ count: rows.length, },),);
  /**
   Full reviewed provenance accompanies model outcomes without corpus passages in stdout metadata.
   */
  const keptAt = await persistProbeRun({
    runsDir: runDir,
    probeName: 'judge-fidelity-probe',
    run: fidelityKeptRun({
      plan,
      rows,
      finishedAt: now(),
      promptPayloadDir,
      corpusPin: pin.commitSha,
      entriesRequested: onlyIds,
      trialCap: cap,
      damageKinds,
    },),
  },);
  log.info(fidelityKeptLine({
    count: rows.length,
    keptAt,
  },),);
  // Model reasons can quote source material, so operational callers redirect this output privately.
  out.write(`${JSON.stringify(
    { rows, },
    undefined,
    2,
  )}\n`,);
}

//endregion Judge fidelity probe run
