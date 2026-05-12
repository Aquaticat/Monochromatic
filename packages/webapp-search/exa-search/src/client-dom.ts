// oxlint-disable typescript/strict-boolean-expressions, no-magic-numbers, no-warning-comments, eslint/prefer-destructuring -- DOM string coercions and a pre-existing TODO marker
import { prompt, } from '@monochromatic-dev/module-dom/ts/prompt.ts';
import {
  $ as createObservable,
  type Observable,
} from '@monochromatic-dev/module-es/create-observable';
import {
  nonNullishOrThrow,
} from '@monochromatic-dev/module-or-throw';
import * as v from 'valibot';

import { replicateElementAsContentOf, } from './client-replicate-element.ts';

/** Exa API proxy configuration with base URL. */
export const baseUrl = 'https://exa.aquati.cat/api/proxy';

/**
 * DOM elements and reactive state for the search interface.
 * Bindings are resolved eagerly at module load via `querySelector` assertions.
 */
const bindings = {
  apiKey: createObservable(
    await v.parseAsync(
      v.pipeAsync(
        v.nullable(
          v.pipe(
            v.string(),
            v.uuid(),
          ),
        ),
        v.transformAsync(async function promptSet(val,): Promise<string> {
          if (val !== null)
            return val;
          const inputApiKey = nonNullishOrThrow(await prompt('Set api key',),);
          localStorage.setItem(
            'exaApiKey',
            inputApiKey,
          );
          return inputApiKey;
        },),
        v.uuid(),
      ),
      localStorage.getItem('exaApiKey',),
    ),
    function updateStorage(val,) {
      localStorage.setItem(
        'exaApiKey',
        val,
      );
    },
  ),
  searchForm: nonNullishOrThrow(
    document.querySelector<HTMLFormElement>('.searchForm',),
  ),
  processingParagraph: nonNullishOrThrow(
    document.querySelector<HTMLParagraphElement>('.processing',),
  ),
  costDollarsSpan: nonNullishOrThrow(
    document.querySelector<HTMLSpanElement>('.costDollars',),
  ),
  numResultsInput: nonNullishOrThrow(
    document.querySelector<HTMLInputElement>('.numResults input',),
  ),
  resultsSection: nonNullishOrThrow(
    document.querySelector<HTMLElement>('.results',),
  ),
  numTotalSearchesSpan: nonNullishOrThrow(
    document.querySelector<HTMLSpanElement>('.numTotalSearches',),
  ),
  changeApiKeyButton: nonNullishOrThrow(
    document.querySelector<HTMLButtonElement>('.changeApiKey',),
  ),
};

/** Exa API key wrapped in an observable for reactive key changes. */
export const apiKey: Observable<string> = bindings.apiKey;

/** Search form element. */
export const searchForm: HTMLFormElement = bindings.searchForm;

/** Processing status paragraph. */
export const processingParagraph: HTMLParagraphElement = bindings.processingParagraph;

/** Cost display span element. */
export const costDollarsSpan: HTMLSpanElement = bindings.costDollarsSpan;

/** Number of results input element. */
export const numResultsInput: HTMLInputElement = bindings.numResultsInput;

/** Results section container. */
export const resultsSection: HTMLElement = bindings.resultsSection;

/** Total searches count display span. */
export const numTotalSearchesSpan: HTMLSpanElement = bindings.numTotalSearchesSpan;

/** API key change button. */
export const changeApiKeyButton: HTMLButtonElement = bindings.changeApiKeyButton;

/**
 * Derived DOM elements and reactive counters that depend on the first binding group.
 * Includes the search input, result template, range constraints, and persisted counters.
 */
const derived = {
  searchInput: nonNullishOrThrow(
    searchForm.querySelector<HTMLInputElement>('input',),
  ),
  firstResult: nonNullishOrThrow(
    resultsSection.querySelector<HTMLElement>('.result',),
  ),
  exaMaxResults: v.parse(
    v.pipe(
      v.unknown(),
      v.transform(Number,),
      v.number(),
    ),
    numResultsInput.max,
  ),
  numTotalSearches: createObservable(
    v.parse(
      v.pipe(
        v.unknown(),
        v.transform(function toNumberOrZero(input,) {
          const n = Number(input,);
          return Number.isNaN(n,) ? 0 : n;
        },),
        v.number(),
      ),
      localStorage.getItem('numTotalSearches',),
    ),
    function updateDisplay(val,) {
      numTotalSearchesSpan.textContent = String(val,);
    },
  ),
  numResults: createObservable(
    v.parse(
      v.pipe(
        v.unknown(),
        v.transform(Number,),
        v.number(),
      ),
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

/** Search text input element. */
export const searchInput: HTMLInputElement = derived.searchInput;

/** First result element used as template for cloning. */
export const firstResult: HTMLElement = derived.firstResult;

/** Maximum number of results from the input range constraint. */
export const exaMaxResults: number = derived.exaMaxResults;

/** Observable counter tracking total searches performed. */
export const numTotalSearches: Observable<number> = derived.numTotalSearches;

/** Observable counter tracking requested number of results. */
export const numResults: Observable<number> = derived.numResults;

// TODO: Use logic of replicating element inside fetch result to avoid errors on subsequent searches.
replicateElementAsContentOf(
  firstResult,
  resultsSection,
  exaMaxResults,
);

/** Live HTMLCollection of result article elements inside the results section. */
export const resultArticles: HTMLCollection = resultsSection.children;
