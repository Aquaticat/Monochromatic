# Translation repair: OpenRouter as the paid fallback provider, part 34

Part 34 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## Class thirty retains naturalness quorum provenance, 2026-09-10

The local reproduction uses Mio12's failure shape:
four acceptable voices and two unusable voices,
with a nine-seat quorum basis requiring five usable replies.
The runtime correctly returned `quorum-not-met`.
Its stored round omitted the wider basis,
so artifact reading derived a three-voice threshold from six recorded seats and expected `acceptable`.
Changing only the basis to six made the control round-trip.
The original reproduction now round-trips without lowering its nine-seat basis.

`4f697b6df` failed both the stage-to-reader case and an explicit wider-basis confirmation case.
`725a31b12` introduces artifact generation fourteen with required `quorumOver` on every review round.
The default basis is materialized before storage,
including when a window asks fewer seats.
Confirmation retains the discovery's effective basis rather than replacing it with the reduced asked roster's size.
The reader recomputes the verdict from that basis and the actual seats,
then still compares against the stored verdict.
Invalid or undersized bases are rejected before runtime calls and during artifact reading.

`7181f5df8` threads the generation into the pre-persistence completeness check.
`348ae2f10` covers defaults,
malformed metadata,
legacy interpretation,
confirmation and cache retention.
Its additional guard failed when confirmation metadata named a different quorum basis;
`82fa7fdff` binds that basis alongside the existing same-roster check.
`b5da9866b` exposes `quorumNeeded` and `quorumOver` in operational logs.
No reviewer identities are fabricated.
The confirmation still asks the discovery's actual seats rather than enlarging the cohort.

Build,
types and oxlint pass with zero warnings.
The full suite ends `unit exit 0` in `~/temp/agent/class30-final-unit-20260910.out`.
The composed `settleEntry` tests create,
parse and publish generation-fourteen artifacts;
the correction-chain and cache tests retain both decisive and confirmation bases.
Real Mio10 and Mio12 generation-thirteen artifacts still parse,
and current `verify-published` accepts Mio12's existing page.
The executed-build digest changed from
`sha256-tree-v1:89a4fe04c01b1669f035f6c9a7505c781c0648ed994a66cc0106d01f70026963`
to `sha256-tree-v1:fb18ac482e336e5537c131dd6d9fa918cbd2144c2a2cb37ff4632df2de00c103`,
keeping pre-change caches out of the new generation.

Boundary evidence:
`~/temp/agent/Mio12-naturalness-quorum-red-20260910.out`,
`~/temp/agent/Mio12-naturalness-quorum-green-20260910.out`,
`~/temp/agent/class30-confirmation-red-20260910.out`
and `~/temp/agent/class30-boundaries-20260910.out`.
The invalid-runtime-basis control asked two fixture reviewers on frozen `ff6d288bc`,
but current code rejected it before any call.
The repair fixtures and replays use local scripted clients rather than translation-provider calls.

The next task is the separately recorded Mio wording follow-up,
not another automatic entry launch.
Its trace is in [Mio12 wording follow-up](translation-repair-mio12-wording-2026-09-10.md).
The trace distinguishes quoted-form loss,
missing repair-lane name authority,
neutral archive-apparatus treatment,
and a physical-slice context window that omits the dated reconnection paragraph.
Optional university and abbreviation preferences do not independently justify another full pass.
No pass is running.

## Mio12 publishes the preserved poem but exposes a stored-review mismatch, 2026-09-10

Mio12 ended at 07:02 UTC on frozen `ff6d288bc`.
The log contains an initial ERROR after 7427272 ms,
then `REATTEMPT` because 78 additional cache records were available,
then SETTLED after another 4359097 ms.
The first error was:
`artifact parse failed at consolidation.slices[3].polish.review.rounds[0].verdict: expected acceptable, derived from seat statuses and quorum.`
The entry must not be described as a clean first attempt.

The published page was read in full beside the pinned source and archive.
`verify-published` reports 17 wordings,
zero silent deliveries,
8726 characters against the 8723-character floor plus separators,
and zero missing wordings.
All four source destinations,
six `PhotoScroll` components and archive front matter survived.
Assembly has no withdrawals,
trims or findings.

The initial writer's source display logged five explicit breaks at 06:11:04 UTC.
The final source-only poem is slice 16,
with five parsed `<br/>` nodes and no trailing break after attribution.
Its six visible rows are the title,
four poem lines and attribution with dedication.
Each line's continuation wraps softly within that row.
The parser-based projection and MDX compilation both succeed,
and the canonical source-file hash remains
`e963638c509636fbe804d27e4e63be7a19d63b893a49ab24e0bbe8aba87d05b1`.
Translation and publication carry the same poem;
consolidation kept the standing wording and did not rewrap it.
This is published-page evidence for the upstream verse remedy,
not merely a passing guard.

Both chat translations and the Twitter transcript survive as exact archive substrings:
2054,
479 and 1884 characters respectively.
The first chat's `Translation:` label is still absent.
The log contains one set of 42 successful model readings,
six per text-bearing picture,
with three deterministic no-text cases.
The reattempt traversed the pictures again but did not purchase new model readings.

Wording concerns remain separate from the break fix:
the opening replaces the source's distinction between `澪` and `Mio` with `Mio?`,
the first bullet still ambiguously places coming out in primary school,
`a local 985 (a top-tier university)` is awkward,
and `sexual reassignment surgery` is an unnecessary expansion of source `SRS`.
The retained first chat still contains archive `musculine` and other English usage issues.
The QQ-group name now has Chinese,
romanized and explanatory forms together.
The poem retains its lament,
unfulfilled dreams,
next-life farewell and dedication;
its visible line grouping is now correct.

The three checks pass:
front matter is byte-identical to the archive,
12 JSON false starts were recovered,
and none of the 34 schema mismatches opens with a double object or reports `finish_reason=error`.
No `InStreamProviderError` occurred.
The refusal vocabulary has four occurrences each of deterministic-ineligibility,
unendorsed-alternate and ineligible-contest-winner notices;
no `StandingIneligible`,
dropped-destination,
untranslated-token,
MDX-downgrade or invalid-page notice appears.
All ten straight quotes after letters are component-path syntax;
there are zero straight apostrophes inside words,
29 curly apostrophes,
four U+2026 ellipses,
zero three-dot ellipses and two spaced-dot transcript strings,
matching the archive's measured conventions.

Logged spend across both attempts:
OpenRouter 0.970260010925 USD over 850 calls,
including 0.10770175 USD estimated for abandoned calls;
Bedrock 0.2758867675 USD over 503 calls;
467 Synthetic calls and five Hyper calls without per-call prices.
Final meter at 06:59 UTC:
OpenRouter 267.74 USD,
Bedrock 185.50 USD,
Synthetic weekly zero and Hyper balance 246.
The Hyper meter changed during the run;
no cause is inferred from that observation.
The post-run daily helper was run.

Evidence:
`~/temp/agent/Mio12-survey-20260910.out`,
`~/temp/agent/Mio12-mechanical-reading-20260910.out`,
`~/temp/agent/Mio12-picture-reading-20260910.out`,
`~/temp/agent/Mio12-spend-20260910.out`
and `~/temp/agent/Mio12-costs-after-20260910.out`.

Class thirty blocks another launch:
the first attempt recorded four acceptable voices among six asked seats as `quorum-not-met`,
while artifact validation expected `acceptable` from those stored seats.
Reproduce that stage-to-artifact boundary and preserve the intended quorum,
rather than lowering the runtime threshold or buying another whole-entry retry.
No pass is running.
The queue remains at Mio while this failure and the wording follow-up are addressed.

## Mio12 launches on the measured verse remedy, 2026-09-10, 03:45 UTC

Frozen `ff6d288bc`,
pass pid `1713424`,
runs `~/temp/agent/Mio12-20260910`,
log `~/temp/agent/Mio12-20260910.log`,
terminal-only supervisor `proc_6a7b`.
No source change is planned while the pass runs.
Build,
types,
oxlint,
edited markdown and full suite pass;
the suite ends `unit exit 0` in `~/temp/agent/source-display-verified-unit-20260910.out`.

Prelaunch at 03:42 UTC and launch meters at 03:45 UTC:
OpenRouter 268.73 USD,
Bedrock 185.78 USD,
Synthetic weekly 1.9636833484848484 percent with five-hour 2750/2750,
Hyper zero.
The required daily helper output is `~/temp/agent/Mio12-costs-before-20260910.out`.
Overlap 4,
built-in writer grace and no withheld seat are confirmed in the launch log.

The entry must be read in full before `hulicaijia`:
source-display activation,
poem line grouping and trailing-break behavior,
both chat translations,
the Twitter transcript,
all destinations,
archive front matter and the earlier wording concerns.
The live probes support this launch,
not a readiness declaration.

## The verse probes select the upstream source-display remedy, 2026-09-10

The matched contract probe completed in 378 seconds.
Mercury's first writer output stayed at zero breaks under both contracts;
GLM-flash kept five.
The old fixed-slate judging split its votes and declined,
while new judging chose the unique five-break rendering with three of four judges.
New consolidation kept five breaks on GLM-flash and six on Mercury,
whose trailing extra break remains something to inspect on the next page.

A supporting source-presentation probe then changed only the five parser-confirmed break spellings in the
existing model-facing source block to `<br/>`.
The system message stayed identical,
the source display moved from 132 to 147 characters,
and the canonical source-file hash stayed unchanged.
Both writers returned five breaks with no trailing break after attribution,
and both outputs compiled.
This supports the presentation change on the measured passage,
not a universal model-compliance claim.

`b3113164a` integrates that view for explicitly absent incumbents with no archive wording.
The shared offset-preserving parser excludes code,
comments and attribute text;
line endings and canonical source offsets stay intact.
Unknown presence,
metadata and real archive wording retain the old presentation.
`79e82a368` verifies the composed stage's first writer calls and its raw-source judge call.
Final code and formatting tip:
`ff6d288bc`.
Build,
types,
oxlint and full unit suite pass;
the suite ends `unit exit 0` in `~/temp/agent/source-display-verified-unit-20260910.out`.

Probe reports:
`~/temp/agent/rendered-verse-probe-20260910-r1/report.json`
and `~/temp/agent/visible-source-break-probe-20260910/report.json`.
The contract probe logged 0.010003172 USD on OpenRouter and 0.00114931 USD on Bedrock;
the display treatment logged 0.00049012 USD on OpenRouter.
Synthetic calls are counted without per-call prices.
The daily helper ran after both probes.

The next verification is a fresh frozen Mio pass and whole-page reading,
not another prelaunch experiment.

## The delegated verse remedy reaches the live probe, 2026-09-10

The owner delegated the best changes after the correction.
The actual Mio10 preparation was rebuilt from its recorded pairing:
18 matching slices,
with the source-only poem's effective verse flag false.
The recorded slate contains a five-break GLM-flash rendering,
but judges selected Mercury's zero-break text for wording.
This closes the evidence gap and locates the failure before publication.

`1a6ebbf62` gives writers and judges a shared rendered-line contract,
with parsed source facts before writing and counts tied to actual anonymous ballot positions before selection.
Coverage and formatting end at `d2e102b12`.
Source bytes,
archive-backed layout authority and ordinary-passage prompt identity are preserved.
Build,
types,
oxlint and full suite pass;
the full suite ends `unit exit 0` in `~/temp/agent/rendered-contract-verified-unit-20260910.out`.

A bounded matched comparison is running,
not a full-entry pass:
`proc_f94d`,
frozen `d2e102b12`,
log `~/temp/agent/rendered-verse-probe-20260910-r1.log`,
report `~/temp/agent/rendered-verse-probe-20260910-r1/report.json`.
It asks Mercury and GLM-flash to write the same source under baseline and new instructions,
asks the original four responding judges to choose from the same recorded slate under both contracts,
and asks for new consolidation proposals.
Both arms use the same source-only context window.
Direct writer outputs are measured before any structural repair or rejection.
The first scratch invocation failed before generation because a meter-call argument was omitted;
that was corrected without changing pipeline source.

The [verse-remedy review](translation-repair-verse-remedy-review-2026-09-10.md)
records the scope,
720000 ms deadline,
nominal calls,
interface reasoning and verification.
Read the results before relaunching Mio.

## Mio11 is stopped for remedy reassessment, 2026-09-10, 02:18 UTC

The owner rejected treating red/green guards and a publication test as the best fix.
The remedy claim is withdrawn;
those checks establish a rejection behavior,
not why the pipeline should produce and select correct rendered verse.
Mio11 was stopped with SIGTERM to its verified pass pid `1653981`.
The supervisor has exited and no page is claimed.
No further source edit followed the correction.

Logged spend before cancellation:
OpenRouter 0.003006791 USD,
Bedrock 0.00038817 USD,
six Synthetic calls without a per-call price.
In-flight usage may be absent from this tally.
Daily-cost output:
`~/temp/agent/Mio11-costs-stopped-20260910.out`.

The committed guard remains provisional.
The next work is the [verse-remedy review](translation-repair-verse-remedy-review-2026-09-10.md),
not another full pass.
That review also corrects an inference:
the isolated poem fails `isLineStructured`,
but the effective production flag inherits from the chunk and is not present in the settled artifact.
The artifact's `rewrapped: false` and flat consolidation input establish that the final wrapper did not create
this loss.

## Mio11 launches with the source-only break floor, 2026-09-10, 02:16 UTC

Frozen `e0a0ae45c`,
pass pid `1653981`,
runs `~/temp/agent/Mio11-20260910`,
log `~/temp/agent/Mio11-20260910.log`,
terminal-only supervisor `proc_1081`.
Full suite ends `unit exit 0` in `~/temp/agent/class29-final-unit-20260910.out`;
build,
types,
oxlint,
edited markdown and the final focused publisher/explicit-break tests pass.
No source changes are planned while the pass runs.

Prelaunch meter at 02:13 UTC and launch meter at 02:16 UTC:
OpenRouter 268.74 USD,
Bedrock 185.78 USD,
Synthetic weekly 2 percent with five-hour 2750/2750,
Hyper zero.
Synthetic has recovered availability in its rolling window without a top-up.
The launch confirms overlap 4,
built-in writer grace and no withheld seat.
Daily-cost output:
`~/temp/agent/Mio11-costs-before-20260910.out`.

Read explicit rendered breaks in the closing poem,
all screenshot translations,
source destinations,
front matter and the wording concerns from Mio10 before deciding whether the queue advances.
A settled artifact alone still does not answer that question.

## Mio10 preserves the screenshots but flattens the closing poem, 2026-09-10

Frozen `dc51b02d9`,
00:15 to 01:36 UTC,
4,872,081 ms,
18 slices,
11 page changes,
zero silent deliveries.
`verify-published` matches all 18 wordings with no missing text.
The page is `~/temp/agent/Mio10-20260910/fixed/people/Mio/page.en.md`;
it was read completely beside both pinned corpus files.

The front matter equals the archive byte for byte.
All six `PhotoScroll` components parse;
the source's four link destinations,
the horizontal rule,
closing poem and Bilibili attribution are present.
The complete chat blocks and Twitter transcript are exact archive substrings,
measured at 2,054,
479 and 1,884 characters respectively.
The opening `Translation:` label before the first chat was removed,
but its transcript was not.
Pictures were bought once:
one ten-picture traversal,
three deterministic no-text results,
seven pictures corroborated by four readers,
28 successful model image reads.
This is live page evidence for class twenty-five.
Archive review completed without the quoted-revision mismatch from class twenty-eight.
`pageAssembly` has no withdrawals,
trims or findings;
class twenty-seven was not needed on this pass.

The deterministic reading reports no Chinese punctuation,
CJK run,
refusal prose or code fence.
No straight apostrophe appears inside a word;
the ten straight quotes immediately after letters all close component asset strings.
The page has 31 curly apostrophes versus the archive's 29,
and four U+2026 ellipses versus four,
with zero three-dot ellipses.
Both spaced ellipses are inherited unchanged.
No footnotes occur in either text.
The front-matter check passes.
One false start was recovered past an abandoned three-character opening;
no error finish occurred.
The full remaining mismatch replies were inspected privately by matching the flattened log previews
back to payload-cache files;
none opens with adjacent braces.
Mercury's malformed suffixes and wrong array shape remain distinct from an abandoned opening.

The refusal-vocabulary search finds one block-floor refusal at slice 4,
followed by the valid incumbent taking over at consolidation.
No missing-destination,
MDX-downgrade,
reattempt or ineligible-standing terminal event occurs.
All phase benches are reachable on Bedrock and OpenRouter;
there is no hold,
payment refusal or naturalness quorum-not-met.
Seat totals and sanitized diagnostics are in `~/temp/agent/Mio10-findings-20260910.out`.

The prose improves the archive's unsupported claim about the older sister,
restores the primary-school SRS interest,
and repairs the accident account and dates.
Wording defects remain:
the archive's screenshot misspelling,
a coming-out bullet that ambiguously places the event in primary school,
two names for the QQ group,
and awkward university wording.
Those are recorded separately from the structural defect,
not waved through as a clean page.

Class twenty-nine is a loss of rendered verse structure.
The source-only closing poem has five Markdown hard breaks;
the translated and consolidated artifact texts already lack them,
and the published poem has twelve physical lines but no hard break.
`isLineStructured` misses this single-block verse because it requires five blank-separated blocks;
`compareLineCounts` counts physical lines rather than rendered breaks.
A cat fixture through the real built `validateTranslatedSlice` accepts the flattened rendering.
The parser-positive control gives one `break` node for source and faithful candidate,
zero for the flattened candidate.
The reproducer fails in `~/temp/agent/reproduce-Mio10-hard-breaks-20260910.mjs`.
The installed MDX compiler confirms that two-space Markdown and intrinsic `<br/>` each emit a break,
while a soft newline does not.

The independent review supports a source-only floor:
protect a minimum count of explicit breaks per top-level block when the archive incumbent is absent,
accept equivalent intrinsic lowercase `br`,
and leave archive-backed layout choices,
paragraph equivalence,
expansion and author defense unchanged.
This does not select the unchosen paragraph-equivalence option in the block-floor decision.
The fix landed as `7c0ce152f`,
after `d813da8d5` failed four real-validator cases on the prior build.
`source-only-breaks.ts` reads the already parsed skeleton,
so Markdown hard breaks and intrinsic lowercase `br` share one count per top-level block.
The comparison applies only to empty incumbent text,
not to an archive that parses to an empty skeleton.
Existing source-versus-archive block choices are unchanged.
`6359bb2aa` adds code,
escape,
custom-component,
CRLF and missing-block cases,
plus publication of an accepted wrapped insertion into a disposable tree.
Formatting corrections end at `e0a0ae45c`.

The full suite ends `unit exit 0` in `~/temp/agent/class29-final-unit-20260910.out`;
build,
types and oxlint pass with zero warnings.
The original reproducer now rejects the flattened candidate,
and applying the guard to Mio10's actual poem reports five explicit breaks owed versus zero carried.
The same words with explicit breaks pass.
The private reply-cache survey finds both break-preserving and already-flat poem proposals before page assembly,
so assembly is not the only boundary to protect.
No corpus text was edited.

OpenRouter logged 0.618695602723 USD across 653 calls,
including 0.05020922 USD of abandoned estimates;
Bedrock logged 0.2738563435 USD across 481 calls.
Last meters:
OpenRouter 268.75 USD,
Bedrock 185.78 USD,
Synthetic weekly zero,
Hyper zero.
The daily helper ran;
its output is `~/temp/agent/Mio10-costs-after-20260910.out`.
Per-provider totals are `~/temp/agent/Mio10-spend-20260910.out`.
The queue remains at `Mio` until this finding is guarded,
fixed and read on a new pass.

## The tenth Mio launches with quoted revision replies accepted, 2026-09-10, 00:15 UTC

Frozen build `dc51b02d9`,
pass pid `1455521`,
runs `~/temp/agent/Mio10-20260910`,
log `~/temp/agent/Mio10-20260910.log`.
The terminal-only managed supervisor is `proc_abcf`.
No source changes are planned while it runs.

Prelaunch meter at 00:14 UTC and launch meter at 00:15 UTC:
OpenRouter 269.36 USD,
Bedrock 186.05 USD,
Synthetic weekly zero and five-hour 2750/2750,
Hyper zero.
The required daily-cost output is `~/temp/agent/Mio10-costs-before-20260910.out`.
The launch confirms overlap 4,
built-in writer grace and Kimi withheld.

Read for archive review completing without discarding a revision solely for its quote,
both screenshot translations surviving,
and the linked closing poem surviving assembly.
Then complete the ordinary page verification before `hulicaijia` starts.
The full suite,
types,
oxlint and edited markdown pass on this build.

## Mio9 loses revision proposals to a stricter handwritten guard, 2026-09-10, 00:12 UTC

`Mio9` stopped INCOMPLETE at 00:07 UTC after 1,075,657 ms,
before either lane:
archive review heard four of ten seats and raised `provider-unavailable`.
The source-support fix reached the reviewers:
the surviving replies explicitly recognized the `photo6.webp` and `photo7.webp` translation as supported
by corroborated picture text.
That is preparation evidence,
not a published-page result.

Class twenty-eight is a schema mismatch within this package.
MiniMax and Gemma proposed `disposition: "revise"` with nonempty `sourceQuote` strings.
The JSON schema permits those strings,
and a revision can cite the portion of a block it preserves,
but `isArchiveBlockReviewWire` required an empty quote for every disposition except `source-supported`.
The guard discarded those voices before the review could select their proposals.
The captured replies have strings in every required field;
one MiniMax quote has 98 characters,
and the Gemma revision quotes have 21.
Only shapes and lengths were printed during diagnosis;
raw provider replies remain in the private run directory.

`1bc7623c3` guards the real review stage with a quoted revision.
It failed `TranslationRepairInterruptedError: provider-unavailable` on the prior build.
`dc51b02d9` accepts a string quote beside `revise` and explains that field in the sheet.
The proposal still faces independent selection;
only a `source-supported` retention claim gets anchor authority,
and that claim still requires a nonempty quote which the stage checks against supplied source.
The existing unanchored-retention guards still pass.
No quorum,
completion cap,
provider order or roster changed.
Mercury's malformed JSON,
DeepSeek-flash truncation and Synthetic's 503 episode are separate losses.

The fixed build,
types and oxlint pass;
the full suite ends `unit exit 0` in `~/temp/agent/class28-unit-20260910.out`.
OpenRouter logged 0.046664869 USD over 31 calls,
including one abandoned estimate of 0.00288322 USD;
Bedrock logged 0.010438314 USD over 23 calls.
Final pass meters:
OpenRouter 269.36 USD,
Bedrock 186.05 USD,
Synthetic weekly zero,
Hyper zero.
The daily-cost helper ran for both filename dates because the pass crossed midnight.
`~/temp/agent/pass-provider-spend-20260910.mjs` reads one actual pass log and keeps provider totals separate.
Relaunch `Mio` on a fresh frozen build before advancing the queue.

## The ninth Mio launches on the structural-withdrawal proof, 2026-09-09, 23:49 UTC

Frozen build `5cb66ffaa`,
pass pid `1425902`,
runs `~/temp/agent/Mio9-20260909`,
log `~/temp/agent/Mio9-20260909.log`.
The terminal-only managed supervisor is `proc_5d73`.
Source is held still while the pass runs;
any necessary source change requires kill and relaunch.

Prelaunch and launch balances:
OpenRouter 269.40 USD,
Bedrock 186.06 USD,
Synthetic weekly zero,
Hyper zero.
The meter sample is `~/temp/agent/Mio9-prelaunch-meters-20260909.log`;
the required daily-cost helper output is `~/temp/agent/Mio9-costs-before-20260909.out`.
The launch confirms overlap 4,
built-in writer grace and Kimi withheld.

Read both screenshot translations and the linked closing poem before advancing to `hulicaijia`.
The guard's `assembly-structure-single-withdrawal` finding proves the selective branch was exercised;
absence of that finding is not failure when no selected replacement broke the page.
Either way,
read the actual complete page and all ordinary verification checks.
The new build has passed the full suite with last line `unit exit 0`,
types,
oxlint and edited markdown.

## Mio8 stops on a link lost by blanket assembly withdrawal, 2026-09-09, 23:46 UTC

The eighth `Mio` on frozen `5b228736b` stopped INCOMPLETE at 23:32 UTC after 5,673,650 ms:
`entry Mio would drop 1 source destination(s)`.
No page or artifact was published.
The daily-cost helper ran after the terminal state;
its output is `~/temp/agent/Mio8-costs-after-20260909.out`.
Summing actual `SPEND` lines by provider gives OpenRouter 0.615210094 USD over 550 logged calls,
Bedrock 0.1817423025 USD over 362,
and Synthetic 159 calls with no per-call price.
Abandoned-stream estimates remain ceilings,
not invoices.
Meters moved from OpenRouter 270.03 to 269.41 USD and Bedrock 186.24 to 186.06 USD.
Synthetic returned during the pass and ended at 0.3868101893939394 percent of its rolling week;
Hyper stayed at zero.

The missing destination is the Bilibili link in the closing poem,
not a failed translation of that poem.
The cache's slice 17 contains the chosen complete linked poem.
Slice 16 contains a selected malformed `PhotoScroll` with `photos=[` instead of `photos={[`,
retained after its author's unresolved repair.
At 22:46:27 UTC the translate assembly logged `assembly-structure-unattributable mdx-downgraded`,
then `assembly-withdrew-every-replacement (15 slices)`.
The valid poem went with the malformed component;
repair had no archive text for the poem,
so the final page could not carry its destination.
This is class twenty-seven.
The publisher refused the defective result as designed.

The author-defense policy in `translate-repair-wire.ts` is deliberate,
so it is not changed.
The missing proof is at assembly:
absence of a footnote identifier does not establish that no replacement can be identified by a concrete trial.
Guard `3e1fec4be` reproduces the failure with a shared component and a valid source-only linked quotation:
the prior build withdraws both indices `[0, 1]` where only the component must be withdrawn.

Fix `ad6d506a6` tests each single withdrawal by splicing the whole document,
requiring no introduced structural or footnote defect against the archive,
and accepting the first successful trial in supplied replacement order.
It runs only when ordinary footnote attribution found no culprit and a structural regression exists.
No model call is added.
When no single trial repairs the document,
the existing blanket fallback remains;
a lone replacement keeps that same diagnostic too.
`dfc02d538` extracts the shared regression readers;
`48ef99c42` formats the proof;
`5cb66ffaa` covers the footnote condition.
The tests also cover no single withdrawal succeeding and valid container halves spanning slices,
so an isolated-slice parser cannot stand in for whole-page proof.

Build and types pass.
Oxlint reports zero warnings and errors.
The full suite ends `unit exit 0` (`~/temp/agent/class27-unit-20260909.out`),
including the guard that failed first.
The next action is a fresh frozen-build `Mio` relaunch,
not `hulicaijia`.
Class twenty-five still needs a published page read;
this interrupted pass cannot close it at the user boundary.

## The open threads are checked against code and recorded measurements, 2026-09-09, 22:00 UTC

No source changed while `Mio` ran.
The glossary was not empty at handoff:
`git show 2cfad6236:package/module/translation-repair/src/community-glossary.ts` contains both seed entries,
and importing frozen `5b228736b` and calling `communityTermLines` against the pinned source pages returns
both entries for `yuki418330012` and an empty list for `Mio`.
The two named terms are absent from Mio's source,
which explains its absent glossary heading without inventing a missing-curation blocker.
The glossary decision and README had the right state;
the handover and seventh-Mio reading are corrected.
Further curation remains the owner's,
but drafting those same seeds would duplicate existing code.

The "first seat ever above the pooled null" claim also contradicts the seating record:
its 2026-09-08 producer-calibration addendum records Gemma at z +4.14 and Qwen at +5.25,
both above that calibration's 2.81 threshold.
The latest Gemma result is z +6.39.
No special weighting rule is adopted here;
seat breadth or weighting based on upward producer evidence remains an owner design question,
not a reason to alter the running pass.

## The eighth Mio launches with picture support before archive review, 2026-09-09, 21:58 UTC

The class-twenty-five build is frozen at
`package/module/translation-repair/node_modules/.frozen-dist-5b228736b`.
The canonical launcher started `Mio` alone at pid `1178354`,
runs `~/temp/agent/Mio8-20260909`,
log `~/temp/agent/Mio8-20260909.log`.
The process-managed supervisor (`proc_8ef1`) watches pid lifetime and emits only a terminal notification.
Its scratch scripts are `~/temp/agent/supervise-translation-pass-20260909.mjs` and
`~/temp/agent/watch-translation-pass-20260909.mjs`.
A terminal notification is not a settlement verdict;
the log and page decide that.

Launch meters:
OpenRouter 270.03 USD,
Bedrock 186.24 USD,
Synthetic weekly zero and five-hour 2750/2750,
Hyper zero.
The log confirms the unchanged overlap and writer-grace defaults,
Kimi withheld,
and archive front-matter authority.
No source changes are planned while the pass runs;
a necessary source change requires killing pid `1178354` and relaunching from a fresh frozen build.

Read for:
the `photo6.webp` and `photo7.webp` chat translation retained through preparation and on the shipped page;
the `photo3.webp` translation retained;
completed pictures bought once across preparation and lanes;
the horizontal rules,
links,
poem and front matter;
then every remaining seven-step and three-check item.
Run the daily-cost helper after the terminal state,
read actual pass spend by provider rather than its mixed-provider total label,
and record the reading before `hulicaijia` starts.
The remaining queue is `hulicaijia`,
`shi_Yumiaoya`,
`yingying`,
`XingZ60`.

## Picture support reaches archive review before removal, 2026-09-09, 21:46 UTC

The takeover confirmed the clean documents tip `2cfad6236`,
code tip `40aba2fdb`,
corpus pin `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`,
and no running pass.
The canonical files live in the translation-repair worktree,
not the main repository.

The class-twenty-five guard (`aba89b50c`) scripts an archive review that removes a greeting unless its
source sheet contains the corroborated Chinese picture text.
On the pre-fix build,
`pass-readiness-boundaries.unit.test.ts` failed because the archive block was removed.
The section-context guard (`d62c76b4b`) failed because the transcription was absent.
It also checks unrelated pictures,
textless and unavailable evidence,
deduplication,
each corroborating reader's wording and target-only sections.

The handoff's cache assumption did not survive source inspection:
`corpus-run/slice-cache-namespace.ts` writes persisted readings to disk but leaves its open `resumed` map unchanged.
The reuse guard (`a72361aa6`) failed with four reader calls against the first reading's measured two.
Completed evidence is therefore retained by an entry-scoped reader,
not inferred from disk persistence.
A newly exposed reference is still read even when its slice also names an already completed picture.
The same pinned entry is the lifetime boundary;
failed readings are not retained as completed evidence,
and cross-entry cache keys still include picture bytes and reader roster.

Implementation:
`f6cd6e5e7` supplies picture support before archive review and limits it to references in the aligned source section;
`07a99e23a` binds that reader through the real pass and retains completed evidence for the later picture phase.
The review prompt explicitly permits exact source anchors from corroborated transcriptions.
No authority or roster policy changed.

The first full suite passed all three new guards and ended with `unit exit 0`
(`~/temp/agent/translation-repair-class25-20260909/class25-unit-20260909.log`).
Type-checking exposed incomplete test fixtures,
corrected in `009eacc3e`.
Oxlint found formatting findings and the pass-entry module one code line over its limit;
these remain work in progress,
not waived.
An independent review requested a guard through `settleEntry` proving the shared callback wiring,
which is being added before launch.
No provider generation has been purchased during this work.

Verification finished at 21:55 UTC:
`865859305` extracts cache retirement into the cache module without changing its post-publication boundary;
`76d27dc31` resolves formatting;
`5b228736b` covers textless and unavailable prior readings.
The first integration fixture did not reach archive review,
so its failure was not accepted as evidence.
`9e7df9b40` minimizes it to one shared component and one unclaimed archive block.
That fixture fails against frozen `a5e0efc7f` because the review sees no transcription
(`~/temp/agent/translation-repair-class25-20260909/class25-entry-red2-20260909.log`),
and passes against the new build,
checking ordering,
the actual sheets,
one reader invocation and both lane stages.
The final full suite ends `unit exit 0`
(`~/temp/agent/class25-final-unit-20260909.out`);
additional prior-reading branch tests pass;
types pass;
oxlint reports zero warnings and errors.

Prelaunch meters at 21:55 UTC:
OpenRouter 270.03 USD,
Bedrock 186.24 USD,
Synthetic weekly zero and five-hour 2750/2750,
Hyper zero.
The live sampler log is `~/temp/agent/class25-prelaunch-meters-20260909.log`;
the required daily-cost helper ran into `~/temp/agent/class25-prelaunch-costs-20260909.out`.
Its `TOTAL logged OpenRouter cost` label is misleading:
it includes Bedrock and unit-test fixtures from the preceding session,
including `cat/whiskers` at 1.25 USD of simulated calls.
No daily provider-spend conclusion is drawn from that total.
New test logs are kept outside its top-level dated `.log` scan;
pass costs will be read from each provider's rows in the actual pass log.
