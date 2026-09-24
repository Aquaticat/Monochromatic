import { nameProjection, } from './declared-name-survival.ts';
import type { DeclaredNamePair, } from './linked-title-declared-name.ts';
import {
  type Link,
  linksOf,
} from './page-name-glossary.ts';

//region Declared link name floor
// THE ONE HUNDRED FOURTEENTH CLASS (yingying9, 2026-09-24). The page-name
// glossary tells every sheet that a declared name inside a linked title takes
// its declared form (class eighty-six), and the bench overruled it: two of
// three translate judges chose the archive's own "Farewell. I miss you,
// Sakura." as "the archive's established rendering for this link text", and
// the repair lane's rewrite to "Yingying" was reverted by an introduced-defect
// probe calling the declared form a change. yingying4 to 8 had written the
// declared form on the judges' own call. A rule the judges read and overrule
// is a floor, the same step classes eighty and ninety-seven took: where the
// original's link text carries a name the front matter declares, the
// rendering's link text under the same href carries the declared form.
//
// COMPARED ON THE NAME PROJECTION (letters and digits, lowercased) that the
// declared-name survival guard uses, so `Mittens'` or an escaped underscore
// is still the name. Silent without declared pairs, where the original's link
// names nobody declared, and where the rendering carries no link under that
// href: a dropped link is the link floor's finding, not this one's.

/**
 One source link naming a declared person, with the pair it names.
 */
type NamingLink = {
  /**
   Link as the original writes it.
   */
  readonly link: Link;

  /**
   Declared pair the link text names.
   */
  readonly pair: DeclaredNamePair;
};

/**
 Source links whose text carries a declared source form, one entry per
 link and pair.

 @param sourceText - original slice

 @param declared - name pairs the front matter declares

 @returns Naming links in source order

 @example
 ```ts
 const naming = namingLinks({ sourceText, declared, },);
 ```
 */
function namingLinks(
  {
    sourceText,
    declared,
  }: {
    readonly sourceText: string;
    readonly declared: readonly DeclaredNamePair[];
  },
): readonly NamingLink[] {
  return linksOf({ text: sourceText, },)
    .flatMap(function named(link,): readonly NamingLink[] {
      return declared
        .filter(function carried(pair,): boolean {
          return link.text
            .includes(pair.source,);
        },)
        .map(function paired(pair,): NamingLink {
          return {
            link,
            pair,
          };
        },);
    },);
}

/**
 Findings for every link the rendering carries under a naming link's href
 without the declared form.

 @param sourceText - original slice

 @param candidateText - proposed rendering of it

 @param declared - name pairs the front matter declares, none when the page
 declares no name on both sides

 @returns One finding per naming link rendered without its declared form,
 written for the model that wrote the rendering

 @example
 ```ts
 const findings = declaredLinkNameFindings({ sourceText, candidateText, declared, },);
 ```
 */
export function declaredLinkNameFindings(
  {
    sourceText,
    candidateText,
    declared,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
    readonly declared: readonly DeclaredNamePair[];
  },
): readonly string[] {
  if (declared.length === 0)
    return [];
  /**
   Links the rendering carries.
   */
  const rendered = linksOf({ text: candidateText, },);
  return namingLinks({
    sourceText,
    declared,
  },)
    .flatMap(function checked(
      {
        link,
        pair,
      },
    ): readonly string[] {
      /**
       Rendered link texts under this href.
       */
      const texts = rendered
        .filter(function sameHref(candidate,): boolean {
          return candidate.href === link.href;
        },)
        .map(function textOf(candidate,): string {
          return candidate.text;
        },);
      /**
       Declared form as the comparison reads it.
       */
      const declaredKey = nameProjection({ text: pair.rendering, },);
      if (
        (texts.length === 0)
        || texts.some(function carriesDeclared(text,): boolean {
          return nameProjection({ text, },)
            .includes(declaredKey,);
        },)
      )
        return [];
      /**
       Rendered link texts as the finding quotes them.
       */
      const quoted = texts.join('", "',);
      return [
        `The link text for ${link.href} names ${pair.source}, whom this page's front matter declares "${pair.rendering}", but your link text "${quoted}" does not carry "${pair.rendering}". A declared name inside a title takes its declared form, whatever the existing translation calls the person there; keep the rest of the title as you rendered it.`,
      ];
    },);
}

//endregion Declared link name floor
