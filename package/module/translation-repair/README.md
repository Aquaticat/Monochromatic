# @monochromatic-dev/module-translation-repair

Multi-model translation critique and conservative repair.

Takes an original text plus its translation,
returns a structured issue list anchored to an immutable document model,
and a repaired candidate translation.

## Contract

The core export is the batch driver over pure stage functions:

```ts
import { repairTranslation, } from '@monochromatic-dev/module-translation-repair';

const result = await repairTranslation({
  client,
  sourceText,
  targetText,
  models: {
    criticModelIds,
    panelModelIds,
    editorModelIds,
    judgeModelIds,
    checkerModelIds,
  },
  signal,
},);
```

- `client` is an injected model client (`createSyntheticClient` or any
  `SyntheticClient` implementation);
  the library performs no IO of its own.
- `models` names the role roster:
  critic fan-out, provenance-blind adjudication panel,
  editors, selection judges, and resolution checkers.
  A stage that loses voices retries exactly the lost ones until at least
  half its roster is heard.
  An optional `editorRuleAddendum` splices one extra machine-enforced
  rule line into the editor prompt for calibration experiments.
- No single model decides the repaired text.
  Every editor in `editorModelIds` rewrites the chunk independently,
  each proposal passes the same deterministic apply gate,
  and judges drawn from `judgeModelIds` choose what ships.
  Selection seats the WHOLE judge roster, producers included,
  and counts a judge's ballot for its OWN candidate at half weight;
  every other ballot it casts carries full weight, including one for
  another producer's candidate.
  A winner needs weight 2, so on these rosters no candidate is selected
  by its own authors alone.
  `assertJudgeableEditorRoster` still requires two judges with no stake
  in the set, which is now a policy rather than an arithmetic necessity:
  it keeps a whole slate from being ranked only by the models that wrote it.
  `checkerModelIds` should likewise exclude every editor,
  so nothing certifies text it wrote.
- Judging runs at two granularities.
  Per envelope, the best fix for each individual issue can win even when
  the model that wrote it botched the rest of the chunk;
  the winners are assembled into a composite candidate.
  Per chunk, whole candidates compete, including that composite,
  which is the only level at which coherence across envelopes is visible.
  The composite has to win on its merits rather than being adopted by
  construction.
  When judges decline, the strongest editor patch ships anyway:
  falling back to the untouched translation would turn a disagreement
  about wording into a lost repair.
- The result is never an unqualified "corrected translation":
  `repairedText` ships with a completion status
  (`repaired`, `unchanged`, or `blocked-non-translation`),
  every adjudicated issue with its resolution fate,
  and degradation findings.
  When no candidate demonstrably beats the input,
  the input is returned unchanged with its unresolved issues.
- Every issue record also carries WHAT WAS WRITTEN for it,
  so repair quality can be judged apart from whether the issue was real.
  `repairRegions` records replaced regions rather than per-issue repairs,
  because envelopes merge overlapping and touching evidence,
  so one replacement can serve several accepted issues and fix only some;
  each region names every issue it serves.
  `repairDisposition` says what became of that repair in the returned document
  (`shipped`, `not-selected`, `withdrawn`, or `no-region`),
  and is decided after document-level blocking and the naturalness lane,
  neither of which any single slice can see.
  `refined` marks a slice the naturalness lane rewrote afterwards,
  which is where the recorded replacement stops being the returned wording,
  and `finalSliceText` carries that wording exactly there.
- Translation policy files (register, terminology, tense discipline)
  are deliberately open;
  the system functions without them using conservative defaults.

## Reading the pictures a document shows

A document that shows a picture carrying text is a document whose translation
cannot be judged from its text alone.
The pipeline reads those pictures and puts the reading beside the source and the
archive, as evidence a later stage may consult.
Nothing in the reading decides what ships.

### Deterministic first, and usually last

`tesseract` runs before any model is asked, with `chi_sim+eng`.
Under 16 solid characters the picture is recorded as carrying no text,
no model is asked about it, and no finding calls that a shortfall,
because it is the correct answer:
119 of the 191 pictures in the reference corpus carry no text at all,
most of them being photographs of people.

It gates rather than votes, which was settled by measurement and is the opposite
of what it looks like it should be.
Its trigram overlap against the model readings is 0.019 and 0.023 on one asset
and 0.096 and 0.111 on another, while those models agree with each other at
0.643 and 0.785.
It is not missing the text:
on the first asset it returns 405 characters against their 390 and 394.
It reads the same text and gets the GLYPHS wrong, which leaves length intact and
destroys overlap, so letting it vote would refuse readings that are fine.
What it is reliable at is PRESENCE, six of six against the models in both
directions.

### Two readers, and a reader asked again

A reading may be used only when a second model, shown the same picture and not
the first model's answer, agrees with the first at the corroboration threshold.
A single reading is refused rather than passed along with a caveat.

The vision sub-roster is exactly two because the provider offers exactly two
models that read images.
That makes the pair's success rate the weaker reader's read rate, which is why a
declined reading is asked again, up to four asks.

Measured over the whole corpus, 119 reader and picture pairs reached a model,
109 read on the first ask, and 1 more read only after being asked again.
Of the 9 that never produced a reading, 6 refused through all four asks, while 2
exited on the length screen and 1 on an empty reply.
Neither of those is a refusal and neither is asked again.
So a decline is usually about the picture, and sometimes about the roll:
on one text-bearing asset asked six times per model,
`hf:Qwen/Qwen3.6-27B` read it six times of six and
`hf:moonshotai/Kimi-K3` twice of six, transcribing the same text either way.
Re-asking costs about 20 extra calls over a corpus pass and recovers the roll
case when it happens.

### What is sent, and what is not

Pictures are sent as they are.
No re-encode, no format change, no downscaling, no tiling.
An earlier byte ceiling was this package's own estimate of what a vision model
would accept, derived from base64 length against context length, and it was
wrong in kind:
a vision model tokenizes a picture by resolution in tiles, not by base64 length.
Sent unchanged, an asset four times that ceiling comes back read for 2631
characters.
A plain 8 MiB ceiling remains, which nothing in the reference corpus approaches.

The provider accepts `image/jpeg`, `image/png`, `image/gif`, `image/webp`,
`image/tiff` and `image/bmp`, and refuses AVIF with an HTTP 400.

### Deployment dependency

`tesseract` must be on the path, with the `chi_sim` and `eng` language data
installed, or every picture is recorded as unreadable by the deterministic
reader and every one of them is sent to two models.
Decoding needs `dwebp` for webp assets;
ImageMagick is tried as a fallback and cannot be relied on for that format.

## What a slice is judged beside

The repair lane works one slice at a time,
and a slice alone is not always enough to judge itself.

Where the archive carried a passage across a section boundary,
the translation at one slice holds English no original there accounts for,
while the original next door holds Chinese with no English.
A critic shown that slice on its own has only two readings available,
invention and omission,
and both are wrong.
Acting on either damages text that is correct where it actually sits.

So the critic, the adjudication panel and the editor are each shown
the passages on either side of the slice under review,
in their original and in the translation as it stands,
fenced and labelled as context they may not raise claims about or edit.

### One section each way, and no more

The width is measured rather than chosen.
Over the reference corpus, 80 of 1260 slices carry a displacement flag,
those flags form 51 contiguous runs,
the longest run anywhere is three,
and every relocation pair is adjacent.
One section each way therefore covers every case the corpus contains,
and a wider window would cost context on every call to reach material that is not there.

A slice with no neighbour, meaning a document of one slice, is shown nothing extra
and is asked exactly what it was asked before this existed.

### Removal is allowed only against what the neighbour already carries

The window creates a second way to do harm, and the editor sheet names it.
Removing a repetition that the neighbouring translation already holds is correct.
Removing anything on the grounds that a neighbour OUGHT to hold it is not,
because the neighbour may never produce it and the document then loses the passage entirely.
Zero occurrences is a worse outcome than two.

### What this changes about caching

The window is part of the question a slice is asked,
so it is folded into the slice cache key,
with each side labelled so that a source-only window
and a translation-only window carrying the same text cannot collide.
A slice whose neighbours change is asked a new question and is recomputed;
a slice with no neighbours keys exactly as before and resumes.

## Repetition the pipeline introduced

Every per-slice instrument in this package is structurally blind to a passage said twice,
because each works inside ONE slice and the duplication is inside no single slice.
Two checks run at assembly, where the whole document is visible.
Neither spends quota:
both compare strings against the archive the artifact stores.

The archive is what makes this decidable.
Real writing repeats, in refrains, names and deliberate echoes,
so a standalone "says it twice" rule would fire on all of them.
Counting against the archive asks the only question worth asking,
whether the pipeline ADDED a repetition,
and inherits the author's own judgement about acceptable repetition for free.

### Document scale, with a content gate

`findIntroducedRepetitions` compares phrase counts across the whole document.
Any two distant sentences may share ordinary phrasing,
so a phrase must carry at least two words of five or more letters to be reported.
Without that gate the check returns mostly noise.

### Adjacent slices, with no content gate

`findAdjacentRepetitions` asks a much narrower question:
did two CONSECUTIVE slices ship the same wording,
which the archive did not repeat.

It has no content gate, and it must not have one.
The duplication this package was built to catch carries no word of five letters at all,
so the document-scale check cannot see it at any setting.
Adjacency supplies the specificity the content gate supplies at document scale.
Measured over every settled artifact carrying a delivery ledger,
it fires once in twenty-two lane readings, and that once is the known damage.

Both checks run in BOTH lanes.
Writing a slice from its source rather than editing an incumbent
does not stop a lane saying the same thing twice.

Findings carry the slice pair and the measurements and never the wording,
because a findings list travels into logs and artifacts
where corpus text does not belong.

## Design commitments

- **No single model output is a decision point.**
  Every decision is either deterministic code
  or an aggregate over independent model calls from different vendor families.
- **Issues carry verifiable evidence.**
  Spans and insertion anchors reference stable node IDs and offsets
  against a hashed base document;
  claims failing deterministic validation are discarded.
- **The source is not ground truth.**
  Suspected source transcription errors,
  interpretive ambiguity,
  and alignment failures are first-class issue states
  that can block correction and preserve safer translations.
- **Structure is detected per document, never assumed per class.**
  Footnote handling activates on detected markers
  (open convention set: `〔1〕`, `[^1]`, `[1]`);
  unrecognized conventions become findings for human confirmation,
  not silent misparses.
- **Refusals are handled reactively, never predicted.**
  Content is never pre-classified for sensitivity;
  refusals reroute across model families and feed a measured scorecard.
- **Detection and repair are graded by separate instruments.**
  `formatGradingSheet` asks only whether an accepted issue is a real defect and
  shows no correction, because seeing one makes an alleged defect look more
  real and would move that answer.
  `formatRepairSheet` asks, on its own sheet and after the first is done,
  whether the returned wording fixes it.
  Keeping them apart is what lets one round's precision be compared with
  another's rather than with a changed instrument.
  Model and corpus text reaches those sheets fenced
  (`fenceForMarkdown`), since a replacement is arbitrary text crossing into
  Markdown grammar and can otherwise invent a heading or a grade box.
  A sheet is READ before it is handed to anyone, item by item, including the
  reasoning it shows the grader.
  A sheet whose generator ran is not a sheet that asks a sensible question:
  the first introduced-defect verification sheet reached the user with all
  eight of its reviewer claims argued against the pre-edit translation rather
  than the original, one of them reporting a corrected mistranslation as
  damage, and nothing in the pipeline could have caught that because every
  stage had succeeded.
- **A grade is bound to the draw it was written on.**
  Sheets print no issue ids, deliberately, because a hash is noise a human has
  to read past, so grades are joined back to machine verdicts BY POSITION.
  Seed and corpus pin cannot carry that join alone:
  the draw is deterministic in its seed but not in its POOL, and the pool grows
  with every entry that settles, so one seed at one commit names different
  items at different times.
  Two draws can then agree on seed, pin and item count while describing
  different issues, and a positional join would mislabel every verdict without
  erroring anywhere.
  `computeDrawDigest` fingerprints the ordered item identities, both sheets and
  the manifest carry it from one computation, and `parseSampleManifest`
  recomputes it rather than trusting the stored string, since a digest never
  checked against its own contents proves only that two files share characters.
  A draw taken before the binding existed is scoreable and says so;
  a pair where only one side carries a digest is refused, because one draw
  writes both in the same instant.
- **Text entering a prompt is fenced against its own content.**
  `selectFence` chooses a delimiter strictly longer than any run inside every
  string a prompt encloses.
  A fixed delimiter would let a translation containing a setext heading
  underline close its own block and have the rest of its text read as
  instructions.
- **A new measurement records before it decides.**
  `runIntroducedDefectProbe` asks whether a repair broke something nobody
  raised, which `regressedKnownIssues` cannot see because it reads verdicts
  keyed by issues a critic already filed.
  It ships in shadow mode: the report reaches the outcome and the artifacts,
  and candidate selection does not read it.
  It was built expecting the opposite failure.
  Every region it inspects contains a defect by construction, that being why
  the region was edited, so a model asked whether anything is wrong was expected
  to find something, and gating on an over-eager probe would have discarded
  correct fixes.
  Measured on 2026-08-12 over all 857 probed regions of the settled artifacts,
  the probe was nearly silent instead: 2438 of 2571 prober verdicts found
  nothing, and the raise rate barely moved with how much text the edit removed.
  READ THAT AS HISTORY, NOT AS THE PROBE'S BEHAVIOUR.
  Those verdicts were produced under a question that made the pre-edit
  TRANSLATION the standard of accuracy, asking whether the replacement
  introduced a defect the BEFORE text did not have.
  Read back, every claim it produced argued from that text, and one reported a
  corrected mistranslation as damage, so the figure measures whether an edit
  CHANGED anything rather than whether it damaged anything.
  The question is now anchored on the ORIGINAL, and every probe figure taken
  before that change is withdrawn.
  Under the new question, on a twenty-region draw read against the Chinese, the
  probe flagged three of three damaged regions with one false positive and no
  misses, which is the first version of this instrument that discriminated at
  all.
  That reading is one agent's and one draw's, so it sizes nothing.
  Shadow mode stands until a human grades a sample: `#66`.
  Shadow mode is a recorded decision rather than an unfinished edge, with the
  rejected gating designs and the condition that reopens it in
  `doc/decision/introduced-defect-probe-gating.md`.
  Claims are screened deterministically rather than believed:
  a quote must be new in the replacement, or gone from it for dropped content,
  and `screenNonTranslationVotes` is the precedent for evidence that dismisses
  an impossible claim without having to prove a possible one.
- **Every stage that changes shipped text is audited, including the last one.**
  The naturalness lane runs after the accuracy stage and rewrites whole slices,
  so the accuracy probe's verdict describes text the lane may have replaced.
  `retainsResolvedIssues` guards only the opposite direction, that a rewrite did
  not undo a confirmed repair, and a rewrite can leave every confirmed repair
  standing while damaging the wording around them.
  An accepted refinement therefore runs the same probe against its own pair,
  the repaired text against the refined text, recorded as `refinementDefects`
  and reported apart from the accuracy figures because the two audit different
  edits against different baselines.
  Its prompt gets a second framing: telling a prober that an editor was fixing
  defects, when it was rewriting already-correct text for fluency, invites
  reading every rephrasing as a failed repair.
  `probe-sensitivity` checks that framing against injected damage, and its
  control is the case that matters, since a probe that reads rephrasing as
  damage would flag every refinement the lane ships and would look identical to
  a clean run while doing it.

## Configuration

Every knob is an environment variable,
and none of them had been written down before 2026-08-24.
Values are read once per invocation.

An EXPORTED-BUT-EMPTY variable counts as unset throughout,
which is deliberate rather than incidental:
an empty export is an ordinary shell accident,
and reading one as an instruction has cost this package a defect before.

### Credentials

-   `TRANSLATION_REPAIR_SYNTHETIC_API_KEY`.
    Bearer token for the first provider.
    A run that reaches a model call without it throws.

-   `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`.
    Bearer token for the second provider, Charm Hyper.
    OPTIONAL, and its absence is not an error:
    `createRunClient` warns and returns a client that speaks to the first provider alone,
    so a run without it still works and simply has nowhere to fail over to.
    Note the `CHARM` in the middle;
    a name missing it is read by nothing and reported by nothing.

#### Running out of budget is normal, and neither provider is restorable on demand

Charm Hyper capacity cannot be reset on request at all;
it returns on its own schedule.
Synthetic capacity can be restored only sometimes.
Plan a pass around that rather than around a clean window,
because a clean window cannot be arranged.

A provider that is out of budget does not fail a run.
The budget layer raises `NoProviderForModelError` for each model
no reachable provider can take, the stage records a lost voice,
and the run continues on whoever answered.
On 2026-08-24 a pass ran with Charm Hyper dry from its first second:
the five Hyper-only models were refused,
the five Synthetic-served models kept streaming,
and both meter endpoints kept reading.

TWO CONSEQUENCES FOR READING A RUN.
A per-entry cost measured while a provider is dry
is not the cost a two-provider run pays, and should be labelled with the outage.
Any quality figure measured then rests on whoever was awake,
so five of ten models contributed nothing to it.

#### Measuring how much of the time each provider was there

Three writer seats sit on models only Charm Hyper serves,
and until 2026-08-24 the argument for them rested on a quality pass
plus an availability adjustment that was reasoned about rather than measured.

The budget layer already read both meters every sixty seconds
and already knew dry from wet,
but said so at `debug` level, which a run does not record.
It now says so at `info`, as one line per reading:

```text
[info] [2026-08-24T19:22:07.104Z] [translation-repair] [takeReading] METERS synthetic=wet hyper=dry syntheticWeekly=97% syntheticFiveHour=48/50 syntheticThrottled=no hyperBalance=0
```

Three states, not two.
A meter that could not be reached at all reads as `unreadable`,
which still routes as spendable, because a monitoring failure must not become an outage.
It is kept distinct in the record because a duty cycle
that counted an unreachable endpoint as a working provider
would report an outage as uptime.

The numbers after the states are what those states were decided from,
and they are there because the verdict alone could not be checked.
`hyper=dry` is equally what an empty balance
and a wrong threshold in `budget-routing.ts` look like,
and separating them once took a live call to the provider,
which no longer exists for a moment already past.
Each provider's numbers and its verdict come off one read,
so they can never describe different instants.

They also separate causes that route identically.
Synthetic goes dry when its weekly budget empties,
when its rolling window empties,
or when the account is actively throttled;
those are one bit at the router and three different problems to a reader.

A field the reader has never been taught the name of is carried through,
because a level is defined as any field whose value is not a meter state.
Records written before the numbers existed carry states alone,
and the report names that rather than printing nothing.

Read a collection of those lines back with `meter-report`,
passing one or more log paths after `--`.
It spends no quota:

```sh
mise run //package/module/translation-repair:meter-report -- run3.log run4.log
```

It reports, per provider,
how many readings fell in each state,
the fraction of answering readings that found budget,
and the longest outage as a range.
The range matters.
A reading happens when a run asks to spend,
so two readings can be a minute apart or a day apart,
and an outage seen at one and gone by the next
began and ended somewhere in between.
An outage with no wet reading before it, or none after it,
is reported open rather than as a number,
since it may have started before the record or may still be running.

Every figure is availability WHEN WE WERE ASKING, not availability.
That is the quantity that prices a seat,
and it is not the same thing.

#### Sampling between runs, so a recovery gets observed

An outage that stops a pass also stops the readings,
so nothing observes when the provider came back,
and every outage that ended a run reads as open-ended forever.

```sh
mise run //package/module/translation-repair:budget-sample > sample.log 2>&1
```

One reading of both meter endpoints.
No model is called and no token is produced;
a live run took 2.4 seconds.
Capture both streams: the reading is at `info` and an unreadable meter warns at `warn`.

Repeat it on a timer to fill the quiet stretches,
for example `watch --interval 300`,
and point `meter-report` at the collected logs.

### Where a run writes

-   `TRANSLATION_REPAIR_RUNS_DIR`.
    Root for artifacts, the published tree, slice caches, and the attempt map.
    Defaults to `node_modules/.monochromatic/translation-repair-runs` under the worktree root.
    Point it at a throwaway directory for any run whose output should not join a pool later.

### Bounding one run

-   `TRANSLATION_REPAIR_HARD_CAP_MINUTES`.
    Overrides the per-entry ceiling, a positive number of minutes.
    A value that is not one is REFUSED rather than replaced by the default,
    including `30m`, which `parseFloat` would have read as 30:
    a ceiling is what stops a runaway entry,
    so an operator who set it must not be left believing a run is bounded some way it is not.
    A run that overrides logs `CAP OVERRIDDEN` above its work.

    THERE IS A FLOOR, and it is one model exchange.
    A ceiling at or below `RUN_PER_CALL_TIMEOUT_MS`, currently 360_000,
    cuts every attempt before any exchange can return,
    so nothing caches, every attempt reports no progress,
    and the queue drops the entry as stalled after its second try.
    A run in that state logs `CAP TOO TIGHT` naming both numbers.
    It is warned rather than refused,
    because cutting mid-exchange is exactly what a test of the stall path wants.

The cap ends an ATTEMPT rather than an entry.
An entry the cap cut goes to the back of the queue
and is attempted again inside the same invocation,
against the same frozen pipeline digest,
so an entry too large for one attempt no longer needs a relaunch per attempt.

A re-attempt is EARNED rather than automatic.
The pass counts the entry's cache records before and after each attempt,
and re-queues only when that count grew.
An attempt that bought nothing logs `STALLED` and the entry is dropped for this invocation,
because no progress guarantee holds:
an abort can land before the first persistence,
and the slices a lane deliberately leaves uncached produce no record however long they took.
Without the earned rule a stuck entry would spend the whole soft budget.

A re-attempt logs `REATTEMPT <id> queued`, naming what the attempt bought.

### Choosing what a run attempts

These two are command-line flags rather than variables,
passed after `--`:

-   `--only Id1,Id2`.
    Restricts the invocation to the named entries and bypasses the ordering.
    Run it into a throwaway `TRANSLATION_REPAIR_RUNS_DIR`,
    so a hand-picked entry never joins a pool that later draws treat as natural accumulation.
    A flag with no value, or one whose value parses to no id at all, is REFUSED:
    a flag that parsed to nothing would run the WHOLE corpus,
    which is the opposite of what was asked and expensive to discover afterwards.
    A restricted run logs `ONLY` and the ids it took.

-   `--plan`.
    Reads the corpus, builds the pending list, constructs the client,
    prints `PLAN ok` with the tip, the pipeline digest and the first few pending ids,
    and returns without calling a model.
    Use it to check a run's setup, selection and credentials for no quota.
    Measured at 1.88 seconds with no stream opened.

### Do not run another task while a pass is in flight

Every pass and probe task declares `depends = ["build"]`,
so invoking one rewrites `dist/final/node` underneath any pass already running.
A pass computes its pipeline digest ONCE at startup
and stamps it into every artifact it writes,
so a rebuild that changes any output file leaves a running pass
recording a digest that no longer describes what is on disk,
and leaves its process holding a mix of old modules and new files.

A rebuild with no source change is byte-identical and harmless,
which is exactly why this is easy to get away with and worth stating anyway:
the digest is the only thing that reveals it,
and it reveals it after the fact.
Wait for the pass, or run the built entry point directly with `node`.

### Deciding who fills a seat

Two runners rank models on the job the seat actually does.
Both spend quota, both write nothing to a corpus,
and both take a slice count after `--`.

```sh
mise run //package/module/translation-repair:producer-calibrate -- 10
mise run //package/module/translation-repair:editor-calibrate -- 14
```

`producer-calibrate` ranks WRITERS.
It drives the translate stage:
a model writing English from Chinese
with nothing in front of it but the source.

`editor-calibrate` ranks EDITORS, and reports the refiner standing off the same spend.
It drives the whole repair lane,
so the claims an editor works from
are claims models really raised about that passage rather than fixtures.
That costs more per slice than the writer calibration,
because a slice buys critics, a panel, editors, judges and checkers
instead of one stage.

Every model writes on every slice in both.
A narrow slate would compare only the models that happened to be seated,
so a standing would mean something different for each of them.
Every model also judges, matching production,
and each model's ballots on its own work are then discounted,
because counting self-votes ranks the most self-confident model first
rather than the best-written one.

#### The standing that costs nothing

Every settled artifact's repair chunks already record
the slate judges were shown, each candidate's producer, and every ballot.
That is what a standing counts,
so one can be read off work already paid for:

```sh
mise run //package/module/translation-repair:editor-standing-read -- <run dir> [<run dir> ...]
```

It spends nothing and touches no model.
Four things bound what it can say.

It is OBSERVATIONAL.
Only models that held a seat ever wrote a candidate,
so it ranks whoever was seated and is silent about everyone else.
An absent model is unmeasured, not last.
That is the survivorship the controlled calibrations exist to defeat,
which is why this corroborates them and never replaces them.

It NEVER POOLS ACROSS PIPELINE DIGESTS,
because two builds are two configurations
and a figure summed over both describes neither.
Each digest is reported alone with its entry count,
which is the denominator that governs:
rounds inside one entry are correlated.

It REFUSES AN ARTIFACT FROM AN EARLIER ROSTER, by name.
Model ids are a closed set,
and reading an id the roster no longer seats as though it were current
would let a standing mix two rosters silently.
Those artifacts are counted apart from malformed ones
and named with the exact path that held the departed id.

It SEPARATES AN EARLIER SCHEMA FROM A DEFECT.
A repair result whose `chunks` field is absent entirely
was settled before the lane recorded rounds at all.
That record is complete and correct for the build that wrote it;
it simply cannot answer this question.
It is counted as `earlierSchema`, not as a parse failure,
because calling it broken would report a healthy archive as a damaged one.
Chunks present and not an array stays a parse failure.

The report accounts for every artifact it opened,
across `read`, `earlierRoster`, `earlierSchema` and refusals,
so a reader can see what fraction of an archive the standing actually rests on.
On the archives as of 2026-08-24 that is
41 artifacts: 2 read, 17 from an earlier roster, 22 from an earlier schema, none malformed.

#### Reading a standing honestly

Three things on the report decide whether a standing means anything.

The COUNTS beside each share.
A share with no denominator cannot be told from a share one ballot wide,
and a lead smaller than its denominator supports is not a lead.

The SLICES that paid in, printed as `from N of M slices`.
Adjudicated is not accepted:
a slice can buy ten critics and a ten-model panel,
have its issues rejected at the accept gate,
and contribute nothing to an editor standing.
A standing drawn entirely from one slice
reads identically to one drawn evenly from six without this line.

The models the table DOES NOT DESCRIBE, named at the end.
A standing carries a row only for a model somebody voted on,
so every other seated model vanishes,
and its absence would otherwise read exactly like a model that wrote and lost.
During a provider outage that is half the roster.

Two different things put a seated model outside the table,
and both calibrations now name them apart
rather than reporting one absence:

-   WROTE AND WAS NEVER VOTED ON.
    Its text reached a slate and no disinterested ballot was cast over it,
    which is what a slice where every producer proposed the same wording does:
    it ships unjudged.
    That evidence is already paid for, and more slices are what would separate it.

-   WROTE NOTHING AT ALL.
    No candidate of its reached any slate.
    A provider out of budget, a refused sheet and a call that timed out
    all look identical from the report, and the run log names which.
    That evidence has not been bought yet, and re-running those seats buys it.

The silent line carries both denominators,
as `covers N of M seats`,
so a table narrowed by an outage cannot read as a full roster comparison.

A standing or a slate naming a model the run never seated is REFUSED,
because coverage of one roster cannot be read off another.

#### Editor credit and refiner credit are separate columns

The lane unions them, so the split takes work.
`collectRefinedAuthors` merges the editors
with any refiner whose rewrite won,
so the refined outcome's authorship names both seats in one list
that cannot be split back apart.

The editor column is therefore read off the accuracy lane's own outcome,
before refinement,
and the refiner column off `settleRefinedSlice`'s `refinedBy`,
which names the models whose rewrite is actually in the text that shipped.
`refinedBy` is empty on every path where no rewrite ships,
including one the recheck rolled back,
and it is deliberately kept off the cached settlement
for the reason `asked` is:
a slice resumed from disk bought no rewrite.

#### The editor calibration diverges from production in one place

Checkers self-certify there, and only there.
Production forbids a checker from proving its own repair,
and seating all ten as editors leaves nobody independent to check.
Rotating editors out instead would reintroduce
the survivorship the shape exists to avoid.

It is safe for that measurement because checking runs after selection:
the ballots a standing reads are cast before any checker is asked,
so self-certification can move how many rounds happen,
not who won the ones that did.

### Pooling artifacts across builds

Each settled artifact records the digest of the pipeline that produced it,
and readers refuse to mix generations unless told to.

-   `TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT`.
    Set to `yes` to resume an accumulation under a build different from the one that filled it.
    The value is spelled out so a stray `0` cannot silently disable the guard.

-   `TRANSLATION_REPAIR_REQUIRED_COMMIT`.
    Restricts a pool to entries whose recorded pipeline contains that commit.

-   `TRANSLATION_REPAIR_POOL_ALL`.
    Set to `yes` to take every generation and say so above the resulting number.
    Setting this together with `TRANSLATION_REPAIR_REQUIRED_COMMIT` throws:
    that asks for a filtered pool and an unfiltered one at once,
    and preferring either would record a policy nobody chose.

## Status

Milestone one (detection) is complete:
the seven-critic ensemble reached 0.981 recall on seeded errors
over the reference corpus,
gated by the seeded-error benchmark harness.
Read that figure with its date attached.
It was measured on 2026-07-17 over 54 seeds against a roster of seven models,
and that roster no longer exists:
the provider has since withdrawn two of them and offered one replacement,
so six critics run today.

A re-measure on 2026-08-10 detected 24 of 27 planted omissions, a rate of 0.889,
over nine entries balanced across the three size bands,
with zero policy declines,
so all three misses are critics failing to see a seeded omission
rather than the panel correctly ruling one a source defect.

That figure is NOT the configured roster's recall, and the run says so itself.
One model returned schema-invalid output 312 times across five roles during it,
and the critic stage never once reached its full roster:
72 chunks ran at five voices of six, eight at three, and one at none at all.
So 0.889 describes what the pipeline delivered while one of six critics was
effectively absent.
Read it as a measurement of a degraded ensemble,
which is a real and current operating condition rather than a spoiled run,
and not as evidence about the roster as configured.

Do not read it against the milestone-one figure as a regression either.
The two runs differ in roster, entry set, seed count, and several stages,
so no delta is attributable to any one of them,
and 24 of 27 against 53 of 54 is not a statistically established difference
(two-proportion z of about 1.8).
All three misses also fall in a single entry, which went 0 for 3 while the other
eight went 24 for 24,
so the sample is one entry failing rather than a uniform detection rate.

Milestone two (repair) is complete:
the full loop
(critics, claim aggregation, adjudication panel, editable envelopes,
editor through a deterministic apply gate, resolution checkers,
lexicographic candidate selection)
reached a probe-adjusted effective restoration rate of 0.98
over 100 seeded omissions across 21 budgeted live runs,
graded by a source-anchored bilingual restoration judge
(three judge models, conservative lower-median verdict).
Misses are attributed, never averaged away:
a derivability probe rules whether each missed seed's information
was fully derivable from the source at all,
so embellishment-capped partials and correct refusals of
underivable content are excused,
and only genuine editor shortfalls count against the editor.
The one reproducible shortfall class
(long omissions restored compressed)
drove a rule now promoted into the baseline editor prompt:
enumerate the omitted source sentences clause by clause.

Milestone three (detection precision) is NOT met.
Its gate is human-graded precision of at least 0.9 over a stratified sample
of accepted issues.
Round three was graded on 2026-08-12 and returned
0.791 strict, 0.810 excluded, and 0.814 lenient
over 43 gradeable items drawn from a pool of 740 across 18 settled entries.
All three readings improved on round two's 0.740, 0.787 and 0.800,
and none reaches the bar.

Round three also found a defect in the sampling instrument itself.
Seven of the 50 drawn items repeat a defect already drawn at an earlier
position, which the grader marked `Duplicate` and the blind pre-grades had
independently annotated the same way.
A duplicate is now its own verdict, excluded from every denominator,
because the pipeline reporting one defect several times is a different failure
from reporting a defect that is not there,
and only the second is what precision measures.
Counting them as false positives had dragged strict to 0.680 while every other
reading rose, which described the instrument rather than the detector.
Read the milestone-two figures above as recall claims only:
they say the ensemble finds seeded defects,
not that what it reports is right.
Nothing here should be taken as evidence that an accepted issue is a real one
until this gate is measured and passes.

The REPAIR half is not fit to be measured yet, and that is a finding rather
than a gap in the schedule.
Round three's repair sheet was deliberately left ungraded:
reading it showed repairs that fix their claim while deleting nearby
source-supported content, including a contributor credit removed by an edit
asked only to change a colon,
and 21 of 50 edits replacing a span more than 1.35 times the quoted defect.
The introduced-defect probe, which exists to catch exactly that, reported no
finding from any prober on every one of those repairs.
So a shadow-mode probe reading clean is currently false assurance, not
evidence, and repair quality claims should be read as unestablished until
that instrument is fixed.

Every number above comes from a graded measurement rather than a self-report.
Where a stage grades itself the figure is named as telemetry and excluded:
`runIntroducedDefectProbe` ships in shadow mode for exactly that reason,
and the checker stage's resolution rate is a stage self-report,
which is why repair quality is graded on its own human sheet instead.
