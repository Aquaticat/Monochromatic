import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import {
  NARRATIVE_DETAIL_IS_NOT_APPARATUS,
  TRANSLATOR_NOTE_KIND,
} from './page-apparatus-clause.ts';

//region Archive dispute
// A slice whose archive rendering the repair lane's adjudicators found to
// ADD something the original never states (class one hundred seven, owner
// answer 2026-09-24: "Not eligible; fall back to the repair text"). On
// CuspariaKLSY10 slice 3 the archive named a suicide method the original
// does not, four `accuracy/addition` claims were accepted, the repair lane
// removed the detail, the translate slate backed nobody, and the archive
// stood because an eligible standing keeps its single round. Here such a
// slice is a dispute: the repair lane's text stands in for the archive as
// the translate lane's incumbent and as the consolidation's standing where
// the contest chose neither lane, so the disputed rendering is neither a
// candidate nor a fallback anywhere downstream.
//
// CLASS ONE HUNDRED SEVENTY-SIX (TianqiChen66610 slice 13, owner answer
// 2026-09-26: "Major+ accuracy"). The adjudicators accepted major
// mistranslation claims against the archive's gloss of the character a
// performer was remembered as, the gate tied 2 to 2, and the archive shipped
// because only additions disputed it. Any accepted accuracy claim at major
// severity or worse now disputes the archive as well; additions keep
// disputing at any severity.

/**
 Claim category that disputes the archive rendering at any severity.
 */
const ADDITION_CATEGORY = 'accuracy/addition';

/**
 Category family whose other claims dispute the archive at a disputing
 severity.
 */
const ACCURACY_FAMILY = 'accuracy/';

/**
 Severities at which a non-addition accuracy claim disputes the archive.
 */
const DISPUTING_SEVERITIES: ReadonlySet<string> = new Set([
  'major',
  'critical',
],);

/**
 How the findings and the sheets name what disputes the archive.
 */
const DISPUTING_RULE = 'accuracy/addition at any severity, any other accuracy claim at major or worse';

/**
 One disputed slice and the text standing in for its archive rendering.

 @example
 ```ts
 const dispute: ArchiveDispute = { sliceIndex: 3, standIn: repairedText, acceptedClaims: [], };
 ```
 */
export type ArchiveDispute = {
  /**
   Slice whose archive rendering is disputed.
   */
  readonly sliceIndex: number;

  /**
   Repair lane's text for the slice, which stands in for the archive.
   */
  readonly standIn: string;

  /**
   Accepted disputing claims, each as "category severity: summary", for the
   sheets that judge or write against the stand-in (class one hundred eight).
   */
  readonly acceptedClaims: readonly string[];
};

/**
 What the reading needs of a repaired chunk: its position, its text and its
 adjudicated issues. A structural subset of `ChunkRepairOutcome`, so a guard
 can build one without the rest of the record.

 @example
 ```ts
 const chunk: DisputableChunk = { sliceIndex: 3, repairedText, issues, };
 ```
 */
export type DisputableChunk = {
  /**
   Chunk position within the document.
   */
  readonly sliceIndex: number;

  /**
   Winning chunk text; the archive's own when unchanged won.
   */
  readonly repairedText: string;

  /**
   Adjudicated issues of this chunk.
   */
  readonly issues: readonly AdjudicatedIssue[];
};

/**
 Map entry for one dispute, keyed by slice index.
 */
type DisputeEntry = readonly [
  number,
  ArchiveDispute,
];

/**
 Whether an accepted claim disputes the archive rendering: an addition at any
 severity, or another accuracy claim at major severity or worse.

 @param category - category the claim was filed under

 @param severity - severity the claim carries

 @returns Whether the claim disputes the archive

 @example
 ```ts
 disputesArchive({ category: 'accuracy/mistranslation', severity: 'major', },); // true
 ```
 */
function disputesArchive(
  {
    category,
    severity,
  }: {
    readonly category: string;
    readonly severity: string;
  },
): boolean {
  if (category === ADDITION_CATEGORY)
    return true;
  return category.startsWith(ACCURACY_FAMILY,) && DISPUTING_SEVERITIES.has(severity,);
}

/**
 Names the accepted disputing claims against one chunk's archive rendering.

 @param issues - adjudicated issues of the chunk

 @returns Disputing claims inside accepted issues, each as
 "category severity: summary"

 @example
 ```ts
 const claims = acceptedDisputingClaimsOf({ issues: chunk.issues, },);
 ```
 */
function acceptedDisputingClaimsOf(
  { issues, }: { readonly issues: readonly AdjudicatedIssue[]; },
): readonly string[] {
  return issues
    .filter(function isAccepted(issue,): boolean {
      return issue.status === 'accepted';
    },)
    .flatMap(function toClaims(issue,) {
      return issue.claims;
    },)
    .filter(function disputes(member,): boolean {
      return disputesArchive(member.claim,);
    },)
    .map(function toBody(member,): string {
      /**
       Claim as the critic filed it.
       */
      const {
        category,
        severity,
        summary,
      } = member.claim;
      return `${category} ${severity}: ${summary}`;
    },);
}

/**
 Reads the disputed slices off the repair lane's chunks.

 @param chunks - every chunk the repair lane settled

 @returns Disputes keyed by slice index, in chunk order

 @example
 ```ts
 const disputes = archiveDisputesOf({ chunks: repair.chunks, },);
 ```
 */
export function archiveDisputesOf(
  { chunks, }: { readonly chunks: readonly DisputableChunk[]; },
): ReadonlyMap<number, ArchiveDispute> {
  return new Map(chunks
    .flatMap(function toDispute(chunk,): readonly DisputeEntry[] {
      /**
       Accepted disputing claims against this chunk's archive rendering.
       */
      const acceptedClaims = acceptedDisputingClaimsOf({ issues: chunk.issues, },);
      if (acceptedClaims.length === 0)
        return [];
      return [[
        chunk.sliceIndex,
        {
          sliceIndex: chunk.sliceIndex,
          standIn: chunk.repairedText,
          acceptedClaims,
        },
      ],];
    },),);
}

/**
 Names a dispute the way every other stage finding is named.

 @param dispute - disputed slice

 @returns Finding in scorecard-stable wording

 @example
 ```ts
 l.warn(describeArchiveDispute({ dispute, },),);
 ```
 */
export function describeArchiveDispute(
  { dispute, }: { readonly dispute: ArchiveDispute; },
): string {
  /**
   Claims the finding counts.
   */
  const { acceptedClaims, } = dispute;
  return `translate-archive-disputed (slice ${String(dispute.sliceIndex,)}): the repair lane's adjudicators accepted ${
    String(acceptedClaims.length,)
  } disputing claim(s) (${DISPUTING_RULE}) against the archive rendering, so the repair lane's text stands in for it `
    + '(classes one hundred seven and one hundred seventy-six)';
}

/**
 Logs every dispute once, where the lanes meet.

 @param disputes - disputes keyed by slice index

 @param l - lanes logger

 @example
 ```ts
 logArchiveDisputes({ disputes, l, },);
 ```
 */
export function logArchiveDisputes(
  {
    disputes,
    l,
  }: {
    readonly disputes: ReadonlyMap<number, ArchiveDispute>;
    readonly l: Logger;
  },
): void {
  for (const dispute of disputes.values()) {
    l.warn(describeArchiveDispute({ dispute, },),);
  }
}

/**
 Sheet block for a disputed slice: what the adjudicators accepted against the
 archive rendering, and what every writer and judge is to make of a detail
 those claims name.

 THE HUNDRED-AND-EIGHTH CLASS (CuspariaKLSY11 slice 3, 2026-09-24). The
 repair lane softened the archive's invented suicide method to "She took
 medication that night", the consolidated proposal dropped it, and the gate
 kept the stand-in 2 to 1 as "dropped page content ... which the Chinese does
 not contradict": the page apparatus clause protected on the stand-in the very
 detail the stand-in exists to remove. ONE WORDING FOR EVERY SHEET, as that
 clause is, so the writer, the slate judge, the gate and the contest read the
 same rule about the same detail.

 THE ONE HUNDRED FORTY-FOURTH CLASS (hulicaijia27 chunk 69, 2026-09-26). The
 same block made one panel's verdict final on every later sheet, whatever the
 claim named. The panel accepted the archive's footnote 7, a note explaining
 the pun between 晚安 and 金刚烷胺, as an addition 3 to 2, and the block told
 the translate slate that no detail the claim names is apparatus: all four
 judges voted the note out, one citing the accepted claim. So the block's
 bar is narrative detail, stated as the page-apparatus clause bounds it,
 which is what class one hundred eight's softened medication was; a claimed
 note or gloss goes back to the apparatus rule.

 @param dispute - disputed slice

 @returns Block naming the claims and the rule, headed for the sheets

 @example
 ```ts
 const note = archiveDisputeNote({ dispute, },);
 ```
 */
export function archiveDisputeNote(
  { dispute, }: { readonly dispute: ArchiveDispute; },
): string {
  /**
   Claims the note names.
   */
  const { acceptedClaims, } = dispute;
  /**
   Claims numbered the way a ballot can cite them.
   */
  const numbered = acceptedClaims
    .map(function toLine(
      claim,
      index,
    ): string {
      return `(${String(index + 1,)}) ${claim}`;
    },)
    .join('; ',);
  /**
   Whether any accepted claim is an addition, which brings the apparatus rule.
   */
  const carriesAddition = acceptedClaims.some(function isAddition(claim,): boolean {
    return claim.startsWith(`${ADDITION_CATEGORY} `,);
  },);
  /**
   Whether any accepted claim is another accuracy claim, which brings the
   reading rule (class one hundred seventy-six).
   */
  const carriesMisreading = acceptedClaims.some(function isMisreading(claim,): boolean {
    return !claim.startsWith(`${ADDITION_CATEGORY} `,);
  },);
  /**
   Rule for a detail an accepted addition names.
   */
  const additionRule = carriesAddition
    ? ` ${NARRATIVE_DETAIL_IS_NOT_APPARATUS} A detail those addition claims name that says what happened is not `
      + 'page content and not the page\'s apparatus, in the archive\'s wording or any softer one: a candidate '
      + 'leaving it out has dropped nothing, and a candidate keeping it carries an accepted addition. Judge such a '
      + `detail against the ORIGINAL alone. A claim naming only the page's apparatus, a gloss of a name or a term or ${
        TRANSLATOR_NOTE_KIND
      }, does not make it an addition: judge it by the page-apparatus rule, as if no claim named it.`
    : '';
  /**
   Rule for a reading an accepted mistranslation, omission or untranslated
   claim names.
   */
  const misreadingRule = carriesMisreading
    ? ' A reading those claims name as mistranslated, omitted or left untranslated is not the page\'s authority, '
      + 'in the archive\'s wording or a near copy of it: render what the ORIGINAL says there, and weigh a candidate '
      + 'keeping the archive\'s reading as carrying an accepted error.'
    : '';
  return `ARCHIVE RENDERING DISPUTED: the repair lane's adjudicators accepted ${
    String(acceptedClaims.length,)
  } claim(s) (${DISPUTING_RULE}) that the archive rendering departs from the ORIGINAL; the claims: ${
    numbered
  }.${additionRule}${misreadingRule}`;
}

/**
 Sheet notes per disputed slice, for a stage that reads its slices by index.

 @param chunks - every chunk the repair lane settled

 @returns Notes keyed by slice index, in chunk order

 @example
 ```ts
 const notes = archiveDisputeNotesOf({ chunks: repair.chunks, },);
 ```
 */
export function archiveDisputeNotesOf(
  { chunks, }: { readonly chunks: readonly DisputableChunk[]; },
): ReadonlyMap<number, string> {
  /**
   Disputes keyed by slice.
   */
  const bySlice = archiveDisputesOf({ chunks, },);
  return new Map([...bySlice.values(),]
    .map(function toNote(dispute,): readonly [
      number,
      string,
    ] {
      return [
        dispute.sliceIndex,
        archiveDisputeNote({ dispute, },),
      ];
    },),);
}

//endregion Archive dispute
