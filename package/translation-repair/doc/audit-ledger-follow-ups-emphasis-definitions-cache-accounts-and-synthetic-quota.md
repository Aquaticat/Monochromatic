# Audit ledger: follow-ups on emphasis definitions, cache accounts and the Synthetic quota shape

Paths in this record are the layout after 2026-10-18,
under `package/translation-repair`.

Four items were left after the page-definitions work of B665 to B667,
and the lead had them closed on 2026-10-18 on top of `7c21a56fc2`
(a clock-zone slip in the account of the third, B672,
and a request to read the words of a place with recorded definitions that was not built, B673, followed):
the emphasis readers that still parsed without the page's definitions (B668),
the contradictions in the TSDoc of the consistency cache version (B669),
the pairing cache version, which no account had read between `d614a0c1d` and `29d606470` (B670),
and the Synthetic meter reader that refused a body on 2026-10-18 (B671).

## B668: emphasis was read without the page's definitions in three places

Found on 2026-10-18 by the lead,
who read the claim of round n173 (every caller of the text fold receives the page's link and footnote definitions)
against `emphasisDelimitersOf`,
which takes `definitions` and was called without them in three places.

Outcome written on 2026-10-18.
Red `074599761e`,
fixed in `1a40579be6`.

Why it matters:
in CommonMark a reference definition changes how emphasis delimiters pair,
because an unresolved `[b*]` is plain text and its `*` can pair with an outer one.
`*a [b*] c*` closes at offset 5 without the definition of `[b*]` and at offset 9 with it.

What the three calls were,
read from the callers:

- `joinedMarksOf` and `marksPastMarkupOf` called it only when the caller passed no `emphasis`.
  Their one production caller, `readProof` in `consistency-fold-apostrophes.ts`, always passed the `emphasis` of
  `proseViewOf({ english })`,
  which was parsed without definitions,
  so the claim failed one step earlier than the three calls the brief named.
- `endsReadingRun` in `consistency-loose-marks.ts` parses `points.join('')`,
  the words of a span,
  which is always a fragment of a page.

What changed:
every reader takes an optional `definitions` and hands it to the parse.
That is `joinedMarksOf` (also to `foldedLinksOf`, so the links and the delimiters agree),
`marksPastMarkupOf`,
`readProof`,
`proofViewOf` (whose remembered view is now found by the English and the definitions,
since a view read without them would otherwise be served to a read with them),
`provenApostrophesInEnglish`,
`markReadingsInEnglish`,
`readingsChangeOutside`,
`looseMarksOf`,
`holdsEdgeApostrophe`,
`apostropheMarksOf`,
`withApostropheForm` and `withLooseMarksOf`.
`planConsistencyEdit` takes `definitions` and reads the English around a splice with them,
and the decision of a place (`plannedPlace`) and the edge refusal (`edgeRefusalOf`) hand it the definitions of the page
the receiving slice stands in,
so the refusal is named for the reading the planner made.
`edgeClassOf` and `sameEdgeClass` moved to `consistency-edge-class.ts`
to keep `consistency-loose-marks.ts` under the line limit.

What stays read alone,
and why:
the words of the places.
The planner, the apply stage and the reader of a record share `bringsAtEdge` and the loose-mark readers,
and the reader of a record holds no page,
so a definition handed to two of them and not the third would let the pass plan a splice that the reader refuses.
The pass would have to record the definitions the way generation 18 records those that move a slot (B665)
before the words of a place could be read with them.
This is open.
The proof of an apostrophe over a whole page (`withProvenApostrophes`,
`pageApostropheFormOf`, the gains check) reads the page text,
which holds the page's definitions,
and a locator given no page (`locateWords` with the recorded `definitions`) still proves over the haystack alone.
That is open too,
and `withProvenApostrophes` takes no `definitions`.

Guard demonstration,
run on the fix commit with the lines that hand the definitions on taken out
(the `definitions` handed to the parse in the three readers,
to `readProof`,
to the remembered view,
to `readingsChangeOutside`,
to `planConsistencyEdit` and to the two planner calls of the edge refusal):
all eleven cases of `consistency-emphasis-definitions.unit.test.ts` failed
(`joinedMarksOf`,
`marksPastMarkupOf`,
`holdsEdgeApostrophe`,
`looseMarksOf`,
`apostropheMarksOf`,
`withApostropheForm`,
`proofViewOf`,
`provenApostrophesInEnglish`,
`markReadingsInEnglish`,
`readingsChangeOutside` and `planConsistencyEdit`),
and both cases of `pass-consistency-edge-definitions.unit.test.ts` failed (`edgeRefusalOf` and `plannedPlace`).
All thirteen passed again once the lines were restored and the packages rebuilt.

Each case reads one English three ways:
without the definition,
with it given,
and with it written into the text.
The second must equal the third and differ from the first.

Prevention:
a claim that every caller of a function receives a value is made after listing the callers with `rg`
and reading what each one hands it,
and a parameter with a default (`definitions = ''`) is the shape that lets a caller leave it out unseen.

## B669: the TSDoc of the consistency cache version contradicted itself

Found on 2026-10-18 by the lead,
reading the paragraph that B657 added.

Outcome written on 2026-10-18.
Fixed in `895259a704`.

The TSDoc said, in the paragraph on version five and again in its general rule,
that a change to a sheet's wording moves the number,
and recorded in the paragraph of B657 a sheet change that did not.
The key digests the exact sheet
(`consistencyKey` hashes the version, the stage, the hash of the messages and the roster),
so a change of wording moves the key and not the number.
The number moves for what the key does not digest,
the reply shape (the response format is no part of the messages) and what a ballot must contain to be usable.
The file now says that once.

The paragraph of B657 also said that only the `choice-run-off` stage was affected,
as if the new paragraph reached the run-off among every candidate alone.
In `buildCarryChoiceMessages` the `runOff` flag adds the paragraph to the rules of every carry run-off,
and the run-off is asked for a lone leader with the labels behind it as well as for a tie,
so every `choice-run-off` key moved.
The sentence that a run-off among the tied labels keeps its key holds for the run-off among places alone.

## B670: the pairing cache version has no account for the commits from `d614a0c1d` to `29d606470`

Found on 2026-10-18 by the lead,
who noted that the last account covered the commits after `29d606470` only,
and that `PAIRING_CACHE_VERSION = 3` was set in `d614a0c1d`.

Outcome written on 2026-10-18.
Verdict:
3 need not move.
Test `665d64c7a3`,
account in the TSDoc of `pairing-cache-version.ts` in `5da176cf4f`.

Evidence:

- The range holds 1,205 commits under `package/module/translation-repair/src/*`
  and `package/translation-repair/*/src/*`,
  all under the first path since the split came after `29d606470`,
  and 27 of them touch the files of the pairing stage
  (`block-pairing-protocol.ts`,
  `block-pairing-question.ts`,
  `section-pairing.ts`,
  `prepare-section-round.ts`,
  `prepare-block-pairing.ts` and their neighbours).
- The key is `pairingQuestionKey`:
  the version,
  the question,
  the source and target texts,
  the pictures and the roster.
  The sheet a seat was shown and the rules that close a round are in no key,
  so no number could have retired a record when they changed.
- What retires a stored pairing is the generation of its namespace.
  `openPairingCache` and `openSectionPairingCache` are opened with the digest of the built pipeline the pass runs
  (`pass-prepare.ts` hands `pipelineDigest`),
  and `openNamespacedCache` discards the namespace when the stored generation differs.
  The probe on a throwaway directory:
  a record filled under one digest was resumed by that digest,
  found by none under another,
  and gone for the first once the other had opened the directory
  (the case in `slice-cache-pairing.unit.test.ts`).
- Every commit of the range that changed a byte the pipeline runs changed the digest,
  and one that changed none left the record as the same code settled it.
- The account of 2026-09-28 said no slice-cache file had been written since 04:26 UTC on 2026-09-27.
  That no longer holds:
  `corpus-pass-TianqiChen66626` wrote three block pairings under 3 and the section marker between 20:58 and 21:00 UTC
  on 2026-10-18
  (the first account here printed the files' local times, 16:58 to 17:00 EDT, and labelled them UTC; B672).
  They resume only for the build that wrote them.
  A search of the slice-cache files under `~/temp/agent` (the throwaway checkouts left out,
  and three directories it could not list) found those and no other file newer than the bump;
  the first four searches of this account used a time the host's `find` refused and discarded the error,
  as M57 records,
  and were repeated with an accepted time and the error kept.
- What the number still holds is what the digest does not:
  a dependency,
  the Node binary,
  and the environment the straggler windows are read from.
  `477bbd6601` moved where the windows are read (the entry hands them down)
  and not whether they come from the environment.
  This account reads the sources of the range and not those three.

## B671: the Synthetic meter reader refused a body on 2026-10-18, and no public source gives another shape

Reported on 2026-10-18 by a pre-launch reading:
`[warn] [meterRecordOf] synthetic: budget unreadable, treating as spendable
(Synthetic /quotas body violated expectations: rollingFiveHourLimit is not an object)`.
The brief said the provider changed its `/quotas` response shape.

Outcome written on 2026-10-18.
No code changed,
and a note in the head of `provider-stream/src/synthetic-quota.ts` records what was found (`5da176cf4f`).

What was searched,
with no call to the endpoint:

- The reader is `parseQuotaSnapshot` in `synthetic-quota.ts`,
  called by the Synthetic client (`provider/src/synthetic-client.ts`)
  and caught in `meterRecordOf` (`provider-meters.ts`).
  It reads `rollingFiveHourLimit` and `weeklyTokenLimit` as the shape verified on 2026-07-16.
- The repository holds that shape in its tests,
  in the handover of provider facts and in a statusline package that parses the `x-synthetic-quotas` header;
  none holds another.
  `rg --files-with-matches rollingFiveHourLimit` found the reader,
  its tests,
  the statusline package and its tests.
- Synthetic's documentation of the endpoint (`dev.synthetic.new/docs/synthetic/quotas`) still shows the older
  `subscription` block only.
- The maintainer of Synthetic answered in `slkiser/opencode-quota` issue 276 on 2026-09-15 that a bearer key returns
  the full quota JSON with `weeklyTokenLimit` and `rollingFiveHourLimit`,
  and that `subscription` and `freeToolCalls` are legacy keys replaced by named limits.
  The same issue records a key on an account the reporter took to be on the free tier,
  answered with status 200 and the body `{}`;
  Synthetic did not say whether that is intended.
  A body of `{}` is refused by this reader with the message of 2026-10-18.
- A third-party schema (`aliou/pi-synthetic`) adds fields to `weeklyTokenLimit`
  and names no replacement for the five-hour block.

So the shape change is not shown by a public source:
the warning says a block was missing or not an object,
and the body was not recorded.
No second shape was added,
and the unknown-shape path stays as it was (a warning and a budget treated as spendable).

Follow-up written on 2026-10-18.
The refusal now says what arrived,
so the next reading settles the open point without the body being kept.
`QuotaShapeError` ends its message with the received top-level key names and the JSON type of each
(`received subscription:object, freeToolCalls:object`, or `received {}` for an empty object),
or the type of a body that is no object (`received array`),
and never a value.
Key names are bounded to twenty listed, forty characters each, printable ASCII only,
since a key is provider text that reaches a log.
The meter warning carries the message whole.
Red tests: `provider-stream/src/synthetic-quota.unit.test.ts` (five bodies)
and `provider/src/provider-meter-state.unit.test.ts`
(an empty body and the older shape, with values that must not appear).
Guard demo: with the line that adds the received description removed, both cases fail.

Open:
the first reading after this change says what the provider returns,
and no second shape is read until it does.

## B672: local file times written as UTC in the account of the pairing cache version

Found on 2026-10-18 by the lead,
who read the host's zone (`date` gave 17:36 EDT where `date --utc` gave 21:36 UTC)
and the launch time of the pass (20:59 UTC) against the account.

Outcome written on 2026-10-18.
Fixed in the commit that carries this entry.

The account of B670 gave the writes of `corpus-pass-TianqiChen66626` as 16:58 to 17:00 UTC.
They were printed by `find -printf '%T…'`,
which prints the local zone,
and the label was added by hand.
`stat --format=%y` on the same files prints `-0400` beside the same digits,
and `TZ=UTC stat` prints the pairings at 20:59:08 UTC and 21:00:15 UTC and the generation markers at 20:58:54 UTC,
so the span is 20:58 to 21:00 UTC.
The TSDoc of `pairing-cache-version.ts` and B670 are corrected.
The only other copies were in those two files (`rg '16:5|17:00'` over the package).

The rule was already in `mistake-prevention-docs-and-references.md` (`find` and `stat` run under `TZ=UTC`),
and the zone scan (`clock-time-zones.unit.test.ts`) read the wrong time as it was meant to read a right one:
it passes any time followed by `UTC`.
No guard can catch it,
since the text does not say which tool printed the digits;
the prevention doc says so and names the check on the source.

## B673: reading the words of a place with recorded definitions was not built, because it reads the page the other way

Raised on 2026-10-18 by the lead as generation 19 of the artifact:
the pass records the smallest set of the page's definitions that change how the words of a place read,
the planner, the apply stage and the reader of a record read the words with them,
and the proof of an apostrophe takes them too.

Outcome written on 2026-10-18.
Red tests for the words were committed and withdrawn (`920ab9bf80`, `6a7daffc75`).
What was built is the proof of the apostrophe taking the definitions a caller gives
(red `262b62fae2`, fixed in `aababac6fe`),
which the lead named and which stands on its own.
No generation was added,
and `ARTIFACT_SCHEMA_VERSION_V18` is still what the pass writes.

What was tried,
and what it showed:

- The mechanism was built in `consistency` and not committed:
  a counter that records, for any located place,
  the cut of the page's definitions that gives the span its slot and its word reading;
  the same cut joined for the two places of a splice
  and handed to `looseMarksOf`, `withLooseMarksOf`, `inReceivingForm`, `bringsAtEdge` and `gainsBesideKeptMark`;
  and a `definitions` carried on the plan so the check of the gains reads the replaced words with them.
- The mark at the end of words reads as an apostrophe of its word after closing markup
  only when the parse of the words closes something,
  and the parse of a fragment cannot see a delimiter outside it.
  In `Take *[*]a*’ now.` with `[*]` defined in another slice,
  the page reads the mark as `trailing` (an apostrophe),
  the counter locates `[*]a*’` at offset 6 and records `definitions: '[*]: u'`,
  the span read alone holds an edge apostrophe (as the page reads it),
  and the span read with that definition holds none and one loose mark.
  The planner then said `replace` for the words read alone
  and `unavailable` for the words read with the recorded definition,
  and a reader that took the record's words with that definition
  would find the edge mark of the span to be no apostrophe.
  So recording the definitions turns a place the pass carries correctly into one it leaves,
  and a record that reads back into one that does not.
- The other direction does not occur in a located place.
  Of the 205,740 strings of three to seven characters over `* _ ~ [ ] ( ) a b ’` and a space
  that start or end in `’` and hold a bracket with a label,
  84 pass `carriesOrCutsMarkup` and read another way with the definitions of their brackets,
  and all 84 are attached alone and loose with the definition.
  A span that reads attached only with the definition (`*a [b*] c*’`) is refused as cutting markup,
  because `carriesOrCutsMarkup` counts delimiters by parity and reads the span alone,
  and the counter leaves such a place unlocated with the reason `markup`.

What the search did not show:
a random search of 1,799,159 pages and quotes found no located place that records definitions,
and the hand-built page for `Take *[*]a*’ now.` found one at the first try.
The null was a sample that rarely held an opener, a reference and a closer in that order,
and it is not evidence that the case cannot occur
(mistake-prevention, searches and censuses that miss).

No difference between the pass and the reader exists today for the words:
both read them alone,
so a place whose words read differently with the page's definitions is not planned one way and read back another.
The limit is the one that the head of `consistency-loose-marks.ts` names,
and its reason there now includes the case of `Take *[*]a*’ now.`.

Options for the lead,
none taken:

- Leave the words read alone.
  Pros: the reachable case is read as the page reads it,
  nothing changes in a record,
  no generation moves,
  and a running pass is not cut off from the run directories of generation 18
  (`assertResumableSchemaGeneration` refuses another generation).
  Cons: a span that only a definition balances stays unlocated.
- Record the page's reading of the edge marks of a located span
  (which edge holds an apostrophe of its word) in place of definitions.
  Pros: the reader takes the page's reading as the counter had it, in every case, with no parse of a fragment.
  Cons: a new key and so a generation,
  and the pass-schema guard cuts a build off from older run directories.
- Make the markup test read the span with the definitions and by pairing, then record the definitions.
  Pros: `*a [b*] c*’` is located and read as the page reads it.
  Cons: the largest change,
  it unlocates places that are carried today (the span `[*]a*’` of `Take *[*]a*’ now.` cuts the page's emphasis),
  and it needs a generation.

Ranking: leaving the words read alone,
then recording the edge readings,
then the definitions with the markup test,
because the first changes nothing the reachable case needs changed,
the second is faithful in every case at the price of a generation,
and the third carries the second's price and unlocates places the pass carries correctly today.
The attempt is kept outside the repository by the agent that ran it.
