import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  type RenderingAuditReport,
  runRenderingAudit,
} from '../rendering-audit.ts';
import {
  type AuditArm,
  SOURCE_TEXT,
} from './audit-sensitivity-input.ts';
import { sightedVoices, } from './audit-sensitivity-oracle.ts';
import {
  armLines,
  keptLine,
} from './audit-sensitivity-print.ts';
import { persistProbeRun, } from './probe-store.ts';
import type { RunnerClosure, } from './runner-closure.ts';
import {
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Audit sensitivity run
// Audits each arm over the roster, prints what the instrument said and keeps
// the answers, which is the whole of the audit sensitivity runner once the
// process has handed it a way to build a client, a runs directory, the clock
// and the identity of the build.

/**
 What one arm produced, kept whole so a later reader can rescore it.

 `oracleVoices` is carried beside the report rather than left to be recomputed,
 because deciding whether a claim points at the planted defect depends on the
 oracle spans in `audit-sensitivity-input.ts`, and a fixture edit would silently
 change what an old run appears to have said.

 @example
 ```ts
 const row: AuditArmRow = { arm: 'flipped', expectation: '...', oracleVoices: 3, report, };
 ```
 */
type AuditArmRow = {
  /**
   Which arm this was.
   */
  readonly arm: string;

  /**
   What a working instrument should have concluded.
   */
  readonly expectation: string;

  /**
   Voices that pointed at the planted defect at least once, as scored against
   the oracle spans this run used.
   */
  readonly oracleVoices: number;

  /**
   Everything the audit returned, unreduced.
   */
  readonly report: RenderingAuditReport;
};

/**
 Runs one arm and reports what the instrument said about it.

 @param candidateText - rendering under audit

 @param arm - label for the arm

 @param expectation - what a working instrument should conclude, printed only;
 nothing branches on it

 @param client - client this one audit asks through

 @returns Arm's whole result, for the record rather than for a caller to
 branch on

 @example
 ```ts
 const row = await auditOne({ candidateText: FLIPPED_CANDIDATE, arm: 'flipped', expectation: 'defect', client, },);
 ```
 */
async function auditOne(
  {
    candidateText,
    arm,
    expectation,
    client,
  }: {
    readonly candidateText: string;
    readonly arm: string;
    readonly expectation: string;
    readonly client: SyntheticClient;
  },
): Promise<AuditArmRow> {
  /**
   What the roster said about this rendering.
   */
  const report = await runRenderingAudit({
    client,
    subject: {
      sourceText: SOURCE_TEXT,
      candidateText,
    },
    modelIds: RUN_MODELS.checkerModelIds,
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'audit-sensitivity', },),
  },);

  /**
   Voices that pointed at the planted defect at least once.
   */
  const sighted = sightedVoices({ rows: report.rows, },);
  for (
    const line of armLines({
      arm,
      expectation,
      report,
      oracleVoices: sighted.length,
      roster: RUN_MODELS.checkerModelIds,
    },)
  )
    console.log(line,);

  return {
    arm,
    expectation,
    oracleVoices: sighted.length,
    report,
  };
}

/**
 Runs every arm and keeps what they said.

 @param arms - arms to audit, in the order they run

 @param newClient - builds the client each arm asks through: ONE FRESH CLIENT
 PER ARM, since a client reuses the reply to a prompt it has already been asked

 @param runsDir - runs directory the answers are kept under

 @param startedAt - instant the invocation began, ISO 8601, read before any
 call so the record dates the run rather than the moment it finished

 @param now - clock read once, after the last arm, for the finish instant

 @param pipelineDigest - digest of the built output, read at the start of the
 run for the reason `audit-sensitivity.ts` gives

 @param runnerClosure - chunks the executing entry imports, read at the start

 @example
 ```ts
 await runAuditSensitivity({ arms: AUDIT_ARMS, newClient, runsDir, startedAt, now, pipelineDigest, runnerClosure, },);
 ```
 */
export async function runAuditSensitivity(
  {
    arms,
    newClient,
    runsDir,
    startedAt,
    now,
    pipelineDigest,
    runnerClosure,
  }: {
    readonly arms: readonly AuditArm[];
    readonly newClient: () => SyntheticClient;
    readonly runsDir: string;
    readonly startedAt: string;
    readonly now: () => string;
    readonly pipelineDigest: string;
    readonly runnerClosure: RunnerClosure;
  },
): Promise<void> {
  /**
   Every arm, in the order they ran.

   SEQUENTIAL rather than concurrent, because the arms share one roster and
   interleaving their progress lines would make the stream unreadable, which
   is the whole point of printing it.
   */
  const rows: AuditArmRow[] = [];
  for (const arm of arms) {
    /* oxlint-disable no-await-in-loop -- sequential by design: the arms share one roster and their progress lines must not interleave */
    rows.push(
      await auditOne({
        ...arm,
        client: newClient(),
      },),
    );
    /* oxlint-enable no-await-in-loop */
  }

  /**
   Where this run was kept, said out loud so the answers are findable.
   */
  const keptAt = await persistProbeRun({
    runsDir,
    probeName: 'audit-sensitivity',
    run: {
      startedAt,
      finishedAt: now(),
      pipelineDigest,
      runnerClosure,
      roster: RUN_MODELS.checkerModelIds,
      // NO CORPUS PIN, deliberately: this probe reads invented fixtures and a
      // corpus commit here would name text it never saw.
      subject: {
        fixtures: 'audit-sensitivity-input.ts',
        arms: rows.map(function named(row,): string {
          return row.arm;
        },),
      },
      rows,
    },
  },);
  console.log(keptLine({
    count: rows.length,
    keptAt,
  },),);
}

//endregion Audit sensitivity run
