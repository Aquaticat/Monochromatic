# Audit ledger, part 31

Part 31 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B136: a lane's generation marker restamped in place on every open

Red in `83355d3a3`,
fixed in `fa2813de4`.
Found on 2026-10-05 (UTC) by the agent of B134 in the same audit.
`openNamespacedCache` (`corpus-run/slice-cache-namespace.ts`) rewrote its lane's marker with a plain `writeFile` on every open,
also when the marker already named the running generation,
and a comment called the failure direction safe.
It was safe for correctness and not for cost.
A plain write truncates before it writes,
a marker left empty reads as another generation,
and the open that meets it discards every slice the lane holds for that entry,
which are then bought again.
The agent measured both halves:
under a file-size limit a marker holding `nap-3` read back empty after a refused write,
and an open over an emptied marker logged the discard of the lane's two cached slices.
The repair lane's cache is the first an entry opens,
so a disk filling up mid-run could empty that marker for each entry attempted meanwhile.

Making the write atomic and nothing else is wrong:
the agent tried it,
and a `pass-entry.unit.test.ts` case that resumes from a cache directory it may only read failed,
since a temporary file cannot be created there.

The red run printed 2 [PASS] and 4 [FAIL] lines:
a reader holding the marker open was shown the later bytes
(`expected 'nap-4\n' to equal 'nap-3\n'`),
and a reopen under the generation the marker names failed with `EACCES` in a directory it may only read.

The fix:
the restamp happens only where the marker does not already name the running generation,
which is where the open has just discarded and the lane holds nothing to lose,
and it goes through `writeFileAtomic`,
so a refused write leaves the earlier marker whole.
The patch is the agent's;
the restamp was folded into the discard's own block,
which tests the same condition.
The whole suite on `fa2813de4` printed 1582 [PASS] and 0 [FAIL] lines,
the lint `Found 0 warnings and 0 errors.`
and the scans 35 [PASS] lines.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back".

### B137: a scan its summary called one linear pass read the text again at every address

Pinned in `855553c3b`,
changed in `4008eeb99`.
Found on 2026-10-05 (UTC) reading the MiMo trial's production diff.
`scanUrlRuns` (`corpus-run/dropped-destinations.ts`) found the next address through `nearestScheme`,
which searched for each of the two schemes apart with `indexOf` and took the nearer answer.
A scheme the text lacks,
or carries only far ahead,
was read for to the text's end at every run,
so the scan cost the square of the text,
while its TSDoc called it one linear pass.
`cited-reference-scan.ts` already scanned for the same two schemes in one pass,
by searching for the stem both share and testing each stem where it stood.
Measured by a delegated agent on its build of `80e129926`,
over a text repeating one `https://` address,
median of five calls a size with other work sharing the machine:
2,000 runs 34 ms,
4,000 runs 132 ms,
8,000 runs 543 ms,
16,000 runs 2,168 ms,
four times the time at every doubling
(spread at 4,000 runs 136 to 178 ms).

No page was harmed:
the scan's results were right,
and a page of the pinned corpus is far shorter than the texts measured.

The fix:
`scheme-start-scan.ts` holds the one search,
`nextSchemeStart`,
and both readers call it,
each keeping its own stop characters and trimming.
The same script then read 0.6,
1.2,
2.4 and 5.2 ms at those sizes.
Both readers' whole output is the same before and after over 30,079 texts
(79 written by hand for the shapes a scheme search can get wrong,
30,000 from a seeded mix of tokens):
the recorded outputs differ in no line,
and a control that lower-cases the text first differs in 9,784.
A text with no scheme and many bare `http` stems costs about twice what it did
(0.30 ms against 0.13 ms at 132,000 characters).
No test asserts a timing;
the cases pinning both readers were committed green in `855553c3b` and stay green.
The whole suite on `4008eeb99` printed 1584 [PASS] and 3 [FAIL] lines,
all three from one lookup-cache case and its suites (ledger B140),
the lint `Found 0 warnings and 0 errors.`
and the scans 35 [PASS] lines.

Open to the owner's veto,
both the agent's choices:
"no scheme from here" is the text's length,
where the two readers disagreed before,
so a caller that forgets the test reads an empty run,
which `scanUrlRuns`' guard and `withoutTrailingPunctuation` both refuse;
and a stem that opens no scheme is passed by one character,
so the step does not depend on the stem having no self-overlap.

Recurrence:
`mistake-prevention.md`,
"Loops that copy what they built".

### B138: a pairing naming a block its section lacks was grouped as though it named a neighbour

Red in `3a7a72502`,
fixed in `e71249a76`.
Found on 2026-10-05 (UTC) reading the MiMo trial's production diff
(ledger M113 had recorded the empty result as found and not yet decided).
`groupNodesSealed` (`group-aligned.ts`) takes a walk of steps,
each naming a block by its index,
and `walkIntoRuns` read a step's block as `[nodes[index]].filter(isPresent)`:
a step naming a block its side lacks became a step carrying no block there.
`renderedSpan` (`group-source-anchor.ts`) documented the same tolerance.
What followed depended on the walk,
by a delegated agent's probes of its build of `80e129926`:
one paired step naming translation block 3 of 1 returned no runs at all,
since `mergeOneSidedRuns` held the one-sided run for a neighbour and found none to host it;
with a paired neighbour the original joined that neighbour's run instead;
a translation-only step past the last block threw `Expected non-nullish value, got undefined`;
and an original-only step past the last original returned an insertion of no blocks.

A walk is built by `blockPairingToSteps` (`pair-blocks-steps.ts`),
which checked nothing.
`readBlockPairing` refuses such a pair in a model's reply,
but a pairing also arrives from a settled artifact's recipe,
which `parseBlockPairing` checks for shape,
order and section,
never against the blocks of the text the rebuild carves.
On the agent's build,
an artifact recording a pair with translation block 3,
rebuilt over a section of 3 blocks,
came back from `rebuildPreparation` as a moved carve with the pair dropped and the rest regrouped,
and nothing named the pairing.

No settled artifact was misread,
measured by the agent over the 466 artifact files under 477 artifacts directories on this machine:
268 read as version 2,
238 of them record a block pairing,
none of 9,536 recorded pairs names a block the section it is rebuilt over lacks,
and every rebuild answers the same before and after the fix
(249 reproduced,
17 moved).

The fix:
`blockPairingToSteps` refuses a pair that names no block of its side with a `BlockPairingError`,
in `readBlockPairing`'s words,
`pairing names translation block 3, and there are 1`.
Every walk the package builds then names only blocks it is grouped over,
and the readers say so:
`blockAtStep` (`group-source-anchor.ts`) reads the block a step names
and throws an `unreachable:` error naming the step,
the side,
the index and the count where there is none;
`walkIntoRuns` reads every step through it before anything else reads the walk,
so each shape gets the one message,
and `renderedSpan` reads through it too.
The guard M113 restored in `anchorOffsets` stays,
its closing clause reworded,
since a walk pairing past the translation blocks no longer reaches it.
The red run printed three [FAIL] cases in `pair-blocks-steps.unit.test.ts`
and two in `group-aligned.unit.test.ts`,
each because the call returned where the case expected a throw.

Open to the owner's veto:
the walk reader throws `unreachable:` although `groupNodesSealed` is exported and its signature admits any walk,
where B127's reading would give a named `RangeError`;
and on the rebuild path a recipe that does not fit its text now throws where it came back as a moved carve.
`rebuildPage` catches it;
`carveSettled`,
`rendering-audit-settled-input.ts` and `slice-census-entry.ts` do not,
so one such artifact would stop those instruments.
B170 has the rebuild answer `moved` again;
`slice-census-entry.ts` converts the pairings itself and still stops.

Open when this entry was written,
closed in B170,
B171 and B172:
a catch of `BlockPairingError` in `rebuildPreparation` answering `moved` in the refusal's words,
so those instruments go on;
`slice-cache-store.ts` says a cached pairing is re-read through `readBlockPairing`,
and it is not unless media adjacency widens it,
with the same claim leaned on in `pair-media-adjacency.ts` and `pair-definition-order.ts`,
so on that warm path an index outside the lists is refused only by `nonNullishOrThrow`;
`readBlockPairing` and `assertPairsNameBlocks` word one refusal in two files;
`groupNodesSealed` does not check that a supplied walk covers every block,
and a walk of one original-only step over two originals and one translation returns no runs
(the agent's probe of the fixed build;
every walk the package builds covers both sides,
and `prepareDocumentPair`'s coverage assertion catches the rest);
and the comment closing `mergeOneSidedRuns` names a caller's one-sided fallback that no longer exists.

Recurrence:
`mistake-prevention.md`,
"Guards a census wants gone".

### B139: a link destination the trim emptied compared equal to every other one it emptied

Red in `855553c3b`,
fixed in `987f767dd`.
Found on 2026-10-05 (UTC) by an independent review of the MiMo trial's cases,
whose case pinned the wrong result.
`trimDestination` (`corpus-run/dropped-destinations.ts`) cuts a destination at its first stopper
and sheds trailing sentence punctuation,
for an address that prose ran into.
A tree destination made of that punctuation,
or opening on a stopper,
was cut to the empty string and still recorded,
so the current directory,
its parent,
a bare query and a link with no destination all read as one destination:
a source linking the parent directory and the current one,
against a page that kept only the current one,
reported nothing dropped.
A recorded empty destination was also found by the trace in every slice,
since every text includes the empty string
(read off `destination-completeness.ts` by the agent that fixed it,
not run).
The red run printed 4 [PASS] and 8 [FAIL] lines,
five of them cases.

No page was harmed,
by the agent's count over the pinned corpus:
`git grep` at the pin finds no page line whose link destination is empty,
is sentence punctuation alone,
or opens on a stopper,
against 331 lines in 173 files for a destination opening on a web scheme;
reference definitions were not searched.

The fix:
where the cut and the shed would leave nothing,
the destination stands as written,
so `trimDestination` answers the empty string only for an empty destination;
a scanned run never reaches that line,
since it opens with its scheme.
`markdownDestinations` leaves an empty destination out:
it names nowhere a reader could follow,
and no page owes it.
The trial's case asserted `urls: ['']` for a link to the current directory,
under a name that also claimed an assertion it did not make;
its four assertions are four cases now,
each named for what it asserts.

Open to the owner's veto,
both the agent's choices:
the destination stands as written rather than cut at its first stopper,
which would still read a destination opening on a stopper as the empty string;
and an empty destination is recorded on neither side,
so a source link with no destination that a page drops is no longer reported by this check,
though the slice rule still protects the link as an atom.

Open when this entry was written,
closed in B173,
B174 and B175:
`trimDestination` still cuts an explicit destination at a stopper where something precedes it,
so two explicit links differing only past a full-width comma read as one,
where the cut is right for an autolink literal only;
`carries` (`destination-completeness.ts`) searches by substring,
so a dropped destination as short as `.` is traced to every slice holding a full stop;
and `sameAddress('/')` is the empty string (`destination-renderings.ts`),
so the site root's key was the empty destination's,
and a source linking `/` against a page with an empty link reported nothing dropped before this fix
(the agent's probes).

Recurrence:
`mistake-prevention.md`,
"Defaults that stand in for an input".

### B140: a logger's own report read as a line the package logged

Red in `7ecd53897`,
fixed in `4640ab83a` and `22afb6c89`.
Found on 2026-10-05 (UTC) when the whole suite on `4008eeb99` failed the `lookup-cache.unit.test.ts` case
"MISSES on a file cut short inside its record,
and WARNS that it does not parse,
naming the file and none of its text"
with `unreachable: the console sink wrote a line without its level and timestamp tags: logger internal error: sink verification failed for entry 3: Timed out after 5000ms: sink 3 verify`.
The same case had passed in the two whole-suite runs before,
on `971c8bec8` and `fa2813de4`.
`warnLinesDuring` (`console-warn-lines.test-fixture.ts`,
added in `8c7426a44`) diverts `console.warn` around a piece of work
and reads every line the console sink wrote.
The package logger is built on a process's first line and verifies its sinks then;
a sink it cannot verify it reports on `console.warn` itself,
untagged.
Where a test process logged its first line inside the divert,
that report landed in it,
and the fixture threw on a line without the sink's tags.
Entry 3 is the file sink,
and another session was running mutation and fuzz jobs on the machine at the time
(both from `7ecd53897`'s message).
The fixture's message called the state unreachable;
a loaded machine reached it.
Reproduced without load in a throwaway checkout of `4008eeb99` by making the log directory read-only:
the same case failed the same way,
the report naming `EACCES`.

The red case runs the fixture in a child process whose working directory holds a regular file
where the file sink wants its log directory,
so the sink's verify fails at once and the child's first line is logged inside the divert:
0 [PASS] and 2 [FAIL] lines at `7ecd53897`.

The fix:
`4640ab83a` flushes the built package's root logger before the fixture replaces `console.warn`,
so the logger verifies its sinks first
and a report of one it could not verify reaches the console it was written for,
outside the divert.
A line without the console sink's tags still makes the fixture throw,
since it is no line the package logged,
and the message no longer calls that unreachable,
because the logger can still report a sink failing during the work.
A test process holds a second logger,
module-logger's default,
which the test framework writes through,
while the build bundles its own copy;
`22afb6c89` flushes that one too.
Which of the two reported in the run on `4008eeb99` is not known,
and a verify of the second running past its limit into an open divert was not reproduced:
an attempt in a child process did not land the report inside the divert.
Flushing it before the divert waits its verification out whenever it started,
so the order no longer rests on timing.
These facts are from the three commits' messages;
the whole suite had not run on `22afb6c89` when its message was written.
It ran afterwards in a fresh checkout of `22afb6c89`:
1585 [PASS] and 0 [FAIL] lines,
the lint clean and 35 scans passing.

Open:
the logger's report itself keeps coming.
`logger internal error: sink verification failed for entry 3: Timed out after 5000ms`
stands 113 times in the suite and scan logs of the five whole-suite runs from `cf50117c5` to `94de8258e`,
each run made in a side checkout while other agents worked on the same machine,
and every one of those runs passed.
Why the file sink's verification runs past its limit on a loaded machine was not looked into.

Recurrence:
`mistake-prevention.md`,
"Globals a case replaces".

### B141: a refinement recheck nobody answered read as passed

Red in `9c2eb03d9`,
fixed in `e0151b92c`.

Found by the independent review of the trial's cases (report 4,
F1),
behind a case asserting `refine-recheck-passed` for a round in which no checker was heard.
`retainsResolvedIssues` rolled a rewrite back over an open issue only where a tally said `worse`,
and a round with no ballot has no tally saying anything,
so it returned `refine-recheck-passed` and the rewrite shipped.
It read neither `heardCheckers` nor the checker stage's findings,
so a round every checker answered `not-fixed` and a round nobody answered left one findings list.
On a bench of three,
the floor `assertCheckerQuorumReachable` holds a run to,
one checker heard of three passed the recheck by itself.
The stage's `stage-quorum-unmet (checker 0/3)` was dropped with the rest of its findings,
so the settlement passed `everyStageHeard` and was written to the refine cache.
A confirmed issue in such a round did roll back,
under `refine-rolled-back`,
which names it as an issue the rewrite broke,
and that was cached too.
Ledger L11 rules that a rewrite ships only after a checker round;
a round short of its quorum is none.

The fix:
the recheck reads the checker stage's findings through `silentStagesOf` (`stage-silence.ts`),
the reader the caches use,
and a round short of quorum rolls the slice back whatever its ballots say,
under `refine-recheck-unheard (<heard> of <configured> checkers heard)`,
decided before any issue is read,
so an outage is never recorded as an issue the rewrite broke.
The checker stage's findings now ride on all three verdicts,
as they do on the accuracy lane's outcome (`repair-chunk.ts`),
so a lost voice or a missing check shows on a pass and on a rollback,
and a round short of quorum keeps its settlement out of the cache.
Rolling back follows the package's gates between a new text and a standing one:
the consolidation gate and the polish gate each ship the standing text unless two ballots name the new one.
Decided for quality under the owner's standing directive and open to veto;
the alternative ships the rewrite under the unheard finding.
The gate moved to `refine-recheck.ts` for the file-length cap,
with its cases in `refine-recheck.unit.test.ts`.

Measured on the built package with a scripted bench of three:
with the unfixed gate,
none heard and one heard each gave `refine-recheck-passed (1 issue)`,
shipped the rewrite and passed `everyStageHeard`;
with the fix both roll back under `refine-recheck-unheard` and fail `everyStageHeard`.

Left as it was,
each shown by a probe:
a damage probe that hears no prober still ships the rewrite,
under `stage-quorum-unmet (introduced-defect-probe ...)` and uncached;
and a round that met its quorum counts an open issue no heard checker ruled on as passed,
now beside one `missing-check` finding a checker.

Cache:
no version moved.
A record written at refine version 5 by the unfixed gate could hold a rewrite shipped on a round short of quorum,
and would resume as it is;
none exists.
`cache-account-audit --runs-under` over the agent runs on 2026-10-05 counted 13,714 slice-cache records
under 391 runs directories,
the newest written at 04:26 UTC on 2026-09-27,
before every cache version's current value was set;
the account is in `REFINE_CACHE_VERSION`'s TSDoc (`refine-slice-key.ts`).

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
a gate that passes on "nobody objected" first reads that enough voices answered,
through the stage's own account,
and carries that stage's findings with its verdict.

### B142: a refiner's rewrite the resolver dropped left no finding

Red in `9c2eb03d9`,
fixed in `e0151b92c`.

Noted by the independent review (report 4,
weak assertions) behind the trial's case for a rewrite naming paragraph 99;
the behaviour predates the trial.
`resolveRefineRewrites` (`refine-wire.ts`) records `refine-unknown-paragraph (<n>)` for a rewrite naming a paragraph the sheet never showed,
`refine-duplicate-paragraph (<n>)` for a second rewrite of one paragraph,
and each invisible variant it folds.
`runRefineStage` read the resolution's operations alone,
so those findings reached neither the stage's findings nor a log line,
and the stage reported `refine-candidates (1/1 heard, 0 proposing)`,
which is what it reports for a refiner that proposed nothing.
A reply rewriting one paragraph twice and naming a missing one shipped its first rewrite with no trace of the other two.
The editor lane keeps its resolver's findings (`buildEditorCandidates`,
`editor-candidates.ts`).

The fix:
the stage resolves each heard reply once and carries the resolver's findings into its own,
between the gather's and `refine-candidates`,
each credited to its rewriter as the editor lane's are,
in roster order,
and logged.
The consolidation polish round calls the same stage and gains the same findings.
Two cases pin it:
the dropped rewrite with the stage's whole result,
and the dropped rewrites beside one that ships.

Left as it was:
a rewrite the atom gate refuses still reaches a log line only,
since the gate's detail quotes atom values and a finding needs wording that carries none.

Cache:
no version moved;
only findings are added.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation":
a caller of a function that returns operations beside findings reads both,
or says why it drops the findings.

### B143: a scripted client no prober ever heard

Fixed in `9c2eb03d9`,
the test commit of B141.

Found by the same review.
`scriptedSettleClient` in `refine-slice-settle.unit.test.ts`,
written by the trial,
offered every exchange one list of replies and returned the first its guard accepted.
The list ended with `EMPTY_INTRODUCED_DEFECT_REPORT`,
the probe's result object,
which no stage's wire accepts,
and held a checker reply only under `worseTally`.
So every run through it ended on `stage-quorum-unmet (introduced-defect-probe 0/2)`,
a run without `worseTally` heard no checker either,
and its comment said the replies were ones each call's guard accepts.
No case asserted the findings,
so nothing showed it.
No case passed because the prober went unheard:
the sheet cases asserted text recorded before any reply was validated.
One half of the recheck case passed on the unheard checker round,
which is the recheck defect.

The fix:
the client scripts by the stage's structured-output name,
each reply checked against the guard the built package exports for that stage,
and every scripted case asserts the settlement's findings whole,
so a stage the script fails to answer shows as a lost voice.
The cases run on a checker bench of three,
the floor the refine phase holds a run to.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail":
a scripted client is shown heard by each stage it serves,
by a case asserting that stage's findings or its heard count,
before any case built on it is read as evidence.

### B144: the run scan read a link's own URL and a tag's attribute as footnote markers

Red in `adce3f9a8`,
fixed in `3ba21f95c`;
B123 continued.

Found reviewing the B123 fix (`9d7bbbec2`,
`d59d9851e`).
The fix scanned the whole raw region of an unpositioned run with `gfmMarkerSpans`,
its link members included,
and gave a run at the head or tail of its parent the parent's whole span.
So `A cat naps ，www.example.com[^9] tail.` under the rewrite of `9` to `10` came back `，www.example.com[^10]`,
though the parse holds `[^9` in the link's `url` and text and only `]` as text;
`[^www.example.com]` and `[^paw@cat.example]` were read as references with a link standing between their brackets;
and `<Cat title="[^1]">，www.example.com</Cat>` under `1` to `2` rewrote the attribute.
Each breaks the promise of `applyFootnoteRelabel` that URLs and attributes stay byte-identical,
and each inflated the label inventory `documentLabels` returns.
Three of the cases added with the fix asserted the rewritten URL.
The fix:
`footnote-unpositioned-runs.ts` pairs every square bracket of a run's raw region with the same bracket of the run's decoded text,
in order,
counting a character reference that spells a bracket as one,
and keeps a marker lexeme only where both its brackets fall in text nodes no link separates.
A run that opens an `mdxJsxTextElement` starts after the element's last attribute;
a run at the edge of any parent but a paragraph,
heading,
emphasis,
strong,
delete,
table cell or JSX text element,
a run member that is neither text nor a link of text,
and bracket counts that still differ
refuse with the `position` kind.
Measured:
56 constructs agree with the parse (`probe-3-matrix.mjs` in the fix's scratch),
12,000 generated pages agree with an oracle that aligns characters instead of counting brackets,
while the unfixed build differs on 2,942 of 5,978,
and none of the 279 Markdown files of the corpus clone reads differently.
Recurrence:
`mistake-prevention.md`,
"Structure read off the parse":
a raw region read in place of nodes is checked against those nodes' own values before any span of it is acted on.

Open when this entry was written,
fixed in B159:
`collectBlockHits` (`footnote-graph.ts`) reads the start and end of every `text` node through `nonNullishOrThrow`,
so `A cat ，www.cat.example naps.` makes `parseDocument` throw `Expected non-nullish value, got undefined`,
with or without a footnote on the page.
`reorderFootnoteDefinitions` and `footnoteProtectedRanges` call it,
so the relabel pass ends on a throw that is no rewrite refusal
for the very pages B123 was opened for.
The module is outside this fix's files.

### B145: a marker shape inside a tokenized autolink literal was relabelled

Red in `adce3f9a8`,
fixed in `3ba21f95c`.

Found with the B123 review,
older than the trial:
the walk at `28303c42a` read every positioned `text` node,
the one text child of an autolink literal among them,
and that text is the URL.
`A cat naps https://cat.example/[^9]x tail.` under the rewrite of `9` to `10` came back `https://cat.example/[^10]x`.
The fix:
`isAutolinkLiteral` (`active-footnote-markers.ts`) reads a link whose span starts where its first child starts,
or that carries no span,
as a literal,
and the walk does not descend into it.
A labelled link keeps its label read,
since a bracket sets the label off from the link's start.
No page of the corpus clone holds a literal whose text carries a marker opening
(count over 279 files),
so no cached decision moves.
Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B146: cases whose expectation was the function's own output

Fixed in `adce3f9a8`.

The three B123 bounds cases took their expected text from what the fixed function returned,
so they asserted the URL rewrite as right,
and one case name said the reference "stays in its text" while the tree held it in the link.
Two more cases named a shape as no marker under a map that named another label,
so a misread could not fail them.
The corrected cases set the reference off from the literal by a space,
the glued form asserts the refusal a tokenized twin gives,
and the two inventory cases assert `documentLabels`.
Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail":
an expectation for a parse-dependent result is written off the printed tree,
and a case that names a shape as inactive asserts the inventory,
or a map that names the shape.

### B147: a `.png` picture decoded onto itself

Red in `e300e6c33`,
fixed in `d550bf04f`.

Found on 2026-10-05 (UTC),
replacing the trial's `ocrTool` seam with a required program runner (ledger M113).
The scratch copy of a picture was `asset.` plus its extension,
and the decoded copy was `asset.png`,
so for a `.png` asset the two were one file.
The fallback decoder rewrote its own input,
and a first decoder that wrote part of its output before failing
left the fallback to decode what it wrote.
The red case scripts a first decoder that writes garbage to its target and exits 1:
the reading came back as the garbage,
32 characters taken as text.
A `.webp` asset was never exposed,
its copy and target being different files.
No run is known to have been harmed:
the reviewer measured the real `dwebp` failing before it wrote,
and `magick` rewriting the file whole.
The fix:
the decoded copy is `decoded.png`,
outside every name the scratch copy takes,
and `@param png` says the two are never one file.
Recurrence:
`mistake-prevention.md`,
"File names derived from an input",
a new heading.

### B148: an OCR reader that wrote nothing ended the entry, and an asset name chose where its copy was written

Red in `e300e6c33`,
fixed in `d550bf04f`.

Three more edges of `readImageWithOcr` (`image-ocr.ts`) were found writing its cases.
A reader that exited without an error and wrote no transcript made the reading reject with `ENOENT`,
which `readImagePair` does not contain,
so the entry ended;
it is now `unavailable` with reason `ocr-failed` and a warning.
The scratch copy took the whole text after an asset name's last dot as its extension:
`../../etc/passwd` and `tabby.png/../../paw` pointed the write into a directory nobody made and rejected,
and a 300-letter extension rejected with `ENAMETOOLONG`;
the extension is now taken only when it is at most 16 ASCII letters and digits,
and the picture is read either way.
A decoder that is not installed was logged as `refused by Error` under the scratch path;
the line now names the asset and says the decoder is not installed.
Each has its red case in `image-ocr.unit.test.ts`.

Recurrence:
`mistake-prevention.md`,
"File names derived from an input"
for the extension,
and "Refusals inside a composed operation"
for the missing transcript.

### B149: the coverage control called a cut that left nothing evidence it could not locate

Red in `9c03075d7`,
fixed in `341211543`.

Found 2026-10-05 (UTC),
reviewing the MiMo trial's test cases (review part 4,
F3).
`withoutSpans` (`corpus-run/coverage-control.ts`) answers blank for a document no span was in,
and blank again when the spans were the whole document.
`tryCase` read every blank as `evidence-not-locatable`,
documented as a carried verdict none of whose spans could be found.
That state no input produces:
`judgeCoverage` calls a passage carried only on a full claim it anchored,
and fills `evidence` with the translation's own text for each such claim,
the same translation `tryCase` cuts.
A roster quoting the whole translation was refused as not locatable with all three spans found.

The fix:
the refusal reason is `cut-left-nothing`;
`tryCase` checks every span is non-blank and in the translation before it cuts,
and throws `unreachable:` where one is not;
the reason's union and documentation say so.
`coverage-control-probe.ts` read the old reason without naming it and said such a case's evidence could not be found;
its lines were brought in line in the same commit,
and `d233f882f` reworded one of them that the count-nouns scan caught.
The census note in the T8 entry on code no unit test runs keeps the old name,
with a note.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B150: a coverage control held without a decoy that ran

Red in `9c03075d7`,
fixed in `341211543`.

Found 2026-10-05 (UTC),
reviewing the MiMo trial's test cases (review part 4,
F5).
A page with no room for a decoy cut clear of the anchored spans records `no-room` and no absence vote.
`coverageControlHolds` took the decoy half over every row,
so such a row counted as a decoy that was taken and moved nothing.
Three rows with no room and a roster following the quote held,
with no decoy ever asked;
one decoy that drew the vote beside two such rows held too.

The fix:
the result carries `decoysTaken`;
the control holds only where at least one decoy was taken,
and no more than half of the decoys taken drew the vote;
a control that took none prints why it cannot hold.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B151: the consolidate store resumed a terminal beside a gate the stage never writes with it

Red in `9c03075d7`,
fixed in `341211543`.

Found 2026-10-05 (UTC),
reviewing the MiMo trial's test cases (review part 4,
F6).
`settleConsolidation` writes no gate on its five exits before the gate,
and `gateAndShip` always writes one,
naming the terminal from what that gate ships.
`isConsolidationSettlement` (`corpus-run/consolidate-cache-store.ts`) checked each field's shape and never the two together.
A file with terminal `consolidated` and no gate was resumed,
and its `text` shipped under an artifact saying no gate was asked;
so was `consolidated` beside a gate shipping `standing`,
and `incumbent-only` beside a gate.
The trial's case pinned the first as resumable.

The fix:
`SETTLEMENT_TERMINALS` names beside each terminal the gate the stage writes with it,
and `gateFitsTerminal` refuses a record where the two disagree;
a refused record is bought again.
Other couplings the stage keeps and the store does not check are listed in the fix wave's report,
`settleGateBallots` against the stored `choice` first among them.
B187 refuses four of them and says why it leaves the rest.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B152: a resumed window trial joined its first row onto a torn last line

Red in `9c03075d7`,
fixed in `341211543`.

Found 2026-10-05 (UTC) by the audit of file reads behind B134 and B135,
and reproduced on the build of the fix wave's worktree.
A kill mid-append leaves a last line with no newline,
and `appendTrialRow` appended the next row straight after it.
One appended row was lost and its arm bought again;
after a second,
the unreadable line was no longer last,
and `readTrialLedger` threw the parser's `SyntaxError`,
whose message quotes the text it refused,
at the opening and closing reads of every later run.

The fix:
before each append `appendTrialRow` reads the ledger's last byte,
and where it is no newline removes a fragment by an atomic rewrite,
or ends a whole row,
saying which through its logger;
the read warns of a torn last line and reports it as `tornTail`;
a line that ends in a newline and does not parse throws `TrialLedgerLineError`,
which names the file and the line number and none of its text.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back".

### B153: the window trial ledger dropped a whole line that was no row without a word

Fixed in `341211543`,
its case in `9c03075d7`.

Found 2026-10-05 (UTC),
reviewing the MiMo trial's test cases (review part 4,
F7).
`readTrialLedger` left out a line that parses and fails `isWindowTrialRow`,
and said nothing.
Rows of four older shapes were appended to this same file:
before `judgesHeard`,
before `position`,
and before `chunkIndex` became `sliceIndex`.

The fix:
`accountTrialLedger` returns the rows,
the count of whole lines left out,
and whether the last line was torn,
and says through its logger how many it left out and why;
`readTrialLedger` returns its rows,
and the window trial's closing report prints the count.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back".
