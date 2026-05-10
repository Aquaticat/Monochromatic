// oxlint-disable typescript/no-unsafe-member-access, typescript/no-unsafe-call, typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion, typescript/no-unsafe-return, typescript/strict-boolean-expressions, no-magic-numbers, typescript/no-confusing-void-expression, no-shadow, no-warning-comments, eslint/prefer-destructuring -- client-side DOM script with untyped external APIs (Exa, Zod, DOM)
import { prompt, } from '@monochromatic-dev/module-dom/ts/prompt.ts';
import {
  $ as createObservable,
  type Observable,
} from '@monochromatic-dev/module-es/create-observable';
import {
  $ as notNullishOrThrow,
} from '@monochromatic-dev/module-es/not-nullish-or-throw';
import { Exa, } from 'exa-js';
import * as v from 'valibot';

import { replicateElementAsContentOf, } from './client-replicate-element.ts';

/** Exa API proxy configuration with base URL. */
export const baseUrl = 'https://exa.aquati.cat/api/proxy';

/**
 * DOM elements and reactive state for the search interface.
 * Bindings are resolved eagerly at module load via `querySelector` assertions.
 */
const bindings = {
  exa: createObservable(
    await (async function createExaExtra(): Promise<[
      Exa,
      { apiKey: string; },
    ]> {
      const apiKey = await v.parseAsync(
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
            const inputApiKey = notNullishOrThrow(await prompt('Set api key',),);
            localStorage.setItem(
              'exaApiKey',
              inputApiKey,
            );
            return inputApiKey;
          },),
          v.uuid(),
        ),
        localStorage.getItem('exaApiKey',),
      );
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

/** Exa SDK client wrapped in an observable for reactive API key changes. */
export const exa: Observable<[
  Exa,
  { apiKey: string; },
]> = bindings.exa;

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
  searchInput: notNullishOrThrow(
    searchForm.querySelector<HTMLInputElement>('input',),
  ),
  firstResult: notNullishOrThrow(
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
