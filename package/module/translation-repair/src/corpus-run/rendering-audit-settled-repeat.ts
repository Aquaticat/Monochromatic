import {
  sameAuditedText,
  textIdentityOf,
} from './rendering-audit-settled-digest.ts';
import { anchoredClaims, } from './rendering-audit-settled-read.ts';
import {
  type SettledAuditRow,
  SLOT_SEPARATOR,
} from './rendering-audit-settled-row.ts';

//region Settled audit repeat readings
// Pairs audits of ONE text so the instrument's own spread can be read off its
// own output.
//
// WHY THIS EXISTS. The headline of `#115` is a comparison: the archive's own
// English against a fresh rendering. A comparison is unreadable below the band
// the instrument moves through on unchanged input, and that band has already
// been seen to be wide. One subject, `grace-remeasure/Aniloviraw#0`, read
// `claimed=1 corroborated=0` on a capped buy and `claimed=5 corroborated=1
// agreed=1` on the full run: identical text, identical roster, minutes apart.
// Reported without a band, any difference between the two halves is a number a
// reader will take for a finding.
//
// TWO PAIRINGS, both mechanical joins with nothing tunable in them:
//
//   WITHIN one run, two artifacts of one entry can carry the same characters at
//   the same slice. Those are one text audited twice inside a single run.
//
//   ACROSS two runs, every subject appears in both. That is the band directly,
//   at the full width of the population.
//
// BOTH REQUIRE RECORDED TEXT IDENTITY. Pairing by slot would assume that one
// entry settled twice produced the same text at the same index, which is the
// thing being checked rather than something to assume.

/**
 * What one side of a repeat said.
 *
 * @example
 * ```ts
 * const side: AuditRepeatSide = { runSet, claimed: 5, corroborated: 1, agreed: 1, near: 0, };
 * ```
 */
export type AuditRepeatSide = {
  /**
   * Archive subdirectory this side came from, which for an across-run pair is
   * the same on both sides.
   */
  readonly runSet: string;

  /**
   * Claims that anchored, summed over every voice.
   */
  readonly claimed: number;

  /**
   * Defects two auditors located identically.
   */
  readonly corroborated: number;

  /**
   * Groups that agreed without quoting identical spans.
   */
  readonly agreed: number;

  /**
   * Pairs that nearly agreed.
   */
  readonly near: number;
};

/**
 * One text audited twice, with what each audit said.
 *
 * @example
 * ```ts
 * const pair: AuditRepeatPair = { entryId, chunkIndex: 0, left, right, };
 * ```
 */
export type AuditRepeatPair = {
  /**
   * Corpus entry.
   */
  readonly entryId: string;

  /**
   * Global slice index.
   */
  readonly chunkIndex: number;

  /**
   * Which half of the population this pair sits in, so a band can be read for
   * archive text and fresh text apart rather than blurred across both.
   */
  readonly auditsArchiveText: boolean;

  /**
   * First audit of this text.
   */
  readonly left: AuditRepeatSide;

  /**
   * Second audit of the same text.
   */
  readonly right: AuditRepeatSide;
};

/**
 * Names the subject one row describes, run set included.
 *
 * ONE BUILDER, used by both the map and the lookup. Spelling the key twice is
 * how two builders come to disagree, and a disagreement here reports that two
 * runs share no subjects at all, which reads exactly like an honest null.
 *
 * @param row - one audited slice
 *
 * @returns Key that is equal for one subject across two runs
 *
 * @example
 * ```ts
 * const key = subjectKey({ row, },);
 * ```
 */
function subjectKey(
  { row, }: { readonly row: SettledAuditRow; },
): string {
  return [
    row.runSet,
    row.entryId,
    String(row.chunkIndex,),
  ].join(SLOT_SEPARATOR,);
}

/**
 * Whether a row says what its audit was shown.
 *
 * @param row - one audited slice
 *
 * @returns Whether the run recorded a text identity for it
 *
 * @example
 * ```ts
 * const vouched = recorded({ row, },);
 * ```
 */
function recorded(
  { row, }: { readonly row: SettledAuditRow; },
): boolean {
  /**
   * What the run wrote down about this subject's texts.
   */
  const identity = textIdentityOf({ row, },);
  return identity.kind === 'digested';
}

/**
 * Reads one row down to what a repeat comparison needs.
 *
 * @param row - one audited slice
 *
 * @returns That side of a pair
 *
 * @example
 * ```ts
 * const side = repeatSideOf({ row, },);
 * ```
 */
function repeatSideOf(
  { row, }: { readonly row: SettledAuditRow; },
): AuditRepeatSide {
  /**
   * Tiers this audit reached.
   */
  const {
    corroborated,
    agreed,
    near,
  } = row.report;

  /**
   * Every claim this subject's roster made that anchored.
   */
  const claims = anchoredClaims({ row, },);

  return {
    runSet: row.runSet,
    claimed: claims.length,
    corroborated: corroborated.length,
    agreed: agreed.length,
    near: near.length,
  };
}

/**
 * Finds texts one run audited more than once.
 *
 * Two artifacts of one entry sit in different run sets, so a repeat here is a
 * pair of rows sharing an entry and a slice index across run sets whose
 * recorded text identity also matches.
 *
 * @param rows - every audited slice of one run
 *
 * @returns One pair per repeated text, in first-seen order
 *
 * @example
 * ```ts
 * const repeats = auditRepeatsWithin({ rows, },);
 * ```
 */
export function auditRepeatsWithin(
  { rows, }: { readonly rows: readonly SettledAuditRow[]; },
): readonly AuditRepeatPair[] {
  /**
   * Rows sharing an entry and a slice, which is the only place a repeat can be.
   */
  const bySlot = new Map<string, SettledAuditRow[]>();
  rows.forEach(function place(row,): void {
    /**
     * Slot this row occupies, which deliberately omits the run set: the whole
     * point is to bring two run sets together.
     */
    const slot = [
      row.entryId,
      String(row.chunkIndex,),
    ].join(SLOT_SEPARATOR,);
    bySlot.set(
      slot,
      [
        ...(bySlot.get(slot,) ?? []),
        row,
      ],
    );
  },);

  /**
   * Slots, each holding every row that landed in it.
   */
  const slots = [...bySlot.values(),];

  return slots.flatMap(function pairsIn(sharing,): readonly AuditRepeatPair[] {
    return sharing.flatMap(function against(
      left,
      at,
    ): readonly AuditRepeatPair[] {
      return sharing
        .slice(at + 1,)
        .filter(function isRepeat(right,): boolean {
          return (left.runSet !== right.runSet) && sameAuditedText({
            left,
            right,
          },);
        },)
        .map(function asPair(right,): AuditRepeatPair {
          return {
            entryId: left.entryId,
            chunkIndex: left.chunkIndex,
            auditsArchiveText: left.auditsArchiveText,
            left: repeatSideOf({ row: left, },),
            right: repeatSideOf({ row: right, },),
          };
        },);
    },);
  },);
}

/**
 * Pairs two runs of the same population, subject against subject.
 *
 * KEYED BY RUN SET AS WELL as entry and slice, so two artifacts of one entry
 * are never crossed with each other; that pairing is `auditRepeatsWithin`'s job
 * and means something different.
 *
 * THREE OUTCOMES, NOT TWO, and the third is the one that matters most in
 * practice. A slot both runs recorded and whose digests DISAGREE means the
 * archive changed underneath them, which invalidates that subject as a band
 * measurement and is worth saying. A slot either run left UNRECORDED means
 * nobody wrote down what was shown, which is a fact about the run and says
 * nothing whatever about the archive.
 *
 * Collapsing those two into one list would report an older run, from before the
 * identity field existed, as a population whose every subject changed text
 * between the runs. That is a confident statement about the corpus assembled
 * out of the absence of evidence about the probe.
 *
 * @param first - rows of the earlier run
 *
 * @param second - rows of the later one
 *
 * @returns Pairs, slots whose text moved, and slots nobody can vouch for
 *
 * @example
 * ```ts
 * const { paired, textMoved, unverifiable, } = auditRepeatsAcross({ first, second, },);
 * ```
 */
export function auditRepeatsAcross(
  {
    first,
    second,
  }: {
    readonly first: readonly SettledAuditRow[];
    readonly second: readonly SettledAuditRow[];
  },
): {
  readonly paired: readonly AuditRepeatPair[];
  readonly textMoved: readonly string[];
  readonly unverifiable: readonly string[];
} {
  /**
   * Later run, reachable by slot.
   */
  const laterBySlot = new Map(second.map(function bySlot(row,): [
    string,
    SettledAuditRow,
  ] {
    return [
      subjectKey({ row, },),
      row,
    ];
  },),);

  /**
   * Slots both runs hold, split by whether the text also agreed.
   */
  const matched = first.flatMap(function join(row,): readonly {
    readonly left: SettledAuditRow;
    readonly right: SettledAuditRow;
  }[] {
    /**
     * Same slot in the later run.
     */
    const right = laterBySlot.get(subjectKey({ row, },),);
    if (right === undefined)
      return [];
    return [{
      left: row,
      right,
    },];
  },);

  /**
   * Slots where BOTH runs said what they saw, so the digests decide.
   */
  const witnessed = matched.filter(function bothRecorded({
    left,
    right,
  },): boolean {
    return recorded({ row: left, },) && recorded({ row: right, },);
  },);

  return {
    paired: witnessed
      .filter(function textAgrees({
        left,
        right,
      },): boolean {
        return sameAuditedText({
          left,
          right,
        },);
      },)
      .map(function asPair({
        left,
        right,
      },): AuditRepeatPair {
        return {
          entryId: left.entryId,
          chunkIndex: left.chunkIndex,
          auditsArchiveText: left.auditsArchiveText,
          left: repeatSideOf({ row: left, },),
          right: repeatSideOf({ row: right, },),
        };
      },),
    textMoved: witnessed
      .filter(function textDisagrees({
        left,
        right,
      },): boolean {
        return !sameAuditedText({
          left,
          right,
        },);
      },)
      .map(nameOf,),
    unverifiable: matched
      .filter(function eitherUnrecorded({
        left,
        right,
      },): boolean {
        return !(recorded({ row: left, },) && recorded({ row: right, },));
      },)
      .map(nameOf,),
  };
}

/**
 * Names one matched slot for a reader.
 *
 * @param left - row from the earlier run, which carries the naming parts
 *
 * @returns Slot as a reader would write it
 *
 * @example
 * ```ts
 * const name = nameOf({ left, },);
 * ```
 */
function nameOf(
  { left, }: { readonly left: SettledAuditRow; },
): string {
  return `${left.runSet}/${left.entryId}#${String(left.chunkIndex,)}`;
}

//endregion Settled audit repeat readings
