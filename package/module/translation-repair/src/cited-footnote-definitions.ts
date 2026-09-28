import {
  isFootnoteLabel,
  scanMarkupAtoms,
} from './markup-atom-scan.ts';

//region Cited footnote definitions
// LEDGER L5. A slice citing `[^5]` whose definition sits at the page end
// showed every sheet the marker and never the note, so an attribution or a
// source the note carries read as dropped (sh2 slices 33 and 37). Over every
// run 342 of 6,261 slices cited a footnote defined outside the slice, and 85
// issues the panel accepted there named a footnote, an attribution, a credit
// or a citation. The fidelity window now ends with the definition of every
// label the slice cites that neither the slice nor its window defines, each
// side from its own document, so every sheet showing the window shows the
// note beside the marker.
//
// THE REVERSE CASE IS LEFT OUT ON PURPOSE. A slice holding a definition whose
// citation is outside the window (19 source slices on the latest artifact of
// each entry) shows the note on both sides, so the two notes compare with
// each other without the sentence citing them.

/**
 Most spaces a definition may be indented by and still open at its line: a
 footnote definition follows the link reference definition's rule, and four
 spaces make indented code instead.
 */
const MAX_DEFINITION_INDENT = 3;

/**
 Label a line opens as a footnote definition.

 @param line - one line of a slice

 @returns Label the line defines, or empty when the line defines none

 @example
 ```ts
 definitionLabel({ line: '[^1]: From the cat diary.', },); // '1'
 ```
 */
function definitionLabel({ line, }: { readonly line: string; },): string {
  /**
   Line without its indentation.
   */
  const rest = line.trimStart();
  if ((line.length - rest.length) > MAX_DEFINITION_INDENT)
    return '';
  if (!rest.startsWith('[^',))
    return '';

  /**
   Bracket closing the label.
   */
  const close = rest.indexOf(']',);
  if ((close === (-1)) || (rest[close + 1] !== ':'))
    return '';

  /**
   Text between the opener and the bracket.
   */
  const label = rest.slice(
    2,
    close,
  );
  return isFootnoteLabel({ label, },) ? label : '';
}

/**
 Whether a line continues a definition after a blank line: GFM keeps a
 footnote's later paragraphs only when indented.

 @param line - line after a blank one

 @returns Whether it belongs to the definition above

 @example
 ```ts
 continuesAfterBlank({ line: '    Page two.', },); // true
 ```
 */
function continuesAfterBlank({ line, }: { readonly line: string; },): boolean {
  return line.startsWith('    ',) || line.startsWith('\t',);
}

/**
 Index one past the last line of the definition opening at `start`.

 @param lines - lines of one slice

 @param start - index of the line opening the definition

 @returns End of the definition's lines

 @example
 ```ts
 definitionEnd({ lines: ['[^1]: A.', '', 'Next.',], start: 0, },); // 1
 ```
 */
function definitionEnd(
  {
    lines,
    start,
  }: {
    readonly lines: readonly string[];
    readonly start: number;
  },
): number {
  for (let at = start + 1; at < lines.length; at += 1) {
    /**
     Line under inspection.
     */
    const line = lines[at] ?? '';
    if (definitionLabel({ line, },) !== '')
      return at;
    if (((lines[at - 1] ?? '').trim() === '') && (line.trim() !== '')
      && (!continuesAfterBlank({ line, },)))
      return at;
  }
  return lines.length;
}

/**
 Every footnote definition a text holds, keyed by label, each with its
 continuation lines; the first definition of a label wins, as in GFM.

 @param text - one slice

 @returns Definition text per label

 @example
 ```ts
 footnoteDefinitions({ text: '[^1]: From the cat diary.', },).get('1',);
 ```
 */
function footnoteDefinitions({ text, }: { readonly text: string; },): ReadonlyMap<string, string> {
  /**
   Lines of the text.
   */
  const lines = text.split('\n',);
  return lines.reduce(
    function addDefinition(
    found: ReadonlyMap<string, string>,
    line,
    at,
  ): ReadonlyMap<string, string> {
    /**
     Label this line defines, if any.
     */
    const label = definitionLabel({ line, },);
    if ((label === '') || found.has(label,))
      return found;
    return new Map([
      ...found,
      [
        label,
        lines
          .slice(
            at,
            definitionEnd({
            lines,
            start: at,
          },),
          )
          .join('\n',)
          .trimEnd(),
      ],
    ],);
  },
    new Map<string, string>(),
  );
}

/**
 Definitions of the footnotes a slice cites that nothing shown with it
 defines, found in the other slices of the same side.

 @param citingText - slice whose citations are read

 @param shownText - slice and window together, whose definitions are already
   on the sheet

 @param documentTexts - every slice of the same side, in document order

 @returns Definitions joined line by line, empty when nothing is missing

 @example
 ```ts
 const notes = citedFootnoteDefinitions({ citingText, shownText, documentTexts, },);
 ```
 */
function citedFootnoteDefinitions(
  {
    citingText,
    shownText,
    documentTexts,
  }: {
    readonly citingText: string;
    readonly shownText: string;
    readonly documentTexts: readonly string[];
  },
): string {
  /**
   Labels already defined on the sheet.
   */
  const shown = footnoteDefinitions({ text: shownText, },);

  /**
   Labels the slice cites and the sheet does not define, first citation first.
   */
  const missing = [
    ...new Set(scanMarkupAtoms({ text: citingText, },)
      .filter(function isFootnote(atom,): boolean {
        return atom.kind === 'footnote-reference';
      },)
      .map(function toLabel(atom,): string {
        return atom.value
          .slice(
            2,
            -1,
          );
      },),),
  ]
    .filter(function notShown(label,): boolean {
      return !shown.has(label,);
    },);
  if (missing.length === 0)
    return '';

  /**
   Definitions each slice of the side holds, in document order.
   */
  const perSlice = documentTexts.map(function definitionsOf(text,): ReadonlyMap<string, string> {
    return footnoteDefinitions({ text, },);
  },);
  return missing
    .flatMap(function toDefinition(label,): readonly string[] {
      /**
       First slice defining the label.
       */
      const holder = perSlice.find(function defines(definitions,): boolean {
        return definitions.has(label,);
      },);
      return (holder === undefined) ? [] : [holder.get(label,) ?? '',];
    },)
    .join('\n',);
}

/**
 A slice's window with the definitions of the footnotes the slice cites and
 neither it nor the window defines appended as its last passage.

 @param windowText - neighbouring passages of one side, empty for a lone slice

 @param citingText - the slice itself, on the same side

 @param documentTexts - every slice of that side, in document order

 @returns Window text, followed by the missing definitions when there are any

 @example
 ```ts
 const window = windowWithCitedFootnotes({ windowText, citingText, documentTexts, },);
 ```
 */
export function windowWithCitedFootnotes(
  {
    windowText,
    citingText,
    documentTexts,
  }: {
    readonly windowText: string;
    readonly citingText: string;
    readonly documentTexts: readonly string[];
  },
): string {
  /**
   Definitions the sheet would otherwise miss.
   */
  const notes = citedFootnoteDefinitions({
    citingText,
    shownText: `${citingText}\n\n${windowText}`,
    documentTexts,
  },);
  return [
    windowText,
    notes,
  ]
    .filter(function present(text,): boolean {
      return text !== '';
    },)
    .join('\n\n',);
}

//endregion Cited footnote definitions
