import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import {
  colonAt,
  isHeadingLine,
  lastColonAt,
  pageTextBySlice,
  slicesInOrder,
  splitHeading,
  withRewrittenText,
} from './assembly-page-text.ts';
import {
  readSignature,
  type Signature,
  signaturesOf,
} from './attribution-line.ts';
import {
  type Authority,
  nameAuthorities,
} from './contributor-name-authorities.ts';
import { carriesRendering, } from './handle-reading.ts';

//region Contributor name restore
// CLASS SIXTY-SEVEN (XingZ616, 2026-09-19). A contributor's name in a section
// heading (`其三：绘都`) was translated word for word ("Painted Capital") while
// the archive renders the same person's signature as the handle the human
// translator knew ("HiYku"), and one lane respelt the archive's handle in the
// signature itself ("Huidu"). Each slice's judges saw one heading or one
// signature; none saw that the two name one person. THE PAGE DECIDES ONCE,
// HERE: a name the original both heads a section with and signs is a person,
// and the page renders it one way everywhere. The archive's signature
// rendering is the authority where the archive carries the signature; else
// the page's own signature rendering; a name with neither stays as rendered.
// The archive's own text is never rewritten: only slices a lane replaced.
//
// CLASS EIGHTY-THREE (XingZ622, 2026-09-22). EVERY SIGNER, HEADED OR NOT,
// AND A HANDLE LEFT IN HAN READ AS PINYIN. 锦心 shipped as 锦心 in the Part
// Ten heading and signature (the slate chose "keeps the original form, no
// declared English" over the lane's "Jinxin", and this pass then wrote the
// signature's Han into the heading), and 雨狸, whom no heading names, shipped
// as "Yu Li" on one song credit and 雨狸 on the next. Owner, 2026-09-22:
// pinyin as one capitalised word, the literal meaning in parentheses. So
// every signer takes an authority, not only the headed ones, and a page
// rendering that still carries Han is no rendering, the handle's own
// reading standing in its place (`contributor-name-authorities.ts`,
// `handle-reading.ts`); and a heading or signature carrying the rendering
// with its gloss in parentheses is left as it is, since the gloss belongs
// at the first appearance.

/**
 What a page line becomes under the authority: rewritten, or left alone.
 */
type LineRestoration =
  | {
    readonly rewritten: true;

    /**
     Line as the page will carry it.
     */
    readonly after: string;

    /**
     Kind of line, for the finding.
     */
    readonly where: 'a heading' | 'a signature';

    /**
     Whose rendering was written.
     */
    readonly origin: Authority['origin'];
  }
  | { readonly rewritten: false; };

/**
 A line left as it is.
 */
const UNCHANGED: LineRestoration = { rewritten: false, };

/**
 Heading titles of one text, in line order.

 @param text - one slice's text

 @returns Title per heading line

 @example
 ```ts
 const titles = headingTitles({ text, },);
 ```
 */
function headingTitles({ text, }: { readonly text: string; },): readonly string[] {
  return text.split('\n',)
    .filter(function heading(line,): boolean {
      return isHeadingLine({ line, },);
    },)
    .map(function titleOf(line,): string {
      /**
       Title of the heading.
       */
      const { title, } = splitHeading({ line, },);
      return title;
    },);
}

/**
 Whether a heading title names a contributor: it is the name, or ends with
 a colon and the name.

 @param title - original heading title

 @param name - name as the original signs it

 @returns True when the heading is this contributor's

 @example
 ```ts
 titleNames({ title: '其三：猫猫', name: '猫猫', },); // true
 ```
 */
function titleNames(
  {
    title,
    name,
  }: {
    readonly title: string;
    readonly name: string;
  },
): boolean {
  if (title === name)
    return true;
  /**
   Where the title's colon stands, -1 for none.
   */
  const colon = colonAt({ title, },);
  if (colon === (-1))
    return false;
  /**
   Title after its colon.
   */
  const rest = title.slice(colon + 1,)
    .trim();
  return rest === name;
}

/**
 Restores a contributor's rendering into a page heading.

 @param line - page heading line

 @param title - original title at the same heading position

 @param authorities - rendering per original name

 @returns The heading rewritten, or left alone

 @example
 ```ts
 const restored = restoreHeading({ line, title, authorities, },);
 ```
 */
function restoreHeading(
  {
    line,
    title,
    authorities,
  }: {
    readonly line: string;
    readonly title: string;
    readonly authorities: ReadonlyMap<string, Authority>;
  },
): LineRestoration {
  /**
   Contributor the original heading names, if any.
   */
  const named = [...authorities.entries(),].find(function names([name,],): boolean {
    return titleNames({
      title,
      name,
    },);
  },);
  if (named === undefined)
    return UNCHANGED;
  /**
   That contributor's authority.
   */
  const [, authority,] = named;
  /**
   Marks and title as the page wrote them.
   */
  const page = splitHeading({ line, },);
  /**
   Where the page title's last colon stands, kept with its prefix when the
   original heading also carries one; -1 to write the rendering alone.
   */
  const colon = (colonAt({ title, },) === (-1)) ? -1 : lastColonAt({ title: page.title, },);
  /**
   Page title as written.
   */
  const { title: pageTitle, } = page;
  /**
   Page title's prefix through its colon, empty when there is none.
   */
  const prefix = (colon === (-1)) ? '' : `${pageTitle.slice(
    0,
    colon + 1,
  )} `;
  /**
   Prefix as it stands in the title, without the space the rewrite adds.
   */
  const bare = prefix.trimEnd();
  /**
   Name as the page wrote it after the prefix, which may carry its gloss.
   */
  const written = pageTitle.slice(bare.length,)
    .trim();
  if (carriesRendering({
    written,
    rendering: authority.rendering,
  },))
    return UNCHANGED;
  /**
   Heading as the page will carry it.
   */
  const after = `${page.marks} ${prefix}${authority.rendering}`;
  return (after === line) ? UNCHANGED : {
    rewritten: true,
    after,
    where: 'a heading',
    origin: authority.origin,
  };
}

/**
 Restores a contributor's rendering into a page signature.

 @param line - page signature line

 @param signature - where the page's name stands on the line

 @param authority - rendering the original's signer takes

 @returns The signature rewritten, or left alone

 @example
 ```ts
 const restored = restoreSignature({ line, signature, authority, },);
 ```
 */
function restoreSignature(
  {
    line,
    signature,
    authority,
  }: {
    readonly line: string;
    readonly signature: Signature;
    readonly authority: Authority;
  },
): LineRestoration {
  if (carriesRendering({
    written: signature.name,
    rendering: authority.rendering,
  },))
    return UNCHANGED;
  /**
   Line as the page will carry it.
   */
  const after = `${line.slice(
    0,
    signature.nameStart,
  )}${authority.rendering}${line.slice(signature.nameEnd,)}`;
  return (after === line) ? UNCHANGED : {
    rewritten: true,
    after,
    where: 'a signature',
    origin: authority.origin,
  };
}

/**
 Restores every contributor name in one replaced slice.

 @param slice - prepared pair

 @param text - page text of the slice

 @param authorities - rendering per original name

 @returns Lines as the page will carry them, and one finding per rewrite

 @example
 ```ts
 const restored = restoreSlice({ slice, text, authorities, },);
 ```
 */
function restoreSlice(
  {
    slice,
    text,
    authorities,
  }: {
    readonly slice: ChunkPair;
    readonly text: string;
    readonly authorities: ReadonlyMap<string, Authority>;
  },
): {
  readonly lines: readonly string[];
  readonly findings: readonly string[];
} {
  /**
   Index of this slice.
   */
  const { sliceIndex, } = slice.target;
  /**
   Original text of this slice.
   */
  const source = slice.source
    .text;
  /**
   Original heading titles here, by heading position.
   */
  const titles = headingTitles({ text: source, },);
  /**
   Original signatures here, by signature position.
   */
  const signed = signaturesOf({ text: source, },);
  /**
   Signatures the page writes here.
   */
  const paged = signaturesOf({ text, },);
  /**
   Whether the page signs as often as the original here.
   */
  const aligned = paged.length === signed.length;
  /**
   One finding per rewritten line.
   */
  const findings: string[] = [];
  /**
   Positions met so far: headings, then signatures.
   */
  const met = {
    headings: 0,
    signatures: 0,
  };
  /**
   Lines as the page will carry them.
   */
  const lines = text.split('\n',)
    .map(function restoreLine(line,): string {
      /**
       What the line becomes.
       */
      const restoration = restoreOne({
        line,
        titles,
        signed,
        aligned,
        authorities,
        met,
      },);
      if (!restoration.rewritten)
        return line;
      findings.push(
        `contributor-name-restored (slice ${String(sliceIndex,)}: "${line.trim()}" to "${restoration.after
          .trim()}" in ${restoration.where}; ${restoration.origin})`,
      );
      return restoration.after;
    },);
  return {
    lines,
    findings,
  };
}

/**
 Restores one page line, counting the heading or signature position it
 stands at.

 @param line - page line

 @param titles - original heading titles of the slice

 @param signed - original signatures of the slice

 @param aligned - whether the page signs as often as the original here

 @param authorities - rendering per original name

 @param met - positions met so far, advanced here

 @returns What the line becomes

 @example
 ```ts
 const restoration = restoreOne({ line, titles, signed, aligned, authorities, met, },);
 ```
 */
function restoreOne(
  {
    line,
    titles,
    signed,
    aligned,
    authorities,
    met,
  }: {
    readonly line: string;
    readonly titles: readonly string[];
    readonly signed: readonly Signature[];
    readonly aligned: boolean;
    readonly authorities: ReadonlyMap<string, Authority>;
    readonly met: {
      headings: number;
      signatures: number;
    };
  },
): LineRestoration {
  if (isHeadingLine({ line, },)) {
    /**
     Original title at this heading position.
     */
    const title = titles[met.headings];
    met.headings += 1;
    return (title === undefined) ? UNCHANGED : restoreHeading({
      line,
      title,
      authorities,
    },);
  }
  /**
   What the line says as a signature.
   */
  const reading = readSignature({ line, },);
  if (!reading.signed)
    return UNCHANGED;
  /**
   Original signature at this position.
   */
  const original = aligned ? signed[met.signatures] : undefined;
  met.signatures += 1;
  /**
   Authority of the original's signer, if any.
   */
  const authority = (original === undefined) ? undefined : authorities.get(original.name,);
  return (authority === undefined) ? UNCHANGED : restoreSignature({
    line,
    signature: reading.signature,
    authority,
  },);
}

/**
 Renders every heading and signature naming a contributor the same way.

 @param slices - prepared pairs, whose original names the contributors

 @param replacements - what the page would write per slice

 @returns Replacements with the names restored, the rewritten rows alone,
 and one finding per rewritten line

 @example
 ```ts
 const named = restoreContributorNames({ slices, replacements, },);
 ```
 */
export function restoreContributorNames(
  {
    slices,
    replacements,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): {
  readonly replacements: readonly SliceReplacement[];
  readonly restored: readonly SliceReplacement[];
  readonly findings: readonly string[];
} {
  /**
   Slices in order.
   */
  const ordered = slicesInOrder({ slices, },);
  /**
   Page text per slice.
   */
  const pageText = pageTextBySlice({
    slices,
    replacements,
  },);
  /**
   Rendering per original name.
   */
  const authorities = nameAuthorities({
    slices: ordered,
    pageText,
  },);
  /**
   Slices a lane replaced; the archive's own text stays as it is.
   */
  const replaced = new Set(replacements.map(function indexOf(replacement,): number {
    return replacement.sliceIndex;
  },),);
  /**
   Page text per rewritten slice.
   */
  const rewritten = new Map<number, string>();
  /**
   One finding per rewritten line.
   */
  const findings: string[] = [];
  for (const slice of ordered) {
    /**
     Index of this slice.
     */
    const { sliceIndex, } = slice.target;
    if (!replaced.has(sliceIndex,))
      continue;
    /**
     The slice restored.
     */
    const restored = restoreSlice({
      slice,
      text: pageText.get(sliceIndex,) ?? '',
      authorities,
    },);
    /**
     What the restoration found.
     */
    const { findings: found, } = restored;
    if (found.length === 0)
      continue;
    findings.push(...found,);
    rewritten.set(
      sliceIndex,
      restored.lines
        .join('\n',),
    );
  }
  return {
    ...withRewrittenText({
      replacements,
      rewritten,
    },),
    findings,
  };
}

//endregion Contributor name restore
