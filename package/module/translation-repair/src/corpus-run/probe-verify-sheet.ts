import { createHash, } from 'node:crypto';

import { fenceForMarkdown, } from '../markdown-fence.ts';
import type { ScreenedDefectClaim, } from '../introduced-defect-screen.ts';
import type { RelabelCase, } from './probe-relabel-case.ts';

//region Probe verify sheet
// Formats the sheet that decides whether the unlabelled probe finds damage or
// invents it.
//
// The relabel runs left exactly one thing unsettled. Withholding the accepted
// issues makes the probe flag every damaged region and roughly four in ten
// unflagged ones, and "unflagged" only ever meant "nobody read it". If those
// four are real damage the reader never saw, the probe is a detector worth
// gating on. If they are inventions, its precision is near half and gating
// would discard correct repairs.
//
// The sheet is therefore BLIND. Items are ordered by a digest of their identity
// rather than by kind, and nothing on the page says whether an item came from
// the damaged set or the control set, because a grader told which is which
// would be answering a different question.
//
// The sheet quotes unlicensed corpus text. It is written outside the repository
// and must never be committed, pasted into a third-party model, or shared.

/**
 * One region to be judged, with what the probe said about it.
 *
 * @example
 * ```ts
 * const item: VerifyItem = { relabelCase, claims, kind: 'control', };
 * ```
 */
export type VerifyItem = {
  /**
   * Region and the texts surrounding it.
   */
  readonly relabelCase: RelabelCase;

  /**
   * Admissible claims the unlabelled probe raised.
   */
  readonly claims: readonly ScreenedDefectClaim[];

  /**
   * Which set this item came from, recorded in the manifest and never on the
   * sheet.
   */
  readonly kind: 'damaged' | 'control';
};

/**
 * Orders items by a digest of their identity.
 *
 * Deterministic so a re-run produces the same sheet, and independent of kind so
 * the damaged and control items interleave. Ordering by anything the grader
 * could infer, insertion order included, would leak the answer.
 *
 * @param items - items to order
 *
 * @returns Same items, digest order
 *
 * @example
 * ```ts
 * const ordered = orderBlind({ items, },);
 * ```
 */
export function orderBlind(
  { items, }: { readonly items: readonly VerifyItem[]; },
): readonly VerifyItem[] {
  return items
    .map(function withDigest(item,) {
      /**
       * Region and texts this item judges.
       */
      const { relabelCase, } = item;

      /**
       * Entry and region naming the edit.
       */
      const {
        entryId,
        region,
      } = relabelCase;

      /**
       * Identity of the edit this item judges.
       */
      const identity = `${entryId} ${region.envelopeId}`;

      return {
        item,
        digest: createHash('sha256',)
          .update(identity,)
          .digest('hex',),
      };
    },)
    .toSorted(function byDigest(
      left,
      right,
    ) {
      return left.digest < right.digest ? (-1) : 1;
    },)
    .map(function toItem(entry,) {
      return entry.item;
    },);
}

/**
 * Renders one claim as the reviewer's stated finding.
 *
 * @param claim - screened claim
 *
 * @returns Markdown lines for this claim
 *
 * @example
 * ```ts
 * const block = renderClaim({ claim, },);
 * ```
 */
function renderClaim({ claim, }: { readonly claim: ScreenedDefectClaim; },): string {
  /**
   * Wording the claim anchors on, from whichever side it quoted.
   */
  const quoted = claim.omittedText === '' ? claim.evidence : claim.omittedText;

  /**
   * Which direction the claim runs, in plain words.
   */
  const direction = claim.omittedText === ''
    ? 'wording the edit ADDED or altered'
    : 'wording the edit DROPPED';

  return [
    `-   Says the edit introduced: ${claim.category}`,
    `-   Quotes this as ${direction}:`,
    '',
    fenceForMarkdown({ text: quoted, },),
    '',
    `-   Its reason:`,
    '',
    fenceForMarkdown({ text: claim.reason, },),
  ].join('\n',);
}

/**
 * Renders one sheet item.
 *
 * @param item - item to render
 *
 * @param position - one-based position on the sheet
 *
 * @returns Markdown section
 *
 * @example
 * ```ts
 * const section = renderItem({ item, position: 1, },);
 * ```
 */
function renderItem(
  {
    item,
    position,
  }: {
    readonly item: VerifyItem;
    readonly position: number;
  },
): string {
  /**
   * Region and texts this item judges.
   */
  const { relabelCase, } = item;

  /**
   * Slice texts and the replaced region.
   */
  const {
    sourceText,
    baselineText,
    region,
  } = relabelCase;

  /**
   * Replaced text and its replacement.
   */
  const {
    before,
    editorAfter,
  } = region;

  return [
    `### ${String(position,)}. grade: [ ]  (Y = the edit damaged the text · N = the edit is acceptable)`,
    '',
    'Original:',
    '',
    fenceForMarkdown({ text: sourceText, },),
    '',
    'Translation of that passage BEFORE the edit:',
    '',
    fenceForMarkdown({ text: baselineText, },),
    '',
    'The edit replaced this text:',
    '',
    fenceForMarkdown({ text: before, },),
    '',
    'with this text:',
    '',
    fenceForMarkdown({ text: editorAfter, },),
    '',
    'An automated reviewer says the edit introduced a defect:',
    '',
    ...item.claims
      .map(function toBlock(claim,) {
        return renderClaim({ claim, },);
      },),
    '',
    'Y if the edit lost or distorted something the original supports.',
    'N if the edit is acceptable, even where it is not the wording you would',
    'have chosen, and N if the only problem is a defect that was already there',
    'before the edit.',
    '',
  ].join('\n',);
}

/**
 * Formats the whole blind verification sheet.
 *
 * @param items - items to judge, any order; ordering is applied here
 *
 * @returns Sheet markdown
 *
 * @example
 * ```ts
 * const sheet = formatVerifySheet({ items, },);
 * ```
 */
export function formatVerifySheet(
  { items, }: { readonly items: readonly VerifyItem[]; },
): string {
  /**
   * Items in blind order.
   */
  const ordered = orderBlind({ items, },);

  return [
    '# Does the unlabelled probe find damage, or invent it?',
    '',
    'Every item below is an edit the pipeline applied, and an automated reviewer',
    'claims each one introduced a defect. Some of these claims are probably',
    'right and some are probably wrong; the point of this sheet is to find out',
    'which, and the items are deliberately in an order that tells you nothing.',
    '',
    'Judge only whether the EDIT damaged the translation. A passage that was',
    'already wrong before the edit is not damage the edit caused, and the',
    'reviewer has been told that too, so a claim pointing at a pre-existing',
    'problem is a wrong claim.',
    '',
    'Replace each `[ ]` on a heading with `Y` or `N`.',
    '',
    `Items: ${String(ordered.length,)}`,
    '',
    ...ordered
      .map(function toSection(
        item,
        index,
      ) {
        return renderItem({
          item,
          position: index + 1,
        },);
      },),
  ].join('\n',);
}

/**
 * Builds the manifest that scores the sheet.
 *
 * Written beside the sheet rather than into it, because the sheet is blind and
 * a grader who can see which items came from the damaged set is answering a
 * different question than the one being asked.
 *
 * @param items - items to judge, any order; ordering matches the sheet
 *
 * @returns Manifest JSON
 *
 * @example
 * ```ts
 * const manifest = formatVerifyManifest({ items, },);
 * ```
 */
export function formatVerifyManifest(
  { items, }: { readonly items: readonly VerifyItem[]; },
): string {
  return JSON.stringify(
    {
      items: orderBlind({ items, },)
        .map(function toEntry(
          item,
          index,
        ) {
          /**
           * Region and texts this entry names.
           */
          const { relabelCase, } = item;

          /**
           * Entry and region naming the edit.
           */
          const {
            entryId,
            region,
          } = relabelCase;

          return {
            position: index + 1,
            entryId,
            envelopeId: region.envelopeId,
            kind: item.kind,
            claimants: item.claims
              .map(function toModelId(claim,) {
                return claim.modelId;
              },),
          };
        },),
    },
    undefined,
    2,
  );
}

//endregion Probe verify sheet
