// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return, typescript/strict-boolean-expressions, no-magic-numbers, typescript/no-confusing-void-expression, no-shadow, no-warning-comments -- client-side DOM script with untyped external APIs (Exa, Zod, DOM)
import { $ as createObservable, } from '@monochromatic-dev/module-es/create-observable';
import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { prompt, } from '@monochromatic-dev/module-es/ts/deprecated/dom/prompt.ts';
import { Exa, } from 'exa-js';
import * as z from 'zod/mini';

import { replicateElementAsContentOf, } from './client-replicate-element.ts';

/** Exa API proxy configuration with base URL. */
export const baseUrl = 'https://exa.aquati.cat/api/proxy';

/**
 * DOM elements and reactive state for the search interface.
 * Bindings are resolved eagerly at module load via `querySelector` assertions.
 */
export const {
  searchForm,
  costDollarsSpan,
  resultsSection,
  exa,
  numResultsInput,
  numTotalSearchesSpan,
  changeApiKeyButton,
  processingParagraph,
} = {
  exa: createObservable(
    await (async function createExaExtra(): Promise<[
      Exa,
      { apiKey: string; },
    ]> {
      const apiKey = await z
        .pipe(
          z
          .pipe(z.nullable(z.uuid(),), z.transform(async function promptSet(val,) {
            if (val)
              return val;
            const inputApiKey = notNullishOrThrow(await prompt('Set api key',),);
            localStorage.setItem('exaApiKey', inputApiKey,);
            return inputApiKey;
          },),),
          z.uuid(),
        )
        .parseAsync(localStorage.getItem('exaApiKey',),);
      const exa = new Exa(
        apiKey,
        baseUrl,
      );
      return [
        exa,
        { apiKey, },
      ];
    })(),
    function updateStorage(val,) {
      localStorage.setItem(
        'exaApiKey',
        val[1].apiKey,
      );
    },
  ),
  searchForm: notNullishOrThrow(
    document.querySelector<HTMLFormElement>('.searchForm',),
  ),
  processingParagraph: notNullishOrThrow(
    document.querySelector<HTMLParagraphElement>('.processing',),
  ),
  costDollarsSpan: notNullishOrThrow(
    document.querySelector<HTMLSpanElement>('.costDollars',),
  ),
  numResultsInput: notNullishOrThrow(
    document.querySelector<HTMLInputElement>('.numResults input',),
  ),
  resultsSection: notNullishOrThrow(
    document.querySelector<HTMLElement>('.results',),
  ),
  numTotalSearchesSpan: notNullishOrThrow(
    document.querySelector<HTMLSpanElement>('.numTotalSearches',),
  ),
  changeApiKeyButton: notNullishOrThrow(
    document.querySelector<HTMLButtonElement>('.changeApiKey',),
  ),
};

/**
 * Derived DOM elements and reactive counters that depend on the first binding group.
 * Includes the search input, result template, range constraints, and persisted counters.
 */
export const {
  searchInput,
  firstResult,
  exaMaxResults,
  numTotalSearches,
  numResults,
} = {
  searchInput: notNullishOrThrow(
    searchForm.querySelector<HTMLInputElement>('input',),
  ),
  firstResult: notNullishOrThrow(
    resultsSection.querySelector<HTMLElement>('.result',),
  ),
  exaMaxResults: z.coerce.number().parse(numResultsInput.max,),
  numTotalSearches: createObservable(
    z
      ._default(
        z.coerce.number(),
        0,
      )
      .parse(localStorage.getItem('numTotalSearches',),),
    function updateDisplay(val,) {
      numTotalSearchesSpan.textContent = String(val,);
    },
  ),
  numResults: createObservable(
    z.coerce.number().parse(
      localStorage.getItem('numResults',) ?? numResultsInput.value,
    ),
    function updateStored(val,) {
      localStorage.setItem(
        'numResults',
        String(val,),
      );
      numResultsInput.value = String(val,);
    },
  ),
};

// TODO: Use logic of replicating element inside fetch result to avoid errors on subsequent searches.
replicateElementAsContentOf(
  firstResult,
  resultsSection,
  exaMaxResults,
);

/** Live HTMLCollection of result article elements inside the results section. */
export const resultArticles: HTMLCollection = resultsSection.children;
