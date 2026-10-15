import { isAsciiAlphanumeric, } from './ascii-letters.ts';
import { rememberedViewOf, } from './consistency-prose-text.ts';
import { transparentUnitsOf, } from './consistency-unread-units.ts';

//region Consistency shown kinds
// WHAT EACH UNIT OF AN ENGLISH IS TO A READER AT A SPAN EDGE: shown, hidden or a boundary (n160, Y2). The word test of a span edge
// (`cutsShownWord`, `consistency-shown-edge.ts`) steps over the units that show a reader nothing, so that `kit*tens*`,
// `[kit](u)tens` and `<b>kit</b>tens` read as the one word they show. That is right for markup that wraps text. It is wrong for
// markup that separates or annotates: a line break (`<br>`, `<br/>`, `<br />` alike), a block tag, a table cell's pipes and padding,
// an image, and the `<rt>` and `<rp>` of a ruby annotation each stand between two words a reader sees apart, so the words on either
// side are not one word, and a place beside them is a whole word at that edge. Those units are told apart here as a boundary: the word
// test reads each as a space. A tag that only wraps text (`b`, `i`, `em`, `strong`, `span`, `a`, `u`, `s`, `sub`, `sup` and the like)
// stays hidden. A repeated phrase left uncarried beside a boundary was the harm, never a half word.
//
// THE BLOCK TAG LIST IS THE PARSER'S OWN. The Markdown parser of the page (`remark-parse` over `micromark`) keeps the CommonMark
// list of HTML block names, `htmlBlockNames` in `micromark-util-html-tag-name@2.0.1` (`index.js`, lines 16 to 79). That package is not
// a dependency of this one and its list is not reachable from here, so the names are written out in `BOUNDARY_TAG_NAMES`, and
// `consistency-shown-kinds.unit.test.ts` reads the parser's installed list and fails when a name it holds is missing here. `br`,
// `hr`, `img`, `rt` and `rp` are the separating and annotating tags the list does not hold.

/**
 What a unit of an English is to a reader at the edge of a span.

 `shown` is a character the reader sees, `hidden` shows nothing between two pieces of one word, and `boundary` is markup that
 separates or annotates, read as a space.
 */
export type UnitKind = 'boundary' | 'hidden' | 'shown';

/**
 The tags that separate or annotate, lower case: the CommonMark HTML block names the parser keeps, and the line break, the rule, the
 image and the two ruby annotation tags.
 */
export const BOUNDARY_TAG_NAMES: ReadonlySet<string> = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'br',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'img',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'rp',
  'rt',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul',
],);

/**
 The characters of a table row that are written between the cells and show a reader the edge of a cell.
 */
const TABLE_EDGE_CHARACTERS: ReadonlySet<string> = new Set([
  '|',
  ' ',
  '\t',
],);

/**
 How many units a tag is read over before it is taken for no tag, so that a stray `<` is never read to the end of the English.
 */
const TAG_LONGEST = 4_096;

/**
 A tag found in an English.
 */
type FoundTag = {
  /**
   The tag's name in lower case.
   */
  readonly name: string;

  /**
   Exclusive offset where the tag ends.
   */
  readonly end: number;
};

/**
 Where a tag's search for its `>` stopped.
 */
type TagClosing = {
  /**
   Exclusive offset past the `>`, or the offset the search gave up at.
   */
  readonly end: number;

  /**
   Whether a `>` outside a quoted value was found.
   */
  readonly closed: boolean;
};

/**
 Where a run of letters and digits that starts at an offset ends.

 @param english - the English

 @param from - offset of the first unit of the run

 @returns The exclusive offset where the run ends, which is `from` for an empty run

 @example
 ```ts
 const end = nameEndOf({ english: '<br/>', from: 1, },); // 3
 ```
 */
function nameEndOf(
  {
    english,
    from,
  }: {
    readonly english: string;
    readonly from: number;
  },
): number {
  /**
   The offset past the run so far.
   */
  let end = from;
  while (isAsciiAlphanumeric({ character: english.charAt(end,), },))
    end += 1;
  return end;
}

/**
 Where a tag whose name ended at an offset ends: the first `>` outside a quoted attribute value, within the length a tag is read over.

 @param english - the English

 @param from - offset past the tag's name

 @param limit - exclusive offset past which no tag is read

 @returns The exclusive offset past the `>`, or the offset it gave up at, with whether a `>` was found

 @example
 ```ts
 const { end, } = tagEndOf({ english: 'a<br/>b', from: 3, limit: 6, },); // 6
 ```
 */
function tagEndOf(
  {
    english,
    from,
    limit,
  }: {
    readonly english: string;
    readonly from: number;
    readonly limit: number;
  },
): TagClosing {
  for (let cursor = from; cursor < limit; cursor += 1) {
    /**
     The unit at the cursor.
     */
    const character = english.charAt(cursor,);
    if (character === '>') {
      return {
        end: cursor + 1,
        closed: true,
      };
    }
    if ((character === '"') || (character === '\'')) {
      /**
       Offset of the quote mark that closes the value, none where it never closes.
       */
      const close = english.indexOf(
        character,
        cursor + 1,
      );
      if ((close === (-1)) || (close >= limit)) {
        return {
          end: limit,
          closed: false,
        };
      }
      cursor = close;
    }
  }
  return {
    end: limit,
    closed: false,
  };
}

/**
 The tag that starts at an offset, none when the units after the `<` are no tag within the length a tag is read over.

 @param english - the English

 @param at - offset of the `<`

 @returns The tag as a list of zero or one

 @example
 ```ts
 const [tag,] = tagAt({ english: 'cats<br/>dogs', at: 4, },); // { name: 'br', end: 9 }
 ```
 */
function tagAt(
  {
    english,
    at,
  }: {
    readonly english: string;
    readonly at: number;
  },
): readonly FoundTag[] {
  /**
   Offset of the first unit of the name, past a `/` of a closing tag.
   */
  const nameStart = (english.charAt(at + 1,) === '/') ? at + 2 : at + 1;
  /**
   Offset past the last unit of the name.
   */
  const nameEnd = nameEndOf({
    english,
    from: nameStart,
  },);
  if (nameEnd === nameStart)
    return [];
  /**
   Where the tag closes.
   */
  const closing = tagEndOf({
    english,
    from: nameEnd,
    limit: Math.min(
      english.length,
      at + TAG_LONGEST,
    ),
  },);
  return closing.closed
    ? [
      {
        name: english.slice(
          nameStart,
          nameEnd,
        )
          .toLowerCase(),
        end: closing.end,
      },
    ]
    : [];
}

/**
 Marks the units of a stretch that are of a kind as another kind.

 @param kinds - the kinds, mutated in place

 @param from - offset where the stretch starts

 @param to - exclusive offset where it ends

 @param was - kind the unit has to have to change

 @param becomes - kind it changes to

 @param only - characters the unit must be one of, any where absent

 @param english - the English, which `only` reads the characters of

 @example
 ```ts
 retype({ kinds, from: 0, to: 5, was: 'hidden', becomes: 'boundary', },);
 ```
 */
function retype(
  {
    kinds,
    from,
    to,
    was,
    becomes,
    only,
    english = '',
  }: {
    readonly kinds: UnitKind[];
    readonly from: number;
    readonly to: number;
    readonly was: UnitKind;
    readonly becomes: UnitKind;
    readonly only?: ReadonlySet<string>;
    readonly english?: string;
  },
): void {
  for (let at = from; at < to; at += 1) {
    if (kinds[at] !== was)
      continue;
    if ((only === undefined) || only.has(english.charAt(at,),))
      kinds[at] = becomes;
  }
}

/**
 The kind of every unit of an English at the edge of a span.

 @param english - the English of a slice

 @param definitions - the page's definitions (`pageDefinitionsOf`), none for an English read alone

 @returns One kind per UTF-16 unit: `hidden` where `transparentUnitsOf` says the unit shows nothing and the unit separates nothing,
 `boundary` for the units of an image, of a tag that separates or annotates and of the pipes and padding of a table row, `shown`
 elsewhere

 @example
 ```ts
 const kinds = unitKindsOf({ english: 'cats<br/>dogs', },); // 'shown' x4, 'boundary' x5, 'shown' x4
 ```
 */
export function unitKindsOf(
  {
    english,
    definitions = '',
  }: {
    readonly english: string;
    readonly definitions?: string;
  },
): readonly UnitKind[] {
  /**
   Which units show a reader nothing between two pieces of one word.
   */
  const hidden = transparentUnitsOf({
    english,
    definitions,
  },);
  /**
   The kinds, mutated only inside this function.
   */
  const kinds: UnitKind[] = hidden.map(function kindOf(isHidden,): UnitKind {
    return isHidden ? 'hidden' : 'shown';
  },);
  /**
   What the parse made of the English.
   */
  const view = rememberedViewOf({
    english,
    definitions,
  },);
  if (view.refused)
    return kinds;
  for (const range of view.images) {
    retype({
      kinds,
      from: range.start,
      to: range.end,
      was: 'hidden',
      becomes: 'boundary',
    },);
  }
  for (const range of view.tableRows) {
    retype({
      kinds,
      from: range.start,
      to: range.end,
      was: 'hidden',
      becomes: 'boundary',
      only: TABLE_EDGE_CHARACTERS,
      english,
    },);
  }
  for (let at = 0; at < english.length; at += 1) {
    if (english.charAt(at,) !== '<')
      continue;
    if (kinds[at] !== 'hidden')
      continue;
    /**
     The tag that starts here, none when the units are no tag.
     */
    const [tag,] = tagAt({
      english,
      at,
    },);
    if (tag === undefined)
      continue;
    if (BOUNDARY_TAG_NAMES.has(tag.name,)) {
      retype({
        kinds,
        from: at,
        to: tag.end,
        was: 'hidden',
        becomes: 'boundary',
      },);
    }
    // Past the tag, so a `<` inside its attributes is never read as a tag of its own.
    at = tag.end - 1;
  }
  return kinds;
}

//endregion Consistency shown kinds
