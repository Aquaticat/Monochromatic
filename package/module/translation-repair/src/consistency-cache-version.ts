//region Consistency cache version

/**
 Generation of the page consistency pass's cached answers (the owner's ruling
 of 2026-10-11).

 Version five (the lead's rulings of 2026-10-15 on the run of TianqiChen66625): what the
 judges are asked and what a reply must contain to count changed, after two passes
 (TianqiChen66624 and TianqiChen66625) wrote version four. Every sheet of the three judge asks (the first
 round, the run-off among places and the choice among a place's candidates) ends in a
 sentence that lists the exact labels the reply may use, and the response format of each
 ask lists them as an `enum`, so no stored answer of version four replies to the question
 asked now (the key digests the sheet, so the keys moved of themselves; the number moves
 as well, since a change to a sheet's wording or to what a ballot must contain to be
 usable moves it). A reply that names exactly one shown label in
 another form (its case, white space, a bare number, the word with the number) now counts,
 and is stored as the shown label: a record of version four holds only replies the
 stricter guard counted, each already in the shown form, so none could hold a value
 computed under the old rule that the new rule would count differently. A choice among
 candidates that no candidate won by a strict majority is now run off among the candidates
 tied for first, under a key of its own (`choice-run-off`); a version four record of the
 choice stands for the first ask only, and the run-off it would now be followed by is
 asked afresh. The counting of quotes, which locates a chosen place by the longest quote
 that stands once and that a strict majority of the quotes naming the place contain, is
 not stored and moves no key.

 Version four (the review of 2026-10-13): what the writers and the judges are
 shown changed again, before any pass wrote version three. The words of every
 place of every other group that stand in a block are listed to keep, not only
 those of the group's own places, and the writer sheet's rule about them names
 places of this repeat or of another; the choice sheet shows the judges the
 words each receiving place replaces (THE WORDS TO REPLACE, numbered as the
 writer sheet numbers them) and says so in its rules; a place in a table, a code
 block or a setext heading is carried by the code splice alone, so no writer is
 asked about it. The sheets of the carry changed, so no stored answer of version
 three is resumed. The stored shapes did not change: a stored answer is still
 the heard voices with the quorum the gather closed on.

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
export const CONSISTENCY_CACHE_VERSION = 5;

//endregion Consistency cache version
