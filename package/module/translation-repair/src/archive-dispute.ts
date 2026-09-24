import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { AdjudicatedIssue, } from './adjudicate-model.ts';

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

/**
 Claim category that disputes the archive rendering.
 */
const DISPUTING_CATEGORY = 'accuracy/addition';

/**
 One disputed slice and the text standing in for its archive rendering.

 @example
 ```ts
 const dispute: ArchiveDispute = { sliceIndex: 3, standIn: repairedText, acceptedAdditions: 2, acceptedClaims: [], };
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
   How many `accuracy/addition` claims the adjudicators accepted.
   */
  readonly acceptedAdditions: number;

  /**
   Those claims, each as "category severity: summary", for the sheets that
   judge or write against the stand-in (class one hundred eight).
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
 Names the accepted addition claims against one chunk's archive rendering.

 @param issues - adjudicated issues of the chunk

 @returns Claims of the disputing category inside accepted issues, each as
 "category severity: summary"

 @example
 ```ts
 const claims = acceptedAdditionClaimsOf({ issues: chunk.issues, },);
 ```
 */
function acceptedAdditionClaimsOf(
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
      /**
       Category the claim was filed under.
       */
      const { category, } = member.claim;
      return category === DISPUTING_CATEGORY;
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
       Accepted addition claims against this chunk's archive rendering.
       */
      const acceptedClaims = acceptedAdditionClaimsOf({ issues: chunk.issues, },);
      if (acceptedClaims.length === 0)
        return [];
      return [[
        chunk.sliceIndex,
        {
          sliceIndex: chunk.sliceIndex,
          standIn: chunk.repairedText,
          acceptedAdditions: acceptedClaims.length,
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
  return `translate-archive-disputed (slice ${String(dispute.sliceIndex,)}): the repair lane's adjudicators accepted ${
    String(dispute.acceptedAdditions,)
  } ${DISPUTING_CATEGORY} claim(s) against the archive rendering, so the repair lane's text stands in for it `
    + '(class one hundred seven)';
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
   Claims numbered the way a ballot can cite them.
   */
  const numbered = dispute.acceptedClaims
    .map(function toLine(
      claim,
      index,
    ): string {
      return `(${String(index + 1,)}) ${claim}`;
    },)
    .join('; ',);
  return `ARCHIVE RENDERING DISPUTED: the repair lane's adjudicators accepted ${
    String(dispute.acceptedAdditions,)
  } ${DISPUTING_CATEGORY} claim(s) that the archive rendering says what the ORIGINAL never states; the claims: ${
    numbered
  }. A detail those claims name is not page content and not the page's apparatus, in the archive's wording or `
    + 'any softer one: a candidate leaving it out has dropped nothing, and a candidate keeping it carries an '
    + 'accepted addition. Judge such a detail against the ORIGINAL alone.';
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
