import type { ScreenedFinding, } from '../rendering-audit-screen.ts';
import type { SettledAuditRow, } from './rendering-audit-settled-row.ts';

//region Settled audit reading
// Turns persisted audit rows into the three readings `#115` owes, and nothing
// else.
//
// WRITTEN BEFORE THE NUMBERS EXISTED, deliberately, while the full run was
// still buying its subjects. Every rule here is one that was already argued for
// somewhere else: the archive-versus-fresh split from the population doc, the
// per-voice raise rate from `#68`, the relocation pairing from `#107`. Writing
// them afterwards would let each threshold drift toward whatever the tally
// happened to show, which is the move that was refused when the voice-loss
// re-read was read on the at-risk population.
//
// PURE, and importing no client. A reading that costs quota to run is a reading
// nobody runs twice, and these rows are already on disk.

/**
 * What the two halves of the population look like, read apart.
 *
 * @example
 * ```ts
 * const split: AudienceSplit = { audits: 'archive', subjects: 16, claimed: 30, ... };
 * ```
 */
export type AudienceSplit = {
  /**
   * Which half this describes: the archive's own English, or a rendering the
   * lane produced.
   */
  readonly audits: 'archive' | 'fresh';

  /**
   * Slices audited in this half.
   */
  readonly subjects: number;

  /**
   * Claims that anchored, summed over every voice.
   */
  readonly claimed: number;

  /**
   * Slices where at least one voice claimed something.
   */
  readonly subjectsWithClaims: number;

  /**
   * Defects two auditors located identically, summed.
   */
  readonly corroborated: number;

  /**
   * Groups of voices that agreed without quoting identical spans, summed.
   */
  readonly agreed: number;

  /**
   * Pairs that nearly agreed, summed.
   */
  readonly near: number;

  /**
   * Subjects whose gather reported degradation, which is a fact about the
   * roster rather than about the text.
   */
  readonly degraded: number;
};

/**
 * How often one auditor thinks a rendering is worth a claim.
 *
 * `#68` measured exactly this over the introduced-defect probe and found the
 * three voices disagreeing by more than an order of magnitude. This is the same
 * reading on a different stage, so the two can be compared.
 *
 * @example
 * ```ts
 * const rate: VoiceRate = { modelId: 'hf:cat/Tabby-1', asked: 40, spoke: 12, claims: 19, dropped: 2, };
 * ```
 */
export type VoiceRate = {
  /**
   * Auditor.
   */
  readonly modelId: string;

  /**
   * Subjects it answered on.
   */
  readonly asked: number;

  /**
   * Subjects where it claimed at least one defect that anchored.
   */
  readonly spoke: number;

  /**
   * Claims that anchored.
   */
  readonly claims: number;

  /**
   * Claims that fell at the screen, kept because a voice whose every claim fell
   * is not a voice that found nothing.
   */
  readonly dropped: number;
};

/**
 * An omission and an addition on neighbouring slices of one document, which
 * `#107` says is one relocation rather than two defects.
 *
 * REPORTED AS A CANDIDATE rather than subtracted from the tally. Per-slice
 * judging cannot tell a relocation from a fabrication, and neither can this; it
 * can only say which pairs a human should look at before either is counted.
 *
 * @example
 * ```ts
 * const pair: AuditRelocationPair = { runSet, entryId, omissionAt: 3, additionAt: 4, };
 * ```
 */
export type AuditRelocationPair = {
  /**
   * Archive subdirectory, so two runs of one entry cannot be crossed.
   */
  readonly runSet: string;

  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Slice the passage was called missing from.
   */
  readonly omissionAt: number;

  /**
   * Slice the passage was called unsupported in.
   */
  readonly additionAt: number;

  /**
   * What the omission said was missing, so a reader can judge the pairing
   * without opening the run.
   */
  readonly omissionReason: string;

  /**
   * What the addition said was unsupported.
   */
  readonly additionReason: string;
};

/**
 * Every claim one subject's roster made that anchored.
 *
 * @param row - one audited slice
 *
 * @returns Findings across all voices, flattened
 *
 * @example
 * ```ts
 * const claims = anchoredClaims({ row, },);
 * ```
 */
function anchoredClaims(
  { row, }: { readonly row: SettledAuditRow; },
): readonly ScreenedFinding[] {
  /**
   * Every voice's screened answer.
   */
  const { rows, } = row.report;

  return rows.flatMap(function claimsOf(voice,): readonly ScreenedFinding[] {
    return voice.findings;
  },);
}

/**
 * Defects two auditors located identically on one subject.
 *
 * @param row - one audited slice
 *
 * @returns Strict-tier count
 *
 * @example
 * ```ts
 * const strict = corroboratedIn(row,);
 * ```
 */
function corroboratedIn(row: SettledAuditRow,): number {
  return row.report
    .corroborated
    .length;
}

/**
 * Groups of voices that agreed on one subject without quoting identical spans.
 *
 * @param row - one audited slice
 *
 * @returns Loose-tier count
 *
 * @example
 * ```ts
 * const loose = agreedIn(row,);
 * ```
 */
function agreedIn(row: SettledAuditRow,): number {
  return row.report
    .agreed
    .length;
}

/**
 * Pairs that nearly agreed on one subject.
 *
 * @param row - one audited slice
 *
 * @returns Near-miss count
 *
 * @example
 * ```ts
 * const nearly = nearIn(row,);
 * ```
 */
function nearIn(row: SettledAuditRow,): number {
  return row.report
    .near
    .length;
}

/**
 * Reads one half of the population.
 *
 * @param rows - every audited slice
 *
 * @param audits - which half to read
 *
 * @returns That half, summed
 *
 * @example
 * ```ts
 * const archive = splitFor({ rows, audits: 'archive', },);
 * ```
 */
export function splitFor(
  {
    rows,
    audits,
  }: {
    readonly rows: readonly SettledAuditRow[];
    readonly audits: 'archive' | 'fresh';
  },
): AudienceSplit {
  /**
   * Subjects belonging to this half.
   */
  const mine = rows.filter(function isMine(row,): boolean {
    return row.auditsArchiveText === (audits === 'archive');
  },);

  /**
   * Claims per subject, kept as an array so both the sum and the count of
   * subjects that said anything come from one pass.
   */
  const perSubject = mine.map(function claimCount(row,): number {
    /**
     * Claims this subject's roster made that anchored.
     */
    const claims = anchoredClaims({ row, },);
    return claims.length;
  },);

  /**
   * Subjects where at least one voice claimed something that anchored.
   */
  const spoken = perSubject.filter(function spoke(count,): boolean {
    return count > 0;
  },);

  /**
   * Subjects whose gather reported degradation, which is a fact about the
   * roster rather than about the text.
   */
  const degraded = mine.filter(function wasDegraded(row,): boolean {
    /**
     * Degradation findings this subject's gather reported.
     */
    const { findings, } = row.report;
    return findings.length > 0;
  },);

  return {
    audits,
    subjects: mine.length,
    claimed: perSubject.reduce(
      function add(
        sum,
        count,
      ): number {
        return sum + count;
      },
      0,
    ),
    subjectsWithClaims: spoken.length,
    corroborated: sumOver({
      rows: mine,
      of: corroboratedIn,
    },),
    agreed: sumOver({
      rows: mine,
      of: agreedIn,
    },),
    near: sumOver({
      rows: mine,
      of: nearIn,
    },),
    degraded: degraded.length,
  };
}

/**
 * Reads how often each auditor thought a rendering was worth a claim.
 *
 * ONE ROW PER MODEL THAT ANSWERED AT LEAST ONCE, rather than per configured
 * model. A model that answered nothing has no rate to report, and inventing a
 * zero for it would say it was asked and stayed quiet, which is a different
 * claim from never having been reached.
 *
 * @param rows - every audited slice
 *
 * @returns One rate per auditor, in first-seen order
 *
 * @example
 * ```ts
 * const rates = rateByVoice({ rows, },);
 * ```
 */
export function rateByVoice(
  { rows, }: { readonly rows: readonly SettledAuditRow[]; },
): readonly VoiceRate[] {
  /**
   * Running tallies, keyed by model, built in one pass so first-seen order is
   * preserved by the map itself.
   */
  const byModel = new Map<string, {
    asked: number;
    spoke: number;
    claims: number;
    dropped: number;
  }>();

  rows.forEach(function tallySubject(row,): void {
    /**
     * Every voice's screened answer on this subject.
     */
    const voices = row.report
      .rows;

    voices.forEach(function tallyVoice(voice,): void {
      /**
       * What this voice claimed here, and what fell at the screen.
       */
      const {
        modelId,
        findings,
        dropped,
      } = voice;

      /**
       * This model's running tally, started when it first answers.
       */
      const running = byModel.get(modelId,) ?? {
        asked: 0,
        spoke: 0,
        claims: 0,
        dropped: 0,
      };
      byModel.set(
        modelId,
        {
          asked: running.asked + 1,
          spoke: running.spoke + ((findings.length > 0) ? 1 : 0),
          claims: running.claims + findings.length,
          dropped: running.dropped + dropped.length,
        },
      );
    },);
  },);

  return [...byModel.entries(),].map(function asRate([modelId, tally,],): VoiceRate {
    return {
      modelId,
      asked: tally.asked,
      spoke: tally.spoke,
      claims: tally.claims,
      dropped: tally.dropped,
    };
  },);
}

/**
 * Sums a per-row number.
 *
 * @param rows - rows to sum over
 *
 * @param of - what to take from each
 *
 * @returns Total
 *
 * @example
 * ```ts
 * const total = sumOver({ rows, of: (row) => row.report.near.length, },);
 * ```
 */
function sumOver(
  {
    rows,
    of,
  }: {
    readonly rows: readonly SettledAuditRow[];
    readonly of: (row: SettledAuditRow) => number;
  },
): number {
  return rows.reduce(
    function add(
      sum,
      row,
    ): number {
      return sum + of(row,);
    },
    0,
  );
}

//endregion Settled audit reading
