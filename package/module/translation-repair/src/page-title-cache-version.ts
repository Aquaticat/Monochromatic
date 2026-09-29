//region Page title cache version

/**
 Generation of the page title lexicon's cached answers (ledger H16).

 Version one (2026-09-28): one rendering per title a page repeats and the
 archive leaves unpaired, the most voices' rendering, the earliest seat on the
 roster breaking a tie. A change to the sheet's wording or to the choice moves
 this number, since each changes what a cached answer means under the same key.
 The span detector does not: the key hashes every title it yields, with its
 count, in order (`pageTitleKey`), so a changed detection is a changed key.

 Rides inside (2026-09-29): `d9a306602` (titles listed by where each first
 stands) and `ee39e2ba5` (one shared heading reader, ledger X20) changed the
 span detector only. No slice-cache file has been written since this value was
 set, under the agent runs or the package's own runs directory, where a control
 time finds 494, so no answer is cached under it. Every later source commit
 rides inside it the same way, those an account names and those none does
 (`corpus-run/cache-account-audit.ts`, ledger M28). The choice changed once
 since (ledger B24, 2026-09-29): renderings apart only in apostrophe style or
 spacing of any kind count as one, and corner brackets and underscores come
 off as wrappers. That rides inside too: a find for slice-cache files written
 since 2026-09-28T19:38Z, when this value was set, finds none, and one from
 2026-09-27T00:00Z finds 494.

 @example
 ```ts
 const material = JSON.stringify({ version: PAGE_TITLE_CACHE_VERSION, source, titles, roster, },);
 ```
 */
export const PAGE_TITLE_CACHE_VERSION = 1;

//endregion Page title cache version
