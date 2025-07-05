import {
  createObservable,
  identity,
  nonPromiseAll,
  notFalsyOrThrow,
  prompt,
  replicateElementAsContentOf,
} from '@monochromatic-dev/module-es';
import { Exa } from 'exa-js';
import { z } from 'zod/v4-mini';

const { baseUrl } = { baseUrl: 'https://exa.aquati.cat/api/proxy' };

const {
  searchForm,
  costDollarsSpan,
  resultsSection,
  exa,
  numResultsInput,
  numTotalSearchesSpan,
  changeApiKeyButton,
  processingParagraph,
} = {
  exa: identity<{ value: [Exa, { apiKey: string; }]; }>(createObservable(
    await (async function createExaExtra(): Promise<[Exa, { apiKey: string; }]> {
      const apiKey = await z
        .pipe(z
          .pipe(z.nullable(z.uuid()), z.transform(async function promptSet(val) {
            if (val) {
              return val;
            }
            const inputApiKey = notFalsyOrThrow(await prompt('Set api key'));
            localStorage.setItem('exaApiKey', inputApiKey);
            return inputApiKey;
          })), z.uuid())
        .parseAsync(localStorage.getItem('exaApiKey'));
      const exa = new Exa(apiKey, baseUrl);
      return [exa, { apiKey }];
    })(),
    function updateStorage(val) {
      localStorage.setItem('exaApiKey', val[1].apiKey);
    },
  )),
  searchForm: identity<HTMLFormElement>(notFalsyOrThrow(
    document.querySelector('.searchForm'),
  )),

  processingParagraph: identity<HTMLParagraphElement>(
    notFalsyOrThrow(document.querySelector('.processing')),
  ),

  costDollarsSpan: identity<HTMLSpanElement>(notFalsyOrThrow(
    document.querySelector('.costDollars'),
  )),
  numResultsInput: identity<HTMLInputElement>(
    notFalsyOrThrow(document.querySelector('.numResults input')),
  ),

  resultsSection: identity<HTMLElement>(
    notFalsyOrThrow(document.querySelector('.results')),
  ),

  numTotalSearchesSpan: identity<HTMLSpanElement>(notFalsyOrThrow(
    document.querySelector('.numTotalSearches'),
  )),

  changeApiKeyButton: identity<HTMLButtonElement>(notFalsyOrThrow(
    document.querySelector('.changeApiKey'),
  )),
};

const {
  searchInput,
  firstResult,
  exaMinResults,
  exaMaxResults,
  numTotalSearches,
  numResults,
} = {
  searchInput: identity<HTMLInputElement>(notFalsyOrThrow(
    searchForm.querySelector('input'),
  )),
  firstResult: identity<HTMLElement>(notFalsyOrThrow(
    resultsSection.querySelector('.result'),
  )),
  exaMinResults: z.coerce.number().parse(numResultsInput.min),
  exaMaxResults: z.coerce.number().parse(numResultsInput.max),

  numTotalSearches: identity<{ value: number; }>(
    createObservable(z
      ._default(z.coerce.number(), 0)
      .parse(localStorage.getItem('numTotalSearches')), function updateDisplay(val) {
      numTotalSearchesSpan.textContent = String(val);
    }),
  ),

  numResults: createObservable(
    z.coerce.number().parse(localStorage.getItem('numResults') ?? numResultsInput.value),
    function updateStored(val) {
      localStorage.setItem('numResults', String(val));
      numResultsInput.value = String(val);
    },
  ),
};

// TODO: Use logic of replicating element inside fetch result to avoid errors on subsequent searches.
replicateElementAsContentOf(firstResult, resultsSection, exaMaxResults);

const resultArticles = resultsSection.children;

nonPromiseAll([
  void searchForm.addEventListener('submit', async function onSearch(event) {
    event.preventDefault();

    await Promise.all([
      numTotalSearches.value++,

      void resultsSection.setAttribute('hidden', 'true'),

      void resultsSection.querySelectorAll(':scope > *').forEach(function hide(result) {
        result.setAttribute('hidden', 'true');
      }),

      (async function processResults(): Promise<void> {
        processingParagraph.removeAttribute('hidden');

        const results = await exa.value[0].searchAndContents(searchInput.value.trim(), {
          type: 'auto',
          // category: 'research paper',
          numResults: numResults.value,
          text: true,
          summary: true,
          subpages: 1,
          extras: {
            links: 1,
            imageLinks: 1,
          },
          highlights: true,
        });

        processingParagraph.setAttribute('hidden', 'true');

        nonPromiseAll([
          costDollarsSpan.textContent = String(results.costDollars?.total ?? 0),

          void results.results.forEach(function displayResult(result, resultIndex) {
            const currentResultArticle: HTMLLIElement = notFalsyOrThrow(
              resultArticles[resultIndex],
            ) as HTMLLIElement;

            const {
              favicon,
              link,
              publishedDate,
              author,
              summary,
              text,
              highlights,
              firstHighlight,
              image,
            } = {
              favicon: identity<HTMLImageElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__favicon'),
              )),
              link: identity<HTMLAnchorElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__link'),
              )),
              publishedDate: identity<HTMLTimeElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__publishedDate'),
              )),
              author: identity<HTMLElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__author'),
              )),
              summary: identity<HTMLParagraphElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__summary'),
              )),
              text: identity<HTMLParagraphElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__text'),
              )),
              highlights: identity<HTMLUListElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__highlights'),
              )),
              firstHighlight: identity<HTMLLIElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__highlight'),
              )),
              image: identity<HTMLImageElement>(notFalsyOrThrow(
                currentResultArticle.querySelector('.result__image'),
              )),
            };
            if (result.favicon) {
              favicon.src = result.favicon;
            }
            nonPromiseAll([
              link.href = result.url,
              link.textContent = result.title,
              void (function updatePublishedDate(): void {
                if (result.publishedDate) {
                  publishedDate.dateTime = result.publishedDate;
                  publishedDate.textContent = result.publishedDate;
                }
              })(),
              void (function updateAuthor(): void {
                if (result.author) {
                  author.textContent = result.author;
                }
              })(),
              summary.textContent = result.summary,
              text.textContent = result.text,
              void replicateElementAsContentOf(
                firstHighlight,
                highlights,
                result.highlights.length,
              ),
              void result.highlights.forEach(
                function populateHighlight(highlight, highlightIndex) {
                  const currentHighlight: HTMLLIElement = notFalsyOrThrow(
                    highlights.querySelector(`:nth-child(${highlightIndex + 1})`),
                  );
                  currentHighlight.textContent = highlight;
                },
              ),
              void (function updateImage(): void {
                if (result.image) {
                  image.src = result.image;
                }
              })(),
            ]);

            currentResultArticle.removeAttribute('hidden');
          }),
        ]);
      })(),
    ]);

    resultsSection.removeAttribute('hidden');
  }),
  void changeApiKeyButton.addEventListener('click', async function promptForNewApiKey() {
    const inputApiKey = notFalsyOrThrow(await prompt('Change api key'));
    exa.value = [new Exa(inputApiKey, baseUrl), { apiKey: inputApiKey }];
  }),

  void numResultsInput.addEventListener('input', function setNewNumResults() {
    numResults.value = Number(numResultsInput.value);
  }),
]);

export {};
