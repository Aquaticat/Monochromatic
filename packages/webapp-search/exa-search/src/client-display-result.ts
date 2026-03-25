// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return, typescript/strict-boolean-expressions, no-magic-numbers, typescript/no-confusing-void-expression, no-shadow, no-warning-comments -- client-side DOM script with untyped external APIs (Exa, Zod, DOM)
import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';
import type {
  ContentsOptions,
  SearchResult,
} from 'exa-js';

import { replicateElementAsContentOf, } from './client-replicate-element.ts';

/** Content options used for search requests requiring text, summary, and highlights. */
type SearchContents = {
  text: true;
  summary: true;
  highlights: true
};

/**
 * Populates a single result article element with data from an Exa search result.
 *
 * @param resultArticles - Live HTMLCollection of result container elements
 *
 * @param result - Exa search result with text, summary, and highlights content
 *
 * @param resultIndex - Zero-based index of this result in the search results array
 */
export function displayResult(
  resultArticles: HTMLCollection,
  result: SearchResult<SearchContents>,
  resultIndex: number,
): void {
  const currentResultArticle = notNullishOrThrow(
    resultArticles[resultIndex],
  );

  const favicon = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLImageElement>('.result__favicon',),
  );
  const link = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLAnchorElement>('.result__link',),
  );
  const publishedDate = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLTimeElement>('.result__publishedDate',),
  );
  const author = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLElement>('.result__author',),
  );
  const summary = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLParagraphElement>('.result__summary',),
  );
  const text = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLParagraphElement>('.result__text',),
  );
  const highlights = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLUListElement>('.result__highlights',),
  );
  const firstHighlight = notNullishOrThrow(
    currentResultArticle.querySelector<HTMLLIElement>('.result__highlight',),
  );
  const image = notNullishOrThrow(
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

  replicateElementAsContentOf(
    firstHighlight,
    highlights,
    result.highlights.length,
  );

  result.highlights.forEach(
    function populateHighlight(
      highlight: string,
      highlightIndex: number,
    ) {
      const currentHighlight = notNullishOrThrow(
        highlights.querySelector<HTMLElement>(`:nth-child(${highlightIndex + 1})`,),
      );
      currentHighlight.textContent = highlight;
    },
  );

  if (result.image)
    image.src = result.image;

  currentResultArticle.removeAttribute('hidden',);
}
