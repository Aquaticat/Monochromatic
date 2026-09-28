import { inlineContainerTags, } from './inline-container-tags.ts';

//region Lone container tag masking
// A container's opening tag is owned by the first block inside it and its
// closing tag by the last (`container-extents.ts`), so a container whose
// blocks fall in different slices puts `<details>` alone at the head of one
// slice and `</details>` alone at the foot of another. The document reader
// sees both and parses; a slice reader handed one half sees an end-tag
// mismatch or an unexpected closing slash and refuses, and both gates that
// consume the slice floor treat a refusal as inadmissible. That stopped the
// Huasheng pass of 2026-09-07 at slices 9 and 12, the class-five pattern for
// containers: 30 of the pinned corpus's pages carry a disclosure element.
//
// Masking a lone tag to same-length whitespace lets the strict grammar read
// the rest of the slice as the document reader did, and reporting the tag lets
// the slice skeleton carry it as an atom, so a candidate that drops the tag
// fails the floor deterministically rather than at the page grammar.

/**
 One container tag standing without its partner inside a slice.
 
 @example
 ```ts
 const tag: LoneContainerTag = { kind: 'close', name: 'details', text: '</details>', };
 ```
 */
export type LoneContainerTag = {
  /**
   Whether the tag opens or closes its element.
   */
  readonly kind: 'open' | 'close';

  /**
   Element name as written.
   */
  readonly name: string;

  /**
   Tag exactly as the slice writes it.
   */
  readonly text: string;
};

/**
 One tag line found while scanning, before pairing.
 */
type TagLine = LoneContainerTag & {
  /**
   Offset of the tag's first character.
   */
  readonly startOffset: number;

  /**
   Exclusive offset past the tag's last character.
   */
  readonly endOffset: number;
};

/**
 One tag the pairing reads: a whole tag line, carried so it can be masked,
 or an opener or closer inside another line, which only partners one.
 */
type PairingTag = Readonly<{
  /**
   Whether the tag opens or closes its element.
   */
  kind: 'open' | 'close';

  /**
   Element name as written.
   */
  name: string;

  /**
   Offset of the tag's first character.
   */
  startOffset: number;

  /**
   The tag line itself, absent for an inline tag.
   */
  line?: TagLine;
}>;

/**
 Whether a character can start an element name.
 
 @param character - character after `<` or `</`
 
 @returns Whether it is an ASCII letter
 
 @example
 ```ts
 startsName({ character: 'd', },);
 ```
 */
function startsName({ character, }: { readonly character: string; },): boolean {
  /**
   Whether it is an ASCII lower-case letter.
   */
  const lower = (character >= 'a') && (character <= 'z');

  /**
   Whether it is an ASCII upper-case letter.
   */
  const upper = (character >= 'A') && (character <= 'Z');

  return lower || upper;
}

/**
 Reads one line as a container tag when the line is nothing but one tag.
 
 A line holding an opening tag with attributes counts; a self-closing tag,
 a comment, a line holding a whole element or any other text does not.
 
 @param line - line without its newline
 
 @param lineStart - offset of the line's first character
 
 @returns Tag on that line as a one-element list, or an empty one
 
 @example
 ```ts
 tagOnLine({ line: '</details>', lineStart: 120, },);
 ```
 */
function tagOnLine(
  {
    line,
    lineStart,
  }: {
    readonly line: string;
    readonly lineStart: number;
  },
): readonly TagLine[] {
  /**
   Line without trailing whitespace, which the corpus leaves on lines freely.
   */
  const trimmed = line.trimEnd();

  /**
   Whether the line is bracketed like a tag.
   */
  const bracketed = trimmed.startsWith('<',) && trimmed.endsWith('>',);

  /**
   Whether the tag closes itself, as `<br/>` and a component do.
   */
  const selfClosing = trimmed.endsWith('/>',);
  if (!bracketed)
    return [];
  if (selfClosing)
    return [];

  /**
   Text between the angle brackets.
   */
  const inner = trimmed.slice(
    1,
    -1,
  );
  if (inner.includes('<',) || inner.includes('>',))
    return [];

  /**
   Whether the tag closes its element.
   */
  const closes = inner.startsWith('/',);

  /**
   Text after the closing slash, or the whole inner text for an opener.
   */
  const body = closes ? inner.slice(1,) : inner;
  if (!startsName({ character: body.charAt(0,), },))
    return [];

  /**
   Where the name ends: at the first space, or the end.
   */
  const nameEnd = body.includes(' ',) ? body.indexOf(' ',) : body.length;

  /**
   Element name as written.
   */
  const name = body.slice(
    0,
    nameEnd,
  );
  if (closes && (name !== body))
    return [];

  return [{
    kind: closes ? 'close' : 'open',
    name,
    text: trimmed,
    startOffset: lineStart,
    endOffset: lineStart + trimmed.length,
  },];
}

/**
 Tag lines of a text in document order.
 
 @param text - slice to scan
 
 @returns Every line that is exactly one tag
 
 @example
 ```ts
 const lines = tagLinesOf({ text, },);
 ```
 */
function tagLinesOf({ text, }: { readonly text: string; },): readonly TagLine[] {
  /**
   Tag lines found so far.
   */
  const found: TagLine[] = [];
  for (let lineStart = 0; lineStart <= text.length;) {
    /**
     Offset of the newline ending this line, or the text's end.
     */
    const newlineAt = text.indexOf(
      '\n',
      lineStart,
    );

    /**
     Exclusive end of this line's content.
     */
    const lineEnd = (newlineAt === (-1)) ? text.length : newlineAt;

    found.push(...tagOnLine({
      line: text.slice(
        lineStart,
        lineEnd,
      ),
      lineStart,
    },),);
    if (newlineAt === (-1))
      break;
    lineStart = newlineAt + 1;
  }
  return found;
}

/**
 Tag lines left without a partner once openers and closers of one name pair
 up innermost first.
 
 @param lines - tag lines in document order
 
 @returns Unpaired tag lines in document order
 
 @example
 ```ts
 const lone = unpairedOf({ lines, },);
 ```
 */
function unpairedOf<const TagT extends Pick<TagLine, 'kind' | 'name' | 'startOffset'>,>(
  { lines, }: { readonly lines: readonly TagT[]; },
): readonly TagT[] {
  /**
   Openers not yet closed, innermost last.
   */
  const open: TagT[] = [];

  /**
   Closers with no opener before them.
   */
  const strayClosers: TagT[] = [];
  for (const line of lines) {
    if (line.kind === 'open') {
      open.push(line,);
      continue;
    }

    /**
     Index of the innermost opener of the same name, or -1.
     */
    const partner = open.findLastIndex(function sameName(candidate,): boolean {
      return candidate.name === line.name;
    },);
    if (partner === (-1)) {
      strayClosers.push(line,);
      continue;
    }
    open.splice(
      partner,
      1,
    );
  }
  return [
    ...open,
    ...strayClosers,
  ].toSorted(function byOffset(
    left,
    right,
  ): number {
    return left.startOffset - right.startOffset;
  },);
}

/**
 Masks every container tag standing without its partner to same-length
 whitespace and reports each one.
 
 @param text - slice, comments already masked
 
 @returns Masked slice and the lone tags in document order
 
 @example
 ```ts
 const { masked, tags, } = maskLoneContainerTags({ text: slice, },);
 ```
 */
export function maskLoneContainerTags(
  { text, }: { readonly text: string; },
): {
  readonly masked: string;
  readonly tags: readonly LoneContainerTag[];
} {
  /**
   Lines that are one container tag and nothing else, the only ones masked.
   */
  const lines = tagLinesOf({ text, },);
  /**
   Openers and closers of those names inside other lines, which partner a
   tag line as surely as another tag line does (ledger X10).
   */
  const inline = inlineContainerTags({
    text,
    names: new Set(lines.map(function nameOf({ name, },): string {
      return name;
    },),),
    covered: lines.map(function rangeOf({
      startOffset,
      endOffset,
    },): readonly [
      number,
      number,
    ] {
      return [
        startOffset,
        endOffset,
      ] as const;
    },),
  },);
  /**
   Every tag the pairing reads, in document order: the tag lines, each
   carrying itself so an unpaired one can be masked, and the inline tags,
   which only partner one.
   */
  const pairing: readonly PairingTag[] = [
    ...lines.map(function asPairing(line,): PairingTag {
      return {
        kind: line.kind,
        name: line.name,
        startOffset: line.startOffset,
        line,
      };
    },),
    ...inline,
  ].toSorted(function byOffset(
    left: PairingTag,
    right: PairingTag,
  ): number {
    return left.startOffset - right.startOffset;
  },);
  /**
   Tag lines with no partner anywhere in this slice.
   */
  const lone = unpairedOf({ lines: pairing, },)
    .flatMap(function tagLineOf({ line, },): readonly TagLine[] {
      return (line === undefined) ? [] : [line,];
    },);
  if (lone.length === 0)
    return {
      masked: text,
      tags: [],
    };

  /**
   Slice with each lone tag blanked, built from the pieces between them.
   */
  const masked = (function blank(): string {
    /**
     Kept and blanked pieces in source order.
     */
    const parts: string[] = [];

    /**
     Scan position; everything before it is already in parts.
     */
    let cursor = 0;
    for (const tag of lone) {
      parts.push(
        text.slice(
          cursor,
          tag.startOffset,
        ),
        ' '.repeat(tag.endOffset - tag.startOffset,),
      );
      cursor = tag.endOffset;
    }
    parts.push(text.slice(cursor,),);
    return parts.join('',);
  })();

  return {
    masked,
    tags: lone.map(function toTag(tag,): LoneContainerTag {
      return {
        kind: tag.kind,
        name: tag.name,
        text: tag.text,
      };
    },),
  };
}

//endregion Lone container tag masking
