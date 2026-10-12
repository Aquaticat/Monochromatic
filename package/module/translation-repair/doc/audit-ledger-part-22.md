# Audit ledger, part 22

Part 22 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B30: functions only tests reach

Status:
fixed 2026-09-29,
found the same day while reading T8's cold stretches;
the values the same reach leaves unread are B31.
`consolidationFailureEvidence` held four cold stretches,
and nothing outside its own test calls it:
the single consolidation attempt (`1ba8f713a`,
2026-09-01) stopped building the prior-failure evidence it feeds,
and the consolidate sheet kept a branch for evidence no caller sets.
B20's guard never reported it,
because it counts a test,
and a barrel's re-export list,
as naming an export.

Measured at `e3ce445ed` by reach from production
(`t8-production-reach.ts` in the audit's scratch folder):
the roots are every non-test source file's module-level code,
which is where the runner entries call their main and where tables run on import;
a top-level function is live once a live context names it,
and its body is then a live context;
import and export lists name nothing.
Matching is by name,
so a name two functions share keeps both live,
and the error is only toward calling code live.
Its control planted a chain no root reaches,
an export that a barrel re-exports and a private function calls,
that private function,
and the export calling it,
which a barrel also re-exports,
beside a function a module-level constant calls;
it reported the chain's three and kept the fourth.
Every one of the 44 build entries sits under `src/`,
and no file outside this package imports it.
It lists 57 functions,
by what they are:

- Wrappers over parts production calls apart,
  tested in place of the parts:
  `assertResumableGeneration` (the pass runs a schema check between its halves),
  `verifiedAttestations` (the stage logs each verdict between its parts),
  `stripStubMarkers`,
  `comparisonRowsEqual`,
  `laneContestChoiceMayShip`,
  `groupNodesAligned` (production passes seals)
  and `corroboratedCount` (replaced by the prober count,
  `83f913a65`).
  Two comments still name the generation wrapper as what runs at pass startup
  (`corpus-pass.ts`,
  `artifact-provenance.ts`).
- Modules built beside the live path and superseded:
  the source-first grouper and orphan reflow (`group-source-first.ts`,
  `reflow-orphans.ts`),
  built unwired on 2026-08-15 "before it decides a corpus",
  whose job the sealed grouper's block-scale insertion took on 2026-08-23;
  the version 1 artifact writer (`buildSettledArtifact`),
  unused since both lanes settle each entry (`04c6d85cf`),
  whose round-trip case says it reads what the pass writes;
  the non-streaming completion parser (`extractCompletion`),
  unused since streaming (`33d3331d4`);
  and the critic benchmark (`runCriticBenchmark`,
  `computeScorecard`,
  `isRetryableAttempt`,
  `isTruncatedAttempt`,
  `prepareBenchmarkEntry`),
  which no runner calls.
- Functions whose caller changed course:
  `consolidationFailureEvidence` and its three helpers (`1ba8f713a`);
  `assertPublishableTranslation` (`c1db6f729` publishes a page with an unfilled passage as a recorded gap);
  `verifyArtifactAgainstPreparation` (the rendering audit checks measurements alone since A12b,
  `da9ca20b0`);
  `referenceLabels` (`ac179a4e4` reads footnotes from the document's syntax);
  `donorTextsFor` (`6354dd16a` calibrates on a reviewed donor);
  `estimateRequestWeight`,
  which routing never read;
  `renderJudgedRate`,
  whose runner changed;
  and `categoryFamily`.
- Test support shipped as package source:
  the TSDoc example scan and its text scanner (`tsdoc-example-scan.ts`,
  `source-text-scan.ts`),
  the catalogs' label lookups and Hyper counterpart lists,
  and `cardOf`.
- `resetRunSpend`,
  a documented seam that zeroes the process-wide spend meter between tests.

Fix:
the guard counts reach from production,
fixtures first,
and fails on these before any is touched.
A wrapper goes and its cases call the parts in production's order;
a superseded module or a function whose caller changed course goes with its cases,
once no other export of its file is live;
test support moves to `.test-fixture.ts` files;
and `resetRunSpend` is the guard's one allowed seam,
since no fixture can reach module-private state without an export,
a choice the owner may veto for an injected meter.
The consolidate sheet's branch goes with the evidence,
and the rendered-sheets census shows whether any sheet changes.

Done:
the guard (`src/dead-functions.unit.test.ts`) went in red in `eda99b687`
and passes from `32e07afb7`,
with `resetRunSpend` its one allowed seam.
`363b0ee60` removes the seven wrappers,
each case now calling the parts in production's order;
the generation guard's drift permission is required,
and the pass passes what it reads from the environment.
`94ccbc67c` names the guard the pass runs in the restart decision.
`9170b7158` moves the test support into `.test-fixture.ts` files,
`2fdcaddb2` removes the superseded modules with their cases,
and `9f49c2ed5` the functions whose callers changed course.
`32e07afb7` removes the consolidation recovery evidence,
the sheet branch no caller fed,
and the sheet-leak floor's label for its heading;
`consolidationNeedsRecovery`,
which read as asking for another strategy,
is now `standingKeptUnendorsed` beside its one caller.
No sheet changes:
the consolidate writer's sheet,
rendered through the wire before and after over the fixture's subject,
a bare one,
one reaching every optional block
and one whose texts carry fence runs,
is identical in all four,
where the old wire with prior-failure evidence set differs
(`b30-wire-compare.ts` in the audit's scratch folder).
The label's removal rides inside consolidation 20 and lane contest 6,
with an account in each key:
the heading is in no stored slate,
artifact or cache record,
and no slice-cache file was written after 04:27 UTC on 2026-09-27.
The whole suite passes on `32e07afb7`:
1,384 describe blocks pass and none fails
(a PASS line is one block,
naming its passing cases,
`describe.ts` in `module-test`;
this entry first called them cases,
M74).
Against the census baseline's 1,397 blocks,
the 25 gone belong to removed functions,
were renamed with them,
or are the guard's old block,
and the 12 new ones are the renamed and split blocks,
the guard's rewritten one
and the renamed rule's
(`b30-suite-diff.mjs`,
which pairs the two logs' PASS lines by tags and first case name,
so a case removed from a block that keeps others does not show).

### B31: values only tests read

Status:
fixed 2026-09-29,
found the same day by B30's reach probe run over top-level values
(`t8-production-reach.ts --values`).
Beside `resetRunSpend`,
the probe listed 23 top-level values no production code reads,
and the guard that went in red found `GAP_PENALTY` and `OPENROUTER_DECISION_IDS` as well:

- `ABSOLUTE_NATURALNESS_CONFIRMATIONS_REQUIRED`,
  which reads as configuration,
  while the confirmation asks exactly once whatever it says.
- `HYPER_ORIGIN_NAMES_ARE_SERVED` and its type,
  a proof that cannot fail:
  it stood over a hand-listed roster type (`cc7ccfc00`),
  and since that type became an `Extract` over the served ids
  (`ea0024e3c`,
  2026-09-16)
  the conditional can never reach `never`;
  its runtime case asserts a literal `true`.
- `SEATED_BEDROCK_JUDGES` and `SEATED_OPENROUTER_JUDGES`,
  read only by the seat tests,
  whose TSDoc holds the two models' seating measurements,
  and the three origin buckets they are built from
  (`HYPER_ORIGIN_ROSTER_IDS`,
  `BEDROCK_ONLY_ROSTER_IDS`,
  `OPENROUTER_ONLY_ROSTER_IDS`,
  with their three private spelling lists).
- The 13 role-named seats of `roster-fixture.ts`,
  unit-test support the package build ships.
- `GAP_PENALTY` in `align-blocks.ts`,
  documented beside the kind scores it is set against and read by nothing:
  `align-blocks-walk.ts` declared its own copy,
  "mirrored from the scoring module's calibration",
  and read that one,
  both since the files' first commit (`35c4a4aac`),
  so retuning the documented one would have changed nothing.
- `OPENROUTER_DECISION_IDS`,
  whose only production reader was a type (`typeof` it).

Fix:
the guard counts values by the same reach,
red first;
the constant and the proof go,
with the runtime cases that cannot fail,
since "SERVES every roster id from at least one catalog" carries the invariant the proof named;
the seated sets and the buckets move to a test fixture,
and their measurements to the two models' cards;
the seats move to a `.test-fixture.ts` file;
the walk reads the documented gap penalty;
and the decisions spelling becomes a type union.

Done:
the guard went in red in `e91ce423b`,
renamed `src/dead-code.unit.test.ts`:
it tracks every top-level function,
class and value bound to a plain name,
roots production at the module-level statements that declare nothing,
and counts a value named only in type positions as unreached.
It named the 25 and no class.
`2efbdbde9` removes the proof,
its type,
the constant,
and the two roster-reach cases that could not fail
(the Hyper catalog refuses to load unless its rows are exactly the Hyper spellings);
the walk imports the documented gap penalty,
whose value is unchanged;
and the decisions spelling is a type union,
a choice under the owner's standing quality directive that the owner may veto,
the model-cards case now checking that no two cards share a decisions spelling.
`34f7db3b6` moves the seated sets and the Bedrock bucket to `roster-buckets.test-fixture.ts`,
drops the Hyper and OpenRouter buckets as no test needs them,
moves the two seating records to the cards,
and turns the model-cards case that restated the buckets into one about a Bedrock-spelled card.
`e28dd54f2` moves the seats to `roster-seats.test-fixture.ts`,
215 test and fixture files importing them from it.
The guard passes from `e28dd54f2`,
and the whole suite on it passes 1,384 describe blocks with none failing;
against B30's run on `32e07afb7`,
every PASS line pairs but the guard's and the seat test's,
renamed,
while the two roster-reach cases left a block that kept a third.

### B32: imports nothing reads

Status:
fixed 2026-09-29,
found the same day:
B30's last group removed four type imports from the consolidate wire by eye,
and no configured check reports one
(GitHub issue 578:
the repository's lint leaves `no-unused-vars` off,
and its TypeScript configuration leaves `noUnusedLocals` false).
TypeScript 7's package ships the native compiler alone,
with no compiler API a scratch check could call,
so the measurement used the source scan's parser
(`b32-unused-imports.ts` in the audit's scratch folder):
an import binding is unread when its local name stands nowhere in its file outside the import declarations,
type positions and export lists counted.
Its control,
a fixture with one unread value import and one unread type import beside read ones,
reported exactly those two.
Over the package's 1,915 files,
tests and fixtures included,
it found 15 unread bindings,
all in package source.
Five are error classes a TSDoc `@throws {@link …}` line names,
the only place a file names an error its callee throws,
and each line holds:
`artifact-repair-read.ts`,
`corpus-run/artifact-rounds-read.ts` and `corpus-run/artifact-vote-read.ts` call the `require*` helpers of `artifact-guard.ts`,
which throw `ArtifactParseError`;
`dedupe-issues.ts` calls `mergeDuplicateEvidence`,
which throws `IssueEvidenceConflictError` through `mergeClaimEvidence`;
and `corpus-run/judge-fidelity-probe.ts` calls `reviewedFidelityTrials`,
which throws `FidelityReferenceError`.
Those imports stay.
The other ten are read nowhere:
`footnoteMarkerLabels` and `ChunkPair`,
left by `9f49c2ed5` (B30,
which removed the functions reading them);
`fetchTransport` in the five provider clients,
left by `66cd08426` (X24,
which made every client's transport required);
and `ProviderRecord`,
`ModelCaller` and `ProviderName`,
left by `3510c8336` (X23,
which built the run client on a handed transport).
`git log -S` on each name in its file names the commit.

Fix:
`src/unused-imports.unit.test.ts` went in red in `40add2b70`,
reading every package file through the source scan
and counting a name a TSDoc link names as read;
it named the ten and joined `mise run source-scans`.
`c077cc881` removes them;
the five clients now import only types from the transport module,
so those imports are `import type`.
The guard passes from `c077cc881`,
and the whole suite on it passes 1,385 describe blocks with none failing,
the one new block the guard's.

### B33: artifact refusals that say the opposite of what they expect

Status:
fixed 2026-09-30 (UTC),
found the same day by T8's fourth batch,
whose probe printed each refusal of the consolidation reader whole.
`ArtifactParseError` prints `artifact parse failed at <path>: expected <reason>.`,
so a reason is read as what the reader wanted there.
Six were written as something else.
Two said the opposite of what the reader wants:
text under a terminal that changed nothing printed "expected text to ship,
from a slice whose terminal is … and settled on no change",
and a contested slice outside the comparison printed "expected index naming no recomputed comparison row".
Four were sentences that do not follow "expected":
the three refusals of a consolidated terminal's shipped record
("expected a slice whose terminal is consolidated must carry the text it ships",
and two that ship an archive or incumbent instead),
and a polish whose changed flag disagrees with its text
("expected whether final text differs from baseText").
No test caught them,
since every case quoting one checked a fragment
("settled on no change",
"must carry the text it ships")
that the wrong reading also contains.

The census (`reason-census.mjs` in the audit's scratch folder,
over the package's own parser)
read all 145 reasons the package's source passes to the class;
a text search finds 146 constructions,
the extra one the example in the class's own TSDoc.
The other 139 read as what was expected.
Phrases naming a state
("present in one slice",
"unfilled,
since …")
read acceptably after "expected" and stay.

Fix:
`74387b886` rewords the five in the consolidation and contest readers
("expected no text to ship,
since a slice whose terminal is … settled on no change";
"expected an index naming a slice the recomputed comparison holds";
"expected the text a slice whose terminal is consolidated ships",
and so on),
and `ebaa97908` makes the polish flag's reason name the value
("expected true,
which is whether final text differs from baseText").
Each test quoting one now checks the whole message.
No scan can tell a well-formed reason from another,
so the prevention doc's rule is to read each new refusal's message whole in its test.

### B34: marked refusals carrying a caught error's text

Status:
fixed 2026-09-30 (UTC) in `a1e4accbd`,
guard red first in `7360aae58`,
found the same day in the B33 census's output (`reason-census.txt` in the audit's scratch folder),
which lists five reasons built from `caughtValueText(error)` and one from `error.message`.
`ArtifactParseError` declares `messageNamesOnly`,
so `refusalText` repeats its message wherever a refusal is printed,
on the promise that the message holds only authored sentences,
counts,
names and what the operator typed.
The inventory in `message-names-only.unit.test.ts` checks what a marked class's own constructor interpolates,
and could not see a throw site handing it another error's text.
Six sites did.
Two of them quoted the stored value:
a pipeline digest refused by forwarding `assertPipelineDigest`'s `TypeError`,
which prints the value it received,
and a preparation identity refused by forwarding `PreparationIdentityError`,
whose first message printed the value.
Both values are hashes a run writes,
never corpus text,
but a tampered or foreign artifact holds whatever string it holds,
and the field readers' own region says they refuse "with the dotted path of the field rather than its content".
The comparison reader forwarded `ArtifactComparisonError`,
an unmarked class its throw sites handed finished sentences;
those sentences held names and numbers,
and nothing checked that they would keep to that.
The corpus verification wrapper forwarded `ArtifactPreparationMismatchError` for each lane's slice count,
from a check that could not fire:
the reader already refuses a lane whose ledger does not hold one row per prepared slice
and a lane count other than its ledger's length,
and the verification checks the preparation's count first.
The remaining two forwarded from narrowed catches:
the change-set reader from `AssemblyContractError`,
which is marked,
and the row relations reader from `DeliveryCoherenceError`,
which is marked,
and `WordingCoherenceError`,
which took finished sentences from its throw sites and so could not carry the marker.

The digest module's own words were wrong too:
the `TypeError`,
its `@throws`,
and `isDigestShaped`'s `@returns` said a digest is 64 lowercase hex characters,
and every digest starts with the scheme name `sha256-tree-v1:`;
the `PipelineDigest` type's TSDoc said a digest cannot be told from a git object id by shape,
which the scheme name makes false.

Fix:
the digest and identity readers refuse by shape
(`isDigestShaped`,
and a new `isPreparationIdentityShaped`)
in words built from the constants the checks read
(`PIPELINE_DIGEST_SHAPE`,
`PREPARATION_IDENTITY_SHAPE`),
then narrow.
`ArtifactComparisonError` takes a closed fault and writes its own sentence,
carries the marker,
and the comparison reader's catch narrows to it and rethrows anything else;
`comparisonRowDifferences` returns `ComparisonRowField`,
so the fields a sentence lists are names by type.
`WordingCoherenceError` writes its sentence from a slice index and a closed fault kind,
in `7360aae58`.
The corpus verification drops the wrapper and both lane checks.
The guard's new case finds every construction of a marked class whose arguments turn a caught error into text
(a template holding the binding,
`String` or `caughtValueText` of it,
or its `message` or `stack`),
reads which classes the enclosing catch narrows to,
and fails on one missing from `FORWARDING_SITES`
or listed as forwarding from a catch narrowed to anything but marked classes.
Its red run listed the comparison reader as narrowed to `LaneComparisonError`,
the live comparison's class rather than the one `compareLanes` throws;
the fix commit corrected the entry,
and a comment on the red commit records it (M77).

### B35: footnote mentions encoded as key strings and parsed back

Status:
fixed 2026-09-30 (UTC) with the sixth T8 batch,
found reading its stretches:
`translate-definition-leak.ts` 46 and `translate-marker-drop.ts` 50 each fell back to `''`
for the third space-separated part of a key that always has three.
`footnoteIdentifiers` keyed each mention as the string `role convention identifier`,
and four readers wanting the parts split it back apart three ways:
the two floors by `split(' ')[2] ?? ''`,
the insertion admission by the first space,
and the assembly guard by `startsWith` and `endsWith`.
A key is a comparison value,
and none of the readers compared keys;
each wanted a field.

Fix:
`footnoteMentions` lists each mention with its role,
convention and folded identifier as fields,
and `footnoteIdentifiers` counts keys built from it
for the one reader that compares two texts' mentions.
The four readers read the fields.
`footnote-mentions.unit.test.ts` pins the list,
the counts and the overflow refusal's whole message;
the two floors' refusal cases read their whole verdicts.

### B36: a page no grammar reads passed a candidate against the original alone

Status:
fixed 2026-09-30 (UTC) with the sixth T8 batch,
found reading `translate-skeleton-page.ts` 114 to 124,
the catch around the plain-markdown reading,
which its own comment called close to impossible to reach.
Plain markdown accepts any text,
but reading a page can exhaust the parser:
8,000 nested quotation markers overflow its stack
(`relaxed-shape-probe.mjs` in the audit's scratch folder).
Such a page read as unparseable,
the validation took an empty page,
its block floor compared the candidate with the original alone,
and the verdict passed the candidate as read by the relaxed grammar:
at 10,000,
20,000 and 50,000 markers the verdict on an ordinary rendering was valid,
where at 1,000 and 5,000 the page was read and the same rendering refused.
The validation's own comment says a check that cannot run must not answer yes,
and names the case that taught it.
No page a run has read reaches it:
the pinned corpus's 279 Markdown files nest quotation markers at most 3 deep
(`quote-depth-probe.mjs`),
so no stored verdict would come out differently.

Fix:
a page neither grammar reads is treated as an original no grammar reads:
the floors that read text still run,
and with none refusing,
the verdict is unknown with the page's reason,
so the candidate stands unvalidated and says so.
`grammarFreeVerdict` holds that path for both sides,
and the empty skeleton the old path used is gone.
`translate-validate.unit.test.ts` pins both verdicts over a page of 16,000 markers,
and the case that said the floor fell back to the original alone,
whose page plain markdown reads,
now says it reads the page under plain markdown and checks the grammar it names.

### B37: the reference-count floor told a model a side carried none of an atom it carried

Status:
fixed 2026-09-30 (UTC) with the sixth T8 batch,
found reading `translate-atom-rendering.ts` 341,
the arm writing "N times" for an atom carried too often,
which no test reached.
The floor compares the atoms (link destinations,
footnote markers and the like) a candidate carries with the ones the original and the page carry,
as multisets,
and its findings go back to the model that wrote the candidate.
It wrote one sentence per missing copy and one per surplus atom,
and each sentence said the other side carried none of it:
a candidate carrying a link once where the original carries it twice was told
"The ORIGINAL carries link-url … and your translation does not.",
and a candidate carrying a link three times where the original carries it once was told
"Your translation carries link-url … 2 times and the ORIGINAL does not."
A link missing twice drew the same sentence twice.
A model told the original lacks a link it carries can remove every copy,
and is then refused for dropping it.
Of the log files on this machine carrying the floor's sentences,
701 carry one missing-atom sentence twice on one line,
and none carries a surplus sentence with a count
(`t8b6-b37-logscan.mjs` in the audit's scratch folder).
Those files are unit-suite logs and the logger's per-process files,
which do not say by path whether a pass or a test wrote them,
so how many pass runs sent such a sentence to a model is not measured.

Fix:
the floor counts each side per atom and writes one sentence per atom,
naming both counts where both are non-zero
("The ORIGINAL carries link-url … 2 times and your translation carries it once.");
a side carrying none keeps the sentence it had,
with the count where it is more than one.
The rendering pools,
which already named both counts,
are unchanged.
`translate-atom-rendering.unit.test.ts` pins every arm by its whole sentence:
missing twice,
short by one,
invented twice,
carried three times against once,
and a pooled rendering carried twice.
Run against the build from before the change,
the two new cases failed,
one on two identical sentences and one on a pooled rendering's "does not".
The finding reaches the model in the revision round,
so the change joins the translate cache account before a launch.

### B38: readers of paired marks took an unclosed mark's next title into its span

Status:
fixed 2026-09-30 (UTC) with the sixth T8 batch,
found writing a case for `translate-latin-title.ts` 100,
the reader's stop at an opening mark with no closing mark after it.
Five readers paired each opening mark with the next closing mark:
the Latin title floor and the Han title reader (`han-title-read.ts`),
which read candidates and originals for the translate floors,
the page-title spans (`page-title-spans.ts`),
the work-title scan (`work-title-scan.ts`),
and the title-reference locator (`corpus-run/title-reference-marks.ts`).
An opening mark that never closed took the next title into its span.
Given `《Purr, and 《Cats Are Liquid》`,
the Latin title floor told the model to write `“Purr, and 《Cats Are Liquid”`
beside a second finding for the real title;
the Han title floor named a title holding the stray mark;
the work-title scan looked up the stray span and never the title inside it;
the page-title spans counted a stray span as a title of its own;
and the locator,
reading a page's `《Purr 《Cat Talk》`,
rewrote `Purr 《Cat Talk` whole with the heading's rendering,
dropping the words before the title.
Three of the readers scanned forward from every opening mark,
so their time grew with the square of the unclosed marks:
the old reader shape took 225 ms at 10,000 unclosed marks and 14,153 ms at 80,000,
where the shared reader takes under 2 ms at 80,000 (`t8b6-b38-timing.mjs` in the audit's scratch folder).
The pinned corpus (279 Markdown files at `a41fc607e`) holds no unclosed 《 or 【,
five unclosed 「 in five files,
and four unclosed “ in two files,
each of those four with its next opening mark on the same line
(`t8b6-b38-corpus.mjs` and `t8b6-b38-corpus2.mjs`),
so no English page there uses the multi-paragraph convention of opening each paragraph and closing only the last.

Fix:
`closed-mark-spans.ts` holds the one pairing rule every reader now uses:
a closing mark answers the last opening mark before it,
so an opening mark followed by another before any closing one encloses nothing,
a closing mark with no opening mark before it is text,
and identical marks (straight quotation marks) pair in turn.
It reads each stretch of text once forward and once backward.
On text whose marks all close,
every reader returns what it returned before.
`closed-mark-spans.unit.test.ts` pins the rule,
and each reader has a stray-mark case:
the Latin and Han title floors' verdicts,
`workTitlesOf`,
`repeatedTitleSpans` with the same stray mark twice,
and `unifyTitleReferences` keeping the words before the title.
Run against the build from before the change,
all five reader cases failed.
A multi-paragraph quotation on a page would now show its last paragraph to the locator as a quoted span,
as any quoted line of dialogue is;
before,
it was read as one span crossing lines and left out.
The Latin and Han title findings reach the model in the revision round,
and the page-title spans and the work-title scan feed preparation,
so the change joins the translate and preparation cache accounts before a launch.

### B39: an empty slate over wording the floor refused stopped the entry

Status:
fixed 2026-09-30 (UTC) with the sixth T8 batch,
found reading `translate-slice-attempt.ts` 189,
the rethrow of an absence refusal on a slice the archive translates,
which its comment called a backstop no input reaches.
A slice whose archive wording the deterministic floor refuses
reaches the translate stage as an absent incumbent,
withheld rather than missing (`translate-stage.ts`).
The owner's rule keeps the archive at a slice no wording passed and ships
(2026-09-27,
"No valid wording"),
and "Preference + polish" made the follow-up round ship its preferred candidate past a declined challenge round.
That rule reached the judge's decline exit and not its empty-slate exit:
where every translator was heard and none proposed wording the floor accepts,
the slate was empty in both rounds,
the judge raised `no-candidate` with the message that the archive has no translation,
the stage rethrew it,
and the slice attempt rethrew it for a content slice,
so the entry stopped where the rule says it ships.
A case running the stage over such a slice
(the address floor refusing the archive and every translator's defended narration)
raised `no-candidate` on the build from before the fix.
Whether any run met it is not measured.

Fix:
on the round that ships past a decline,
an empty slate whose translators were heard keeps the withheld wording and names `no-candidate`,
the same record a present incumbent's empty slate returns;
a slate nobody was heard on still raises,
and the stage still turns that into a provider interruption,
since it says nothing about the passage.
The slice attempt now returns an unfilled slice only for an absence over an insertion slice
and rethrows everything else in one statement,
a content slice's absence among it,
so the backstop stands with no statement of its own;
its branch for `no-voice-heard` is gone,
since the stage converts that reason before the attempt sees it.
`translate-withheld-empty-slate.unit.test.ts` pins the whole kept record,
and that a slate nobody was heard on still interrupts.
The stage's record keeps the archive's wording,
so the translate cache account takes this change before a launch.

### B40: text that shows nothing passed every check that asked `trim()`

Status:
fixed 2026-09-30 (UTC),
found while checking whether the B39 fix reached the consolidation lane,
whose judge call shares the changed exit.
The checks deciding whether a model's wording or reason said anything asked `trim()`,
which removes ECMAScript whitespace and keeps every invisible character that is not whitespace.
The intake fold (`invisible-variants.ts`) removes the soft hyphen (`U+00AD`),
the zero-width space (`U+200B`),
the word joiner (`U+2060`)
and the byte order mark (`U+FEFF`),
and `trim()` keeps all of them but `U+FEFF`.
Measured on the build from before the fix
(`t8b6-blank-slate-probe.mjs` in the audit's scratch folder):
a translator reply of `U+200B`,
`U+2060`
or `U+00AD` alone passed `isTranslateReportWire`,
and `buildTranslateCandidates` put it on the slate as a candidate of no characters.
The slate filter's TSDoc said nothing blank reaches it,
and `BlankSelectionError`'s said its exit was unreachable;
both were false.
The deterministic floor passes a proposal of `U+3000`,
`U+00A0`,
`U+200B`,
`U+2060`,
`U+3164`
or `U+115F` alone over an original that says something
(`t8b6-b39-blank-probe2.mjs`),
and the Hangul fillers are not folded at all.
The same reading let a zero-width reason meet "Reason before vote" in the panel ballot,
reach the polish as a gate or slate objection,
print as a judge's reason in the consolidation brief,
anchor a source-supported archive block,
stand as a coverage quote,
pass as a short image reading,
join the consolidation slate as a lane text,
and write an anchor the splice refuses blank text for.
Whether any run met it is not measured.

Fix:
`rendersAsNothing` (`renders-as-nothing.ts`) reads a text as nothing when every code point is Unicode White_Space,
Default_Ignorable_Code_Point
(`DerivedCoreProperties.txt`,
Unicode 18.0.0)
or a control,
one code point at a time,
and every one of those checks asks it:
the translator and repair reply guards,
the slate builder,
`blankAgainst` on both sides,
the absent slice's record check in `translate-slice.ts`,
the splice's anchor check on both sides,
the lane offer,
the panel ballot's missing reason,
the gate and slate objections,
the consolidation brief's findings and reason,
the archive-block review's anchor quote,
the coverage quote,
and the image reading's "nothing at all".
Every character the fold removes is default-ignorable
and every one it turns into a space is White_Space,
so the fold cannot change the answer;
the slate builder folds first and asks it of the folded bytes all the same.
The floor is left as it is:
every route to it passes one of the reply guards first,
or the lane offer's check,
and a reply guard's refusal is the designed re-ask.
The census of the package's 154 lines calling `trim()`
(`t8b6-b40-trim-census.txt`)
left the rest,
which read parsed values,
settings,
corpus text
or one character's spacing.
The editor and refiner wires fold too,
but their guards take any string as a replacement,
the empty one included
(`isEditorEditWire`,
`isRefineRewriteWire`),
so a replacement the fold empties passes no check it would otherwise fail.
Every case is pinned beside its check's siblings,
and `renders-as-nothing.unit.test.ts` pins the reading itself,
past the first plane included.

The B39 exit does not reach the consolidation lane after this (an inference from the code):
that lane counts floor survivors as heard,
a survivor passed the reply guard,
and the fold cannot empty what the guard passed,
so its slate is empty only where nobody survived,
which still raises.
The records of the translate,
consolidation,
repair,
coverage,
archive-block review
and image reading stages can change,
and so can page assembly's,
so the cache-account audit before a launch takes this change beside B36 to B39.

### B41: the translate stage's record dropped its first round

Status:
fixed 2026-09-30 (UTC),
found reading `runTranslateRepairs` for the B39 fix.
A slice whose incumbent is absent or withheld gets a follow-up round when the first round's judges reject every candidate,
and `runTranslateRepairs` returned the follow-up round's record as it stood,
or rethrew the follow-up's absence as it stood.
The first round's findings reached the follow-up's translators as evidence,
and nothing else kept them:
a slice filled at depth two recorded no decline at all
(read from the code),
and one left unfilled recorded a single round,
where the judges' retry beside it carries every ask it made
("so the record shows each ask rather than only the one that answered",
`translate-retry.ts`)
and a stage case pins that a settled absence carries the evidence of the work that led to it.
Measured on the build from before the fix:
the depth-two absence in `translate-stage.unit.test.ts` carried the 7 findings of one round,
where the two rounds make 15.

Fix:
the record and the settled absence carry the first round's findings,
then `translate-followup-round (after <reason>, <count> rejected candidates)`,
the sentence the log already wrote,
then the follow-up round's own.
Nothing in the package parses a stage record's findings
(`rg` over the source outside the translate modules finds no reader of a translate finding by name),
so the change reaches the records alone.
The rethrown absence carries no finalists,
since every absence the judges' retry lets out is built without them.
The stage case compares the whole record around the named follow-up,
and the B39 case pins both rounds on the kept record.
The translate records change,
so the cache-account audit before a launch takes this change beside B36 to B40.
