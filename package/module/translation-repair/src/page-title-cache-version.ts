//region Page title cache version

/**
 Generation of the page title lexicon's cached answers (ledger H16).

 Version one (2026-09-28): one rendering per title a page repeats and the
 archive leaves unpaired, the most voices' rendering, the earliest seat on the
 roster breaking a tie. A change to the sheet, the span detector or the choice
 moves this number, since each changes what a cached answer means.

 @example
 ```ts
 const material = JSON.stringify({ version: PAGE_TITLE_CACHE_VERSION, source, titles, roster, },);
 ```
 */
export const PAGE_TITLE_CACHE_VERSION = 1;

//endregion Page title cache version
