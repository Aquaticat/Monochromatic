// oxlint-disable typescript/strict-boolean-expressions, no-magic-numbers, typescript/no-confusing-void-expression -- DOM string coercions and IIFE-wrapped async handlers
import { prompt, } from '@monochromatic-dev/module-dom/ts/prompt.ts';
import {
  nonNullishOrThrow,
} from '@monochromatic-dev/module-or-throw';

import { displayResult, } from './client-display-result.ts';
import {
  apiKey,
  baseUrl,
  changeApiKeyButton,
  costDollarsSpan,
  numResults,
  numResultsInput,
  numTotalSearches,
  processingParagraph,
  resultArticles,
  resultsSection,
  searchForm,
  searchInput,
} from './client-dom.ts';
import { searchExa, } from './exa-fetch.ts';

searchForm.addEventListener(
  'submit',
  function onSearch(event,) {
    event.preventDefault();
    void (async function onSearchAsync(): Promise<void> {
      try {
        numTotalSearches.value++;
        resultsSection.setAttribute(
          'hidden',
          'true',
        );
        resultsSection.querySelectorAll<HTMLElement>(':scope > *',).forEach(
          function hide(result,) {
            result.setAttribute(
              'hidden',
              'true',
            );
          },
        );

        processingParagraph.removeAttribute('hidden',);

        const results = await searchExa({
          apiKey: apiKey.value,
          baseUrl,
          query: searchInput.value.trim(),
          options: {
            type: 'auto',
            numResults: numResults.value,
            contents: {
              text: true,
              summary: true,
              subpages: 1,
              extras: {
                links: 1,
                imageLinks: 1,
              },
              highlights: true,
            },
          },
        },);

        processingParagraph.setAttribute(
          'hidden',
          'true',
        );

        costDollarsSpan.textContent = String(results.costDollars?.total ?? 0,);

        results.results.forEach(function forEachResult(
          result,
          resultIndex,
        ) {
          displayResult({
            resultArticles,
            result,
            resultIndex,
          },);
        },);

        resultsSection.removeAttribute('hidden',);
      }
      catch (error: unknown) {
        console.error(
          'search failed',
          error,
        );
      }
    })();
  },
);

changeApiKeyButton.addEventListener(
  'click',
  function onChangeApiKey() {
    void (async function promptForNewApiKey(): Promise<void> {
      try {
        const inputApiKey = nonNullishOrThrow(await prompt({ message: 'Change api key', },),);
        apiKey.value = inputApiKey;
      }
      catch (error: unknown) {
        console.error(
          'api key change failed',
          error,
        );
      }
    })();
  },
);

numResultsInput.addEventListener(
  'input',
  function setNewNumResults() {
    numResults.value = Number(numResultsInput.value,);
  },
);

export {};
