import {
  type Link,
  linksOf,
} from './page-name-glossary.ts';
import { parseMarkdownBody, } from './parse-mdx.ts';
import type { ProtectedAtom, } from './protected-atom.ts';
import {
  readSliceSkeleton,
  walkAtoms,
} from './translate-skeleton.ts';

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
//
// "STILL CARRIES THE HREF" IS THE DESTINATION FLOOR'S READING (ledger B23):
// the rendering's link destinations, worded or bare, as the slice grammar
// parses them. A raw substring took an address that only begins with the
// href (`windowsill-nap.html2`) for the href kept, and told the model its
// destination was intact when it had changed.
//
// A RENDERING THE STRICT GRAMMAR REFUSES IS READ UNDER PLAIN MARKDOWN, the
// downgrade the page side already takes (`translate-skeleton-page.ts`), and
// never as carrying nothing. Where the original is readable the validator
// refuses such a rendering at its parse anyway. Where the original is refused
// too, the validator runs only the floors that need no grammar and otherwise
// answers unknown, which translate-repair lets stand as written, so a floor
// gone silent there would pass a genuine unwrap. Plain markdown reads no MDX:
// a bare destination inside a raw html block is not a link there, and the
// floor is silent on it, where the old substring reading refused.

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
 Atoms of a rendering: the strict grammar's where it reads the text, plain
 markdown's where it refuses.

 A THROW FROM PLAIN MARKDOWN PROPAGATES. CommonMark reads every input, so a
 throw is an unexpected state rather than a grammar disagreement, which is how
 {@link readSliceSkeleton} treats any error but the grammar's own refusal.

 @param text - rendering to read

 @returns Atoms in document order under the grammar that read the text

 @example
 ```ts
 const atoms = renderingAtoms({ text: candidateText, },);
 ```
 */
function renderingAtoms({ text, }: { readonly text: string; },): readonly ProtectedAtom[] {
  /**
   Rendering's skeleton, or the strict grammar's refusal.
   */
  const read = readSliceSkeleton({ text, },);
  if (read.kind === 'read')
    return read.skeleton
      .atoms;
  return walkAtoms({ root: parseMarkdownBody({ body: text, },), },);
}

/**
 Destinations a text carries as links, worded or bare, as the destination
 floor reads them.

 @param text - rendering to read

 @returns Every link destination the text carries

 @example
 ```ts
 carriedDestinations({ text: 'A nap (https://example.invalid/nap)', },); // Set { 'https://example.invalid/nap' }
 ```
 */
function carriedDestinations({ text, }: { readonly text: string; },): ReadonlySet<string> {
  return new Set(renderingAtoms({ text, },)
    .filter(function isLinkDestination(atom,): boolean {
      return atom.kind === 'link-url';
    },)
    .map(function destinationOf(atom,): string {
      return atom.value;
    },),);
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
  /**
   Destinations the rendering carries, worded or bare.
   */
  const destinations = carriedDestinations({ text: candidateText, },);
  return [...wordedCounts({ text: sourceText, },),]
    .filter(function unwrapped([href, owed,],): boolean {
      return ((rendered.get(href,) ?? 0) < owed) && destinations.has(href,);
    },)
    .map(function finding([href,],): string {
      return `The ORIGINAL links words to ${href} as [words](${href}), but your translation carries that destination without words linked to it. Keep the link: put the rendered words inside the brackets and the destination in the parentheses right after them, as the ORIGINAL does.`;
    },);
}

//endregion Unwrapped link floor
