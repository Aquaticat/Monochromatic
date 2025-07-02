import {
  createObservable,
  identity,
  nonPromiseAll,
  notFalsyOrThrow,
  prompt,
  replicateElementAsParentContent,
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

nonPromiseAll([
  void replicateElementAsParentContent(firstResult, exaMaxResults),

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
            const {
              currentResultArticle,
            } = {
              currentResultArticle: identity<HTMLElement>(notFalsyOrThrow(
                resultsSection.querySelector(`:nth-child(${resultIndex + 1})`),
              )),
            };

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
              void replicateElementAsParentContent(firstHighlight,
                result.highlights.length),
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

// DOM elements
// const searchForm = document.getElementById('searchForm') as HTMLFormElement;
// const searchInput = document.getElementById('searchInput') as HTMLInputElement;
// const resultsContainer = document.getElementById('resultsContainer') as HTMLDivElement;
// const errorContainer = document.getElementById('errorContainer') as HTMLDivElement;
// const apiKeyButton = document.getElementById('apiKeyButton') as HTMLButtonElement;
// const loadingIndicator = document.getElementById('loadingIndicator') as HTMLDivElement;
// const noResultsIndicator = document.getElementById('noResultsIndicator') as HTMLDivElement;

// /** Storage key for API key */
// const API_KEY_STORAGE_KEY = 'exa-search-api-key';

// /** Get API key from localStorage */
// function getApiKey(): string | null {
//   return localStorage.getItem(API_KEY_STORAGE_KEY);
// }

// /** Set API key in localStorage */
// function setApiKey(apiKey: string): void {
//   localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
//   updateApiKeyButton();
// }

// /** Clear API key from localStorage */
// function clearApiKey(): void {
//   localStorage.removeItem(API_KEY_STORAGE_KEY);
//   updateApiKeyButton();
// }

// /** Update API key button text */
// function updateApiKeyButton(): void {
//   const hasKey = getApiKey() !== null;
//   apiKeyButton.textContent = hasKey ? 'Change API Key' : 'Set API Key';
// }

// /** Show error message */
// function showError(message: string): void {
//   errorContainer.textContent = message;
//   errorContainer.style.display = 'block';
//   resultsContainer.innerHTML = '';
// }

// /** Hide error message */
// function hideError(): void {
//   errorContainer.style.display = 'none';
//   errorContainer.textContent = '';
// }

// /** Hide all result containers */
// function hideAllResults(): void {
//   const MAX_RESULTS = 100;
//   for (let resultIndex = 0; resultIndex < MAX_RESULTS; resultIndex++) {
//     const resultItem = document.getElementById(`result-${resultIndex}`) as HTMLDivElement;
//     if (resultItem) {
//       resultItem.style.display = 'none';
//     }
//   }
//   loadingIndicator.style.display = 'none';
//   noResultsIndicator.style.display = 'none';
// }

// /** Populate a result container with data */
// function populateResult(index: number, result: {
//   title: string;
//   url: string;
//   text?: string;
//   publishedDate?: string;
// }): void {
//   const resultItem = document.getElementById(`result-${index}`) as HTMLDivElement;
//   if (!resultItem) return;

//   const titleLink = resultItem.querySelector('.result-link') as HTMLAnchorElement;
//   const urlDiv = resultItem.querySelector('.result-url') as HTMLDivElement;
//   const snippetP = resultItem.querySelector('.result-snippet') as HTMLParagraphElement;

//   titleLink.href = result.url;
//   titleLink.textContent = result.title;
//   urlDiv.textContent = result.url;

//   if (result.text && snippetP) {
//     const snippet = result.text.substring(0, 300) + '...';
//     snippetP.textContent = snippet;
//     snippetP.style.display = 'block';
//   } else if (snippetP) {
//     snippetP.style.display = 'none';
//   }

//   resultItem.style.display = 'block';
// }

// /** Perform search using Exa API */
// async function performSearch(query: string): Promise<void> {
//   const apiKey = getApiKey();

//   if (!apiKey) {
//     showError('Please set your Exa API key first');
//     return;
//   }

//   hideError();
//   hideAllResults();
//   loadingIndicator.style.display = 'block';

//   try {
//     const response = await fetch(EXA_API_URL, {
//       method: 'POST',
//       headers: {
//         'x-api-key': apiKey,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         query,
//         numResults: 100, // Maximum allowed by Exa
//         contents: {
//           text: true,
//         },
//       }),
//     });

//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({}));
//       throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();

//     loadingIndicator.style.display = 'none';

//     if (!data.results || data.results.length === 0) {
//       noResultsIndicator.style.display = 'block';
//       return;
//     }

//     // Populate results into pre-created containers
//     data.results.forEach((result: any, index: number) => {
//       if (index < 100) { // We've 100 pre-created containers
//         populateResult(index, result);
//       }
//     });
//   } catch (error) {
//     console.error('Search error:', error);
//     loadingIndicator.style.display = 'none';
//     showError(
//       `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
//     );
//   }
// }

// /** Handle API key button click */
// function handleApiKeyClick(): void {
//   const currentKey = getApiKey();
//   const message = currentKey
//     ? 'Enter new API key (or leave empty to clear):'
//     : 'Enter your Exa API key:';

//   const newKey = prompt(message, '');

//   if (newKey === null) {
//     // User cancelled
//     return;
//   }

//   if (newKey === '') {
//     clearApiKey();
//   } else {
//     setApiKey(newKey);
//   }
// }

// /** Handle search form submission */
// function handleSearchSubmit(event: Event): void {
//   event.preventDefault();

//   const query = searchInput.value.trim();
//   if (!query) {
//     return;
//   }

//   performSearch(query);
// }

// // Initialize event listeners
// searchForm.addEventListener('submit', handleSearchSubmit);
// apiKeyButton.addEventListener('click', handleApiKeyClick);

// // Initialize API key button state
// updateApiKeyButton();

// // Focus search input on load
// searchInput.focus();

export {};
