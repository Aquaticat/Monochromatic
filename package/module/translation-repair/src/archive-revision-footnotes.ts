import { REVISION_SHAPE_REFUSED, } from './archive-revision-shape.ts';
import { introducedFootnoteFindings, } from './assembly-regressions.ts';

//region Archive revision footnotes
// THE EIGHTY-FOURTH CLASS (hulicaijia12, 2026-09-22). The archive block
// review put the translator's note "[^10]: Formerly Nayuki, renamed Naìsnow
// in 2025." to its reviewers, five of five called the rename unsupported by
// the original, and the selection removed the definition. The marker
// `Naixue[^10]` stood in the body where no reviewer was asked about it, so
// the page shipped a reference with no note. The page footnote guard
// (`page-footnote-integrity.ts`) never saw it: the review's revision is
// spliced into the archive text every later stage reads as the incumbent,
// so a defect the review introduces is inherited by the page and blamed on
// nobody. A footnote is a relation BETWEEN blocks, and a revision of one
// block is judged here against the whole page it would leave: a revision
// that introduces a footnote defect the archive did not carry is withheld
// under the shape floor's finding prefix, and the note ships as the archive
// wrote it.

/**
 What `indexOf` returns for a block the archive does not carry verbatim.
 */
const NOT_FOUND = -1;

/**
 Refusal of a block the archive it was read from does not carry, so the page
 its revision would leave cannot be built.

 MARKED: its message is one sentence written here, naming nothing.

 @example
 ```ts
 throw new BlockOutsideArchiveError();
 ```
 */
export class BlockOutsideArchiveError extends Error {
  /**
   Declares this message safe to print whole at a boundary: a fixed sentence.
   */
  readonly messageNamesOnly: true = true;

  /**
   Writes the one sentence this refusal says, which takes nothing from the
   block or the archive.
   */
  constructor() {
    super(
      'the archive block under review is not in the archive it was read from, so the page its revision would leave '
        + 'cannot be built and its footnotes cannot be checked',
    );
    this.name = 'BlockOutsideArchiveError';
  }
}

/**
 Why a revision cannot replace the block it revises, when the page it would
 leave carries a footnote defect the archive did not: a reference with no
 definition, a definition nothing references, or an identifier defined
 twice.

 A BLOCK THE PAGE DOES NOT CARRY IS REFUSED (ledger T8, eighteenth batch).
 The block under review is an exact slice of the archive
 (`corpus-run/archive-block-repair.ts`), so one not found in it breaks the
 caller's contract; it once passed every revision unread, a branch kept for
 fixtures a caller composed and reached by none. A block the page carries
 more than once is replaced at its first occurrence; the footnote graph
 reads the same labels whichever occurrence is replaced.

 @param modelId - reviewer who wrote the revision, named in the finding

 @param blockText - archive block under review, verbatim

 @param replacementText - revision as it would ship, empty for a removal

 @param targetText - whole archive the block stands in

 @returns Findings withholding the revision, empty when it may stand

 @throws BlockOutsideArchiveError when the archive does not carry the block

 @example
 ```ts
 const findings = revisionFootnoteFindings({ modelId, blockText, replacementText: '', targetText, },);
 ```
 */
export function revisionFootnoteFindings(
  {
    modelId,
    blockText,
    replacementText,
    targetText,
  }: {
    readonly modelId: string;
    readonly blockText: string;
    readonly replacementText: string;
    readonly targetText: string;
  },
): readonly string[] {
  /**
   Where the block stands in the archive.
   */
  const at = targetText.indexOf(blockText,);
  if (at === NOT_FOUND)
    throw new BlockOutsideArchiveError();
  /**
   The page as the revision would leave it.
   */
  const revised = `${targetText.slice(
    0,
    at,
  )}${replacementText}${targetText.slice(at + blockText.length,)}`;
  /**
   Footnote defects the revised page carries and the archive did not.
   */
  const introduced = introducedFootnoteFindings({
    incumbentText: targetText,
    assembledText: revised,
  },);
  if (introduced.length === 0)
    return [];
  /**
   Each defect spelled the way the page guard spells it.
   */
  const spelled = introduced.map(function spell(finding,): string {
    return `${finding.kind} ${finding.convention} ${finding.identifier}`;
  },)
    .join(', ',);
  return [
    `${REVISION_SHAPE_REFUSED} (${modelId}): the revision leaves the page with a footnote defect the archive did not carry (${spelled}); a footnote is a relation between blocks, and its marker stands outside the block under review`,
  ];
}

//endregion Archive revision footnotes
