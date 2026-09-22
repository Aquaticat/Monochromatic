import type { ChunkPair, } from '../chunk-document.ts';
import {
  type Signature,
  signaturesOf,
} from './attribution-line.ts';
import {
  carriesHan,
  handleReading,
  withoutGloss,
} from './handle-reading.ts';

//region Contributor name authorities
// WHICH RENDERING A SIGNER TAKES, decided once per page for the contributor
// name restore (`contributor-name-restore.ts`, class sixty-seven): the
// archive's aligned signature where the archive carries it, else the page's
// own aligned signature, else (class eighty-three, XingZ622, 2026-09-22) the
// handle's pinyin reading, since a page rendering that still carries Han is
// no rendering. Every signer takes an authority, headed or not: 雨狸, whom no
// heading names, shipped as "Yu Li" on one song credit and 雨狸 on the next.

/**
 Where a name's rendering comes from.
 */
export type Authority = {
  /**
   Rendering the page uses everywhere.
   */
  readonly rendering: string;

  /**
   What rendered it, as the finding names it.
   */
  readonly origin:
    | 'the archive\'s signature rendering'
    | 'the page\'s signature rendering'
    | 'the pinyin reading of the original\'s handle';
};

/**
 Signature at one position of a text, when that text signs as often as the
 original does; the archive or the page may split or merge a signature line.

 @param text - archive or page text of the slice

 @param at - position among the original's signatures

 @param count - how many signatures the original writes in the slice

 @returns Signatures aligned by position, empty when the counts differ

 @example
 ```ts
 const aligned = alignedSignature({ text, at: 0, count: 1, },);
 ```
 */
function alignedSignature(
  {
    text,
    at,
    count,
  }: {
    readonly text: string;
    readonly at: number;
    readonly count: number;
  },
): readonly Signature[] {
  /**
   Signatures the text writes.
   */
  const signatures = signaturesOf({ text, },);
  if (signatures.length !== count)
    return [];
  return signatures.slice(
    at,
    at + 1,
  );
}

/**
 Authority per name the original signs: the archive's aligned signature,
 else the page's own aligned signature where it renders the name in
 something other than Han, else the handle's pinyin reading (class
 eighty-three).

 @param slices - prepared pairs in slice order

 @param pageText - page text per slice

 @returns Rendering and its origin per original name

 @example
 ```ts
 const authorities = nameAuthorities({ slices, pageText, },);
 ```
 */
export function nameAuthorities(
  {
    slices,
    pageText,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly pageText: ReadonlyMap<number, string>;
  },
): ReadonlyMap<string, Authority> {
  /**
   Authority per name, the first signature's.
   */
  const authorities = new Map<string, Authority>();
  for (const slice of slices) {
    /**
     Signatures the original writes in this slice.
     */
    const signed = signaturesOf({ text: slice.source
      .text, },);
    signed.forEach(function settle(
      signature,
      at,
    ): void {
      /**
       Name as the original signs it.
       */
      const { name, } = signature;
      if (authorities.has(name,))
        return;
      /**
       Archive's rendering at the same position.
       */
      const [archive,] = alignedSignature({
        text: slice.target
          .text,
        at,
        count: signed.length,
      },);
      if (archive !== undefined) {
        authorities.set(
          name,
          {
            rendering: archive.name,
            origin: 'the archive\'s signature rendering',
          },
        );
        return;
      }
      /**
       Page's rendering at the same position, without a gloss it carries.
       */
      const [page,] = alignedSignature({
        text: pageText.get(slice.target
          .sliceIndex,) ?? '',
        at,
        count: signed.length,
      },);
      /**
       Page's rendering as the authority, empty where the page has none at
       this position or left the handle in Han.
       */
      const rendered = (page === undefined) ? '' : withoutGloss({ rendering: page.name, },);
      /**
       Whether the page's rendering stands as the authority.
       */
      const pageRenders = (rendered !== '') && (!carriesHan({ text: rendered, },));
      if (pageRenders) {
        authorities.set(
          name,
          {
            rendering: rendered,
            origin: 'the page\'s signature rendering',
          },
        );
        return;
      }
      authorities.set(
        name,
        {
          rendering: handleReading({ name, },),
          origin: 'the pinyin reading of the original\'s handle',
        },
      );
    },);
  }
  return authorities;
}

//endregion Contributor name authorities
