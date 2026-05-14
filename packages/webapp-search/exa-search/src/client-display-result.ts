// oxlint-disable typescript/strict-boolean-expressions, no-magic-numbers, no-shadow -- DOM string coercions and template-cloning indices
import {
  nonNullishOrThrow,
} from '@monochromatic-dev/module-or-throw';

import { replicateElementAsContentOf, } from './client-replicate-element.ts';
import type { ExaSearchResult, } from './exa-fetch.ts';

/**
 * Populates a single result article element with data from an Exa search result.
 *
 * @param resultArticles - Live HTMLCollection of result container elements
 *
 * @param result - Exa search result with text, summary, and highlights content
 *
 * @param resultIndex - Zero-based index of this result in the search results array
 *
 * @example
 * ```ts
 * displayResult({ resultArticles, result, resultIndex: 0 });
 * ```
 */
export function displayResult({
  resultArticles,
  result,
  resultIndex,
}: {
  resultArticles: HTMLCollection;
  result: ExaSearchResult;
  resultIndex: number;
},): void {
  const currentResultArticle = nonNullishOrThrow(
    resultArticles[resultIndex],
  );

  const favicon = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLImageElement>('.result__favicon',),
  );
  const link = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLAnchorElement>('.result__link',),
  );
  const publishedDate = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLTimeElement>('.result__publishedDate',),
  );
  const author = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLElement>('.result__author',),
  );
  const summary = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLParagraphElement>('.result__summary',),
  );
  const text = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLParagraphElement>('.result__text',),
  );
  const highlights = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLUListElement>('.result__highlights',),
  );
  const firstHighlight = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLLIElement>('.result__highlight',),
  );
  const image = nonNullishOrThrow(
    currentResultArticle.querySelector<HTMLImageElement>('.result__image',),
  );

  if (result.favicon)
    favicon.src = result.favicon;

  link.href = result.url;
  link.textContent = result.title;

  if (result.publishedDate) {
    publishedDate.dateTime = result.publishedDate;
    publishedDate.textContent = result.publishedDate;
  }

  if (result.author)
    author.textContent = result.author;

  summary.textContent = result.summary;
  text.textContent = result.text;

  replicateElementAsContentOf({
    templateElement: firstHighlight,
    parentElement: highlights,
    targetCount: result.highlights.length,
  },);

  result.highlights.forEach(
    function populateHighlight(
      highlight: string,
      highlightIndex: number,
    ) {
      const currentHighlight = nonNullishOrThrow(
        highlights.querySelector<HTMLElement>(`:nth-child(${highlightIndex + 1})`,),
      );
      currentHighlight.textContent = highlight;
    },
  );

  if (result.image)
    image.src = result.image;

  currentResultArticle.removeAttribute('hidden',);
}
