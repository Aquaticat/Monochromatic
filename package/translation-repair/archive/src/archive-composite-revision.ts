import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  type Candidate,
  describeProducer,
  producerModelIds,
} from '@monochromatic-dev/translation-repair-house-rule/ts';
import { rendersAsNothing, } from '@monochromatic-dev/translation-repair-typography/ts';
import type { RosterModelId, } from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  counted,
  linesOf,
  numbered,
  sharedLines,
} from './archive-composite-lines.ts';
import { revisionFootnoteFindings, } from './archive-revision-footnotes.ts';
import {
  REVISION_SHAPE_REFUSED,
  revisionShapeFindings,
} from './archive-revision-shape.ts';

//region Archive composite revision
// THE COMPOSITE OF DISJOINT REVISIONS (ledger B712, zheermao20, 2026-10-21).
// The block review asks each reviewer for the complete corrected block, and
// tells each to change only what is demonstrably wrong, so different reviewers
// fix different lines. The letter block of that run drew two revisions that
// changed lines 3 and 6 to 9, and lines 12, 13 and 26, of 36; the selection
// could pick one whole revision and the other's fixes were lost. The
// consolidation stage was built on the same argument for slices
// (`consolidate-wire.ts`): no selection can produce text that is neither
// candidate. This builds that text when it can be built without choosing
// anything: the lines each revision changed, applied to the block together.
//
// THE RULE IS NARROW BY DESIGN, and each narrowing is recorded so a reader can
// veto it.
// - Every revision that changes the block keeps its line count. One that does
//   not has no lines to match against the block's, and then no composite is
//   built, rather than one from the revisions that do match, because the
//   shipped text would depend on which reviewers happened to answer in a
//   matching shape. A removal is such a revision.
// - The changed lines of all of them are pairwise disjoint. A line two
//   revisions change is an overlap even when both change it identically:
//   agreeing on a line is no reason to merge revisions that differ elsewhere,
//   and the only merge the slate already trusts is of byte-identical whole
//   revisions. Three revisions of which two are disjoint build nothing for the
//   same reason: choosing the pair needs a rule, and the only one to hand
//   (roster order) would make the shipped text depend on who answered first.
// - A revision equal to the block changes no line. It is no contributor and
//   does not count toward the two a composite needs.
// - A line is the text up to and including its line ending, so a carriage
//   return stays with its line and a trailing newline is a change to the last
//   line, never a line of its own.
// - The composite goes through the gates every revision passed (shape,
//   footnotes), since a composite is text no model read as a whole.
// - The outcome names what each revision contributed (its candidate number
//   and the lines it changed), because no reviewer proposed the composite and
//   the judges' sheet can show its assessments only through its contributors'
//   (ledger B716, `archive-block-selection-evidence.ts`).
// - It stands after the reviewers' revisions and before the block as the
//   archive wrote it, as the editor lane's composite stands last among its
//   proposals (`editor-candidates.ts`).

/**
 What the composite step decided for one block's revisions.
 */
export type CompositeRevisionOutcome = {
  /**
   The composite as one more candidate, absent when none was built.
   */
  readonly candidate?: Candidate<string>;
  /**
   Findings the shape or footnote gate refused the composite under, empty
   otherwise.
   */
  readonly withheld: readonly string[];
  /**
   What each revision the composite carries contributed, in slate order, empty
   when no composite was built (ledger B716).
   */
  readonly contributions: readonly CompositeContribution[];
};

/**
 One revision a composite carries, and the lines of the block it changed.
 */
export type CompositeContribution = {
  /**
   Candidate number the judges see the revision under, which the revisions
   keep because the composite stands after them.
   */
  readonly candidate: number;
  /**
   Zero-based positions of the block's lines the revision changed, which the
   composite takes from it.
   */
  readonly changed: readonly number[];
};

/**
 The outcome of a block whose revisions leave nothing to combine or whose
 combination no gate lets stand, said without a finding.
 */
const NO_COMPOSITE: CompositeRevisionOutcome = {
  withheld: [],
  contributions: [],
};

/**
 One revision that changes the block, and the lines it changes.
 */
type ChangingRevision = {
  /**
   Candidate number the judges see it under.
   */
  readonly number: number;
  /**
   The revision.
   */
  readonly candidate: Candidate<string>;
  /**
   Its lines.
   */
  readonly lines: readonly string[];
  /**
   Zero-based positions of the lines it changes.
   */
  readonly changed: readonly number[];
};

/**
 Builds the composite of the revisions' changed lines when they allow one,
 and says at the decision point why not when they do not.

 @param revisions - distinct reviewer revisions in slate order, as the judges
 number them, the block's own candidate not among them unless a reviewer
 wrote it

 @param blockText - archive block under review, verbatim

 @param blockOffset - where the block starts in the page, for the footnote
 gate

 @param targetText - page the block stands in, as the revisions already
 applied leave it, for the footnote gate

 @param l - stage logger

 @returns The composite candidate when built and passed through the gates,
 with what each revision it carries contributed, and the findings the gates
 refused it under when they did

 @throws BlockOutsideArchiveError when the page does not carry the block

 @example
 ```ts
 const { candidate, withheld, } = compositeOfDisjointRevisions({ revisions, blockText, blockOffset, targetText, l, });
 ```
 */
export function compositeOfDisjointRevisions(
  {
    revisions,
    blockText,
    blockOffset,
    targetText,
    l,
  }: {
    readonly revisions: readonly Candidate<string>[];
    readonly blockText: string;
    readonly blockOffset: number;
    readonly targetText: string;
    readonly l: Logger;
  },
): CompositeRevisionOutcome {
  // ONE REVISION, OR NONE, HAS NOTHING TO COMBINE and no decision to record.
  if (revisions.length < 2)
    return NO_COMPOSITE;
  /**
   Logger naming this step in every line.
   */
  const compositeLog = tagged({
    l,
    tag: compositeOfDisjointRevisions.name,
  },);
  /**
   Lines of the block.
   */
  const blockLines = linesOf({ text: blockText, },);
  /**
   Revisions that differ from the block, with their candidate numbers.
   */
  const differing = revisions
    .map(function numberedRevision(
      candidate,
      index,
    ): {
      readonly candidate: Candidate<string>;
      readonly number: number;
    } {
      return {
        candidate,
        number: index + 1,
      };
    },)
    .filter(function differsFromBlock({ candidate, },): boolean {
      return candidate.value !== blockText;
    },);
  if (differing.length < 2) {
    compositeLog.info(
      `archive composite not built: ${String(differing.length,)} of ${
        counted({
          count: revisions.length,
          one: 'revision',
          many: 'revisions',
        },)
      } change the block, and two are needed to combine`,
    );
    return NO_COMPOSITE;
  }
  /**
   Each differing revision with the lines it changes.
   */
  const changing: ChangingRevision[] = [];
  for (const {
    candidate,
    number,
  } of differing) {
    if (candidate.value === '') {
      compositeLog.info(
        `archive composite not built: candidate ${String(number,)} is a removal, which has no lines to match`,
      );
      return NO_COMPOSITE;
    }
    /**
     Lines of this revision.
     */
    const lines = linesOf({ text: candidate.value, },);
    if (lines.length !== blockLines.length) {
      compositeLog.info(
        `archive composite not built: candidate ${String(number,)} has ${
          counted({
            count: lines.length,
            one: 'line',
            many: 'lines',
          },)
        } against the block's ${
          counted({
            count: blockLines.length,
            one: 'line',
            many: 'lines',
          },)
        }, and lines can only be matched one for one`,
      );
      return NO_COMPOSITE;
    }
    changing.push({
      number,
      candidate,
      lines,
      changed: lines.flatMap(function changedAt(
        line,
        index,
      ): readonly number[] {
        return line === blockLines[index] ? [] : [index,];
      },),
    },);
  }
  /**
   What each pair of revisions that share a line shares, as the log says it.
   */
  const overlaps: string[] = [];
  for (const [position, first,] of changing.entries()) {
    for (const second of changing.slice(position + 1,)) {
      /**
       Lines both change.
       */
      const shared = sharedLines({
        left: first.changed,
        right: second.changed,
      },);
      if (shared.length > 0) {
        overlaps.push(
          `${numbered({ indexes: shared, },)} (candidates ${String(first.number,)} and ${String(second.number,)})`,
        );
      }
    }
  }
  if (overlaps.length > 0) {
    compositeLog.info(
      `archive composite not built: ${
        counted({
          count: changing.length,
          one: 'revision',
          many: 'revisions',
        },)
      } overlap on ${overlaps.join('; ',)}, of the block's ${
        counted({
          count: blockLines.length,
          one: 'line',
          many: 'lines',
        },)
      }`,
    );
    return NO_COMPOSITE;
  }
  /**
   Models whose revisions the composite carries, in slate order.
   */
  const contributors: readonly RosterModelId[] = [
    ...new Set(
      changing.flatMap(function contributorsOf({ candidate, },): readonly RosterModelId[] {
        return producerModelIds(candidate.producer,);
      },),
    ),
  ];
  /**
   The composite's provenance.
   */
  const producer = {
    kind: 'composite',
    contributors,
  } as const;
  /**
   Name the gates' findings give the composite.
   */
  const label = describeProducer(producer,);
  /**
   Block with every revision's changed lines applied.
   */
  const combined = blockLines
    .map(function lineOf(
      line,
      index,
    ): string {
      /**
       Revision changing this line, when one does.
       */
      const owner = changing.find(function changesLine({ changed, },): boolean {
        return changed.includes(index,);
      },);
      return owner === undefined ? line : (owner.lines[index] ?? line);
    },)
    .join('',);
  if (rendersAsNothing({ text: combined, },)) {
    compositeLog.info(
      'archive composite not built: the combined text shows a reader nothing, though each revision shows something',
    );
    return {
      withheld: [
        `${REVISION_SHAPE_REFUSED} (${label}): the combined revision shows a reader nothing, though each revision `
        + 'shows something',
      ],
      contributions: [],
    };
  }
  /**
   Why the combined text cannot stand for the block, from the gates every
   revision passed.
   */
  const refused = [
    ...revisionShapeFindings({
      modelId: label,
      blockText,
      replacementText: combined,
    },),
    ...revisionFootnoteFindings({
      modelId: label,
      blockText,
      blockOffset,
      replacementText: combined,
      targetText,
    },),
  ];
  if (refused.length > 0) {
    compositeLog.info(`archive composite not built: a gate refused the combined text: ${refused.join('; ',)}`,);
    return {
      withheld: refused,
      contributions: [],
    };
  }
  compositeLog.info(
    `archive composite built from ${
      counted({
        count: changing.length,
        one: 'revision',
        many: 'revisions',
      },)
    } changing disjoint lines, of the block's ${
      counted({
        count: blockLines.length,
        one: 'line',
        many: 'lines',
      },)
    }: ${
      changing.map(function describeChange({
        number,
        changed,
      },): string {
        return `candidate ${String(number,)} ${numbered({ indexes: changed, },)}`;
      },)
        .join('; ',)
    }`,
  );
  return {
    candidate: {
      producer,
      value: combined,
      rendered: combined,
    },
    withheld: [],
    contributions: changing.map(function toContribution({
      number,
      changed,
    },): CompositeContribution {
      return {
        candidate: number,
        changed,
      };
    },),
  };
}

//endregion Archive composite revision
