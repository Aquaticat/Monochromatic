import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type AuditVoiceRow,
  type RenderingAuditReport,
  runRenderingAudit,
} from '../rendering-audit.ts';
import type {
  ScreenedFinding,
  SideReading,
} from '../rendering-audit-screen.ts';
import {
  CLEAN_CANDIDATE,
  FLIPPED_CANDIDATE,
  ORACLE_CANDIDATE_SPAN,
  ORACLE_SOURCE_SPAN,
  SOURCE_TEXT,
} from './audit-sensitivity-input.ts';
import { digestPipeline, } from './pipeline-digest.ts';
import { persistProbeRun, } from './probe-store.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_PER_CALL_TIMEOUT_MS,
  RUN_MODELS,
} from './run-config.ts';

//region Audit sensitivity
// Asks whether the rendering audit can detect a planted defect at all, and
// whether it invents one where there is none.
//
// THIS IS THE INSTRUMENT'S OWN GUARD TEST. Everything else about the audit is
// checked against scripted replies, which prove the code does what it says and
// prove nothing about what real auditors do with the prompt. Two arms are the
// least that can say anything: a rendering with one dropped negator, where a
// working instrument corroborates a defect, and a faithful rendering, where a
// working instrument corroborates none.
//
// THREE MEASUREMENTS PER ARM, KEPT APART, because a single count cannot say
// which part failed:
//
// -   ORACLE HITS, per voice: did this auditor point anywhere near the planted
//     defect, whatever it called the defect and whether or not anyone agreed.
//     This is about the AUDITORS.
// -   DROPPED CLAIMS, per voice: did an auditor point at it and fail to anchor.
//     This is about the PROMPT and the SCREEN.
// -   CORROBORATED, AGREED and NEAR MISSES: did the matcher bring two voices
//     together. This is about the MATCHER.
//
// A run that scores three oracle hits, zero drops and zero agreement of either
// tier is a matcher problem. One that scores zero oracle hits is not.
//
// `agreed` IS A SUPERSET OF `corroborated`, since exactly equal focus intervals
// trivially overlap. So `corroborated=1 agreed=1` is ONE defect reported at two
// strengths, not two findings, and `corroborated=0 agreed=1` is the loose tier
// catching what the strict one missed.
//
// Inputs live in `audit-sensitivity-input.ts` and are cat-themed invention. NO
// corpus text takes part.
//
// IT KEEPS ITS ANSWERS, which it did not always. Both arms ran three times on
// 2026-08-17 and the results existed only in the terminal that ran them, so
// nothing can now re-read them, and the instrument's stability across those
// runs cannot be checked by anyone. Every invocation now lands under
// `audit-sensitivity/` in the runs directory, carrying the roster and the
// pipeline digest that produced it. Standard output is unchanged.
//
// IT ONLY RUNS WHEN INVOKED, which it also did not always. Both arms used to
// execute at module scope, so anything that imported this file bought a full
// roster of calls by importing it. `coverage-probe.ts` has carried the guard
// against exactly that from the start; this file did not, and nothing but the
// bundler's entry list stood between an ordinary import and the spend.

/**
 * Wording one side of a finding rests on, empty where it rests on none.
 *
 * @param reading - one side of a screened finding
 *
 * @returns Focus wording, or empty for a side the category does not use
 *
 * @example
 * ```ts
 * const quoted = focusText({ reading: finding.source, },);
 * ```
 */
function focusText({ reading, }: { readonly reading: SideReading; },): string {
  if (reading.kind !== 'anchored')
    return '';

  return reading.focus
    .text;
}

/**
 * Whether one quoted span and the oracle span are about the same wording.
 *
 * @param span - oracle wording
 *
 * @param quoted - wording the auditor pointed at
 *
 * @returns Whether either contains the other
 *
 * @example
 * ```ts
 * const near = meetsOracle({ span: ORACLE_SOURCE_SPAN, quoted, },);
 * ```
 */
function meetsOracle(
  {
    span,
    quoted,
  }: {
    readonly span: string;
    readonly quoted: string;
  },
): boolean {
  if (quoted === '')
    return false;

  return span.includes(quoted,) || quoted.includes(span,);
}

/**
 * Wording to print for one side, or a dash where it rests on none.
 *
 * @param reading - one side of a screened finding
 *
 * @returns Focus wording, or a dash
 *
 * @example
 * ```ts
 * const shown = shownText({ reading: defect.source, },);
 * ```
 */
function shownText({ reading, }: { readonly reading: SideReading; },): string {
  /**
   * What this side rests on.
   */
  const quoted = focusText({ reading, },);

  return (quoted === '') ? '-' : quoted;
}

/**
 * Whether one screened finding points at the planted defect.
 *
 * BY CONTAINMENT EITHER WAY, deliberately loose: this is not the matcher and
 * must not inherit its strictness. The question here is whether the auditor
 * looked in the right place at all, so a voice quoting the whole clause and one
 * quoting the negator both count.
 *
 * @param finding - claim to check
 *
 * @returns Whether either side's focus meets the oracle span
 *
 * @example
 * ```ts
 * const hit = pointsAtOracle({ finding, },);
 * ```
 */
function pointsAtOracle({ finding, }: { readonly finding: ScreenedFinding; },): boolean {
  /**
   * Whether the original side names the planted clause.
   */
  const source = meetsOracle({
    span: ORACLE_SOURCE_SPAN,
    quoted: focusText({ reading: finding.source, },),
  },);

  /**
   * Whether the candidate side names it.
   */
  const candidate = meetsOracle({
    span: ORACLE_CANDIDATE_SPAN,
    quoted: focusText({ reading: finding.candidate, },),
  },);

  return source || candidate;
}

/**
 * Prints one voice's row, so a failed arm can be attributed rather than guessed
 * at.
 *
 * @param row - one auditor's screened answer
 *
 * @param arm - which arm this row came from
 *
 * @example
 * ```ts
 * reportVoice({ row, arm: 'flipped', },);
 * ```
 */
function reportVoice(
  {
    row,
    arm,
  }: {
    readonly row: AuditVoiceRow;
    readonly arm: string;
  },
): void {
  /**
   * Claims from this voice that point at the planted defect.
   */
  const hits = row.findings
    .filter(function atOracle(finding,): boolean {
      return pointsAtOracle({ finding, },);
    },);

  /**
   * Why this voice's claims fell, when any did.
   */
  const dropped = row.dropped
    .join(', ',);

  console.log(
    `  VOICE ${arm} ${row.modelId} verdict=${row.verdict} claims=${
      String(row.findings
        .length,)
    } oracleHits=${String(hits.length,)} dropped=${
      String(row.dropped
        .length,)
    }${(dropped === '') ? '' : ` [${dropped}]`}`,
  );

  for (const finding of row.findings) {
    console.log(
      `    ${pointsAtOracle({ finding, },) ? 'ORACLE' : 'other '} ${finding.category}: ${
        shownText({ reading: finding.source, },)
      } || ${shownText({ reading: finding.candidate, },)}`,
    );
  }
}

/**
 * What one arm produced, kept whole so a later reader can rescore it.
 *
 * `oracleVoices` is carried beside the report rather than left to be recomputed,
 * because deciding whether a claim points at the planted defect depends on the
 * oracle spans in `audit-sensitivity-input.ts`, and a fixture edit would silently
 * change what an old run appears to have said.
 *
 * @example
 * ```ts
 * const row: AuditArmRow = { arm: 'flipped', expectation: '...', oracleVoices: 3, report, };
 * ```
 */
type AuditArmRow = {
  /**
   * Which arm this was.
   */
  readonly arm: string;

  /**
   * What a working instrument should have concluded.
   */
  readonly expectation: string;

  /**
   * Voices that pointed at the planted defect at least once, as scored against
   * the oracle spans this run used.
   */
  readonly oracleVoices: number;

  /**
   * Everything the audit returned, unreduced.
   */
  readonly report: RenderingAuditReport;
};

/**
 * Runs one arm and reports what the instrument said about it.
 *
 * @param candidateText - rendering under audit
 *
 * @param arm - label for the arm
 *
 * @param expectation - what a working instrument should conclude, printed only;
 * nothing branches on it
 *
 * @returns Arm's whole result, for the record rather than for a caller to
 * branch on
 *
 * @example
 * ```ts
 * const row = await auditOne({ candidateText: FLIPPED_CANDIDATE, arm: 'flipped', expectation: 'defect', },);
 * ```
 */
async function auditOne(
  {
    candidateText,
    arm,
    expectation,
  }: {
    readonly candidateText: string;
    readonly arm: string;
    readonly expectation: string;
  },
): Promise<AuditArmRow> {
  /**
   * What the roster said about this rendering.
   */
  const report = await runRenderingAudit({
    client: createRunClient(),
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
   * Voices that pointed at the planted defect at least once.
   */
  const sighted = report.rows
    .filter(function sawIt(row,): boolean {
      return row.findings
        .some(function atOracle(finding,): boolean {
          return pointsAtOracle({ finding, },);
        },);
    },);

  console.log(
    `SENSITIVITY arm=${arm} expected=${expectation} heard=${
      String(report.rows
        .length,)
    }/${
      String(RUN_MODELS.checkerModelIds
        .length,)
    } corroborated=${
      String(report.corroborated
        .length,)
    } agreed=${
      String(report.agreed
        .length,)
    } agreedVoices=${
      String(report.agreed
        .reduce(
          function widest(
            best: number,
            group,
          ): number {
            return Math.max(
              best,
              group.voices,
            );
          },
          0,
        ),)
    } near=${
      String(report.near
        .length,)
    } oracleVoices=${String(sighted.length,)} findings=${
      String(report.findings
        .length,)
    }`,
  );

  for (const row of report.rows) {
    reportVoice({
      row,
      arm,
    },);
  }

  for (const defect of report.corroborated) {
    console.log(
      `  CORROBORATED ${arm} ${defect.category} voices=${String(defect.voices,)} at ${
        shownText({ reading: defect.source, },)
      } || ${shownText({ reading: defect.candidate, },)}`,
    );
  }

  for (const group of report.agreed) {
    console.log(
      `  AGREED ${arm} ${group.category} voices=${String(group.voices,)} spans=${
        group.members
          .map(function toSpan(member,): string {
            return shownText({ reading: member.finding
              .source, },);
          },)
          .join(' / ',)
      }`,
    );
  }

  for (const near of report.near) {
    console.log(
      `  NEAR ${arm} ${near.kind}: ${
        near.left
          .finding
          .category
      } (${near.left
        .modelId}) against ${
        near.right
          .finding
          .category
      } (${near.right
        .modelId})`,
    );
  }

  for (const finding of report.findings)
    console.log(`  DEGRADED ${arm} ${finding}`,);

  return {
    arm,
    expectation,
    oracleVoices: sighted.length,
    report,
  };
}

/**
 * Runs both arms and keeps what they said.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * When this invocation began, read before any call so the record dates the
   * run rather than the moment it happened to finish.
   */
  const startedAt = new Date().toISOString();

  /**
   * Both arms, in the order they ran.
   *
   * SEQUENTIAL rather than concurrent, because the two arms share one roster
   * and interleaving their progress lines would make the stream unreadable,
   * which is the whole point of printing it.
   */
  const rows: readonly AuditArmRow[] = [
    await auditOne({
      candidateText: FLIPPED_CANDIDATE,
      arm: 'flipped',
      expectation: 'agreement at either tier on the oracle span',
    },),
    await auditOne({
      candidateText: CLEAN_CANDIDATE,
      arm: 'clean',
      expectation: 'agreement at neither tier',
    },),
  ];

  /**
   * Digest over built output, which is the only identity that moves when the
   * code moves but the commit does not.
   */
  const { digest: pipelineDigest, } = await digestPipeline({ dir: import.meta.dirname, },);

  /**
   * Where this run was kept, said out loud so the answers are findable.
   */
  const keptAt = await persistProbeRun({
    runsDir: await resolveRunsDir(),
    probeName: 'audit-sensitivity',
    run: {
      startedAt,
      finishedAt: new Date().toISOString(),
      pipelineDigest,
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
  console.log(`SENSITIVITY kept ${String(rows.length,)} arms at ${keptAt}`,);
}

// Guarded so this runs only when INVOKED, never as an import side effect: for a
// probe that spends a full roster per arm, loading the library would otherwise
// buy the calls.
if (import.meta.main)
  await main();

//endregion Audit sensitivity
