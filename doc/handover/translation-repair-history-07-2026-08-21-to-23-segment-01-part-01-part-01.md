# Translation repair history: 2026-08-21 to 2026-08-23, part 01

Part 01 of [Translation repair history: 2026-08-21 to 2026-08-23](translation-repair-history-07-2026-08-21-to-23-segment-01-part-01.md),
whose index lists every part in order.

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Session 2026-08-21: the consolidation reaches the document, and four measurements that changed their own tasks

THIS DOCUMENT WAS 208 COMMITS STALE when this section was written.
The whole third-rendering arc,
`#130` through `#168`,
is recorded in
`doc/planning/the-third-rendering.md`,
which is canonical for it.
What follows is the state a taking-over session needs,
not a retelling of those commits.

### The consolidation is wired, and its record can no longer delete a slice

`pass-entry.ts` calls `consolidateDocument` after the lane contest,
under the entry's own signal,
and writes what it settled into the version 2 artifact.
Four defects were fixed on the way and each is worth knowing about:

-   The artifact dropped `settlement.text` entirely,
    so a consolidation that won both rounds could not affect any output.
    It now carries `shipped` as a NAMED ABSENCE,
    `{ kind: 'consolidated', text }` or `{ kind: 'unchanged' }`,
    because one terminal state carries the empty string
    and a consumer writing a bare field per slice would delete every declined-contest slice.
-   The resume rule read `gate.usable > 0` where its own policy says quorum,
    and persisted `slate-kept-standing` regardless of the decision behind it.
-   `contest.` and `pairing.` were never registered as cache namespaces,
    so every repair-lane generation change silently deleted an entry's contest ballots
    and its whole LLM-assisted pairing,
    both bought from the roster.
    Proven end to end on a throwaway directory.
    The list is now derived from one `CLAIM_BY_ROLE` record.
-   A resumed settlement was trusted unread.
    `openConsolidateCache` now validates the terminal,
    the text,
    the floor,
    every verdict and every gate ballot before bytes off disk can become corpus text.

State at this commit:
lint clean,
501 suites,
0 failures.

### What is running, and the one rule that protects it

`#138`'s verification at the user boundary is IN FLIGHT.
`doc/handover/translation-repair-run-continuity.md` carries the operating detail
under "The verification run in flight",
including why a cache poller exists and how to finish or stop it.

The rule that matters here:
DO NOT EDIT `package/module/translation-repair/src/` UNTIL RUN 2 HAS FINISHED.
The slice cache keys on a digest taken over the built output,
so any source edit discards every namespace,
and run 2 would re-buy everything and report a validator failure that never happened.
Documentation commits are safe and were used throughout this session for exactly that reason.

### Four measurements that changed the task that asked for them

Each of these was owed by a pending task,
cost no quota,
and moved the answer:

-   `#164` asked which of two renderings is better where the gate's ballots disagree with the panel.
    The question dissolved.
    `unsupported` and `dropped` are lists of rendering NAMES,
    so a ballot naming both cancels,
    and 74 of the 76 asymmetric ballots
    name faulty exactly the rendering they voted against.
    The field restates the vote.
    Closed with nothing built.
-   `#162` asked whether the wrap splits a line on line-structured slices.
    The band pair has ZERO such slices,
    so the first measurement was a null from a probe
    that could not have shown anything.
    Corpus-wide it splits 189 of 211,
    breaking 470 of 1091 existing lines.
-   That produced `#167`:
    none of the three shipped wrap sites is gated on `lineStructured`,
    so the pipeline tells producers to keep verse lines and then breaks 43 percent of them at assembly.
-   `#163`'s band of 2.09 to 4.24 fires on 27 percent of the corpus's own archive slices.
    Refuted.
    The tail starts near 0.8 and 10,
    and block-count disparity is a second,
    unit-free instrument:
    88 percent of slices carry equal block counts.

The shared lesson,
and it recurred three times in one session:
A NULL FROM A PROBE THAT CANNOT SHOW THE DIFFERENCE MEANS NOTHING.
The band pair had no line-structured slice;
a GFP walked the same list it was testing;
`prepared.slices` carries `source` and `target` objects rather than `targetText`,
so a key mismatch reported zero structured slices out of 1259.
Each was caught by running a positive control first.

### Open, in the order they matter

-   `#138` item 4,
    the verification,
    is the only thing blocking that task.
-   `#165` owes a count of `slate-kept-standing` settlements carrying a declining decision.
    The artifact records the TERMINAL and not the decision,
    so this reads off the captured cache rather than the artifacts.
-   `#166` has its consumer split enumerated:
    `readArtifactSubjects` and `damage-region-v2` ask shipped questions and are wrong as they stand;
    `settled-tally` is honest but incomplete.
-   `#167`,
    `#163`,
    `#162` all need a decision and then source changes,
    so all wait for run 2.
-   `#168` and `#169` came out of infrastructure rather than the pipeline:
    a picture ceiling above the gateway's undocumented body cap,
    and a supervisor whose process guard cannot see the pass it launches.

## Session 2026-08-22: the gateway's real cap, and the verse rule finally reaching a judge

Three tasks landed.
Two of them share a shape worth naming before the details:
A FACT THE PIPELINE COMPUTES CAN REACH HALF THE ROUND AND STOP THERE,
and nothing fails,
because both halves keep answering.

### `#168`: the picture ceiling was guarding against the wrong authority

The ceiling on a picture asked what a MODEL would read.
The thing that actually refuses is the GATEWAY,
and it refuses by describing our JSON rather than its own limit:
a body over the cap comes back as `400` naming a parse failure at a byte offset,
so a request refused for being too big reads as a request that was malformed.

-   The ceiling is now 7 MiB,
    measured against what the gateway carries rather than derived from what a model reads.
    The eight mebibytes standing until today mapped onto a body of 11185335 bytes,
    which is 699575 ABOVE the only size measured to pass:
    the number guarding the request permitted requests the gateway rejects.
-   The unavailable reason is renamed `too-large-for-transport`.
    A reader who saw the old spelling would look for a model that refused,
    and no model ever did.
-   `failureForReply` re-raises that refusal as `SyntheticRequestTooLargeError`,
    on three signals together:
    status `400`,
    the gateway's parse-failure wording,
    and a body larger than anything measured to arrive.
    Never as a pre-flight refusal,
    because only the PASSING size is exact
    and a client-side guard would reject gray-zone bodies the gateway may well carry.
-   The trap in measuring it:
    the corpus is Chinese,
    so `.length` reads about a third of the wire size.
    `Buffer.byteLength` is required,
    and there is a test that fails on exactly that substitution.

A coverage gap was found by inspection rather than by a failure:
nothing pinned the ceiling.
The oversize fixture cleared both the old number and the new one,
so a revert would have passed the whole suite.
`PAST_THE_NEW_CEILING_ONLY` sits between them and is the only thing that can tell them apart.

### `#177`: the verse rule reached both producer sheets and no judge at all

`#150` made the verse rule outrank the page rule for PRODUCERS,
and said so in the rule text rather than by ordering,
because a model resolves a contradiction however it likes when neither side defers.
`#176` gave the same rule to the consolidation's producers.
Neither reached a judge,
and `judgeTranslateSlate` had no line-structure parameter at all,
so there was nothing to forward and nothing to notice missing.

WORSE THAN SILENCE.
Criterion four tells every judge that a shape the ORIGINAL does not have is not a fault,
because this archive's pages split,
merge and quote passages of their own accord.
On a verse slice that is the right rule pointed the wrong way:
there the ORIGINAL is what carries the line structure and the page is what merged it.
A producer obeying the rule unmerges,
and its judge had been handed a reason to prefer the merged rival.
Measured under `#162`:
211 slices across 34 entries of the 92 pairs are governed.

What landed:

-   `TRANSLATE_LINE_STRUCTURE_CRITERION`,
    phrased for SELECTION rather than production.
    A judge builds nothing and chooses between candidates already written,
    so the same fact has to arrive as a test it can apply to each one.
-   It is inserted BY IDENTITY immediately ahead of the rule it overrides,
    and names that rule outright rather than relying on list order.
    The clause both criteria state is ONE SHARED CONSTANT,
    so the override cannot come to quote a sentence no judge is given.
-   `lineStructured` is REQUIRED on `judgeTranslateSlate`.
    `#176` carried the same fact as an optional field for a day,
    no caller set it,
    and every verse passage was quietly told it was prose.
    Required,
    the compiler named all seven call sites at once.
-   Both cache versions moved,
    `TRANSLATE_SLICE_CACHE_VERSION` to 6 and `CONSOLIDATE_CACHE_VERSION` to 2.
    Both keys ALREADY carried `lineStructured`,
    so this change is invisible to the material:
    without the bumps a governed slice settled yesterday resumes
    with a judgment made under a sheet that never mentioned lines.
    The owner may veto the discard;
    it is recorded rather than asked,
    since quality decides and quota is not a constraint.

### The lesson that generalises: test the derivation, not the parameter

Every case that writes a flag out by hand passes whether or not any caller ever computes it.
`#177` carries a governed and an ungoverned round at four levels,
and the GFP proves the levels are not redundant:
breaking the STAGE's handover fails the stage and whole-document cases
and leaves the two that call the judging half directly passing.

`document-verse-rule-reaches-the-wire.unit.test.ts` is the one that drives a real
document and lets the pipeline derive the verdict itself.
It also asks the SHIPPED predicate about its own fixture,
so a fixture that quietly stopped being line-structured is reported as a broken fixture
rather than passing as a clean null.

### Open, in the order they matter

-   `#178`,
    split out of `#162` today:
    the consolidation's judges are picture-blind and window-blind.
    The picture half is a LIVE REGRESSION rather than a longstanding gap,
    because `#176` gave the producers pictures this morning,
    so the judges now weigh proposals written against evidence they cannot see.
    Its window half puts the window into the consolidation key,
    which unlike `#176`'s picture append discards nearly every settled consolidation:
    nearly every slice of a multi-slice document has a window.
-   `#162` keeps the pre-slate wrap alone,
    now blocked on `#177` and `#178`,
    and its `!lineStructured` gate removes the degradation arm by construction.
    Its savings claim still owes the measured band-pair fork run.
-   `#163`,
    `#175`,
    and the five older pending tasks are unchanged.

## 2026-08-22, later: `#162` closed on a refuted premise, and `#175` built the publisher

### `#162`: the savings premise was refuted before any code was written

The task was opened on a claim that whitespace-only consolidations were costing rounds:
3 of 20 shipped consolidations differed from their incumbent only in where lines broke.
That number came from an offline re-derivation over runs 8 and 9,
both of which predate `#151` wiring the wrap into the pipeline.

Re-measured over the two most recent runs of the same six entries,
`demoted` is 0 of 34,
and the one slice the claim named never reaches the gate at all.
The zero is real rather than a plumbing failure:
`rewrapped` rides the same forward and varies in the same files.

A stronger justification was found in the same data and replaced it.
Over those runs 15 of the 16 shipped consolidations came back from `wrapConsolidation` altered,
which means both deciders were approving bytes the run then changed.
That is a correctness defect of the same class as `#142`,
and it does not depend on any savings claim.

What landed is `wrapConsolidationProposals`,
called in `consolidate-settle.ts` before the slate is built rather than after the gate has spoken.
The change turned out much smaller than predicted:
`judgeTranslateSlate` already had a `soleIncumbent` early return,
and `SLATE_TERMINALS` already mapped `sole-candidate` to `slate-unjudged-standing`,
so a proposal that is only a re-wrapping now folds into the incumbent,
settles unjudged,
and buys neither a slate round nor a gate round,
with no new terminal and no artifact,
parser,
cache or census ripple.

The costly band-pair fork run was DROPPED with a stated reason rather than deferred.
Its primary signal compares zero against zero on the current pipeline,
and the band pair's own measured run-to-run spread,
about 2 slices in 13,
swamps any rate reading at this size.
A deterministic zero-round unit test replaces it.

### `#175`: the owner answered, and the pipeline now writes documents

The owner's words:
"The pipeline should replicate the directory structure of the corpus in a newly created dir,
and put fixed `*.en.md` files in the new dir."

Until today every decision the pipeline made existed only as JSON.
The contest picked a lane,
the consolidation picked a text,
the gate accepted or refused,
and the only full documents that existed at any moment were the ones the checkers assembled to verify and threw away.

`publishFixedPage` in `src/corpus-run/publish-fixed.ts` closes that,
writing `<runsDir>/fixed/people/<id>/page.en.md` for every entry the pass settles.

### Why the publisher runs inside the pass, and not over an artifact pool

This was the open fork when the owner's answer arrived,
and the artifact schema settles it.
`spliceSlices` resolves each replacement by `slice.target.chunkIndex` and needs the OFFSETS a `ChunkPair` carries.
`ArtifactComparisonRowV2` carries `chunkIndex`,
`incumbentKind`,
`incumbentText` and the lane texts,
and no ranges at all.
Recovering offsets by searching `incumbentText` inside `archiveText` is not merely fragile on repeated wording:
where `incumbentKind` is `absent` the incumbent is the empty string,
which matches at every offset,
so only a stored range can say where an insertion goes.

Extending the schema with ranges was rejected as a standalone-republisher feature nobody asked for.
NAMED EXCLUSION:
artifact pools settled before this publisher existed get no pages without a re-run.

### The write order is the correctness property

`corpus-pass.ts` builds its skip set as `settledEntryIds({ artifactsDir })`,
so "done" means exactly "an artifact JSON exists".
Publishing after the artifact would let a crash between the two writes
strand an entry marked done forever with no page ever written.
Publishing first makes "done implies published" true by construction.

The file already argued for this ordering in its own words:
`settledTallyLine` was moved above the artifact write earlier the same day
because it can raise and would otherwise print `status=ERROR` for an entry whose complete artifact was on disk.
The publisher reads the same would-ship readings and can raise the same error,
so it sits in the same slot.

### What was measured, and the branch measurement cannot reach

Across 14 artifact pools,
40 entries and 249 slices,
every settled artifact on disk:

-   readings shipping nothing:
    0
-   slices whose archive holds no wording:
    0
-   slices whose archive holds wording:
    249

The same reader discriminates four deciders over those slices,
`archive` 228,
`consolidation` 11,
`contest` 9,
`lanes-agreed` 1,
so it is reading real per-slice data rather than returning a constant.

All three silence kinds require an empty archive incumbent,
and no slice in any pool has one,
which is consistent with `#90` and `#100`:
absent incumbents come from one-sided sections the slicer does not yet produce.
So `spliceSlices`' refusal of empty text at an insertion anchor cannot fire today,
and becomes reachable only when section-scale one-sided slicing lands.
It is left to propagate and fail the entry loudly.

WHAT THE MEASUREMENT COULD NOT SHOW is that a silent reading is reachable at all.
Forcing one by blanking a real artifact's row was refused by `parseSettledArtifactV2`,
which cross-derives comparison rows from the ledgers beside them,
so the branch is proved by a fixture artifact in the tests instead.

A SAFETY NOTE from that refusal:
the parse error message quotes the passage it disagrees about.
Scratch probes over artifacts must print error CLASS NAMES only,
never messages.

### The GFP evidence, and the file split it produced

Three type-legal breaks:

-   `order`,
    publishing after the artifact write:
    fails only `settleEntry`'s ordering case,
    with `ENOENT` on the page.
-   `mkdir`,
    creating only the immediate parent:
    fails every case that writes a page,
    in both files.
-   `silent`,
    dropping silent readings instead of handing them the empty string:
    fails the replacement builder and both refusal cases.

The `silent` break is what found a structural defect in the new tests.
It first reported ONE narrow failure while the real blast radius was every page the pass writes:
the runner abandons a whole file once any describe in it fails,
and the two pure describes sitting above the writing ones hid all of them.
Split into `publish-fixed-replacements.unit.test.ts` and `publish-fixed.unit.test.ts`,
the same break reports both files.

This is the second time this runner behaviour has cost a segment's evidence.
The rule it implies:
cheap unit describes and end-to-end describes do not share a file.

### Verified at the user boundary, and one claim of mine corrected

A real `corpus-pass --only gaoyanger` into a throwaway `TRANSLATION_REPAIR_RUNS_DIR`,
settling the entry in 976 seconds and publishing `fixed/people/gaoyanger/page.en.md`.

The check is an INDEPENDENT reconstruction rather than a second call to the assembler.
Re-splicing would compare the publisher against itself and agree with any offset bug it has,
so the expected page is rebuilt from the corpus bytes by string replacement,
which knows nothing about ranges:
start from `git show <pin>:people/gaoyanger/page.en.md`,
and swap each incumbent wording for what the artifact says shipped there.

-   archive 349 characters,
    published 370
-   2 slices:
    1 shipped new wording,
    1 kept the archive wording,
    0 shipped nothing
-   page matches the independent reconstruction:
    true
-   trailing newline preserved exactly,
    on both sides

CORRECTION TO WHAT THIS RECORD FIRST SAID.
It claimed re-runs overwrite the page.
A second pass into the same runs directory reports `pending=0 done=1`,
skips the entry outright,
and leaves the page with an unchanged mtime and an identical digest.
So a resumed pass does not republish at all,
which is what the "done implies published" ordering is FOR:
the page is already there,
and nothing has to re-derive it.
Overwriting is only the path where an entry is genuinely re-settled,
an artifact gone while its page remains,
and that path is covered by a unit case rather than by this run.

The run also carried the first real traffic through `#162`,
`#177` and `#178`,
which dropping `#162`'s fork run had left unexercised.
It settled with `selection=contested`,
`pageChanged=1`,
`pageSilent=0` and no refusal.

### Commits

-   `f982ca3cc`,
    `f6ebbce0b`,
    `3e711d9bf`:
    `#162`,
    the wrap and its tests.
-   `6acb9a86c`:
    the publisher and its wiring.
-   `db52bc892`:
    the publisher's tests.
-   `717bb781c`:
    the file split GFP forced.

## 2026-08-22, later still: `#163` found its instrument already built, and its sweep was re-aimed

`#163` asked for an expansion-ratio guard.
Its own closing note proposed the sharper form:
"a per-slice comparison against the archive's own ratio may be sharper than any corpus-wide band,
and costs nothing more".
That instrument already exists in production source,
and the task never mentioned it.

### The instrument was already built, and its header is a catalog of the traps

`src/displacement-ratio.ts`,
253 lines,
and `src/displacement-class.ts` beside it:

-   `sliceRatios` measures every slice and filters nothing,
    because an earlier version discarded short originals and threw away the strongest evidence there is.
-   `documentBaseline` returns the document's own expansion when it lands between
    `PLAUSIBLE_BASELINE_MIN` 1.9 and `PLAUSIBLE_BASELINE_MAX` 4.5,
    and `CORPUS_REFERENCE_EXPANSION` 2.86 otherwise,
    saying which of the two it used.
-   `classifyDisplacement` classifies each slice,
    computes a residual against that baseline,
    and keeps untranslated,
    target-only,
    relocation candidates and unpaired imbalances apart.
-   `MIN_RATIO_SOURCE_CHARS` 80 stops a short original's ratio being read as evidence at all.

The header already records that a document's own MEDIAN is contaminated by exactly what it detects,
and that the eligible-slice aggregate is only partly invariant under relocation.
A second ratio instrument built beside this one would re-hit both.

### What it measures, and what it decides

Read at the call sites rather than assumed:

-   Both consumers feed it `prepareDocumentPair({ sourceText, targetText, },)`,
    which is the ARCHIVE pair.
    It has never seen a candidate rendering.
-   Both consumers are probes under `corpus-run/`,
    `displacement-probe.ts` and `window-trial-probe.ts`,
    emitting telemetry.
-   No pipeline stage reads it.
    `translate-barrel.ts` only re-exports it.

So the instrument exists and the guard does not.
The neighbouring guards are all size-blind:
`translate-validate.ts` compares block skeleton,
references and code;
`consolidate-validity-floor.ts` refuses a slate with no structurally valid proposal.
A candidate that keeps the skeleton and deletes most of the prose inside it passes both.
`#155` named the complementary fault,
deleting what the archive carries and the Chinese does not,
bounded to a SILENT original.
An original that says something and a rendering that renders almost none of it is still unnamed.

### The sweep looked unnecessary, and the probe that could refute that did

The sweep's product is a cleaned outlier list,
which is worth buying only if the guard reads a parameter those outliers can move.
A per-slice guard comparing a rendering against the archive's own value for that slice draws no corpus-wide band,
so at first reading the 28 pairing calls bought nothing.
That reading was wrong,
and measuring it rather than asserting it is what showed the difference:

-   Only 854 of 1259 slices,
    67.8 percent,
    can serve as their own reference.
    The other 405 must read the document baseline.
-   Of the 64 flagged slices,
    36 are currently eligible to SET their document's baseline.
-   Removing them changes the baseline source in 7 documents,
    and moves it by up to 0.725 against a corpus value of 2.86.
-   170 of the 405 baseline-reading slices sit in a document whose baseline moves.

### Why the sweep is bought anyway, which is a better reason than the first one

Every number this task ever recorded,
the 1259 slices,
the 64 flags,
and both contamination probes,
was measured with `prepareDocumentPair`,
the DETERMINISTIC pairing.
Production preparation is `prepareDocumentPairWithRoster`,
at `corpus-run/pass-entry.ts:266`,
per `#131`.
The two slice a document differently.
Calibrating a guard on the deterministic numbers would calibrate it on slices the pipeline never produces,
so the sweep is not "clean the outlier list" but "measure on the population the guard will read".
That justifies it whether or not the contamination result had come back null.

### What is running

`~/temp/agent/163-roster-sweep.mjs`,
sequential by entry:
29 entries,
110 paid pairing rounds,
each asking all 6 roster voices.
Sections are already asked in order inside the preparation,
so one entry at a time holds the whole sweep at six concurrent streams,
under the roughly seven the aggregate-concurrency stall was measured at.
Entries are ordered by baseline exposure,
so a stall still leaves the decisive ones settled.
It stores counts only,
never text,
and reports errors by class name,
because pairing and parse errors quote the passage they failed on.

The guard's shape is settled and does not reopen:
per-slice archive reference where usable,
document baseline fallback,
and a named fault in the `contest-ballot-wire.ts` shape both deciders read,
which is `#155`'s mechanism.
The sweep decides its calibration inputs only,
and the guard is built after it rather than beside it.
