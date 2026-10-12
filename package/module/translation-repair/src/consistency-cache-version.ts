//region Consistency cache version

/**
 Generation of the page consistency pass's cached answers (the owner's ruling
 of 2026-10-11).

 Version three: what the pass asks changed again, before any pass wrote version
 two. A quote locates only at the boundaries of words, so a quote or a slot that
 stood inside a longer word no longer locates and the spans carried change; a
 quote's quotation marks and brackets that its words do not need are read as
 edge punctuation, like a full stop; the writers are given the innermost block
 that holds the words, and every receiving place of one block together, with the
 words of the group's other places inside it to keep; the choice sheet shows the
 judges what the writers were shown (the chosen place's ORIGINAL and English
 paragraph, the receiving places' ORIGINAL with the blocks around it, and the
 chosen place's English slot for a frame); and the reply shapes of the three
 judges' sheets name no real label. Every sheet of the stage changed, so no
 stored answer of version two is resumed.

 Version two: what the pass asks changed in three ways. The consistency sheet
 asks each judge to quote only the words that render the repeated source wording
 and to name, in the reason, a word of the chosen rendering that renders source
 outside the repeat. The bench is asked once more, over a sheet that shows only
 the finalists, when the choices tie for first. And a rendering is carried to a
 receiving place by writers and a choice among candidates, so the cache holds
 four kinds of answer, each under a key that names its kind: the ballots of the
 first round, the run-off's ballots, the writers' paragraphs and the choice
 ballots. A stored answer is the heard voices with the quorum the gather closed
 on. The counting, which reads them against the English, is not stored: a change
 to how quotes are located, how a choice wins or how a place is kept moves no key
 and needs no number, since the ballots mean the same under the same sheet.

 A change to a sheet's wording, to a reply shape or to what a ballot must contain
 to be usable moves this number, since each changes what a stored answer replies
 to or whether it counts. Version one was written by one pass (TianqiChen66623),
 over a sheet that let a quote carry words of the source outside the repeat,
 counted by the exact text of a quote, and is not resumed.

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
export const CONSISTENCY_CACHE_VERSION = 3;

//endregion Consistency cache version
