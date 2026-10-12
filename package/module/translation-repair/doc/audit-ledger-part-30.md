# Audit ledger, part 30

Part 30 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B121: one length-changing lower case on a page switched off the archive-name casing veto

Red in `545d9a416`,
fixed in `69816085b`.
`phraseOccurrences` (`corpus-run/archive-name-runs.ts`) lowered the whole text
and returned no occurrence at all when the lower case came out longer,
since its offsets would no longer line up.
One İ (U+0130),
which lowers to two UTF-16 units,
anywhere on a page does that.
`restoreArchiveNameCasing` checks "never in another casing" with `.every` over those occurrences,
which holds over none,
so the veto stopped applying to the whole page,
and a row holding an İ was never restored.
On the red case's page,
a row writing the name "Yarn hall" was rewritten to title case
though the archive also writes the name in lower case,
and the row naming İpek kept its lowered street name.

The scan now lowers one code point at a time (`lengthKeepingLowerCase`),
keeping as written any code point whose lower case has another length,
and lowers the phrase the same way,
so offsets always line up and a kept code point still matches itself.
Measured reach:
none of the 2,837 `.md`,
`.mdx`,
`.json` and `.txt` files of the pinned corpus holds such a code point
(the probe found U+0130 in a control file holding it),
so no pinned archive triggered the defect;
shipped wording still could.
The package's other whole-text lowerings search or fold within the lowered copy
and map no offset back to the original,
so none shares it.
A read-only agent's T8 case had pinned the read-past as intended behaviour;
it was held back.

Recurrence:
`mistake-prevention.md`,
"Which fold for which question".

### B122: sorts that skipped the code-point order

Red in `e29363b19`,
fixed in `ae0a90f71`.
B95 made `compareCodePoints` the package's order for text
and guarded against locale orderings,
but nothing guarded the other way around it.
An argument-less `sort` or `toSorted` orders by UTF-16 unit,
so an astral character sorts before one in U+E000 to U+FFFF,
against code-point order.
A comparator written `left < right ? -1 : 1` orders text the same way
and never answers zero for two equal keys,
which the comparator contract requires.

`locale-orderings.unit.test.ts` gained `codeUnitOrderings`:
an argument-less sort in package source,
and a relational operator inside a function handed straight to a sort,
in source and tests alike.
Tests may still sort without a comparator:
a type-aware census
(TypeScript 5.9 from a scratch install,
since the package's TypeScript 7 has no compiler API)
found 153 such sorts in tests,
every one over text-typed values sorted to compare two sides,
which no order changes.
The red package case failed on 46 sites,
the set the census listed:
40 argument-less sorts in 31 production files,
relational comparators in `ledger-directory.ts`,
`probe-verify-sheet.ts`,
`damage-sample.ts` and `score-verify.ts`,
and two in the candidate-ledger and number-reads unit tests.

The fix added `textsInCodePointOrder` (`code-points.ts`),
which orders a list of text through `compareCodePoints` and keeps its element type,
and 39 of the 40 sorts go through it.
The comparators go through `compareCodePoints`.
`sample-draw.ts` held `compareKeys`,
a correct second copy of the comparison out of the scan's reach,
which the type-aware census found;
its three calls now use `compareCodePoints`.
The fortieth sort stays code-unit order on purpose:
`canonicalPromptValue` (`prompt-uniqueness-client.ts`) sorts record keys as canonical JSON (RFC 8785) does,
and its digest names a durable payload record another host reads,
so code-point order would be another canonical form.
It is the scan's one named exemption (`CODE_UNIT_ORDER_EXEMPTIONS`),
which the scan also fails once it no longer names a site.
The keys sorted are file names,
hex digests,
ids,
labels and model names,
so an order moves only where two keys first differ at an astral character against one in U+E000 to U+FFFF
(inference from the key formats,
with no replay),
and no cache version moves.
The full suite on `ae0a90f71` exited 0 with 1543 PASS lines.

Recurrence:
`mistake-prevention.md`,
"Text by code point".

### B123: a link literal the parser builds without a position makes the footnote relabel refuse the page

Status:
fixed in `9d7bbbec2` (red case in `23137d784`),
2026-10-04.
Found 2026-10-02 (UTC) reviewing what the T8 bundle 1 agent left,
and written only into `23090a91d`'s commit message until 2026-10-03,
when the handover to the trial model copied it here.
`activeFootnoteMarkers` (`src/active-footnote-markers.ts`) walks the parsed body
and reads each text node's raw bounds off `node.position`;
a text node without one throws `FootnoteRewriteError` of kind `position`
(the check reading `start` and `end` in the text-node arm of the walk).
The commit message names the source of such nodes:
`mdast-util-gfm-autolink-literal`'s transform builds text and link nodes with no position
wherever its pattern finds a literal micromark did not tokenize,
such as `www.` after a quote mark,
a comma or CJK punctuation,
and any literal after an unbalanced `[`.
On a page holding a footnote and one such literal,
the relabel refuses the whole page and the archive is kept.
That session's census of the 279 pinned `.md` and `.mdx` files found none that triggers it
(`b1-review/corpus-unpositioned.mjs` in its scratch folder).
Bundle 1 left this stretch uncased on purpose,
since a case written against the code as it stands would pin the refusal.

Measured on 2026-10-03 against the build of `98e94e584`,
calling `applyFootnoteRelabel` with the one rewrite of label `1` to `2`:
`A cat[^1] naps.` with its definition relabels,
while the same text holding `"www.example.com"`,
`[www.example.com`,
`，www.example.com。`
or `,www.example.com`
throws `FootnoteRewriteError` with the `position` kind's message
(`footnote rewrite: parsed marker positions do not match raw syntax; ...`).

The fix reads the raw behind each unpositioned run (`9d7bbbec2`),
the run bounded between its positioned neighbours
(the parent's own bounds at either end)
and scanned with `gfmMarkerSpans`,
which is escape-aware and reads labels as
`micromark-extension-gfm-footnote` 2.1.0 does.
The installed tokenizer settles the design:
a call forms only when its identifier is defined somewhere in the document
(`callData`'s `defined.includes` gate at `]`),
so an undefined `[^9]` stays in the text
and the walk's literal-looking recovery exists for exactly it.
That category rides in unpositioned runs too
(the probe put `，www.example.com[^9]` in one),
so skipping unpositioned nodes would lose the recovery;
a check off node values would mistake an escaped opening for a marker,
since a decoded value erases the escape backslashes;
and reconstructing positions would authorize edits off offsets no token
carried.
Probes on the built package:
`~/temp/agent/mimo-trial/b123-probe.mjs` and `~/temp/agent/mimo-trial/b123-probe2.mjs`.
No cache version moves:
the pinned corpus at `a41fc607e` holds 279 `.md` and `.mdx` files,
68 with marker text,
and none of those parses into unpositioned nodes
(`~/temp/agent/mimo-trial/b123-corpus-scan.mjs`),
so the relabel changes nothing a cache entry keys on.
The red case and three contract cases
(the undefined reference riding with the literal relabels in both
measured shapes,
an escaped opening and the malformed ones stay byte-identical)
sit in `apply-footnote-relabel.unit.test.ts`.

### B124: a refuser held out for no time ended the call as every provider dry

Red in `804ae3e85`.
Found reading `budget-hold-wait.ts` for the T8 bundle 2 review.
`markRefused` (`provider-budget.ts`) holds a refuser whose meter reads wet for the rate-limit backoff
only when another provider reads wet,
so the calls move there;
with every other provider dry it holds it for no time,
and the transport ladder paces the retries
(XIEPT2,
2026-09-03).
The router then asked again with that refusal folded in,
and `readBudgetsPastHolds` read every provider dry,
found every hold at 0 ms,
and raised `EveryProviderDryError`,
whose message says Synthetic has no five-hour or weekly credit left,
while its meter read wet.
The two rules were each right alone:
the budget layer meant the refuser to stay spendable at once,
which its own case asserts ("HOLDS NOTHING when a wet provider refuses us"),
and the hold wait meant a just-refused provider to read dry.

Measured:
a probe on the built package
(the real `createProviderBudgets` and `createRoutingClient`,
stub meters with Synthetic wet and the others empty,
a Synthetic caller refusing one call with a 429)
asked Synthetic once and threw,
holds all 0 ms,
for a four-provider seat and a Synthetic-only one
(`t8-par/b124/wet-refuser.mjs` in the audit scratch).
Among the 8,511 `.log` files under the agent scratch
(walked three levels deep,
as the P1 measure walked),
166 all-dry errors name a refuser "just refused this call" with every hold at 0 ms,
all in the Uekawakuyuurei pictures log of 2026-09-04,
beside 166 zero-hold refusal lines there;
each was logged "voice lost",
so the seat's voice was lost each time,
not the run
(`stage-call.ts` catches the error per seat).
The huasheng4 log's 34 all-dry errors all waited out a hold first,
so they are not this.

The fix:
`readBudgetsPastHolds` returns the first reading,
the refuser wet in it,
when the provider that just refused reads wet by meter and has no hold left,
and logs that it asks that provider again.
A unit case pins that reading,
and a router case drives the real budget layer:
Synthetic refuses once,
is asked again,
and answers.
The probe on the fixed build asks Synthetic twice and is answered both times.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

### B125: a decision seat's distribution recorded as an objection

Red in `1faf181ae`.
Found reading the T8 bundle 2 change to the typed ballot's reason.
A typed decision seat answers the select ballot with a number and a distribution,
and `readTypedBallot` (`candidate-select-decision.ts`) writes
`typed decision: probabilities ..., confidence ...` as the ballot's `reason`.
`shipPreferredPastDecline` (`translate-runoff-tie.ts`) took the reason of every ballot
that did not back the shipped candidate as an objection,
so a decision seat's numbers entered `shippedPastDecline.objections`
beside the written judges' words.
The red case seats the three written judges and `SEAT_OPENROUTER_DECISIONS` on a slate
declined over wording that cannot ship,
and the objections read the rejection and the distribution.

No page was harmed,
measured as far as the stores reach:
only the consolidation slate's objections reach a refiner (`consolidate-settle-gate.ts`),
and that slate seats no decision seat
(a probe on the built package,
`t8-par/b125/seated.mjs` in the audit scratch,
printed `late judges include a decision seat: false`,
with the decision seat among the eight select judges);
the translate lane's objections have no reader.
Of the `.log` files under the agent scratch,
174 outside the audit's own scratch record a typed ballot,
and none outside unit-test runs records a decline shipped by preference;
no stored JSON but coverage maps carries `shippedPastDecline`,
and the 290 JSON files in the worktree's runs directory hold no typed reason.

The fix:
`shipPreferredPastDecline` leaves out the ballot of a decision seat,
named by `isDecisionSeat` on its model rather than by the reason's label,
which a written judge's words could begin with.
A `run-seats.unit.test.ts` case pins that the consolidation slate seats no decision seat
under any reading,
with the select benches seating it as the control;
adding the decision seats to `slateJudges` turned it and two older cases red,
and the seating was restored.

Recurrence:
`mistake-prevention.md`,
"One field carrying two kinds of text".

### B126: a link's empty label returned its markup for a name

Red in `98e94e584`.
A T8 bundle agent's case in `contributor-name-authority.unit.test.ts` wrote it:
"READS NO NAME from a link whose label is empty,
which shows a reader nothing,
rather than its markup (T8)".
`contributorForm` (`contributor-name-authority.ts`) finds a link's label end with
`unmarked.indexOf('](')`
and returned the token unchanged when `labelEnd <= 1`.
That one check joined two cases:
`-1`,
no `](` at all,
where the token is a plain name such as `[Whisker`,
and `1`,
an empty label `[](...)`,
whose visible form is the empty string.
The empty label instead returned its whole markup:
the case expected `['Pebble']`
and measured `['[](https://example.test/whisker)', 'Pebble']`.

The fix:
the check returns the token only where no `](` exists (`labelEnd === (-1)`),
so an empty label slices to the empty string,
which `archiveContributorNameForms` drops through its `nonempty` filter,
and the `@returns` names the empty link label beside the empty token.
The reader keeps its scan;
moving it onto the Markdown parse,
which the recurrence's rule asks for,
is a larger change no finding here asks for.

No cached decision changes,
inference from one search of the pinned corpus:
`git -C ~/one-among-us/data grep --line-number --fixed-strings '[](' a41fc607ea5a70d8a7625cc67d5ed8c444f53379`
prints six lines and every one reads `Binary file ... matches`
for a photo under `people/`,
no text line,
so no contributor line (`CONTRIBUTOR_LABELS`) carries an empty-label link
and the contributor floor protects the same pages as before.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B127: a sample size that was not a whole number drew a slot from every band on every pass

Red in `1d3f3dafe`.
Found on 2026-10-05 (UTC),
reading the MiMo trial's production diff once the trial was merged.
`allocateBandQuota` (`sample-draw.ts`) hands a sample's slots to the size bands one at a time,
round-robin,
and stops when `remaining` reaches exactly zero.
The trial's T8 change replaced the loop's no-progress break with a count of passes taken from the size,
and a size carrying a fraction steps over zero:
on the build of `7f069adc9`,
ten candidates a band and a size of 2.5 returned three slots a band,
nine handed out for two and a half asked
(`node --eval` against the built package).
The loop as it stood at `28303c42a` ran while `remaining` was over zero,
which ends that call at three slots;
that is read off the source,
since no build of that commit is kept.

No sample was harmed:
the one production caller,
`corpus-run/draw-sample.ts`,
passes `DEFAULT_SAMPLE_SIZE`,
the whole number 50.
The function is exported,
so the fraction is an input its signature admits.

The fix:
`allocateBandQuota` refuses a size that is not a safe whole number,
zero or more,
with a `RangeError` naming the size,
the way `assertSourceBytes` in `sample-grading.ts` refuses a byte count.
With the size whole the trial's pass count is exact,
and it stays.
The cases refuse 2.5,
-1,
`NaN` and `Infinity`,
and hand out nothing for zero.

The trial's other change to the file stands.
It dropped the issue-key tiebreak from `selectFromBand`:
a rank is a position inside one entry's bucket and `byEntry` keeps one bucket an entry,
so two candidates of one rank never share an entry key and the comparison never ties.
The `issueKey` field the comparator stopped reading is gone from `RankedCandidate`,
and the comment gives that reason
in place of "the stable order settles anything else".

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B128: a claim's quoted side chosen again, by its raw text

Red in `0938d6a21`,
fixed in `9ff566830`.
Found on 2026-10-05 (UTC) by an independent reviewer
reading the cases the MiMo trial added,
one of which asserted the wrong result as the intended one;
it was reproduced on the built package before anything changed.
The trial changed neither production file
(`git diff 28303c42a 7f069adc9 --stat` printed nothing for them):
the defect is older than the trial.

A prober's claim of introduced damage quotes one of two sides,
wording the edit added (`evidence`)
or wording it dropped (`omittedText`),
and `screenEvidence` (`introduced-defect-screen.ts`) decides which by the screened text of each.
Two readers decided again,
by whether the raw `omittedText` was the empty string:

- `toClaim`,
  in the same module,
  chose the quote that `restatesPriorIssue` compares with the accepted issues.
  A claim corroborated on its evidence,
  its omitted side three spaces,
  was compared on the spaces,
  restated nothing,
  and stayed `corroborated`:
  counted as damage the edit introduced,
  though its evidence restated an accepted issue.
  The same claim with an empty omitted side was `pre-existing`
  (probe of the unfixed build).
  The wire guard admits any string in `omittedText`.
- `renderClaim` (`corpus-run/probe-verify-sheet.ts`) chose the quote and the direction a human grader is shown:
  the same claim was printed as "wording the edit DROPPED" over a quote of three spaces
  (same probe).

`screenEvidence` itself asked whether a side was blank of trimmed text,
which keeps every invisible character that is not whitespace.
A one-sided claim with a zero-width space (`U+200B`) or a Hangul filler (`U+3164`) on its other side
read as anchored both ways and was called `unanchored`,
so a claim of real damage was set aside as a wire fault
(the red run printed `unanchored` for both).
That is the question "Text that shows nothing" gives to `rendersAsNothing` (ledger B40),
asked here of an empty-string comparison.
The red run of the two test files printed 3 [PASS] and 6 [FAIL] lines for the screen
and 3 [PASS] and 4 [FAIL] lines for the sheet.

The fix:
`screenEvidence` asks `rendersAsNothing` of each side.
`toClaim` takes the side from the verdict it holds
and compares the screened text the differential read,
with the prior quotes through the same screen;
`renderClaim` takes the side from the claim's recorded admissibility.
`restatesPriorIssue` returned false for a blank quote;
no corroborated claim reaches it blank now,
and a blank quote that ran on would sit inside every prior quote and dismiss the claim,
so the return is an `unreachable:` throw.
`renderClaim` throws likewise for a claim the screen did not corroborate:
`probe-verify.ts` hands a sheet only corroborated claims,
and the damage sample strips claims before formatting.

The trial's case,
"KEEPS a corroborated claim whose quoted side flattens to nothing out of the prior-issue dismissal",
pinned the defect,
and could not have failed on the guard it named:
its issue carried an id the region did not serve,
so no prior quote was ever compared.
It is replaced.
The sheet test's fixture marked every claim `corroborated`,
one of them carrying both sides,
which the screen calls `unanchored`;
it takes each claim's admissibility now.

Whether a corpus run ever met such a claim was not measured:
no stored probe artifact was read for a padded or invisible omitted side.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal" and "Text that shows nothing".

### B129: a span checked against the first node of a repeated id

Red in `4185c097a`;
fixed in `e9ad88d97` by a throw that broke a caller's contract,
and corrected in `ca7677605`.
Found on 2026-10-05 (UTC) reading `validate-issue.ts`.
`validateSpanAnchor` found the node a span names with a search that stops at the first node carrying that id.
Handed a document with a second node under the id,
it checked a span built against the second node against the first:
a correct span over a copy of a parsed document in which every block carried the span's id
came back `stale-node-hash`,
"the base drifted",
for a base that had not
(probe of the unfixed build of `80e129926`).
A rejection is fed back to the model that wrote the claim,
so the wrong kind would have sent it a retry prompt about an anchor that was sound.

No run was harmed:
`parseDocument` ids its blocks `block/<index>` (`document-node.ts`),
and the one production caller of `validateIssueClaim`,
`resolveCriticIssue` (`critic-wire.ts`),
passes parsed documents.
The function is exported and its `AnchorTarget` parameter admits a hand-built document,
which is how the case builds one without a cast.

The first fix,
`e9ad88d97`,
gathered every node under the id and threw an `unreachable:` error naming the side and the id
before any rejection was decided.
It was committed on its own test file,
and the whole suite run on `9ff566830` printed 1564 [PASS] and 3 [FAIL] lines:
a `critic-wire.unit.test.ts` case,
"refuses a claim when caller-supplied documents list two nodes sharing one id whose hashes disagree",
hands `resolveCriticIssue` such a document and expects the claim refused with a reason.
That case had pinned the mislabel,
`anchor-validation (stale-node-hash)`.
It also showed the design the throw cut across:
this module's contract is that a defect of a claim's anchors comes back as data,
and `resolveCriticIssue` ends on a gate that turns any rejection into a named refusal of the claim.
A throw for one kind of document defect bypassed both.

The fix as it stands:
the repeated id is a rejection of its own kind,
`repeated-node-id`,
whose detail says the document lists the id more than once,
so the label is true,
nothing throws,
and the gate's refusal reads `anchor-validation (repeated-node-id)`.
Both cases were changed to expect that first and failed against the throwing build;
on `ca7677605` the whole suite printed 1564 [PASS] and 0 [FAIL] lines,
the lint read `Found 0 warnings and 0 errors.`
and the scans 35 [PASS] lines.
No production reader branches on the rejection kind:
`AnchorRejectionKind` appears outside `validate-issue.ts` only in the package index's export list and in tests.

The process lesson:
a fix that turns a module's rejection-as-data into a throw changes its contract,
and runs against every caller's cases,
by the whole suite,
before it is committed.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation" and "Tables keyed by text".

### B130: a code span after an escaped backtick left unprotected

Red in `b1fd99dc2`,
fixed in `52c5ca829`.
Found on 2026-10-05 (UTC) reading the T8 trial's cases in `prose-ranges.unit.test.ts`,
where an independent reviewer found one asserting an empty result for a bare double backtick,
a result that holds with or without the check the case named.
`constructEnd` (`corpus-run/prose-ranges.ts`) answered "no construct" for any backtick whose previous character was a backtick.
The check dates from `1873b23dc`,
when code spans were found by a hand scan.
They come off the parse now,
in `codeSpans`,
keyed by the starts the parse gives its spans,
and the one span whose opening backtick follows a backtick is the span after an escaped backtick,
which the check hid:
in a sentence holding an escaped backtick directly before a code span,
the parse reads the span at offsets 8 to 14 and `protectedRanges` returned none,
so a prose rewrite could reach inside it.
The red run printed 1 [PASS] and 2 [FAIL] lines,
the case failing with `expected [] to deeply equal [ { start: 8, end: 14 } ]`.

No page was harmed as far as the corpus shows:
at the pinned commit no Markdown file holds an escaped backtick directly before a backtick
(`rg` counted 0 files,
against 7 holding any backtick);
a model's wording could.

The fix:
the backtick arm asks the parse's spans alone.
The file's cases for a bare double backtick and for a fenced block return the same ranges with the check gone.
The trial's other four cases in the file asserted a length,
or a length of zero or more;
each asserts its whole range list now,
on inputs the reviewer's mutants tell apart
(a closing brace inside a line comment,
inside a template literal,
and inside a block comment that never closes).

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse" and "Guards that cannot fail".

### B131: a directory id with no Latin letter stood on any alias without one

Red in `cd37ea51a`,
fixed in `dc4d651a1`.
Found on 2026-10-05 (UTC) by an independent reviewer,
behind a T8 trial case whose source fixture carried no alias,
so the comparison it named never ran.
`directoryIdNameStands` (`corpus-run/directory-id-name.ts`) asks whether the source's own aliases carry the directory id
by comparing Latin letters alone (`latinLettersOf`).
An id with no Latin letter reads as the empty string,
and so does an alias in another script:
the two compared equal,
and the id stood as the page's visible name.
The red case gives an id of punctuation,
one of digits and one in Han each a source whose only alias is a different Han name:
`expected [ true, true, true ] to deeply equal [ false, false, false ]`,
1 [PASS] and 2 [FAIL] lines.

No page was harmed as far as the corpus shows:
the reviewer counted 93 entry directories at the pinned commit,
none named without an ASCII letter;
that count was not repeated.

The fix:
an alias carries the id where it is the id character for character,
or where the id has Latin letters and the alias's Latin letters equal them.
The first arm keeps an id in another script standing on its own alias,
which the letters rule alone would drop once an empty reading stopped matching.
Three sibling cases fed their guards values the code after the guard refuses anyway;
each now also feeds the value only the guard stops.

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B132: a spend record with no logger prefix ended the cap census

Red in `66fa8de2e`,
fixed in `83942a8b4`.
Found on 2026-10-05 (UTC) deciding the T8 hunks of `corpus-run/cap-census-read.ts`,
and independently by a review of the trial's cases.
The trial turned `stampOf`'s `line.split('] [',)[1] ?? ''` into `nonNullishOrThrow(...)`,
on the reason that both line markers carry the bracket the split reads.
The stream marker does (`'] [reportStreamProgress] stream '`);
the spend marker is `'SPEND '`,
and `readSpendLine` reads a record at the start of a line or behind any space.
So `readCapLog` handed `stampOf` a spend line with no `] [`,
and the census threw `Expected non-nullish value, got undefined`,
where B73's rule is that a line whose stamp the logger did not write is left out and counted.
The red run printed 3 [PASS] and 3 [FAIL] lines.
No run log was read,
so whether a census ever met such a line is not known;
the spend reader documents the bare form as one it reads.

The fix:
`stampOf` returns `unstamped` where the line has no second bracket,
and a `cap-census.unit.test.ts` case pins a bare spend line and one behind `[info] `
as left out and counted.
The same file's wrong-unit case could not tell a stream line read from one skipped;
it now follows each misread stream line with its spend line.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B133: a parenthesis that was no gloss took the handle's gloss beside it

Red in `5f931f0a2`,
fixed in `754e50dd2`.
Found on 2026-10-05 (UTC) by a review of the T8 trial's cases,
behind a case named "PLACES NO GLOSS" that asserted a prefix of the damaged heading.
`appearancesIn` (`corpus-run/handle-gloss-place.ts`) read a handle followed by a parenthesis that was no gloss
(empty,
never closed,
or closed only by a mark on a later line)
as an appearance with no gloss.
Where that appearance was the handle's earliest,
`placeOne` wrote the gloss another appearance carried in front of the open parenthesis,
and stripped it from the appearance that had it:
a heading `### Ten: Jinmao (Brocade Cat` over a signature carrying `Jinmao (Brocade Cat)` became
`### Ten: Jinmao (Brocade Cat) (Brocade Cat`.
The same happened across two slices and for `Jinmao ()`.
The defect is older than the trial,
whose case pinned it.
Whether a shipped page ever carried a doubled gloss was not measured.

The fix:
such an appearance is left out,
as the module's rule for a parenthesis holding markup already had it (ledger A6),
and the scan goes on from the handle's end,
since the closing mark may belong to another appearance's gloss.
The case asserts the three pages come back whole with no finding,
and was red at `5f931f0a2` (1 [PASS] and 2 [FAIL] lines);
a second case asserts whole that a handle inside a longer word is no appearance,
which the old `toContain` could not tell from a gloss written after it.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B134: a lookup cache file cut short took its title's evidence away on every later run

Red in `8c7426a44`,
fixed in `971c8bec8`.
Found on 2026-10-05 (UTC) by a delegated agent
reading `readCachedLookup` (`lookup-cache.ts`) against its own `@returns`,
"a miss when the file is absent or is not a record".
The read ran `JSON.parse` on the file's text with no catch,
so a file cut short raised a `SyntaxError` out of `lookupWorkTitle` (`work-title-lookup.ts`).
`workTitleLookupLines` caught it with every other failed lookup,
logged that the title's lookup failed and contributes no line,
with the parser's words and no path,
and returned no line for the title.
Nothing was bought and nothing rewrote the file,
so every later run met it and the title never had its evidence again.
V8's refusal can quote ten characters of the text it refused,
so that warning could carry a cache file's opening.
An empty file,
which a write refused before its first byte leaves,
read as absent with no line,
and `textOrNothing` read every other read failure as absent too,
at debug level:
with a directory at the record's path,
the title was bought on each of two runs and never kept.
The write was a plain `writeFile`,
which truncates before it writes:
under a per-process file-size limit standing in for a full disk,
a plain write left 512 bytes of a longer record at the cache path.
These are the agent's measurements,
on its builds of `f0f449765` and of `7f069adc9`,
whose cache modules are the tip's.

No run was harmed as far as this machine's cache shows:
the agent counted 58 lookup records and 14 reference records,
all whole,
none empty;
the run logs were not searched.

The fix:
`cacheFileText` answers `CACHE_FILE_ABSENT` only where nothing stands at the path (`isMissingPathError`)
and raises `CacheFileUnreadableError`,
whose message names the filesystem code and the path,
for any other read failure;
`readCachedLookup` takes the parse failure as data (`parseModelJson`),
warns `cached lookup at <path> does not parse as JSON; ignoring it` and misses,
so the caller buys the record once and the write replaces the file;
`writeCachedLookup` writes through `writeFileAtomic`.
The class is listed among the classes whose message names only a code and a path
(`message-names-only.unit.test.ts`).

Red on the tree of `8c7426a44`:
both cache test files exit 1 at load,
since the cases assert the class the fix adds.
The per-case reds are the agent's,
on the build before the class existed.
The whole suite on `971c8bec8` printed 1581 [PASS] and 0 [FAIL] lines,
the lint `Found 0 warnings and 0 errors.`
and the scans 35 [PASS] lines.

Open to the owner's veto:
a file that is there and cannot be read is a refusal,
not a miss,
since a miss buys the record and then meets the same path at the write,
paying on every run and keeping nothing;
that is the package's rule in `missing-path-error.ts`,
and what `readAttemptMap`,
`readNamespaceGeneration` and `readPayloadText` do.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back".

### B135: a reference cache file cut short failed the entry citing its page on every run

Red in `8c7426a44`,
fixed in `971c8bec8`,
with B134,
whose twin `readCachedReference` (`reference-cache.ts`) is.
`citedReferenceBlock` (`cited-reference-lookup.ts`) reads every cited page's cache file before it buys anything,
outside the catch that turns one page's failed fetch into a line,
so the `SyntaxError` of one file cut short rejected the whole block:
on the agent's build of `f0f449765`,
a raw `SyntaxError` and no transport call.
The rejection leaves `preparePassEntry` and is tallied by `runEntryPipeline`
as an entry error naming no file
(read off `tally-error-text.ts` by the agent,
not run end to end),
on every run until someone found the file and deleted it.
A directory at a page's path read as a miss instead:
the page was bought on each of two runs,
its record never kept,
and its line said it could not be fetched.

The fix:
`readCachedReference` reads through `cacheFileText`,
takes the parse failure as data and misses with
`cached reference at <path> does not parse as JSON; ignoring it`,
so the page is bought once and its file replaced;
a path that is there and cannot be read raises `CacheFileUnreadableError`,
which rejects the block before anything is bought
and reaches the tally line with the code and the path;
`writeCachedReference` writes through `writeFileAtomic`.
`reference-cache.unit.test.ts` is new,
so `reference-cache.ts` leaves the own-tests allowlist.

Open to the owner's veto:
for a work title the existing catch in `workTitleLookupLines` turns the refusal into no line,
with a warning naming code and path;
for a cited page the block rejects and the entry is tallied as an error.
The asymmetry is the callers' existing design.

Open,
found by the same agent's audit of every `JSON.parse` of a file and every plain writer:
`readTrialLedger` (`corpus-run/window-trial-ledger.ts`) tolerates a line that does not parse only when it is the last,
and `appendTrialRow` appends a row with no newline before it,
so after a torn last line the first row a resumed run appends is joined onto the fragment and lost,
and a second makes the read throw a raw `SyntaxError`
(the agent's measurement:
one row and a fragment read as 1 row,
1 again after one appended row,
and a `SyntaxError` after two),
handed to the agent that owns that module;
`readBaselineCensus` (`corpus-run/coverage-census-input.ts`),
`bundleScriptsOf` (`corpus-run/coverage-file.ts`) and `readSourceMap` (`corpus-run/coverage-lines.ts`)
each run `JSON.parse` bare while each `@throws` promises its own class,
and `census.json` is written by a plain `writeFile`;
`writeFileAtomic` leaves `<path>.<pid>.partial` behind when its write fails (the agent's measurement);
`runs-lock.ts` creates the lock empty and then writes it,
and a starter that finds it unreadable takes it over,
so a second pass starting between the two could evict a live holder
(an inference from the code order,
not measured);
`work-title-lookup.ts` and `cited-reference-lookup.ts` log `String(error,)` of whatever they caught,
and V8's message for a provider body that is not JSON quotes ten characters of it,
where `refusalText` exists for that;
and `BedrockLedgerShapeError` names the ledger line and not the ledger's path.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back".
