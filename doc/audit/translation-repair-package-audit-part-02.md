# Translation-repair package audit, part 02

Part 02 of [Translation-repair package audit](translation-repair-package-audit.md),
whose index lists every part in order.

## Findings register, continued

### provider-5, MAJOR, verified: stale-lock takeover is `rm` then `claim`, which two starters can interleave

`src/corpus-run/runs-lock.ts:353-375`:
`await rm(path, { force: true })` then one `claim`.
The comment says "exactly one create succeeds",
which holds only when both removes precede both claims;
B-rm,
B-claim,
C-rm (removes B's live lock),
C-claim lets both passes proceed,
and the dispose at
`:380-383` removes whichever file is present,
so B's exit deletes C's lock.
Needs two starts against one stale lock,
which a relauncher can produce.
No concurrent-takeover case in `runs-lock.unit.test.ts`.
Tracked as `#243`.

FIXED 2026-08-26 in `caee057fd`:
the eviction is a rename to a name only that call knows,
so exactly one of any
number of concurrent starters evicts (`evictStaleLock`),
every acquisition carries a random token,
and the release
removes the file only while it still carries that token (`releaseIfOwned`),
saying so when it keeps one.
Guards:
two concurrent evictions report `evicted` and `gone` (fails as `evicted`,
`evicted` with a remove),
a release of a lock another holder took over keeps it (fails with the owner check removed),
and of two concurrent takeovers exactly one acquires and the other is refused with the winner's lock intact.

### provider-6, MAJOR by contract, verified: a marked class inherits a provider body excerpt

`src/request-size-refusal.ts:59` declares `messageNamesOnly: true` on `SyntheticRequestTooLargeError`,
and its `super({ status, bodyText, summary })` at `:103-117` ends `Gateway said:`,
after which the
parent (`src/completion-shape.ts:82-89`) appends `bodyText.slice(0, BODY_EXCERPT_LIMIT)`.
The marker's contract (`stated-refusal.ts`,
`refusal-text.ts`) excludes anything read from a provider body.
The observed gateway wording carries only a byte position,
so nothing has leaked;
a gateway that echoes request bytes would print corpus text at the boundary.
Tracked as `#244`.

FIXED 2026-08-26 in `0fb6a8ad8`:
`SyntheticHttpError` takes an excerpt policy,
the marked subclass withholds the
gateway's words from its message and keeps them on `bodyExcerpt` for the log.
Guard:
a gateway body echoing a sentinel leaves the message clean and the excerpt carrying it;
with the excerpt quoted again two cases fail;
restored,
passes.

### provider-7, MINOR, verified: a budget refusal during the re-ask is not caught

`src/provider-router.ts:590-604` calls `callOn` bare for the second opinion;
a 429 or 402 there
becomes a throw instead of the first outcome,
and `markRefused` starts that provider's cooldown one
call late.
Folded into `#240`.

FIXED 2026-08-26 in `2376b7d14`:
the re-ask goes through `replyOrBudgetRefusal`,
which reads a 429 or a 402
as the re-ask not happening:
the first answer is returned and `markRefused` runs on the call the refusal arrived on.
`#240` closed the slot half of this site;
this is the refusal half the entry named.
Guard:
with the helper rethrowing,
the case
`KEEPS the first answer and starts the other provider's cooldown when the re-ask is refused on budget` fails;
restored,
passes.

### provider-8, note: the run log carries provider body excerpts and 80-character openings

`src/stage-call.ts:247` logs `String(error)` of a `SyntheticHttpError` (up to 600 body characters);
`src/stream-cut.ts:40` sets `OPENING_CHARS = 80`.
Both are recorded decisions (`#75`),
and the log is treated as corpus-bearing;
no change.

### provider-9, MINOR, verified: the catalog-drift instrument compares against a stale copy

`src/corpus-run/model-catalog-compare.ts:26-33`:
`CATALOG_MODEL_IDS` still lists
`hf:zai-org/GLM-4.7-Flash` and omits every Hyper-only id,
so the tool built to catch catalog
removals reports a departed model as expected.
Fix:
derive from `Object.keys(SYNTHETIC_MODELS)` and delete the copy.

FIXED 2026-08-26 in `2376b7d14`:
`CATALOG_MODEL_IDS` is `Object.keys(SYNTHETIC_MODELS)`;
the Hyper-only ids are
absent on purpose,
since the fetch compares Synthetic's own endpoint.
Guard:
with the departed id appended to the derived list,
the case `IS the compiled Synthetic catalog` fails;
restored,
passes.

### provider-10, MINOR, verified: TSDoc describes a roster that no longer exists

`src/chat-contract.ts:174` (example uses the departed `hf:zai-org/GLM-4.7-Flash`),
`src/synthetic-catalog.ts:134` ("two of the six"),
`src/corpus-run/run-config.ts:111,152,173` (GLM-4.7-Flash as the third editor) and `:330-335`
("Exactly two models read images").
The `#235` diagnosis started from this prose.

FIXED 2026-08-26 in `2376b7d14`:
the seat history in `RUN_MODELS`'s TSDoc opens with the current seating (ten seats
across two providers,
the measured editors,
refiners and checkers) and keeps each earlier rule in the past tense with
its date;
the reader paragraph counts six readers of ten,
measured as `readsImages: true` on 2 Synthetic and 4 Hyper
rows;
the chat contract's example names `hf:zai-org/GLM-5.2`.
Prose only,
no guard.
The "two of the six" the entry placed at `synthetic-catalog.ts:134` is not in that file (`rg` over the whole of `src`
finds the phrase nowhere),
so nothing was changed there;
the file's remaining mentions of the departed model are
dated history.

### provider-11, note: a shared meter read aborted by its first caller resolves wet for every sharer

`src/provider-budget.ts:318-322`,
documented and pinned by `provider-budget.unit.test.ts:268`;
the 429/402 re-route corrects the one decision it can mislead.
Accepted.

### provider-12, MINOR, verified: raw `console.log` in two library modules, and a handle outside `using`

`src/corpus-run/git-command.ts:54`,
`src/corpus-run/runs-lock.ts:173,222,344,351` (`TLG`);
`runs-lock.ts:258-263` opens with `'wx'` and closes by hand,
so a write failure leaves an empty
lock the next pass reports unreadable and takes over (`PP3`).

FIXED 2026-08-26 in `2376b7d14`:
`runs-lock.ts` logs through `tagged({ tag: 'runs-lock' })`,
warn for a lock held
by another process,
an unreadable file and a lock no longer this acquisition's,
info for the two takeovers;
`git-command.ts` logs its fallback through `tagged({ tag: 'git-command' })`;
and `claim` holds its `wx` handle in
`await using`,
so a write that fails still closes it,
the empty file such a failure leaves being what the next pass
reads as unreadable and evicts.
The sink suite `sink-names-only.unit.test.ts` reads the unreadable-lock line and caught the move:
the whole-suite
run after `2376b7d14` failed its LOCK case (782 PASS,
2 FAIL,
exit 1),
and `c7f2a5075` makes the suite's collector
capture the logger's console methods and drops the `LOCK ` prefix from the expectation.
An earlier draft of this paragraph said no test read those lines;
the search behind it was anchored on the old
prefix with a leading quote and missed the case.
The disposal itself has no guard.

### provider-13, MINOR, verified: a malformed round line parses to `NaN` silently

`src/corpus-run/run-timing-parse.ts:297-298`:
`heard: Number(counts[0])` with no check that the
ratio split into two integers;
only the duration fields refuse.

FIXED 2026-08-26 in `2376b7d14`:
`countIn` refuses an empty or non-digit field and the ratio must split into exactly
two fields;
both throw inside the existing `round line unreadable` wrapper.
Guard:
with `Number` restored and the two-field check removed,
the case
`THROWS ON A RATIO THAT IS NOT TWO WHOLE NUMBERS` fails;
restored,
passes.

### provider-14, MINOR, verified: each of provider-1 to provider-5 lacks the test that would have caught it

No re-ask landing on Synthetic,
no mixed text-then-tool stream,
no roster-subset assertion,
no bare-client refusal of a non-`hf:` id,
no `RunConfigError` marker check at the boundary,
no concurrent stale-lock takeover.
Each fix carries its guard,
committed first per `GFP`.

CLOSED 2026-08-26 by the MAJOR landings,
each recorded under its own entry with its guard:
the re-ask landing on
Synthetic (`#240`,
provider-2),
the mixed text-then-tool stream (`#242`,
provider-4),
the roster-subset proof
(`#241`,
provider-3),
the bare client's refusal of a non-`hf:` id and the `RunConfigError` marker at the boundary
(`#235`,
A-1 and provider-1),
and the concurrent stale-lock takeover (`#243`,
provider-5).
Nothing further to land.

### repair-1, MAJOR, verified: a slice settled while a whole stage heard nobody is cached as a decision

`src/repair-translation.ts:453-470`:
the only gate on the write is `outcome.heardCritics === 0`.
The quorum gather never throws on shortfall (`src/stage-quorum.ts:369-377` returns
`stage-quorum-unmet (...)` as a finding),
and every silent stage downstream lands on an ordinary
"unchanged" exit:
a silent panel makes every claim `needs-human` (`src/tally-votes.ts:76`,
electorate
below `minBallotWeight`),
so `src/repair-chunk.ts:274` returns "nothing to edit,
unchanged";
a silent editor returns `src/repair-editor-stage.ts:251` "no operation survived the gate";
a silent checker leaves every tally unresolved and `src/select-candidate.ts:193` ranks the unchanged
candidate first on the tie.
All three carry `heardCritics > 0`,
so all three are persisted and memoised.
`src/refine-phase.ts:336` persists unconditionally,
so `refine-candidates (0/N heard)` and a
rollback produced by a silent recheck are stored too.
Consequence:
a provider outage lasting one slice (the `#199` week of 429s,
or the `#235` shape where
every seat of one role sits on a dark provider) is frozen into the cache as "examined and found
nothing to change";
every later run resumes it,
reports success,
and never re-asks.
The findings travel with the record,
so the artifact says `stage-quorum-unmet` while the text ships settled.
Retroactive:
caches written during the `#199` outage may already hold such records.
Tracked as `#238`.

FIXED 2026-08-26 in `1a96979ad`,
together with slices-1.
The finding has one spelling,
built and read through `stage-silence.ts`;
the repair driver refuses to cache a settlement carrying it through `cacheRefusalsOf`,
which names its reasons,
the refine driver does the same,
both cache guards refuse to resume such a record,
and the namespace loader now says which record it refused instead of dropping it silently.
Guard:
a persisted slice carrying `stage-quorum-unmet (critic 0/6)` is not resumed while its neighbour is;
shown to fail with the guard's finding check removed (2 failing lines),
restored,
passed.
Retroactive scan:
this worktree's default runs directory holds 150 slice-cache files and none carries the finding;
the main worktree has no runs directory,
so nothing needed purging.
Not guarded:
the two persist-side refusals in the drivers have no driver-level test,
because the scripted client in the driver suites cannot make one stage fall short of quorum;
the existing no-critic refusal beside them has none either (repair-9),
and both are listed there.

### repair-2, MINOR (downgraded from the reviewer's MAJOR): the refine loop lacks the accuracy loop's abort check

`src/refine-phase.ts` has no `signal.throwIfAborted()` before its persist at `:336`;
`src/repair-translation.ts:437` checks before its write.
The reviewer's mechanism,
that an abort settles every remaining slice as silence,
does not hold:
`src/stage-round.ts:103-108` rethrows a caught error when the signal is aborted,
`src/stage-call.ts:244-246`
does the same,
and `src/stream-drain.ts:353-358` throws `StreamCutShortError` under a caller abort
rather than returning partial text,
so an aborted call propagates as a throw and nothing after it is
persisted.
The symmetric check is still owed as a guard against a future path that turns an abort into a non-ok
outcome,
and `refine-phase.unit.test.ts` has no abort case.
Folded into `#238`.

FIXED 2026-08-26 in `d7c707cc3`:
`refine-phase.ts` calls `signal.throwIfAborted()` before its persist,
the check
`repair-translation.ts` makes before its own write,
and `refine-phase.unit.test.ts` has an abort case:
a client that
aborts the run from inside its first exchange and still answers leaves the cache empty and the phase rejected.
GFP,
reported as measured:
with the new line removed the abort case STILL PASSES,
because the stage machinery already
throws on an aborted signal before the phase reaches its write,
exactly as the entry's mechanism paragraph says.
The line is the symmetric guard the entry asked for against a future path that settles an aborted call;
the case
pins the behaviour,
not the line,
and this paragraph says so rather than claiming a guard it cannot show failing.

### repair-3, MAJOR, verified: envelopes adopted without a vote lose their authors

`src/editor-ensemble.ts:232-243`:
the sole-proposal path pushes the winner and its contributors but
no round (`rounds.push` happens only on the judged path at `:282`).
`src/issue-authors.ts:311-318` builds a composite's `perIssue` from `envelopeAuthorsFromRounds({ rounds })`,
and `:227` reads `byEnvelope[envelopeId] ?? []`,
so every issue served by a sole-adopted envelope has no author.
Under `checkerSelfCertificationPermitted: true` (the live setting) a checker that wrote that text votes
on it at full weight and the artifact's `wroteTheText` is false for it.
Bounded today because the checker and editor rosters do not overlap (`#187`);
the record is wrong now
and the weighting becomes wrong on the first overlapping roster.
`issue-authors.unit.test.ts` has no composite built from a sole envelope.
Tracked as `#239`.

FIXED 2026-08-26 in `7103ae59c`:
a sole adoption is a round of its own kind,
`adopted`,
carrying the one slate
entry,
its index,
a reason,
and empty vote fields so every reader of a round keeps its shape;
`issue-authors` treats it like a selected round and the artifact rounds reader parses it.
Guards:
the authors case fails with the kind check reverted (2 lines),
the selection case fails with the push
removed (2 lines);
both restored and passing.

### repair-4, MINOR, verified: an outcome with no prepared slice is refined against an empty original

`src/refine-phase.ts:219` (`prepared?.source.text ?? ''`) and `:236` (`?? outcome.repairedText`);
`src/repair-refine-step.ts:150-157` throws for that state after the phase,
so the tolerance buys
model calls before a refusal that comes anyway.
Unreachable through `repairPreparedDocument` today.

FIXED 2026-08-26 in `d7c707cc3`:
the phase refuses an outcome naming a slice the preparation never produced before
any call,
as `UnpreparedSliceError` (`unprepared-slice.ts`,
marked,
one slice index in its message),
and
`repair-refine-step.ts` throws the same class for the same fault instead of a bare `Error`;
the `??` fallbacks are gone.
Guard:
with the refusal removed,
the case
`REFUSES an outcome naming a slice the preparation never produced before buying any call` fails;
restored,
passes.

### repair-5, MINOR, verified: six prompts fence document text with a fixed `=====`

`src/edit-prompt.ts:18`,
`src/critic-prompt.ts:18`,
`src/adjudicate-prompt.ts:17`,
`src/resolution-wire.ts:21`,
`src/restoration-judge-wire.ts:23`,
`src/derivability-wire.ts:22`,
against `src/refine-prompt.ts`,
whose note calls the fixed value forgeable (a setext underline) and
picks its fence against the content with `selectFence`.
A page carrying a `=====` line closes the instruction block early;
every gated stage bounds the damage.

FIXED 2026-08-26 in `9135037e8`:
all six builders choose their fence through `selectFence` against every text they
enclose,
the rendered claim,
issue,
region and reference blocks included;
the adjudication and editor prompts render
their blocks before the nearby block so the fence can see them;
the six constants are gone.
Guard:
each builder put back on a fixed `=====` fails its case
`FENCES the blocks with a delimiter the enclosed text cannot reproduce` (six suites,
one case each;
`edit-prompt.unit.test.ts` is new,
the builder having had no suite);
restored,
passes.

### repair-6, MINOR, verified: two unmarked classes whose messages hold positions only

`src/repair-unheard.ts` (`RepairUnheardError`) and `src/placement-layout.ts` (`PlacementLayoutError`)
carry no `messageNamesOnly` and quote nothing,
so the slice they name is muted at the boundary.
`repair-unheard.ts:160` spells `` archive`s `` with a backtick for an apostrophe.

FIXED 2026-08-26 in `9135037e8`:
`RepairUnheardError` takes a slice index and an `UnheardClaim`,
`PlacementLayoutError` a position and a `PlacementFault` of seven kinds,
and each writes its sentence from indices,
offsets and counts;
both carry the marker and the inventory names their parts.
The backtick apostrophe went with the
message it sat in.
Guard:
with either marker removed the inventory cases `KEEPS exactly the classes the inventory records` and
`KEEPS a reason for every class that writes its sentence and stays unmarked` fail;
restored,
passes.

### repair-7, MINOR, verified: a stale comment names an exit that no longer exists

`src/repair-translation.ts:536`:
"A blocked document already returned above" against the module
note at `:47-56` ("NOTHING BLOCKS THE DOCUMENT ANY MORE").

FIXED 2026-08-26 in `d7c707cc3`:
the comment says nothing blocks a document any more and points at the module note.
Prose only.

### repair-8, MINOR, verified: typography restoration runs after the structural gate

`src/apply-patch.ts:346` applies `restoreTypography` to `newText` after every check,
while
`src/refine-stage.ts:255` gated the raw `operation.newText`,
so a protected atom holding a straight
quote between word characters can be altered by text no gate saw.
Low frequency.

FIXED 2026-08-26 in `9135037e8`:
`applyPatchOperations` restores typography before its checks,
so the
unchanged-region and preservation gates read the text that ships and the applied record equals it;
`refine-stage.ts`
restores a rewrite before `gateParagraphRewrite` reads it and forwards the restored text.
Guard:
the apply gate reading the raw text again fails
`REJECTS as unchanged an edit whose only difference is a flattened apostrophe`;
restored,
passes.
NO GUARD for the refine half:
with its gate reading the raw text again the refine suite still passes,
because no case
there turns on quote style;
the register's scenario (a protected atom holding a straight quote between word characters)
is what such a case would need,
and it is owed.

### repair-9, MINOR, verified: the guards the three MAJORs need do not exist

No abort case in `refine-phase.unit.test.ts`;
the only silence-and-cache case in
`repair-translation.unit.test.ts` is the critic one;
no sole-envelope composite in
`issue-authors.unit.test.ts`;
`repair-not-applicable`,
`assertUnheardKeptArchive`,
`heardNobodyAbout`,
`settleChunkFromChecks`,
`collectEnvelopeProposals` are named by 0 test files;
`src/refine-slice-settle.ts:149` types the refiner roster as `RepairModels['checkerModelIds']`.

FIXED IN PART 2026-08-26 in `d7c707cc3`:
the abort case (repair-2),
the refiner roster typed as
`readonly RosterModelId[]` rather than as the checker seats (the borrowed type was the only non-optional one),
and suites for `repair-not-applicable` (the anchor never counts toward the non-translation block;
every count zero;
the finding's wording),
`repair-unheard` (`heardNobodyAbout` on all three inputs;
`assertUnheardKeptArchive` refuses
a foreign wording and a claimed change,
accepts the archive wording,
asks nothing of a slice somebody spoke about)
and `editor-proposals` (a duplicate merges its writer into the first proposal;
distinct texts stay apart in roster
order;
a silent model contributes nothing).
The sole-envelope composite landed with `#239` and the silence-and-cache cases with `#238`.
Guards:
the claimed-change refusal removed fails `REFUSES a silent slice that claims a change`;
the merge disabled
fails `MERGES a duplicate proposal into the first one`;
the anchor counted as standing fails
`REFUSES to count an anchor toward the non-translation block`;
each restored,
passes.
COMPLETED 2026-08-26 in `9135037e8`:
`settleChunkFromChecks` reaches the bundle and has a case.
Guard:
with the credit inverted the case `CREDITS exactly the creditable issues the checker majority confirmed fixed`
fails;
restored,
passes.

### translate-1, MAJOR, verified: pairing agreement is filtered from the first usable voice's reply only

`src/pair-blocks-stage.ts:330-333` and `src/pair-sections-stage.ts:368-372`:
`const agreed = (pairings[0] ?? []).filter(votes >= AGREEMENT_NEEDED)` with `AGREEMENT_NEEDED = 2`.
Votes are tallied over every usable reply,
but candidates come only from the first,
so a
correspondence two other voices named is dropped whenever the first voice omitted it,
and which pairs
survive depends on which seat answered usably first.
Both files' module notes say "AGREEMENT IS PER PAIR rather than per reply",
which the code contradicts.
Pairing is the input every later stage reasons from:
a dropped block pair leaves its original
`source-only` (the `#157` shape returns),
a dropped section pair sends a translated section through as absent (`#159`).
Both suites seat only two voices,
a shape that cannot show it.
Tracked as `#245`.

FIXED 2026-08-26 in `4eaa89ede`:
agreement is per pair through `agreePairs` (`pair-agreement.ts`),
shared by both
stages:
every distinct pair across every usable voice is counted,
a contested source keeps its better-voted target
or is dropped with a finding on a tie,
and the result stays strictly increasing on both sides with a finding for an
agreed pair that would run backwards.
Guards:
six helper cases plus a three-voice case per stage;
the blocks stage reverted to the first reply's pairs
fails its three-voice case,
the tie rule removed fails the contested case;
restored,
both pass.

### translate-2, MAJOR, verified: ledger file names restart at zero per process and overwrite on relaunch

`src/candidate-ledger.ts:78` (`const state = { recorded: 0 }`),
`:208-209` (ordinal from that counter),
`:252-255` (`writeFile` to `${padded}.json`).
Relaunching into the same runs directory is the documented resume path,
and `ledger-report.ts`
reads the whole directory with no way to tell an overwritten file from an original,
so the `#212`
evidence (producer standings,
self-preference counts) is silently lost for every relaunched pass.
Tracked as `#246`.

FIXED 2026-08-26 in `b00f9d3b2`:
every ledger file is named by a per-process launch stamp (file-safe ISO time plus
process id) and then the ordinal,
so names never collide across launches and still sort as text into contest order.
Guard:
the same ordinal under two launches names two files and names sort by launch then ordinal;
with the launch dropped from the name two cases fail;
restored,
passes.
The reader-side check slices-2 proposed is not added:
with unique names the collision cannot recur,
and files written before this fix already collided in a way no reader can undo.

### translate-3, MINOR, verified: `sentinel-probe` prints any error's message to stdout

`src/corpus-run/sentinel-probe.ts:166-173`,
the same shape as calibrate-2.
Folded into `#237`.

CLOSED by `#237` (translate-3 was folded into it):
`sentinel-probe.ts` prints its error line through `refusalText`
(line 168 at `8e10cfa19`),
so a marked refusal prints whole and anything else prints its class name.
Nothing further to land.

### translate-4, MINOR, verified: a stage note says a guard is missing that `translate-slice.ts` now runs

`src/translate-stage.ts:31-33` against `src/translate-slice.ts` (`findDroppedDeclaredNames`,
two sites).

FIXED 2026-08-26 in `732d7fb41`:
the stage note says where declared names are checked,
in `translate-slice.ts`
through `findDroppedDeclaredNames`,
and keeps the cross-slice gap as the one thing the stage still does not do.
Prose only.

### translate-5, MINOR, verified: the translate slice cache is at version 6 with a history ending at 5

`src/translate-document-contract.ts:57` against the paragraphs at `:31-50`;
nobody can tell what the bump to 6 discarded or why.

FIXED 2026-08-26 in `732d7fb41`:
the history has its version 6 paragraph,
the bump from `973f7b47d` on 2026-08-22
that carried the verse rule to the judges' sheet in both lanes,
so every slice judged without the rule is re-judged;
neither the record's shape nor its key changed.
Prose only.

### translate-6, MINOR, verified: twenty-one files in the slice have no sibling unit test

Named in the reviewer's report (`~/temp/agent/audit-translate.md`);
the branches that deserve a
direct case are `translate-retry.ts:200-228`,
`translate-slice-attempt.ts:182-183`,
the shipped and
withdrawn index sets in `translate-assemble.ts`,
every `blankAgainst` branch in `translate-absence.ts`,
and the three-voice pairing case translate-1 needs.

FIXED 2026-08-26 in `8e10cfa19`,
on the branches the entry named rather than on file names:
`translate-retry.ts`
(a first decline followed by a decision keeps the decision and both rounds' findings with the retry marker;
a first
decision asks once;
two declines settle as `no-candidate-backed` with one marker),
`translate-slice-attempt.ts` (now
exported:
an insertion nobody could fill is reported `unfilled` with its reason and findings;
a content slice nobody
answered settles on its incumbent) and `translate-assemble.ts` (a replacement dropping a footnote marker is withdrawn
at assembly,
listed as withdrawn and not as changed,
and the warning names the count).
`blankAgainst`'s four branches
were already held by `translate-absence-blank.unit.test.ts`,
and the three-voice pairing case landed with `#245`.
Guards:
the retried-decline list emptied fails the first and third retry cases;
the insertion backstop made to rethrow
fails the unfilled case;
the withdrawn set emptied fails the assembly case;
each restored,
passes.
The slice-attempt fixture builds its insertion by hand the way the document suite does,
because the deterministic
aligner yields no slices at all for a heading-count mismatch (measured:
0 slices for a two-against-one pair).

### probes-1, BLOCKER, verified: the sensitivity instrument labels an arm `prior=shown` that shows nothing

`src/corpus-run/probe-sensitivity.ts:92-103` calls `runIntroducedDefectProbe` with `issues` and no
`disclosure`;
the probe's default is `'withheld'` (`src/introduced-defect-probe.ts:155`),
and the sheet
renders the "PRE-EXISTING DEFECTS THIS EDIT TARGETED" block only under `disclosure === 'rendered'`
(`src/introduced-defect-wire.ts:438`),
whose own default is `'rendered'` (`:365`).
So the `condition: 'shown'` arm (`:172`) and the `'absent'` arm (`:168`) send byte-identical prompts
and differ only in what the deterministic screen dismisses,
while the closing NOTE (`:243-247`)
tells the reader a stage that "goes quiet with prior=shown is one the production prompt silences".
Production withholds explicitly (`src/repair-chunk.ts:389`),
so the counts describe production;
the labels,
the comments,
and the NOTE do not,
and the instrument cannot detect a regression in the
rendered prompt at all.
No recorded decision rests on a post-flip run;
any rerun would mislead.
Tracked as `#247`.

FIXED 2026-08-26 in `bf7d6afbd`.
Production's disclosure is one exported constant (`PRODUCTION_PRIOR_ISSUE_DISCLOSURE`) read by both stages
and both instruments;
the sensitivity arms are a data table (`probe-sensitivity-arms.ts`) whose unit test
holds every arm's printed list to the disclosure it sends;
each accuracy region runs under `none`,
`withheld`,
and `rendered`,
so none-against-withheld isolates the screen and withheld-against-rendered the prompt.
Guard shown to fail with the rendered arm sending `withheld` (2 failing lines),
restored,
passed.
Live run of the instrument,
2026-08-26,
exit 0:
eighteen `SENSITIVITY` lines each carrying `list=` and `issue=`,
three checker seats asked eighteen times and usable eighteen of eighteen,
no dark seat.
It measured what the old arms could not:
on `deletion/mislabelled`,
`list=withheld` raises `removal=3`
while `list=rendered` raises `removal=1` with two probers filing the real deletion as `preExisting`,
so the rendered prompt lets a false accepted issue talk two of three probers out of seeing real damage;
`list=none` against `list=withheld` moves nothing on any region,
so the screen dismisses no real claim here.

### probes-2, MAJOR, verified: the relabel instrument's "shown" arm shows nothing either

`src/corpus-run/probe-relabel.ts:78-88` passes no `disclosure`,
and `:150` labels the arm
"Production condition:
the issue list is shown".
Same mechanism;
folded into `#247`.

FIXED 2026-08-26 in `bf7d6afbd`:
three arms per region (the production disclosure,
the other prompt,
no list),
each labelled from the constant it sends.
Its live run waits on `#257`,
since it reads the round-three draw.

### probes-3, MAJOR, verified: the damage sheet tells the grader every item was flagged

`src/corpus-run/probe-verify-sheet.ts:303-304` prints,
unconditionally,
that "an automated reviewer
claims each one introduced a defect",
while `src/corpus-run/damage-sample.ts:333-357` builds the
sheet from `probe-flagged` AND `probe-silent` items with every claim stripped.
`score-verify.ts` reads a Y on a silent item as damage the probe missed,
so the preamble primes the
grader toward Y on exactly the partition scored as probe misses.
The 20-item damage sheet of 2026-08-17 is still ungraded,
so this can still be fixed before it costs a grade.
Tracked as `#248`.

FIXED 2026-08-26 in `b88d6a947`:
`formatVerifySheet` takes a framing;
the verify sheet keeps its wording and the
damage sample writes the blind one,
which says the reviewer flagged some items and stayed silent on others without
saying which.
Guard:
the blind sheet never says "claims each one";
with the framings collapsed the case fails.
The two ungraded damage sheets on disk (`damage-sheet.md`,
`damage-sheet-agent-read.md` in this worktree's runs
directory) had their preamble replaced in place with the blind wording,
items untouched,
so grading them now is safe.

### probes-4, MAJOR, verified: two probes carve with the deterministic pairer the pass no longer uses

`src/corpus-run/judge-fidelity-probe.ts:384` and `src/corpus-run/displacement-probe.ts:198` call the
bare `prepareDocumentPair` under a comment reading "Slices exactly as the lanes would see them",
while the pass carves through `prepareDocumentPairWithRoster` (`src/corpus-run/pass-entry.ts:267`),
whose LLM-assisted pairing took one entry from zero slices to nine (`#189`) and whose deterministic
fallback slid whole documents (`#71`).
Fidelity trials therefore run on pairs the lanes never see,
and the displacement census counts the
deterministic aligner's slides as translation displacement.
Tracked as `#249`.

FIXED 2026-08-26 in `26f346de8`,
`d2c580995` and `459482191`.
The artifact now records the other half of its pairing recipe (`preparation.sectionPairing`,
always written as
`deterministic` or `supplied` with the pairs,
read as `unrecorded` on older files),
`rebuildPreparation` and
`recipeOf` turn both halves back into the inputs `prepareDocumentPair` consumed,
and `settled-carve.ts` lists a
runs directory's settled entries and carves each over the pair at the artifact's own commit.
Both probes walk that population and log `carved from its settled artifact (complete recipe)` or the halves the
deterministic default stood in for;
an entry with no two-lane artifact is skipped by name of its kind.
Guards:
the rebuild reproduces a crossed section pairing and a declined block,
proved by the identity hash with the
bare carve as positive control;
removing either recipe half from the carve or the reader's generation check fails
2 to 3 cases each.
Measured at the boundary:
this worktree's runs directory holds 56 legacy artifacts and both probes carve none;
`TRANSLATION_REPAIR_RUNS_DIR` pointed at the 2026-08-17 runs directory carves 6 of 6 two-lane artifacts,
every one
with both halves defaulted since they predate the recorded pairing,
and one capped fidelity trial ran over them
with all ten seats usable.
