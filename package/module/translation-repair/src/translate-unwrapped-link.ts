import {
  type Link,
  linksOf,
} from './page-name-glossary.ts';

//region Unwrapped link floor
// THE ONE HUNDRED FIFTEENTH CLASS (yingying10, 2026-09-24). A translate
// candidate rendered the original's linked blog title as plain words with the
// bare destination in parentheses after them, and every floor passed it: the
// destination floor reads a bare URL as an autolink, so the destination
// survived, and the declared link name floor (class one hundred fourteen) is
// silent where the rendering carries no link under the href. It reached the
// slate and drew a ballot. The corpus census at the pin found no archive that
// renders a source's worded link this way (119 of 141 kept under the same
// href, the rest dropped outright, which the destination floor refuses), so
// the floor refuses no archive text.
//
// A WORDED LINK is `[words](href)` whose words are neither empty nor the href
// itself. Where the original carries more worded links under an href than the
// rendering does while the rendering still carries the href, the link was
// unwrapped. Silent where the rendering drops the href outright: that is the
// destination floor's finding, not this one's.

/**
 Whether a link carries words of its own rather than its destination.

 @param link - link as scanned

 @returns True where the link text is neither empty nor the href

 @example
 ```ts
 isWorded({ link: { text: 'A Nap', href: 'https://example.invalid/', }, },); // true
 ```
 */
function isWorded({ link, }: { readonly link: Link; },): boolean {
  /**
   Link text without surrounding space.
   */
  const words = link.text
    .trim();
  /**
   Destination without surrounding space.
   */
  const destination = link.href
    .trim();
  return (words !== '') && (words !== destination);
}

/**
 Worded links of a text counted by href.

 @param text - text to scan

 @returns Count of worded links under each href

 @example
 ```ts
 wordedCounts({ text: '[A Nap](https://example.invalid/)', },);
 ```
 */
function wordedCounts({ text, }: { readonly text: string; },): ReadonlyMap<string, number> {
  return linksOf({ text, },)
    .filter(function worded(link,): boolean {
      return isWorded({ link, },);
    },)
    .reduce(
      function counted(
        counts,
        link,
      ): Map<string, number> {
        return counts.set(
          link.href,
          (counts.get(link.href,) ?? 0) + 1,
        );
      },
      new Map<string, number>(),
    );
}

/**
 Findings for every source href whose worded link the rendering unwrapped
 while keeping the destination.

 @param sourceText - original slice

 @param candidateText - proposed rendering of it

 @returns One finding per unwrapped href, written for the model that wrote
 the rendering

 @example
 ```ts
 const findings = unwrappedLinkFindings({ sourceText, candidateText, },);
 ```
 */
export function unwrappedLinkFindings(
  {
    sourceText,
    candidateText,
  }: {
    readonly sourceText: string;
    readonly candidateText: string;
  },
): readonly string[] {
  /**
   Worded links the rendering carries, by href.
   */
  const rendered = wordedCounts({ text: candidateText, },);
  return [...wordedCounts({ text: sourceText, },),]
    .filter(function unwrapped([href, owed,],): boolean {
      return ((rendered.get(href,) ?? 0) < owed) && candidateText.includes(href,);
    },)
    .map(function finding([href,],): string {
      return `The ORIGINAL links words to ${href} as [words](${href}), but your translation carries that destination without words linked to it. Keep the link: put the rendered words inside the brackets and the destination in the parentheses right after them, as the ORIGINAL does.`;
    },);
}

//endregion Unwrapped link floor
