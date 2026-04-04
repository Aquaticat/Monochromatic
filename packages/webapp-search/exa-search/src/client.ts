// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return, typescript/strict-boolean-expressions, no-magic-numbers, typescript/no-confusing-void-expression, no-shadow, no-warning-comments -- client-side DOM script with untyped external APIs (Exa, Zod, DOM)
import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { prompt, } from '@monochromatic-dev/module-dom/ts/prompt.ts';
import { Exa, } from 'exa-js';

import { displayResult, } from './client-display-result.ts';
import {
  baseUrl,
  changeApiKeyButton,
  costDollarsSpan,
  exa,
  numResults,
  numResultsInput,
  numTotalSearches,
  processingParagraph,
  resultArticles,
  resultsSection,
  searchForm,
  searchInput,
} from './client-dom.ts';

searchForm.addEventListener(
  'submit',
  function onSearch(event,) {
    event.preventDefault();
    void (async function onSearchAsync() {
      try {
        numTotalSearches.value++;
        resultsSection.setAttribute('hidden', 'true',);
        resultsSection.querySelectorAll<HTMLElement>(':scope > *',).forEach(
          function hide(result,) {
            result.setAttribute('hidden', 'true',);
          },
        );

        processingParagraph.removeAttribute('hidden',);

        const results = await exa.value[0].search(searchInput.value.trim(), {
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
        },);

        processingParagraph.setAttribute('hidden', 'true',);

        costDollarsSpan.textContent = String(results.costDollars?.total ?? 0,);

        results.results.forEach(function forEachResult(result, resultIndex,) {
          displayResult(resultArticles, result, resultIndex,);
        },);

        resultsSection.removeAttribute('hidden',);
      }
      catch (error: unknown) {
        console.error('search failed', error,);
      }
    })();
  },
);

changeApiKeyButton.addEventListener(
  'click',
  function onChangeApiKey() {
    void (async function promptForNewApiKey() {
      try {
        const inputApiKey = notNullishOrThrow(await prompt('Change api key',),);
        exa.value = [new Exa(inputApiKey, baseUrl,), { apiKey: inputApiKey, },];
      }
      catch (error: unknown) {
        console.error('api key change failed', error,);
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
