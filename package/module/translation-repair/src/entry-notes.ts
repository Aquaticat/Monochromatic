import type { RepairDocument, } from './parse-document.ts';

//region Entry notes
// The notes an entry carries, rendered as identity-context lines so a sheet
// working one slice sees what sits at the end of the page or inside a comment.
//
// WHY. The owner's rule of 2026-09-02 (`doc/decision/translation-repair-work-titles-established-vocabulary.md`):
// "Some entries contain established vocabulary in footnotes. If that exists,
// use that." A footnote definition sits at the end of the page and an editor's
// HTML comment is masked out of the parse, so neither reaches a translator or
// a judge working one slice unless it is carried to them. Measured over the
// pinned corpus: 23 sources carry 52 footnote definitions, 17 carry HTML
// comments; XIEPT2's archive carries 17 comments, a translation hint and a
// glossary ("起床战争：Bed Wars") among them, and yulianNyanner's source is a
// glossary in comments ("波奇酱（后藤一里）：Bocchi-chan").
//
// NOT AUTHORITATIVE. A note is document content: LCG_Akiball's first footnote
// is an editor's guess at what the author meant. The lines are labelled by
// side and kind, and the sheets read them as establishing vocabulary for the
// terms they name and nothing else; `identity-context.ts` explains why document
// content is never fed as a declaration.

/**
 * Which document a note comes from, in the vocabulary the sheets use.
 */
export type NoteSide = 'ORIGINAL' | 'ARCHIVE';

/**
 * Opening delimiter of an HTML comment.
 */
const COMMENT_OPEN = '<!--';

/**
 * Closing delimiter of an HTML comment.
 */
const COMMENT_CLOSE = '-->';

/**
 * Node kind the parser gives a GFM footnote definition.
 */
const FOOTNOTE_DEFINITION_KIND = 'footnoteDefinition';

/**
 * Whether one character is whitespace by the same test `trim` uses.
 *
 * @param character - one character
 *
 * @returns Whether trimming it alone leaves nothing
 *
 * @example
 * ```ts
 * isWhitespace({ character: '\n', },);
 * // => true
 * ```
 */
function isWhitespace(
  { character, }: { readonly character: string; },
): boolean {
  /**
   * The character with whitespace removed.
   */
  const trimmed = character.trim();
  return trimmed.length === 0;
}

/**
 * Folds a note onto one line: every run of whitespace becomes one space and
 * the ends are trimmed, so a multi-line definition or comment stays one
 * identity-context line.
 *
 * ONE LINEAR PASS with the string API rather than a pattern.
 *
 * @param text - note text as it stands in the document
 *
 * @returns Note on one line
 *
 * @example
 * ```ts
 * foldedLine({ text: '[^1]: first\n    second', },);
 * // => '[^1]: first second'
 * ```
 */
export function foldedLine(
  { text, }: { readonly text: string; },
): string {
  /**
   * Text with every whitespace character made a plain space, one pass.
   */
  const spaced = Array.from(
    text,
    function toSpace(character,): string {
      return isWhitespace({ character, },) ? ' ' : character;
    },
  )
    .join('',);
  return spaced
    .split(' ',)
    .filter(function isWord(word,): boolean {
      return word.length > 0;
    },)
    .join(' ',);
}

/**
 * Inner text of one HTML comment, delimiters removed.
 *
 * @param comment - comment as it stands in the document, delimiters included;
 * an unterminated comment has no closing delimiter and keeps its tail
 *
 * @returns What the editor wrote
 *
 * @example
 * ```ts
 * commentBody({ comment: '<!-- 起床战争：Bed Wars -->', },);
 * // => ' 起床战争：Bed Wars '
 * ```
 */
export function commentBody(
  { comment, }: { readonly comment: string; },
): string {
  /**
   * Text after the opening delimiter, or the whole comment when a finding's
   * span did not start on one.
   */
  const opened = comment.startsWith(COMMENT_OPEN,)
    ? comment.slice(COMMENT_OPEN.length,)
    : comment;
  return opened.endsWith(COMMENT_CLOSE,)
    ? opened.slice(
      0,
      opened.length - COMMENT_CLOSE.length,
    )
    : opened;
}

/**
 * Footnote definitions of one document as labelled lines.
 *
 * @param document - parsed document
 *
 * @param side - which document, for the label
 *
 * @returns One line per definition, in document order
 *
 * @example
 * ```ts
 * footnoteNoteLines({ document, side: 'ORIGINAL', },);
 * // => ['- ORIGINAL note: [^1]: 意为个人「代购」境外漫画书籍']
 * ```
 */
export function footnoteNoteLines(
  {
    document,
    side,
  }: {
    readonly document: RepairDocument;
    readonly side: NoteSide;
  },
): readonly string[] {
  return document.nodes
    .filter(function isDefinition(node,): boolean {
      return node.kind === FOOTNOTE_DEFINITION_KIND;
    },)
    .map(function toLine(node,): string {
      return `- ${side} note: ${foldedLine({ text: node.text, },)}`;
    },);
}

/**
 * Editors' HTML comments of one document as labelled lines.
 *
 * The parser masks every comment before parsing and records each as a finding
 * with its offsets, which is the one place the comments survive.
 *
 * @param document - parsed document
 *
 * @param side - which document, for the label
 *
 * @returns One line per comment carrying any text, in document order
 *
 * @example
 * ```ts
 * commentNoteLines({ document, side: 'ARCHIVE', },);
 * // => ['- ARCHIVE editor comment: 起床战争：Bed Wars']
 * ```
 */
export function commentNoteLines(
  {
    document,
    side,
  }: {
    readonly document: RepairDocument;
    readonly side: NoteSide;
  },
): readonly string[] {
  return document.parseFindings
    .filter(function isComment(finding,): boolean {
      return (finding.kind === 'html-comment-skipped')
        || (finding.kind === 'unterminated-html-comment');
    },)
    .map(function toBody(finding,): string {
      /**
       * Comment as it stands in the document, delimiters included.
       */
      const comment = document.text
        .slice(
          finding.startOffset,
          finding.endOffset,
        );
      return foldedLine({ text: commentBody({ comment, },), },);
    },)
    .filter(function saysSomething(body,): boolean {
      return body.length > 0;
    },)
    .map(function toLine(body,): string {
      return `- ${side} editor comment: ${body}`;
    },);
}

/**
 * Every note both documents carry, footnotes first and comments after, the
 * original before the archive.
 *
 * @param sourceDocument - parsed original
 *
 * @param targetDocument - parsed archive
 *
 * @returns Labelled lines, empty when neither document carries a note
 *
 * @example
 * ```ts
 * const lines = entryNoteLines({ sourceDocument, targetDocument, },);
 * ```
 */
export function entryNoteLines(
  {
    sourceDocument,
    targetDocument,
  }: {
    readonly sourceDocument: RepairDocument;
    readonly targetDocument: RepairDocument;
  },
): readonly string[] {
  return [
    ...footnoteNoteLines({
      document: sourceDocument,
      side: 'ORIGINAL',
    },),
    ...footnoteNoteLines({
      document: targetDocument,
      side: 'ARCHIVE',
    },),
    ...commentNoteLines({
      document: sourceDocument,
      side: 'ORIGINAL',
    },),
    ...commentNoteLines({
      document: targetDocument,
      side: 'ARCHIVE',
    },),
  ];
}

//endregion Entry notes
