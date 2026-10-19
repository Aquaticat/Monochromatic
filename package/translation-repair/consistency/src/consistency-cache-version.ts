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
 asked now (the key digests the sheet, so the keys moved of themselves; the number moved
 as well, for the reply shape and for what a ballot must contain to be usable, which the key does not digest). A reply that names exactly one shown label in
 another form (its case, white space, a bare number, the word with the number) now counts,
 and is stored as the shown label: a record of version four holds only replies the
 stricter guard counted, each already in the shown form, so none could hold a value
 computed under the old rule that the new rule would count differently. A choice among
 candidates that no candidate won by a strict majority is now run off among the finalists,
 under a key of its own (`choice-run-off`); no record of version four is read after the bump,
 since the key hashes the number, so the choice and the run-off that follows it are both asked
 afresh. The counting of quotes, which locates a chosen place by the longest quote that stands
 once and that the quotes of more than half of all the usable ballots contain (a ballot that
 quoted nothing of the place counts against every candidate), is not stored and moves no key.

 The finalists of a run-off moved no number either (the lead's rule, open to the owner's veto, extending the owner's
 rule of 2026-10-11): a first round or a carry choice with no strict majority and a lone leader is now run off among
 the leader and the labels next behind it, where it was kept. Which labels are the finalists is counted from the stored
 ballots and is not stored, and the sheet of a run-off shows only its finalists under a key that digests the sheet, so
 a run-off among three labels asks a question under a key of its own, and a run-off among the tied labels keeps its
 key byte for byte. The wording of the first round's sheet and of the run-off among places is the same.

 The sheet of the run-off among a place's candidates changed its bytes (the lead's repair of 2026-10-18, ledger B657) and the
 number still did not move, since the key digests the exact sheet: the new bytes make a new key, and no stored answer is read under
 a key it was not written under. Its rules now say that a first round was split between these candidates and the judge is asked
 again, because a run-off whose finalists are every candidate (a split of two, or of three over three) sent the first ask's sheet
 byte for byte, and a client that answers a repeated model and prompt from its first payload replayed the first round's ballots.
 The paragraph goes into the rules of every carry run-off, whichever labels are its finalists (the `runOff` flag of
 `buildCarryChoiceMessages` adds it, and the run-off is asked for a lone leader with the labels behind it as well as for a tie),
 so every `choice-run-off` key moved, and the statement above that a run-off among the tied labels keeps its key holds for the
 run-off among places alone. The `choice` stage is not affected: the sheet of the first ask is byte for byte what version five has,
 so the key of every first ask is unchanged, and a carry run-off stored under its earlier key is asked afresh under the new one.

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

 A change to a reply shape or to what a ballot must contain to be usable moves this number, since each changes
 whether a stored answer counts and the key digests neither. A change to a sheet's wording moves the key and not the number,
 since the key digests the exact sheet: an answer stored under the old wording is never found under the new key. Version one was written by one pass (TianqiChen66623),
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
