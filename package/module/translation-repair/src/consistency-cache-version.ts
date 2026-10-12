//region Consistency cache version

/**
 Generation of the page consistency pass's cached ballots (the owner's ruling
 of 2026-10-11).

 Version one: the judge bench is asked once per repeated source wording of a
 page, over one sheet showing the wording, every place's paragraph and the
 whole English of its slice, and the heard ballots are stored with the
 quorum the gather closed on. The counting, which reads the stored ballots
 against the English, is not stored: a change to how quotes are located, how a
 choice wins or how a place is kept moves no key and needs no number, since the
 ballots mean the same under the same sheet. A change to the sheet's wording, to
 the reply shape or to what a ballot must contain to be usable moves this
 number, since each changes what a stored ballot answers or whether it counts.
 No pass has run with this value set, so no answer is cached under it.

 The tense-candidate block (the lead's decision of 2026-10-12) moved no number:
 the key adds the recorded death and the subject names for an entry that records
 a death, so such an entry asks a new question under a new key, and an entry
 that records none keeps its key byte for byte, as the key of every other judged
 stage does (ledger B419).

 @example
 ```ts
 const material = JSON.stringify({ version: CONSISTENCY_CACHE_VERSION, sheet, roster, },);
 ```
 */
export const CONSISTENCY_CACHE_VERSION = 1;

//endregion Consistency cache version
