import { mkdir, mkdtemp, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { hashContent, } from '../document-node.ts';
import type { FidelityReferenceError, } from '../fidelity-reference-error.ts';
import { readReviewedFidelityReferences, } from '../fidelity-reference-read.ts';
import { reviewedFidelityRequest, } from '../fidelity-reference-request.ts';
import { reviewedFidelityTrials, } from '../fidelity-reference-trials.ts';
import { runFidelityTrial, } from '../judge-fidelity.ts';
import { mapOverlapped, } from '../overlapped-map.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import {
  probeRosterWith,
  readCandidateIds,
  readCandidatesAlone,
} from './probe-candidates.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { persistProbeRun, } from './probe-store.ts';
import { readRunnerClosure, } from './runner-closure.ts';
import { readFidelityArguments, } from './judge-fidelity-args.ts';

//region Source-reviewed judge calibration
// An unchanged archive is not automatically correct. Review locks the reference and every intentional delta.

/**
 * Runs only source-reviewed, hash-locked comparisons through the production selector.
 * Individual ballots are retained; a singleton judge's underweight merged verdict
 * is not a quality score. This command never changes role admission itself.
 *
 * @throws {@link FidelityReferenceError} for unreviewed requests or reference drift
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * CLI-scoped progress and diagnostic logger.
   */
  const log = tagged({ tag: 'judge-fidelity-probe', },);
  /**
   * Existing flags retain their names; unreviewed context cannot become new gold evidence.
   */
  const {
    onlyIds,
    cap,
    damageKinds,
    withContext,
  } = readFidelityArguments();
  /**
   * Approved candidates can be measured without acquiring a production seat.
   */
  const judgeModelIds = probeRosterWith({
    candidates: readCandidateIds({ argv: process.argv, },),
    alone: readCandidatesAlone({ argv: process.argv, },),
  },);
  /**
   * Request and authorship checks precede all corpus and provider activity.
   */
  const specs = reviewedFidelityRequest({
    corpusSha: RUN_CORPUS_PIN.commitSha,
    onlyEntryIds: onlyIds,
    damageKinds,
    judgeModelIds,
    cap,
    withContext,
  },);
  log.info(`judges: ${judgeModelIds.join(', ',)}`,);
  if (cap === 0) {
    log.info(`preflight only: ${String(specs.length,)} reviewed reference specifications selected; no corpus or model calls`,);
    return;
  }
  /**
   * Exact source and locally reviewed reference, never a newly discovered long archive block.
   */
  const references = await readReviewedFidelityReferences({
    pin: RUN_CORPUS_PIN,
    specs,
  },);
  /**
   * Fixed complete matrix, bounded in attempted rows before any calls begin.
   */
  const matrix = reviewedFidelityTrials({ references, damageKinds, },);
  /**
   * A bounded prefix remains exploratory, not a complete admission comparison.
   */
  const planned = matrix.slice(0, cap,);
  /**
   * Completeness describes the requested population, not automatic role eligibility.
   */
  const completeRequestedMatrix = planned.length === matrix.length;
  if (!completeRequestedMatrix)
    log.warn(`partial reviewed matrix: ${String(planned.length,)} of ${String(matrix.length,)} rows; not complete admission evidence`,);
  /**
   * Operator-selected output root; calibration callers use a disposable directory.
   */
  const runsDir = await resolveRunsDir();
  await mkdir(runsDir, { recursive: true, mode: 0o700, },);
  /**
   * Fresh per-invocation state cannot replay old ballots or synthetic planner responses.
   */
  const runDir = await mkdtemp(join(runsDir, 'judge-fidelity-',),);
  /**
   * Completed payloads remain available for explicit audit after interruption.
   */
  const promptPayloadDir = join(runDir, 'payloads',);
  /**
   * Every exchange has the existing measured per-call deadline.
   */
  const controller = new AbortController();
  /**
   * Run identity, kept beside the fixed reference identities.
   */
  const startedAt = new Date().toISOString();
  /**
   * Executed build provenance, not the working tree's predicted behavior.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);
  /**
   * Exact entry closure used by this invocation.
   */
  const runnerClosure = await readRunnerClosure({ entryPath: process.argv[1] ?? '', },);
  /**
   * Byte identity of the exact reviewed manifest used by this invocation.
   */
  const referenceManifestDigest = hashContent({ content: JSON.stringify(specs,), },);
  /**
   * A durable plan cannot be mistaken for a completed result if execution is interrupted.
   * These are logical trial rows, not a claim that every configured judge was actually asked.
   */
  const plan = { status: 'planned', startedAt, pipelineDigest, runnerClosure,
    referenceManifestDigest, referenceManifest: specs, requestedRoster: judgeModelIds,
    completeRequestedMatrix, fullMatrixRows: matrix.length, plannedRows: planned.length,
    rows: planned.map(function identity(row, position,) {
      return { position, trialId: row.trial.trialId, direction: row.trial.direction,
        cleanFirst: row.trial.cleanFirst, damageKind: row.trial.damageKind, };
    },), };
  await writeFile(join(runDir, 'plan.json',), JSON.stringify(plan, undefined, 2,), { mode: 0o600, flag: 'wx', },);
  /**
   * Client construction follows all input verification and durable plan publication.
   */
  const client = createRunClient({ promptPayloadDir, },);
  /**
   * Sequential native driver retains every outcome and its actual ballots.
   */
  const rows = await mapOverlapped({
    items: planned,
    overlap: 1,
    oneItem: async function runReviewedTrial({ item: row, position, },) {
      /**
       * Existing selector and unchanged criteria evaluate the reviewed comparison.
       */
      const outcome = await runFidelityTrial({
        client,
        trial: row.trial,
        judgeModelIds,
        signal: controller.signal,
        perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
        l: log,
      },);
      /**
       * A completed row remains readable even if a later row interrupts the invocation.
       */
      const result = {
        referenceId: row.spec
          .id,
        entryId: row.spec
          .entryId,
        sourceRange: row.spec
          .source,
        archiveRange: row.spec
          .archive,
        referenceHash: row.spec
          .referenceHash,
        changedChars: row.changedChars,
        damageDetail: row.damageDetail,
        ...outcome,
      };
      await writeFile(join(runDir, `row-${String(position,)}.json`,), JSON.stringify(result, undefined, 2,),
        { mode: 0o600, flag: 'wx', },);
      return result;
    },
  },);
  log.info(`fidelity: ${String(rows.length,)} reviewed trial rows; use individual ballots for per-model calibration`,);
  /**
   * Full reviewed provenance accompanies model outcomes without corpus passages in stdout metadata.
   */
  const keptAt = await persistProbeRun({
    runsDir: runDir,
    probeName: 'judge-fidelity-probe',
    run: {
      startedAt,
      finishedAt: new Date().toISOString(),
      pipelineDigest,
      runnerClosure,
      roster: judgeModelIds,
      subject: {
        status: 'completed',
        completeRequestedMatrix,
        fullMatrixRows: matrix.length,
        plannedRows: planned.length,
        completedRows: rows.length,
        referenceManifestDigest,
        promptPayloadDir,
        corpusPin: RUN_CORPUS_PIN.commitSha,
        referenceManifest: specs,
        entriesRequested: onlyIds,
        trialCap: cap,
        damageKinds,
        withContext: false,
      },
      rows,
    },
  },);
  log.info(`kept ${String(rows.length,)} reviewed rows at ${keptAt}`,);
  // Model reasons can quote source material, so operational callers redirect this output privately.
  process.stdout
    .write(`${JSON.stringify(
      { rows, },
      undefined,
      2,
    )}\n`,);
}

if (import.meta.main)
  await reportingRefusals({
    what: 'judge-fidelity-probe',
    run: main,
  },);

//endregion Source-reviewed judge calibration
