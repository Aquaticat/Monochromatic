import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  type AuditVoiceRow,
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
import {
  createRunClient,
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
// -   CORROBORATED and NEAR MISSES: did the matcher bring two voices together.
//     This is about the MATCHER.
//
// A run that scores three oracle hits, zero drops and zero corroborated defects
// is a matcher problem. One that scores zero oracle hits is not.
//
// Inputs live in `audit-sensitivity-input.ts` and are cat-themed invention. NO
// corpus text takes part, and this writes nothing.

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
 * Runs one arm and reports what the instrument said about it.
 *
 * @param candidateText - rendering under audit
 *
 * @param arm - label for the arm
 *
 * @param expectation - what a working instrument should conclude, printed only;
 * nothing branches on it
 *
 * @example
 * ```ts
 * await auditOne({ candidateText: FLIPPED_CANDIDATE, arm: 'flipped', expectation: 'defect', },);
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
): Promise<void> {
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
}

await auditOne({
  candidateText: FLIPPED_CANDIDATE,
  arm: 'flipped',
  expectation: 'one corroborated defect at the oracle span',
},);

await auditOne({
  candidateText: CLEAN_CANDIDATE,
  arm: 'clean',
  expectation: 'no corroborated defect',
},);

//endregion Audit sensitivity
