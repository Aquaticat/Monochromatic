# Audit ledger, part 11

Part 11 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Test suite, continued

### T8: code no unit test runs, continued

The sixty-sixth cluster of that census,
`resolution`,
against `census-TXnKot` at `250b09177`:
3 line stretches over `resolution-wire.ts`
(`8bb2ce647`).
Two cased:
the reply that is no object
and the check that is no object.
Left:
the issue's non-number refusal
(`328`),
the guard's single-line return
the census's attribution leaves cold.
The reach census (`~/temp/agent/mimo-trial/reach-resolution.log`)
reads `ran 2, still cold 1`.
No B entry found.

The sixty-seventh cluster of that census,
`claim`,
against `census-5tlfGG` at `11ae619cb`:
3 line stretches over `claim-panel-voters.ts`
and `claim-filers.ts`.
Left:
the empty-ballots return
(`claim-panel-voters.ts:54`),
the missing-filers fallback
(`claim-filers.ts:253`),
and the no-claims-on-record return
(`262`):
the cases need the `AdjudicatedIssue`'s full fixture shape,
whose fields the attach map reads directly.
The reach census was not run for a landed case;
none landed.
No B entry found.

The sixty-eighth cluster of that census,
`corpus-run/canadian` (second pass),
against `census-2aJKLC` at `11ae619cb`:
3 line stretches over `canadian-date-read-leading.ts`
and `canadian-spelling-capital.ts`
(`52a5e2c9c`).
Landed:
the date cases given leading dates
(the reads run on the document's leading date;
the earlier shapes sat mid-sentence).
Left:
the year-refused return
(`259`),
the runs-on comma
(`335`),
and the underscore count
(`463`):
the cases assert their rewrites,
the three lines' returns the census's attribution leaves cold.
The reach census (`~/temp/agent/mimo-trial/reach-canadian2.log`)
reads `ran 0, still cold 2`.
No B entry found.

The sixty-ninth cluster of that census,
`corpus-run/publish`,
against `census-cLOz3U` at `63adf51b8`:
3 line stretches over `publish-fixed.ts`
(`320`,
`321`).
Left:
the three trace fallbacks
(the dropped-destination warn's `trace?.sourceSlices ?? []`
and siblings):
the trace's lists go absent where the address
is dropped from the page but absent
from every slice's text,
a fixture whose artifact destination fields
this pass did not build.
No case landed;
the reach was not run.
No B entry found.

CORRECTION (2026-10-05),
self-named:
the eight paragraphs above that explain cold lines as
"the census's attribution"
(the spend,
slice-cache-namespace,
model-content,
lookup-cache,
lane-contest-cache-store,
nudged-reask,
resolution-wire,
and canadian groups)
were wrong.
Re-verified against each run's own census byte spans
and V8's own ranges on the coverage build,
every one of the eight traced to my own fixtures or assertions:

- `resolution-wire.ts` 328 was covered all along:
  V8 reports the return's bytes with count 1,
  and the run's cold span `[11812..11892]` begins after them.
  The stretch's line label starts at the boundary line,
  so the words "still cold 328" named a span holding
  lines 329 to 331.

- `lane-contest-cache-store.ts` 59 to 61:
  the guard reads the archive field of each BALLOT
  (line 84 inside `isLaneContestBallot`),
  and my case put `archive` on the outcome.

- `nudged-reask.ts` 147,
  153,
  159:
  my first reply carried no `servedBy`,
  so the function answered from the untagged reply
  before the re-ask ever ran;
  and both assertions read `kind === 'ok'`,
  which every path returns.

- `canadian-date-read-leading.ts` 259:
  the refused year arises where four or more digits
  fail the clean-year read
  (the example shape is `May 3 20233`);
  my "no year" text took the none path.

- `canadian-date-read-leading.ts` 335:
  the runs-on comma belongs to `yearMonthDay`
  (the year-first form,
  such as `2026 May 3rd`)
  and needs an ordinal day;
  my texts went through the month-first and leading readers,
  whose own `closingComma` produced the commas
  my expected strings looked for.

- `canadian-spelling-capital.ts` 463:
  the counter runs inside `insideEmphasis`,
  which the respeller calls only for a capitalized candidate word;
  my lowercase word never reached it.

- `spend-read.ts` 238:
  the negative-count return is the same literal as the returns
  beside it,
  and the assertion could not tell them apart;
  the file's own known-good tail now proves the readable path
  beside the refusals.

- `spend-read.ts` 345's `?? ''` is dead code
  (`String.split` always yields at least one piece)
  and became `nonNullishOrThrow`.
  The remaining sites in these groups
  (`lookup-cache.ts` 193 and 221,
  `slice-cache-namespace.ts` 266 and 378,
  `model-content.ts` 36)
  were covered by their cases as written:
  the runs' own byte spans exclude those statements,
  and the residual spans are neighbouring statements
  other cases cover.

VERIFIED TOOL FACTS
(kept for later readers of these censuses):
the suite prints one info line per suite
listing its fulfilled children's names,
per-case `[PASS]` lines are debug level,
and empty-name suites log at debug
(`package/module/test/src/describe.ts`),
so counting `[PASS]` lines counts named suites,
not cases;
a cold stretch's line label can start at the line
before the cold bytes
(the piece begins at the boundary after an executed statement),
and the run's own census JSON carries the byte spans
(`bundle`,
`start`,
`end`)
whose slice of the coverage chunk's text names the exact statement;
the verdict line's words are derived from baseline stretch boundaries
matched against merged spans and can misattribute;
the coverage build is unminified for exactly this reason
(`package/module/translation-repair/mise.toml`,
`coverage-census:build` says compression folds guards into expressions
V8 gives no range for,
ledger M79);
and `isJsonRecord` is object and non-null and not-array
(`src/json-guard.ts`).

METHOD FROM HERE:
a case counts as covering a branch only where its assertion
distinguishes that branch from the other paths returning the same value,
and the run's own census bytes exclude the target statement
from the cold set.
A passing suite is not branch evidence.

RE-VERIFICATION COMPLETE (2026-10-05):
the fixture-reasoned left sites are re-verified
by byte span too,
and all but one now carry cases
whose assertions distinguish their branches:

- `photo-reference.ts` 133 and 303 covered:
  the reduce's earlier-mark arm needs one element
  carrying two quote kinds,
  and the asset-directory refusal needs a path
  starting with the entry placeholder
  but not the photos directory
  (my earlier path failed the placeholder check first
  and returned the same value there).

- `dropped-destinations.ts` 187 and 292 to 295 covered:
  the reduce's second arm needs one text carrying
  both scheme kinds
  (mine carried one scheme twice),
  and the empty return is the tree-side shape
  where the destination is all punctuation
  (a scan run always starts with a scheme character).
  Its run-advance fallback (241)
  was provably dead
  (the end scan always consumes the scheme)
  and became the plain advance.

- `active-footnote-markers.ts` 309 to 335 covered:
  the four bounds arms split between a run at its
  parent's ends
  and a run between positioned neighbours.
  The autolink transform rebuilds the surrounding text
  unpositioned too,
  so the far side needs an inline node
  that keeps its positions.

- `claim-panel-voters.ts` 54
  and `claim-filers.ts` 253 and 262 covered:
  the empty-ballots return needed an issue
  whose readings carry the claim,
  and the filers fallback was dead behind its own filter.

- `publish-fixed.ts` 320 and 321 were dead
  behind the shared dropped list
  and the trace type's required fields;
  they became `nonNullishOrThrow`.

- `model-card-derive.ts` 366 covered
  through `recordOver`'s own keys;
  421 to 427 remains UNRESOLVED
  with the cause known:
  both its inputs are the module's own card
  and roster tables,
  so the disagreement it guards is data drift
  no test fixture can stage.

Two of the re-verification edits put TSDoc blocks
before statements;
the attachment scan caught both,
and they are comments now
(fix-forward,
never amend).

Suite at the close:
1,564 [PASS] and no [FAIL];
35 source scans and no [FAIL].

PUBLISHED-PAGE RE-VERIFICATION (2026-10-05):
the incumbent-map fallbacks
(`published-page-check.ts` 179,
196,
236)
are dead:
`wouldShipTextPerSlice` walks the same
`artifact.comparison` the map is built from
(an earlier fixture cut the comparison
and the results proved identical),
and they became `nonNullishOrThrow`.
The filled-anchor caveat
(`published-page-disagreement.ts` 99 to 100)
now has its case,
its message pair distinguishing the floor
from the outright comparison.
The unweighable guard (552)
cannot fire after the refutes check
(`pageWeightRefutes` returns false for unweighable)
but narrows the types,
so it became an `unreachable:` throw,
its line cold by design
(ledger M112's shape).
One position word left a comment
and the position-reference scan caught it (WR5),
fixed forward.

DECLINED RE-VERIFICATION (2026-10-05):
the flatMap's node read
(`declined-target-runs.ts` 193 to 196)
cannot miss
(the `isDeclined` filter keeps only target-only steps
and the alignment indexes the same node list),
so the kind ternary and the undefined arm
became one `nonNullishOrThrow`
under a type-guard filter.
The empty-pairing refusal (158)
now has its case
(an empty source side yields no paired step
and no source-only step to stop earlier).
The four spans first left open
with the cause "the aligner's `continuesPairing`
emission rules unmapped"
were then covered anyway,
and that cause was itself unverified:
`declinedTargetBlocks` takes its steps as an argument,
so hand-built steps suffice.
Their fixtures need a `paired` step
(the no-pairing guard returns early)
and the plain and continuation steps
must name different indices
(the claimed set would exclude the plain one otherwise).
All four spans are covered:
the rendering-continues machinery
and the claiming walk's source-only arm.
Two scan slips in the edit
(a TSDoc before a `return`,
a position word in its comment)
were caught and fixed forward.

WHOLE-SUITE CENSUS AND THE CLUSTERS CUT FROM IT (2026-10-06 UTC):
a whole-suite census was taken at `65bd3a645` (`census-5RzoUC`),
with the unit suite at 1,621 pass lines.
Its report reads:
library source,
103 files,
137 stretches over 380 lines,
4 functions never called;
entry files,
5 files,
17 stretches over 714 lines,
9 functions never called;
invariant throws counted apart,
41 stretches,
all in library source;
and 36 bundles no test loaded,
carrying 39 sources and 14,029 physical lines.
B231 records the fourteen chain tails that census listed as cold.
The clusters of this passage were cut from that census,
by file,
and given to agents in side checkouts.
The lead merged each patch,
with red cases committed apart from their fix;
what the lead measured stands in each commit's message,
and M121,
M123 and M124 record what the lead's reading and checks missed.

The library's cold stretches went in three clusters.
The files from a to l:
cases for twenty-two library files,
four states made loud,
one dead operand removed,
and one defect (B271),
in `f18d0b9b1` and `b8e30dce2`.
The `corpus-run` files:
cases in seventeen test files and one new one,
five defaults for states their callers rule out made loud,
and two defects (B272,
B273),
in `96dad6b2c` and `5723cd071`.
The files from m to z:
cases in seventeen test files and six new ones,
eleven silent defaults made loud or total,
and three defects (B274 to B276),
in `f45278048`,
`71974714f` and `230623bec`.
The agents of the first two clusters each report a census over their test files
that lists no stretch of the cluster's files the whole-suite census listed,
and all three list their new throws among the invariant throws
(the agents' accounts,
not rerun by the lead).
A fourth piece closed what the third left,
the fallbacks of `request-pace.ts` and the rethrow of `transient-retry.ts` (B292).

One stretch of library source stays cold on purpose.
`translate-slice.ts` keeps its quote-loss refusal,
which ships the whole archive by the owner's rule of 2026-09-27 and which no input reaches,
since the floor counts the same passages.
The lead's ruling,
open to the owner's veto:
it stays as a defence the owner decided,
and the final census is expected to list exactly this stretch in library source.
The owner ruled on 2026-10-10 (UTC),
asked in this form,
that the refusal stays as it is,
over turning it into an `unreachable:` throw,
which would crash where a run must ship,
and over removing it;
the card for B113 on the review page states the same call.

The runner entry files came next,
the work this entry had left for after the library.
A runner's procedures moved out of its entry file into modules beside it,
each with a test file of its own over scripted clients and readers,
and each command gained a suite that runs it as built,
in a child process that holds no key (B291).
The entry file keeps its wiring and one call.
Nine clusters,
34 commands,
were merged by `f8e99b84d`,
with entry lines after and before by each agent's count:

- `ledger-report`,
  `run-timing-report`,
  `spend-report` and `meter-report`
  (58,
  32,
  28 and 34 lines,
  from 378,
  271,
  463 and 496),
  in `5e116395a` and `387af02b7` (B278 to B281);
- `probe-sensitivity`,
  `probe-verify`,
  `probe-relabel`,
  `checker-sensitivity` and `audit-sensitivity`
  (61,
  57,
  78,
  50 and 118,
  from 190,
  264,
  306,
  363 and 523),
  in `139a31f4a` and `abb506b7b` (B282,
  B283);
- `score-attribution`,
  `score-verify`,
  `score-agreement`,
  `score-probe` and `score-crosscheck`
  (32,
  42,
  34,
  39 and 38,
  from 280,
  325,
  353,
  401 and 414),
  in `a13f71ba8` and `1088e72d9` (B284 to B287);
- `cap-census`,
  `slice-cost-report` and `cache-account-audit`
  (17,
  16 and 40,
  from 443,
  533 and 462),
  in `53e25b458` (B288 to B290);
- `sentinel-probe`,
  `displacement-probe`,
  `coverage-control-probe`,
  `coverage-probe` and `translate-probe`
  (35,
  62,
  37,
  75 and 44,
  from 212,
  588,
  321,
  437 and 394),
  in `7d2ca2604` and `da8a963cc` (B294);
- `model-health`,
  `model-catalog`,
  `roster-card`,
  `draw-sample`,
  `damage-sample` and `budget-sample`
  (40,
  38,
  42,
  42,
  55 and 41,
  from 223,
  129,
  180,
  427,
  412 and 174),
  in `17a66fa66` and `097b6ac40` (B295 to B298);
- `editor-calibrate` and `editor-width-probe`
  (51 and 56,
  from 596 and 312),
  in `327ea1de0` and `77a213478` (B299);
- `corpus-pass`
  (116,
  from 675),
  in `ea16d3b51` and `9a68e3c78` (B302 to B304);
- `producer-calibrate`,
  `recall-benchmark` and `roster-bench`
  (65,
  51 and 73,
  from 315,
  446 and 405),
  in `cd78288d7` and `f8e99b84d` (B305 to B307).

B308 records the counts those moves found standing before a fixed word.
Each agent reports a census over its own test files that shows its bundles loaded,
and no cold stretch in its entry files or new modules beyond the invariant throws its commit names
(the agents' accounts,
not rerun by the lead;
the editor cluster's is in its report and not in its commit's message;
two entry files of the sampler cluster each keep one cold character,
which B296 records).
What a keyless child cannot reach stays unreached,
and each commit says what:
a run to its end,
a round that reaches a provider,
a real settlement.

The whole suite at the close of this passage,
on `f8e99b84d` in a side checkout:
1,938 `[PASS]` lines and 2 `[FAIL]` lines,
both for one case that fails under load (B300,
B305),
the lint finding nothing,
and the 41 source scans passing.
Until `63f8f838a` every count of pass lines left out the cases B277 records.

Still open at `f8e99b84d`:

- three runner clusters,
  seven commands,
  were not merged at that commit
  (`verify-published` and `window-trial-probe`;
  `slice-census` and `coverage-census`;
  `judge-fidelity-probe`,
  `rendering-audit-settled` and `rendering-audit-settled-report`);
- no whole-suite census has been taken since `65bd3a645`,
  so the counts this passage rests on are the agents' own,
  and the recount B231 owes is still owed;
- the moved procedures of `ledger-report` and `meter-report` set the exit code themselves (B281),
  where the rule for the later clusters is that a procedure returns its code;
- the clusters' observations left to rule on,
  each in the entry of its cluster under "Open".

Final whole-suite census and its last cold stretches (2026-10-10 UTC):
a whole-suite census was taken at `9d558da592162f9765fb03a2280af9477ada147d` (`census-2W1rHH`),
in a worktree holding no key,
as the user unit `tr-census-final`
(memory capped at 10G,
peak 10G,
5 min 25 s),
with the unit suite at 2,032 passes.
Its report reads:
library source,
22 files,
59 stretches over 110 lines,
0 functions never called;
entry files,
5 files,
5 stretches over 13 lines,
0 functions never called;
invariant throws counted apart,
91 stretches,
all in library source;
and 0 bundles no test loaded.
Other packages' sources add 62 files,
322 stretches over 3,501 lines,
which are theirs to test.
The passage on the census at `65bd3a645` expected the final census
to list only the `translate-slice.ts` stretch in library source;
this one listed 59.

The 64 stretches went in two clusters,
cut by file,
to agents in side checkouts,
with the `translate-slice.ts` stretch held back:
the markup readers,
37 stretches in 12 library files,
and the runner and git stretches,
26 stretches in 14 files,
9 of them library source and 5 entry files.
The lead merged each patch with its cases committed apart from its production change,
and the passages "The markup readers' cluster of the final census"
and "The runner and git cluster of the final census" give what each closed.
Together they closed 50:
the markup readers 28 of their 37,
all library source,
and the runner and git cluster 22 of its 26,
21 in library source and one in an entry file.

The census after both,
at `f5ea0872bf9f4e8d551b92c64aeba925cf1933e2` (`census-LFRrQs`),
with the unit suite at 2,033 passes,
reads:
library source,
4 files,
10 stretches over 30 lines,
0 functions never called;
entry files,
4 files,
4 stretches over 5 lines,
0 functions never called;
invariant throws counted apart,
98 stretches,
all in library source,
seven more than before,
one for each `unreachable:` throw the two clusters added;
and 0 bundles no test loaded.
The lead's gate on `f5ea0872bf9f4e8d551b92c64aeba925cf1933e2` passed:
the suite at 2,033 passing and 0 failing,
the lint clean,
and the 49 source scans passing.
These pass counts are counts of named suites,
not of cases.

What stays cold,
and why:

- `footnote-unpositioned-runs.ts` 242,
  245,
  665,
  673 and 688,
  and `footnote-protected-ranges.ts` 75:
  `FootnoteRewriteError` refusals of the `position` kind,
  which the relabel pass turns into a withheld relabel that keeps the archive;
  the markup readers' agent made them `unreachable:` throws,
  and the lead kept them as they were (M143);
- `footnote-unpositioned-runs.ts` 552 and 561:
  the bracket-count refusals of `zoneByRawOffset`,
  for which no input was found and no proof stands;
- `parse-mdx.ts` 731:
  `parseMarkdownBody`'s rethrow of a fault that is no stack exhaustion,
  a propagation B100 decided;
- `translate-slice.ts` 366 to 386:
  the quote-loss refusal,
  held by the lead's ruling of 2026-10-06 in the passage on the census at `65bd3a645`,
  which still awaits the owner's word and was given to no agent;
- the entry tails of `corpus-run/damage-sample.ts` 44,
  `corpus-run/model-health.ts` 30,
  `corpus-run/roster-bench.ts` 66 and `corpus-run/editor-width-probe.ts` 47 to 48,
  each the rest of `main` after a run that needs a provider's answer,
  which no keyless child gets.

The markup readers' cluster of the final census (2026-10-10 UTC):
cases in `f4df3d6f1923886c63d218d794d0efb96340dddc`,
production code in `40665630f2c096260d987736521970b828e89a0b`.
The cluster held 37 stretches in 12 files:
`mdx-tag-name.ts`,
`corpus-run/tag-attributes.ts`,
`inline-container-tags.ts`,
`mask-container-tags.ts`,
`nesting-html-block.ts`,
`nesting-inline-count.ts`,
`nesting-line-lexing.ts`,
`parse-mdx.ts`,
`footnote-graph-findings.ts`,
`footnote-parsed-spans.ts`,
`footnote-unpositioned-runs.ts` and `footnote-protected-ranges.ts`.
Of those,
28 are closed and 9 stay cold.

Fifteen are cased through each module's exported surface:
`mdx-tag-name.ts` 449 to 450,
556,
627 to 630 and 644 to 645;
`corpus-run/tag-attributes.ts` 137 to 139 and 317 to 318;
`inline-container-tags.ts` 139;
`mask-container-tags.ts` 362 and 509;
`nesting-html-block.ts` 80;
`nesting-line-lexing.ts` 299 to 300;
and `parse-mdx.ts` 62,
68 to 69,
75 to 76 and 156.
The inputs:
a prefixed or local tag name followed by a character the grammar refuses,
an attribute run the text ends inside,
a lone inline opener or closer whose tag never ends,
a line that is an angle bracket and an exclamation mark alone,
a footnote label the line ends inside,
and `MdxParseError` built with a cause that is no error,
an error naming a rule without a source,
and one naming neither.
By the agent's mutation rounds,
each case failed under a named mutation of its stretch.
All 43 named test files pass against the unchanged production code,
since each case reaches a stretch that already ran correctly.

Nine are dead code,
gone with code that has no such branch:
seven index reads of the form `x[i] ?? ''`,
at `nesting-line-lexing.ts` 132,
168,
261,
294 and 341,
`nesting-html-block.ts` 98 and `nesting-inline-count.ts` 375,
each in range by its loop or the check before it,
became `charAt`,
which returns the same unit and an empty text out of range;
the `?? 0` of `definedTwice` in `footnote-graph-findings.ts` 121,
which read a count the same function had just set,
became a set of repeated keys read off the counts;
and the push of an attribute's expression value in `membersOf` (`parse-mdx.ts` 467) is removed,
since `mdast-util-mdx-jsx` 3.2.0 builds that value with its type,
its text and its `data` alone and no position,
and a case pins those three keys,
so a later version that gives the value a position fails it.

Four are `unreachable:` throws,
written as three guards:
a member of `countDropped`'s walk that is no object (`parse-mdx.ts` 425 and 445),
one guard in the walk's loop,
`positionOfNode` gone and `membersOf` taking a record;
a link label child with no position in `outsideLabelSpans` (`footnote-parsed-spans.ts` 122),
which had answered `[]` without a word,
though only the autolink-literal transform builds a node without a position
and it skips text under a link or a link reference
(`mdast-util-gfm-autolink-literal` 2.0.1 and `mdast-util-find-and-replace` 3.0.2);
and an ordered marker read where no digit stands (`nesting-line-lexing.ts` 249),
which had answered zero,
though its one caller,
`markerEndOf`,
reads it only at a digit.
The census at `f5ea0872bf9f4e8d551b92c64aeba925cf1933e2` lists them among the invariant throws,
at `parse-mdx.ts` 502 to 505,
`footnote-parsed-spans.ts` 123 to 126 and `nesting-line-lexing.ts` 253.
`countDropped`'s TSDoc had said it throws for any node without a position;
it passes over a node the transform built,
and the TSDoc now says so.

The agent's patch held 14 files,
8 of production code and 6 of tests;
the lead's merge took 12 and restored `footnote-unpositioned-runs.ts` and `footnote-protected-ranges.ts` from the base,
so both stand as before the cluster.
The agent had turned six `FootnoteRewriteError({ kind: 'position' })` refusals into `unreachable:` errors:
`runLeaves` twice (242 and 245),
`runEdges` three times (665,
673 and 688)
and `footnoteProtectedRanges` once (75).
The only production catch of `FootnoteRewriteError` is `relabelArchiveFootnotes`
(`corpus-run/pass-footnote-relabel.ts`),
through `requireFootnoteRewriteRefusal` (`footnote-rewrite-error.ts`),
which returns the archive unchanged with `withheld: 'rewrite-validation'`;
every other caller of `activeFootnoteMarkers`,
`unpositionedRuns`,
`fragmentReadingOf` and `footnoteProtectedRanges` lets both classes propagate,
by the lead's search.
So the change would have altered nothing off the relabel path,
and on it would have turned a withheld relabel into a stopped entry,
against the owner's rule that a run always ships (`doc/design-commitments.md`);
the lead kept the refusals (M143).
`footnote-parsed-spans.ts` is not on the relabel path
(its only production importer beside the footnote barrel is `footnote-mentions.ts`),
so its new throw changes no outcome.
The agent's proofs for the six rest on the sources of `mdast-util-gfm-autolink-literal` 2.0.1,
`mdast-util-find-and-replace` 3.0.2 and `mdast-util-mdx-jsx` 3.2.0,
and for the parent of a type the transform never splits text in,
on mdast's phrasing content and a probe:
inference,
not a named refusal.

Left open:
`footnote-unpositioned-runs.ts` 552 and 561,
the bracket-count refusals in `zoneByRawOffset`:
the agent ran 4,026 texts through `fragmentReadingOf` and `parseDocument` and none threw,
though no positive control showed the probe reaching the runs,
and `character-entities` 2.0.2 decodes only `lbrack`,
`lsqb`,
`rbrack` and `rsqb` to a square bracket;
no proof either way.
And `parse-mdx.ts` 731,
the rethrow of a fault that is no stack exhaustion (B100).

Run on the merged tree before the production commit:
lint clean,
49 scans passing,
and the suite at 2,032 passing with no failure.
No defect was found in this cluster.

Open to the owner's veto:
the six `FootnoteRewriteError` refusals stay,
leaving their six stretches cold,
where the agent's version,
a crash on a shape no input builds,
is the alternative that closes them;
the `parse-mdx.ts` cases build `MdxParseError` with causes its `unknown` type admits but the grammar never throws;
`x[i] ?? ''` became `charAt` rather than `nonNullishOrThrow`;
the duplicate count became a set of repeated keys rather than an explicit throw;
and the mutation that proves the case of `corpus-run/tag-attributes.ts` 139 throws,
since every value mutation there still ends in `NO_TAG`.

The runner and git cluster of the final census (2026-10-10 UTC):
red in `5ba14c371fdc57996fb2aba3fdffb32758f62b33`,
fixed in `f5ea0872bf9f4e8d551b92c64aeba925cf1933e2`.
The cluster held 26 stretches in 14 files,
9 of them library source
(`corpus-run/artifact-pool.ts`,
`corpus-run/cli-refusal.ts`,
`task-runner-guard.ts`,
`local-program-failure.ts`,
`corpus-git-context.ts`,
`corpus-commit-probe.ts`,
`corpus-run/runs-lock.ts`,
`credential-search.ts` and `corpus-run/judge-fidelity-probe-run.ts`)
and 5 entry files
(`corpus-run/editor-standing-read.ts`,
`corpus-run/damage-sample.ts`,
`corpus-run/model-health.ts`,
`corpus-run/roster-bench.ts` and `corpus-run/editor-width-probe.ts`).
Of those,
22 are closed and the 4 entry tails stay cold.

Seventeen are cased through each module's exported surface or the command as built,
each,
by the agent's mutation rounds,
failing under a named mutation of its stretch:
