# @monochromatic-dev/module-translation-repair

Multi-model translation critique and conservative repair.

Takes an original text plus its translation,
returns a structured issue list anchored to an immutable document model,
and a repaired candidate translation.

## Operating a corpus pass

This file describes the design.
To RUN the pipeline over the corpus, follow
[the corpus pass runbook](../../../doc/runbook/translation-repair-corpus-pass.md),
which carries the environment, the launch, what to watch while it runs,
and how to read the output back once it has exited.

Read-back tools, none of which spends quota or calls a model:

-   `verify-published` reads the published tree back against the artifacts that produced it,
    and refuses a run whose pages disagree with what its artifacts promised.
-   `meter-report` says what each provider was doing while the run was asking,
    which is availability WHEN WE WERE ASKING rather than availability.
-   `run-timing-report` says where the wall clock went,
    splitting each round into work and straggler waiting,
    and reports achieved rather than configured concurrency.
-   `spend-report` prices the metered seats against a DATED rate table,
    and counts subscription seats without pricing them.
-   `ledger-report` says who produced each candidate and how often judges chose it.
    Its `--model` view prints corpus wording, so it must not be pasted anywhere.

The runbook carries the exact invocation and the expected output for each,
including what each one prints when the run recorded nothing for it,
which is never the same as the run having done nothing.

The pass also prints, beside each settled entry's `TALLY` line,
`DESTINATIONS <id> source=N page=M dropped=K`:
how many distinct web addresses the source page links to, how many the published page carries,
and how many of the source's the page lacks (`#265`).
The addresses themselves go to the run log at info, never to stdout.
A dropped destination from a wording both deciders approved is a finding, not a late publish rewrite.
A different rule protects a source-only passage:
whole-document coverage must call it absent,
then page shortfall or a destination missing from target admits translation.
Any source passage still unfilled fails entry before contest, artifact and publication;
a known gap never becomes settled page.
This includes a passage admitted for translation when provider outage leaves every translator unheard:
entry reports error and keeps slice cache for retry.

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

### Four readers, and a reader asked again

A reading may be used only when a second model, shown the same picture and not
the first model's answer, agrees with the first at the corroboration threshold.
A single reading is refused rather than passed along with a caveat.

The cross-provider vision sub-roster remains four after Synthetic GLM-5.3-Flash
replaced GLM-5.2.
The replacement reads images on Synthetic but has no inherited Charm Hyper route.
Corroboration still requires independent agreement,
and a declined reading is still asked again up to four times.
The retry measurement that follows predates the third reader and must not be
read as its measured refusal rate.

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

## What is folded out of candidate and archive text at intake

Characters a reader cannot tell from their plain counterpart are folded
where each lane turns an answer into a candidate (`#264`).
Corpus pass applies same fold to archive before preparation,
so incumbent, candidates, spans, artifact and page share visible bytes:
U+2011 to the hyphen, U+00A0 and U+202F to the space,
and U+00AD, U+200B, U+2060 and U+FEFF dropped.
The fold runs before any decider judges,
so the bytes judged are the bytes that ship,
and each fold is a finding, `invisible-variant-folded (U+2011 x1)`, in the stage's findings.
Typographic quotes, dashes and the ellipsis pass through:
measured over every archive page at the pin, 85 of 92 carry typographic quotes
and the corpus holds 1173 U+2019, so those are the archive's own convention.
The 2026-08-26 output reading found the case that motivated this,
a hyphenated word published with a non-breaking hyphen the archive never had.

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

Two instruments are the exception, by design, and their standard output is an artifact rather than a summary:
`coverage-probe` prints its rows as JSON, whose `evidence` is the document's own matched text,
and `judge-fidelity-probe` prints per-trial judge `reasons`, which are model prose quoting candidates.
Redirect both to a file under the runs directory and never paste either into a log, a commit, or a chat;
both also persist their rows through the probe store, so the redirect is a convenience rather than the record.

## The site's grammar is not this one

The corpus repository builds each `page.md` itself:
its `scripts/build.ts` rewrites `<!--` and `-->` into JSX comment delimiters
and `scripts/mdx.ts` compiles with `@mdx-js/mdx` under `remark-math` and `rehype-katex`, with no GFM.
This package parses with `remark-mdx` plus `remark-gfm` after masking HTML comments to whitespace.
Verified with the site's own renderer on 2026-08-26:
a footnote reference compiles to literal text there and to structure here,
a `$...$` pair compiles to math there and to prose here.
Six source pages at the pin carry a math pair.
`#267` holds the reconciliation question;
nothing published changes either way, since the text is preserved as written,
but a formula is unprotected structure until the strict grammar knows it.

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
    REQUIRED, exactly like the first:
    `createRunClient` refuses to build a client without it,
    as a stated refusal that names the variable and exits 6.
    It used to warn and return a client that spoke to the first provider alone;
    that client offered Charm-Hyper-only seats to a provider that cannot serve them,
    and a calibration settled clean with half its roster dark (`#235`).
    Current eight-model roster has four Hyper-only seats and can settle at quorum on four Synthetic voices,
    so early refusal prevents degraded run from looking complete.
    There is no one-provider run to fall back to.
    Note the `CHARM` in the middle;
    a name missing it is read by nothing and reported by nothing.

Both keys live in the sops-encrypted, gitignored `.env.local.json` at the repository root,
which `mise run` decrypts into the task's environment.
A worktree created with `git worktree add` starts without that file;
copy the encrypted file into the worktree root (it stays encrypted at rest) or launch from the main worktree.
Either way, launch under `mise run`:
a bare `node dist/...` launch has neither key,
and since `#235` it fails at once with the refusal instead of running half-dark.

Every command ends by printing one `SEAT <model> asked=N usable=N unusable=N threw=N` line per seat to stderr,
and a `SEATS DARK:` line naming every seat that was asked and never once produced a usable answer.
A dark seat is a provider that cannot serve it,
a key that was never injected,
or a model that answers nothing readable;
the run log names which.
Do not read a run with a dark seat as a comparison of the roster.

#### Current roster changes

`qwen3.8-max` was removed from roster and Charm Hyper allowlist on 2026-08-28 at owner's instruction.
Its metered cost was disproportionate and exceptionally expensive.
No replacement was selected, so that cull left nine models.
Dated pricing remains only so historical run artifacts can still be accounted.

Synthetic `hf:zai-org/GLM-5.2` was replaced by
`hf:zai-org/GLM-5.3-Flash` on 2026-08-29.
The live endpoint confirmed the successor;
the operational request reported Synthetic's plan to retire the older model.
Synthetic's live model endpoint reported the replacement as always-on beta,
with text and image input,
a 524288-token context,
a 65536-token output ceiling,
and the structured-output features this pipeline requires.
The old `glm-5.2` Charm Hyper route left the active allowlist because it is the superseded roster identity,
not a fallback for GLM-5.3-Flash.
Hyper's live catalog still listed `glm-5.2` but no GLM-5.3-Flash spelling on 2026-08-29.
That replacement left the roster at nine models.

Nemotron-3-Super left every active stage and the callable Synthetic catalog on 2026-08-29 at owner's instruction.
In adjacent required-correction reviews it first proposed concrete wording and then was sole reviewer rejecting that wording.
The roster now has eight models.
Broad-stage quorum consequently moves from five to four,
which equals entire Synthetic side;
a run with all four Hyper seats dark can reach exact-half quorum on four Synthetic seats.
Both-key startup refusal prevents missing credentials but not provider becoming unavailable later,
so any such run remains degraded evidence rather than readiness proof.
Kimi-K3 takes departed checker seat rather than shrinking below hard floor of three;
it participated in 231-round wide checker arm where added voices changed zero verdicts,
but fresh checker-seat calibration remains required before treating new narrow roster as independently optimal.
GPT-OSS takes departed default restoration-benchmark judge seat because it already checks and judges in production;
benchmark-specific calibration remains open.
Historical artifacts and measured narratives retain departed identity.

GLM-4.7-Flash remains blocked from every active stage,
roster type,
and callable catalog as it has been since 2026-08-24.
Interrupted schema-9 run started before Nemotron removal logged no GLM-4.7-Flash model label,
and no translation-repair process remained alive after run was stopped.
This establishes interrupted pass did not issue GLM-4.7-Flash calls;
it does not identify source or time window of calls visible outside package log.
A widened scan over same-day validation,
review,
replay,
and probe logs found zero GLM-4.7 call labels;
remaining mentions were provider catalog listings or historical stream-parser test names.

Same live catalog read showed `syn:large:text` now points to GLM-5.3-Flash,
while current Synthetic rate-limit documentation names Kimi-K3 as one-request baseline.
Planning denominator now follows Kimi-K3 input price and has GFP coverage;
live `/quotas` remains authoritative.
See `doc/troubleshooting/synthetic-rate-limit-default-drift.md`.

#### Eight-seat schema-9 latency diagnosis

Fresh eight-seat `Weideriche_` validation from `88049530a` failed closed after first entry spent
6,433,300 milliseconds.
It wrote no page or artifact;
operator stopped second entry after first terminal refusal.
Matched prior first entries took 3,014,684 and 3,774,160 milliseconds.
This was active work rather than deadlock:
round logs assign 4,797,358 milliseconds,
79.96 minutes,
to post-quorum grace.
GLM-5.3-Flash reached 180,000-millisecond grace cap eleven times,
compared with two and four in matched runs.
Current pass also bought more quality work,
including twenty-seven consolidation rounds compared with ten and fourteen.

Exact final-candidate replay heard all eight seats.
Seven accepted;
GPT-OSS returned one idiomatic-naturalness finding in paragraph three.
Affected phrase preceded second correction and survived all three second-correction proposals.
Previous-candidate replay was also unacceptable,
with GPT-OSS and DeepSeek Flash each returning one different finding;
adjacent GPT findings did not match.
Evidence supports iterative defect discovery,
not claim latest required finding was ignored.
Final floor correctly refused publication after correction cap.
No reviewer wording or corpus wording is retained in readiness record.

Existing round logs proved aggregate cause,
but lacked active consolidation slice,
terminal consolidation exit,
and per-seat absolute-review status.
Pipeline now logs `SLICE-START` plus `SLICE-COST` for consolidation,
distinguishes cache reuse,
unsettled,
failure,
and abort exits,
and reports only absolute-review seat ids,
statuses,
finding counts,
paragraph numbers,
and wording digests.
See `doc/troubleshooting/translation-repair-schema9-latency.md`.

No GLM-5.2 quality result or role calibration transfers to GLM-5.3-Flash.
It enters only catalog-derived broad-roster and image-reading paths;
it does not inherit an editor,
refiner,
checker,
or default benchmark-judge seat.
Admission evidence is replacement-specific:
the live endpoint facts were read on 2026-08-29,
the package client completed 20 of 20 schema-constrained calls,
the full roster health probe heard all nine seats,
and the image-reading boundary returned a usable transcription without exposing its text.
The image-boundary call completed in 78.4 seconds,
inside the production 360-second per-call deadline.
One call does not characterize its latency tail and does not justify a timeout change.
These checks establish wire and modality compatibility,
not actual-output quality.
Fresh schema-9 passage validation remains mandatory before this replacement contributes readiness evidence.

#### Running out of budget is normal, and the two providers run out differently

THEY ARE NOT THE SAME KIND OF LIMIT, and an earlier version of this section had
Charm Hyper backwards.

Charm Hyper is a PREPAID BALANCE, priced per token and per model.
`GET /v1/credits` returns `balance`, which `parseHyperCredits` reads and the
`METERS` line prints as `hyperBalance`.
Spending draws it down and it does not refill on a schedule:
it read `0` continuously across the whole of 2026-08-24,
before, during and after a pass,
and reached `10000` on 2026-08-25 only because credits were bought.
A reader who hits `hyperBalance=0` and waits is waiting for something that has
not been observed to happen.

Synthetic is a SUBSCRIPTION ALLOWANCE, weekly and five-hourly,
which the `METERS` line prints as `syntheticWeekly` and `syntheticFiveHour`.
That one does refill on its own schedule,
and the account owner can sometimes reset it, but not reliably and not on demand.

Plan a pass around both facts rather than around a clean window,
because a clean window still cannot be arranged.

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

### Do not rebuild a worktree while its pass is in flight

Every pass and probe task declares `depends = ["build"]`,
so invoking one rewrites `dist/final/node` underneath any pass already running from the same worktree.
A pass computes its pipeline digest once at startup
and stamps it into every artifact it writes,
so a rebuild that changes output leaves the running pass recording a digest that no longer describes files on disk,
and leaves its process holding a mixture of old modules and new files.

A rebuild with no source change is byte-identical and harmless,
which is exactly why this is easy to get away with and worth stating anyway:
the digest is the only thing that reveals it,
and it reveals it after the fact.
Wait for the pass or run the already-built entry point directly.
Same immutable build may back concurrent passes when no rebuild follows.
Source-distinct pass requires separate throwaway worktree built before that process launches.
Never rebuild worktree backing active process.

Concurrent passes require separate run roots,
logs,
and publication roots.
They still share provider capacity,
so elapsed times are operational results rather than matched performance comparison.
Record each pipeline digest and corpus commit separately.

Production `corpus-pass` currently has no pull-request input flag.
Pull-request 386 run uses uncommitted throwaway fork that changes only corpus commit
and exposes corpus clone path through `TRANSLATION_REPAIR_CORPUS_DIR`.
For another pull request,
prepare equivalent source-distinct worktree,
use exact commit in isolated corpus clone or minimal Git fixture,
run `--plan --only <entry>` first,
and retain provenance mapping fixture bytes to pull-request head.
Supply credentials through trusted worktree environment;
copying secret values into command,
log,
or provenance file is forbidden.

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
It keeps four slices in flight and waits 300000 ms on stragglers after quorum,
both the owner's decisions of 2026-08-26 on the five calibration arms
(`doc/decision/translation-repair-calibration-overlap.md`);
`TRANSLATION_REPAIR_SLICE_OVERLAP` and `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` override either for one launch,
and `1` and `180000` reproduce the pass's own settings, which stay where they were until `#261`.
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

Three different things put a seated model outside the table,
and the calibrations name them apart
rather than reporting one absence (`#263`):

-   WROTE AND WAS NEVER VOTED ON.
    Its text reached a slate and no disinterested ballot was cast over it,
    which is what a slice where every producer proposed the same wording does:
    it ships unjudged.
    That evidence is already paid for, and more slices are what would separate it.

-   ANSWERED AND WAS NEVER SLATED.
    At least one usable answer of its was heard and none became a candidate a judge saw:
    a rewriter that leaves a paragraph as it stands, or whose rewrite is dropped before judging.
    Re-running it buys the same again; slices with something to rewrite are what would seat it.
    Arm A of 2026-08-26 reported such a seat as silent beside a `SEAT` line saying it had answered 31 of 31,
    which is the misreport this state exists to end.

-   ANSWERED NOTHING USABLE.
    No usable answer of its was heard at the seat.
    A provider out of budget, a refused sheet and a call that timed out
    all look identical from the report, and the `SEAT` lines and the run log name which.
    That evidence has not been bought yet, and re-running those seats buys it.

Only a seat that records who answered can tell the last two apart.
The refiner seat does (`settleRefinedSlice` returns `refinersHeard`);
the editor and translate seats carry only a heard count out of their stages (`#266`),
so their silent line reads `NO CANDIDATE OF THEIRS REACHED ANY SLATE` and says the seat does not record who answered,
instead of calling the unknown silent.

The silent line carries both denominators,
as `covers N of M seats`,
so a table narrowed by an outage cannot read as a full roster comparison.

A standing, a slate or an answer list naming a model the run never seated is REFUSED,
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
`refinersHeard` rides beside it, also uncached:
the refiners heard with a usable answer, proposal or not,
which is what separates a seat that answered from one that never did.

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

### Schema generations, which the drift opt-in does not cover

The pass writes SCHEMA GENERATION 4, and refuses to resume into a directory holding another one.
That refusal is separate from the build guard above and is not waved past by
`TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT`:
drift is an opinion about which BUILD filled a pool,
and its remedy works because every file still answers the same questions.
A file of another schema generation cannot answer them at all.

Three generations record the same two-lane shape and differ only in how four keys are spelled.
Generation 4 spells all four the current way:

-   `changedSliceIndices`, which generation 2 spelled `shippedChunkIndices`.
-   `withdrawnSliceIndices`, which generation 2 spelled `withdrawnChunkIndices`.
-   `sliceCritics`, which generation 2 spelled `chunkCritics`.
-   `sliceIndex`, which generations 2 AND 3 spelled `chunkIndex`.

Generation 3 is therefore a MIXTURE:
the change-set arrays already carry their current names there, and the index does not.
That is why the reader holds a table rather than a flag.
A reader holding a flag reads every generation 3 artifact's index as ABSENT.

All three generations are READ. The reader takes the spelling from the version the file records,
so nothing is ever tried under two spellings,
and a stamp over another generation's keys is refused rather than read as a file
missing the keys it names.

Meeting the refusal on a resume, the ways forward are the ones the message lists:
start a fresh directory with `TRANSLATION_REPAIR_RUNS_DIR`,
restore the code those entries were settled under and resume there,
or move the older artifacts to an archive directory and pay for their re-run.
Deleting them is the one thing to avoid:
it costs the same re-run and destroys a sound result of the generation that wrote it.

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

Status on 2026-08-26.
The whole-package audit closed on a measured tally and every MAJOR and MINOR it filed landed with a guard shown
to fail when its fix is removed.
The production readiness signal was then put to the owner and REJECTED,
because the published pages had not been read by anyone:
"Not yet. You didn't even look at its actual output."
The pipeline is not production-ready.
Reading is now gate,
and one page passing that gate validates only artifact from that run,
not package or pipeline.

Fixed-build `Toka_ls` under overlap 4 and 300-second grace produced page with no blocker or major,
but same run still exposed systemic unresolved path:
contest can decline archive and settle on neither lane,
consolidation then records `no-standing-text` and buys no third rendering,
while final assembly revives archive.
One slice reached that path after 9 of 10 contest voices called archive flawed.
A favourable page does not close mechanism that can recur on next entry.

Fixed-build overlap-4 `Zha_Ke` exposed separate readiness blocker, `#272`.
Source Markdown carries central letter only as image asset,
while archive carries English transcription inside unmatched block.
Artifact and image share pinned corpus commit `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
Preparation paired four source Markdown blocks,
one being image placeholder,
and explicitly reported two target blocks, 3,672 characters, as unclaimed.
No quality lane processed those blocks as source-aligned content.
Final page's 3,673-character details block is byte-identical to archive.
Direct image comparison found source will has seven numbered provisions
while published transcription has six;
one provision is absent and two others materially change source meaning.
Those differences concern wishes and responsibility,
not protected suicide method or drug detail.
Published central letter also retains repeated grammatical defects.
Mechanical page verification still passed all four promised wordings and destination,
so current completeness gate is blind to visual-source content and unmatched archive text
even when alignment names unclaimed target blocks.
Page is not publishable and pipeline cannot be production-ready until that path is handled.
Static pinned-corpus inventory found 50 source entries with visual references.
Three have English-only details blocks absent from source Markdown:
`Chinatsu_Suzuki`, `Zha_Ke` and `shihai4h`.
This proves bypass pattern is not entry-unique;
it does not establish which remaining visual assets contain source text.

Same-digest `Zha_Ke` overlap pair at built-in grace confirms performance mechanism,
not readiness.
Both providers were wet throughout both arms.
Overlap `1` took 129.95 minutes over 4.862 call-hours,
normalized `0.445`, with 68 voices unheard and 25.27 metered credits.
Overlap `4` took 36.49 minutes over 2.947 call-hours,
normalized `0.206`, with 6 voices unheard and 44.55 metered credits.
Overlap `4` reduced wall time 71.9 percent and normalized wall 53.7 percent;
metered spend rose 76.3 percent.
Both pages retained byte-identical blocked details transcript,
while surrounding wording differed stochastically.
Both are mechanically complete and neither is acceptable production output.

Fixed-build matched `Weideriche_` pair exposed liveness blocker `#273`.
In both fresh roots pairing roster heard all 10 voices,
contested same source block,
and committed same pairing without it.
Preparation therefore made source-only insertion,
although archive carries passage in neighbouring target slice.
Coverage refused duplicate insertion,
translation left slice unfilled,
and publication guard correctly wrote no artifact or page.

Overlap `1` first attempt took 54.04 minutes over 2.293 call-hours,
normalized `0.393`, with 15 voices unheard and 13.02 metered credits.
Overlap `4` first attempt took 31.51 minutes over 2.502 call-hours,
normalized `0.210`, with 10 voices unheard and 30.92 metered credits.
Both providers were wet throughout.
Overlap `4` reduced wall time 41.7 percent and normalized wall 46.6 percent;
call sum rose 9.1 percent and metered spend rose 137.5 percent.
Automatic retries reused cached pairing and reached same refusal.
Safe refusal is correct;
persisting contested alignment with no path to re-pair means entry cannot settle under this generation.
This is settlement-progress failure,
not process nontermination.
Repair must preserve contested source block and candidate targets as unresolved relation,
then run bounded targeted re-pairing while retaining attempt evidence.
It must not relax coverage or publication guard;
adjacency alone does not prove two target blocks may be merged.

Current nine-model validation on 2026-08-28 settled `Weideriche_` under production overlap `1`.
Its block record carries eight source blocks and nine target blocks across nine monotone relations,
including one source block paired to two adjacent target blocks.
No archive block remained unclaimed,
three slices settled,
and publication wrote artifact and page instead of repeating prior unfilled-passage refusal.
Mechanical verification matched one artifact to one page,
with all three promised wordings,
expected 919 characters,
and source destination retained.
Both providers were wet on all 25 meter readings and no seat stayed dark.
Body reading found the published wording restores source's non-binary older-sister wording,
care for injured people,
positive period of life,
memorial facts,
and contributor destination without reintroducing archive pronoun claim.
It still has body-level naturalness defects,
including strained emotional-deprivation wording and calqued descriptions of facing life and suicidal ideation.
More importantly,
whole-page reading failed publication:
target front matter still names entry id instead of source person's declared name,
and build script uses that `name` as visible localized list metadata.
This is inherited archive defect on exact path `#269` names,
not settlement regression.
Affected-entry evidence validates `#273` progress through settlement and publication only;
general pipeline closure still requires seeded recontest evidence and current-build front-matter rerun.
Unit guard now proves contested pairing is not cached,
second attempt is actually bought,
and recovered one-to-many split becomes cacheable.

Front-matter path `#269` is implemented after that reading and remains under live validation.
Visible YAML metadata is explicit syntax-bearing slice zero in artifact generation 5;
repair and naturalness lanes emit deliberate no-op rows,
while translate ensemble,
contest,
consolidation,
and final gate receive source-authoritative metadata rules.
Candidate and final-page guards require parseable target-compatible YAML shape,
exact metadata slice placement,
and non-incumbent result when source and archive metadata differ.
Preparation identity generation 2 distinguishes current metadata-aware slicing,
while generations 2 through 4 rebuild under legacy body-only identity generation 1.
A full synthetic pass crosses translation,
contest,
consolidation gate,
artifact parser,
and page persistence.

Fresh `b716eb99e` validation reached four slices and all nine active seats,
but correctly published no artifact or page.
The translate lane produced changed metadata whose visible name followed source identity,
then lane contest selected the unchanged repair metadata.
Consolidation produced another changed candidate,
but its final gate restored exact incumbent metadata.
The final guard refused that output as `incumbent-fallback` on three attempts;
subsequent attempt stalled because invalid contest and consolidation decisions had become cache-terminal.
This confirms final refusal but not live closure of `#269`.
Candidate validation now preserves source `name` and `info.alias` identity equality,
contest winners that fail publication invariants remain retryable,
and consolidation standing text must pass same syntax guard before unchanged result becomes resumable.
Final-page validation applies same source identity relation even when page differs bytewise from archive.

Fresh `1974ad999` validation then settled all four slices under preparation identity generation 2.
Artifact generation 5 and its 897-character page matched exactly under `verify-published`;
source destination survived,
all nine seats answered,
and both providers were wet on all 30 meter readings.
Visible `name` and `info.alias` now identify same source person,
so primary front-matter defect is closed at publication boundary.
Strict complete-page reading still rejected output for two systemic reasons.
The `info.location` contributor comment restored source-script attribution over established target form,
and body consolidation reintroduced several literal collocations after repair lane's naturalness pass had finished.
Mechanical agreement therefore remains necessary and insufficient.

Metadata validation now compares contributor attribution at same YAML path and preserves established target spelling after
`, by `;
translate,
contest,
consolidation,
and final-page checks share that policy,
with translate,
contest,
and consolidation cache generations advanced.
Artifact generation 6 adds auditable body-only naturalness polish after consolidation fidelity gate.
Measured refiner roles propose rewrites,
existing selection chooses candidate,
then separate fidelity-first naturalness gate lets polished wording replace approved base only when meaning and structure remain intact.
Front matter never enters polish.
Artifact records base,
proposal,
final text,
writers,
selection round count,
gate ballots,
and findings;
publication reads polish before every earlier decider.
Full package suite passes 854 groups with no failures,
and mutation proofs show polish shipping and read precedence guards are effective.

Fresh `2981e8cad` generation-6 `Weideriche_` validation reached all four slices and all nine active seats,
but correctly published no artifact or page.
Translate produced source-valid metadata;
repair deliberately retained archive metadata whose visible name and alias violate source identity.
On retry the lane contest selected repair,
recorded winner as unpublishable,
and did not cache it.
Consolidation produced source-valid metadata,
but final consolidation gate kept invalid standing repair text.
Complete-page guard refused both attempts as `invalid-page`;
second attempt added no cache record and queue stopped rather than repeating same work.

Missing trailing newline on generated metadata was investigated and rejected as root cause.
Positive control parsed exact generated candidate plus actual archive body successfully because body begins with line break.
Temporary boundary restoration and cache bumps were reverted in `03b698e40`.

Artifact generation 7 records source text and deterministic archive,
repair,
and translate eligibility on syntax-bearing contests while retaining raw ballots unchanged.
Verdict derivation excludes votes for ineligible candidates without redirecting them,
requires ordinary direct-vote quorum for eligible lane,
and suppresses archive endorsement when archive itself is ineligible.
When either lane is excluded,
contest still starts straggler grace at exact-half quorum rather than requiring every provider seat.
Fast inadmissible votes may therefore leave no eligible winner;
that outcome fails closed as retryable and uncached.
Contest prompt names deterministic exclusions,
artifact reader recomputes eligibility from stored source and lane texts,
and final page guard remains independent.
Fresh `09c3919bc` generation-7 `Weideriche_` validation settled all four slices in isolated root,
used both providers,
wrote one artifact and one page,
and passed `verify-published` with exact wording and expected length.
Artifact carries schema 7,
preparation identity v2,
and source-backed metadata eligibility at slice zero.
Archive and repair metadata are ineligible,
translate metadata is eligible,
and all eight retained raw ballots remain unchanged.
Seven judges declined to redirect an inadmissible choice and one chose translate,
so eligible lane lacked direct quorum;
consolidation then produced valid metadata and its gate approved it.
Complete-page reading confirmed visible name and alias agree,
location contributor uses established target spelling,
and source-script contributor did not leak into published metadata.

That page is not accepted yet.
Body meaning is materially faithful,
but several phrases remain literal or stiff.
Both body slices record polish as `not-run/not-configured` even though production run roles configure measured refiners.
The actual reachability defect is in `settleConsolidation`:
when consolidation slate keeps an already-endorsed standing lane,
function returns before `polishConsolidation`.
Artifact conversion then reports missing polish as not configured.
Final polish now runs over every endorsed surviving body baseline,
including slate-declined and structurally empty consolidation slates,
while unendorsed baseline remains `unsafe-baseline` and cannot buy or ship polish.

Fresh `bd70fa261` generation-7 `Weideriche_` validation confirmed that reachability fix:
all body slices carry settled polish rather than `not-configured`,
one body slice heard all measured refiners and reached nine-voice fidelity gate,
and `verify-published` matched one artifact and page at expected length.
Gate kept approved base,
so no changed polish shipped.
Complete-page reading still refused output.
Three short body passages,
including redundant and literal constructions,
were skipped because repair-lane 120-character eligibility floor was reused by final polish.
Final polish now disables that length floor while retaining paragraph-kind,
hard-break,
markup,
parse-integrity,
structural,
name-survival,
and final fidelity guards.

Same page also translated established English contributor handles literally from source attribution.
Existing English archive has 38 canonical contributor-label lines at pinned corpus checkout,
and target labels can be chosen public identities unrelated to source-script transliteration.
Preparation now extracts plain and linked contributor forms from those lines,
adds them to deterministic declared-name survival and prompt context,
and publication independently rejects any final attribution that drops or respells them.
Exact current generation-7 page is positive control:
new boundary rejects it with `ContributorCompletenessError`.

Fresh `1d4472e31` generation-7 `Weideriche_` validation then settled in an isolated root with schema 7,
preparation identity v2,
and both providers wet.
`verify-published` matched one artifact and page at expected length.
Metadata kept source identity equality and exact established target contributor forms.
Every structurally eligible body slice reached final polish;
one retained its approved base after all three refiners proposed nothing,
and another shipped a changed proposal after nine approving gate ballots with final text equal to proposed text.
Complete-page reading still refused publication quality.
The selected polish improved local repetition and verb form,
but left source-order adverb stacking and literal verb-object phrasing;
the untouched body slice also retained repeated generic referents.
The generic rewriter question permitted partial local cleanup while preserving Chinese grammar too literally.
Rewriter policy now says to preserve meaning rather than source grammar,
names the observed calque classes,
and requires every clear issue in a changed paragraph to be fixed before reply.
Refinement and consolidation cache generations advance because earlier replies answered weaker question.

Prompt pressure alone is not publication proof.
Artifact generation 8 adds independent absolute naturalness review over exact would-ship body text after comparative fidelity gate,
including unchanged text when refiners propose nothing.
Every requested roster seat remains accounted as usable or unavailable,
but exact-half usable quorum starts bounded straggler grace and is also minimum for approval.
Any usable rejection heard before settlement blocks.
Findings identify one-based structurally correctable paragraph and actionable defect.
One bounded corrective generation receives those findings as fenced data,
then existing structure and fidelity gates run before independent review rechecks exact selected text.
No-op correction,
thin review,
rejected correction,
or second-review defect yields `NaturalnessCompletenessError` before page or artifact persistence.
Such settlements are neither cached nor twin-reused.
Schema 8 stores every seat status,
review verdict,
correction count,
and candidate digest;
reader recomputes counts,
unique seats,
findings,
verdict,
and final-text digest.
Generations 6 and 7 remain readable but cannot satisfy schema-8 publication boundary.
Full package suite passes 858 groups with no failures,
and OXLint and TypeScript checks are clean.

The first fresh schema-8 run correctly rejected body text after every absolute reviewer found material naturalness defects.
It wrote no page,
artifact,
or consolidation cache.
That run also exposed a correction-routing defect:
correction refiners saw the findings,
but candidate selectors still received the generic comparative-polish question and a tie restored wording already known to be unpublishable.
Consolidation cache generation 8 makes required correction a distinct non-fallback mode.
Correction rewriters and selectors now receive structured paragraph findings as fenced evidence;
selectors are told unchanged text cannot ship,
and decline or tie records `no-correction` rather than fallback.
Comparative refinement retains its accepted-input fallback.
Structural validation,
fidelity gate,
and exact-text second absolute review remain mandatory after any selected correction.

The next fresh schema-8 run proved required-correction routing converged,
but one correction remained an insufficient bound.
On its first attempt,
a selected correction passed fidelity review and exact-text absolute review exposed further material defects.
On its retry,
a broader correction was selected but fidelity review retained the rejected input.
Both attempts wrote no page,
artifact,
or consolidation cache;
`verify-published` correctly refused to call the empty run clean.
Artifact schema 9 and consolidation cache generation 9 permit one further correction only after exact first corrected text receives a new material rejection.
Each transition records rejected-text digest,
canonical structured-findings digest,
gated-text digest,
and reviewed paragraph digests.
The reader recomputes every exact reviewed candidate,
its paragraph identities,
and every adjacent transition.
No candidate,
tie,
no-op,
fidelity retention,
thin review,
or rejection after correction two remains terminal and retryable.
Generations 6 through 8 remain readable but cannot satisfy schema-9 correction-chain boundary.
Another fresh affected rerun remains required before accepting output.

Two fresh schema-9 `Weideriche_` validations after the GLM-5.3-Flash roster replacement each attempted the entry twice,
failed absolute naturalness on body slice 1,
and wrote no page or artifact.
The first exposed reviewers treating Markdown soft breaks as visible sentence breaks even though target MDX renders them as spaces.
Absolute-review instructions now require flow findings to survive rendered soft-break normalization;
a replay over same rejected candidate text and reconstructed context then received nine usable approvals.
The second fresh run still rejected genuinely awkward body wording after both corrections.
It also exposed required-correction fidelity gate calling rejected base already approved and unanimously restoring it.
Required-correction gate now receives rejected status and canonical findings;
base remains fidelity evidence but cannot win merely because improvement is unclear.
Correction generation and selection now treat findings as minimum defects rather than edit whitelist.
Replays over exact candidate texts with reconstructed source and identity context moved gate from base to polished
and selection from partial to broader idiomatic correction.
Those replays are directional prompt evidence,
not publication evidence:
the best replayed correction still received one usable rejection among nine and therefore fails strict floor.
GLM-5.3-Flash returned usable structured answers and approved reviewed candidates in these diagnostics,
but this does not grant specialized role standing or production readiness.
Consolidation cache generation 10 prevents warm reuse of settlements bought under earlier review,
correction-generation,
selection,
or fidelity-gate questions.
The next eight-seat validation proved relative correction selection still allowed every judge to choose best available text before exact absolute review rejected it.
Generation 11 makes required correction absolute eligibility explicit:
rewriters are instructed to perform separate finding-led and sentence-level native-English passes,
inherited wording gets no presumption from omission in finding list,
and selectors must assess each candidate independently and decline every candidate when each remains materially unnatural.

Prompt strengthening alone was insufficient.
A newly generated correction fixed demonstrated phrase but introduced another idiomatic defect;
selector still chose it and exact review rejected it.
More importantly,
same exact failed candidate was rejected by original run and first replay,
then accepted by all eight seats in later replay.
One absolute-review draw is therefore not stable enough for publication approval.
Generation 11 now requires one sequential exact-half-quorum confirmation after first acceptance.
Any rejection heard before either bounded settlement remains immediately decisive and feeds bounded correction;
an acceptance ships only after second quorum acceptance of exact candidate.
Generation 12 applies exact-half required participation to every direct roster round;
no stage waits on every provider seat as requirement.
Participation quorum is distinct from existing two-vote corroboration thresholds for pairing and comparative gates.
Sequential naturalness approvals may contain different responding halves;
requiring identity overlap would restore provider-seat dependency the cap removes.
Schema-9 `confirmations` retains earlier acceptable draw with candidate and paragraph digests,
while decisive `rounds` preserves one-review-per-candidate correction-chain invariant.
Runtime settlement produces confirmation evidence by construction;
artifact reader independently checks final-candidate identity,
paragraph digests,
roster order,
and confirmation order.
Final-naturalness completeness guard checks settled runtime state and does not duplicate artifact reader's digest validation.
Legacy schema-9 records without field remain readable.
Generation 13 landed in `1d16d89c4` and removes two-correction ceiling.
Generation 14 landed in `cf14b379b` and threads every reviewed rejection into failed-strategy evidence
while durably storing first raw model payload by canonical prompt under run root.
Commit `6369228d5` detects exact repeated correction task before dispatch and pauses it as `INCOMPLETE`.
Interrupted invocation reconstructs exact correction state from payloads without provider resends,
then continues at first unseen prompt.
Payload cache carries corpus and model wording;
it stays inside disposable run root and is never committed or quoted.
Every rejection feeds latest exact text and findings into next correction.
No-change,
selection decline,
structural refusal,
and fidelity retention become prior failed-strategy evidence for materially different next prompt.
Schema-9 reader accepts any count of complete digest-bound transitions and still requires final acceptance.
First acceptance uses defect-discovery responsibility;
confirmation uses prior-acceptance challenge responsibility rather than repeated prompt.
No further validation may reuse generation-12 consolidation cache.

### Standing operation invariants

A quality rejection is repair work,
not final `do not publish` answer.
Pipeline must continue stage-local correction from latest exact rejected text and latest structured findings
until strict publication gates accept or operational interruption pauses work.
No finite correction ceiling is authorized.
It must not restart whole entry merely because quality work remains.
Cancellation,
dark provider,
quota exhaustion,
transport outage,
and insufficient live seats leave resumable incomplete work.
They must not become quality judgement,
terminal refusal,
unsuccessful quality tally,
or `do not publish` result.
Operational interruption may pause or retry repair,
but may not publish or weaken publication gate.

One model plus one substantive prompt may contribute at most one provider payload per invocation.
Identity is exact model identity plus canonical ordered messages,
including roles and exact content bytes.
Run client memoizes first in-flight or completed payload and reuses it for exact duplicates;
it never sends second provider call.
Pipeline must never resend that task to same model to manufacture independence,
non-bias,
confirmation,
or extra sample.
Changing temperature,
response schema,
round number,
nonce,
whitespace,
or request metadata does not create independent sample.
Providers may silently enable deterministic prompt caching;
duplicate response would then be same computation,
not independent evidence.
Follow-up work must give model substantively distinct task grounded in prior result,
latest rejection,
or different review responsibility.

Same-model same-prompt transport retry is permitted only after connection failure,
reset,
or timeout before completed provider payload exists.
Once any payload exists,
including malformed,
truncated,
schema-invalid,
or semantically rejected payload,
that model and prompt may not be resent as another evidence draw.
Operational recovery and discarded payload together still produce at most one recorded response.
Malformed completed payload keeps memoized failed claim and cannot be resent.
Claims are invocation-local;
a later invocation replacing interrupted work may repeat provider request,
but its result is never independent or non-bias evidence against earlier payload.
Concurrent duplicate waits on first caller's exchange and signal;
it does not start or cancel separate provider call.
Corpus pass persists raw payload memo beneath `prompt-payloads/` in run root.
Corrupted record refuses before provider call.

`TALLY status=INCOMPLETE` means stage-local or operational work remains.
It is neither success,
quality verdict,
nor publication evidence.
Scheduler retains caches but does not queue fresh whole-entry attempt in same invocation.
Ordinary hard-cap or transport error remains `status=ERROR` and may resume measured cache progress.

Pipeline must function normally when only one provider is wet.
No provider family,
provider-specific seat,
or cross-provider response is mandatory.
Exact-half participation may come entirely from one provider;
strict quality,
corroboration,
and publication gates remain unchanged.
One wet provider is valid normal operating mode with reduced provider diversity to report,
not reason to stop repair or lower quality.
Too few live seats for stage participation pauses or retries work as operational state;
it is not quality rejection.

Ordinary operation permits either provider alone.
Validation and performance arms requiring both must pass
`--require-providers synthetic,hyper`.
Harness verifies both keys and live non-dry meters before any model call,
then logs `REQUIRED-PROVIDERS synthetic,hyper status=wet`.

The live artifact also exposed misleading diagnostic wording:
it reported nine pair relations as though nine of eight source blocks had been paired.
`countPairedBlocks` now reports unique source and target reach separately from relation count,
with one-to-many and many-to-one guards.

Two fresh validations launched from `68c37da59` at 2026-08-29 12:14 UTC.
`Weideriche_` used `~/temp/agent/validation-Weideriche-schema9-half-quorum-v12-20260829`.
Its first attempt refused slice 1 absolute naturalness at 4,840,305 milliseconds,
wrote no artifact or page,
and incorrectly queued whole-entry cache-warm reattempt.
Process was stopped after that behavior was rejected.

Pull request 386 `Carena0442` used exact pull-request files in isolated fixture at
`~/temp/agent/validation-pr386-Carena0442-schema9-half-quorum-v12-20260829`.
Process was stopped after same-model same-prompt repetition was rejected as independence mechanism.
It wrote no artifact or page.
Neither stopped run is publication or readiness evidence.
Artifact and log paths,
fixture method,
and failed startup non-evidence are recorded in
`~/temp/agent/pr386-Carena0442-run-provenance-20260829.md` and
`doc/handover/translation-repair.md`.

The stopped runs are not completion-time samples.
Before another `Carena0442` launch,
completion-path work must target fresh-run median below two hours without weakening quality.
`doc/planning/translation-repair-entry-time-to-complete.md` defines phase attribution,
comparison controls,
completion evidence,
and objective.
Concurrent runs share provider capacity and are not matched runtime arms.

### Terminal quality-refusal audit, 2026-08-29

Naturalness rejection no longer ends with `do not publish`:
generation 14 continuously corrects,
checkpoints payloads,
and pauses only on operational interruption or exact deterministic task cycle.
Publication gates remain strict.

Remaining terminal and bypass findings must move to stage-local repair before fresh runs:

- Archive-only block repair landed in `ccaad1f53`, with contributor-floor test in `78ab244a2`.
  Preparation now scopes each unclaimed target block to expected aligned source section,
  requires exact anchored source support or deterministically shaped editorial apparatus,
  and lets any revise voice block retention.
  Retained wording receives defect-discovery naturalness review plus distinct acceptance challenge.
  Corrections preserve target-authoritative contributors,
  undergo independent whole-roster selection,
  splice in reverse offset order,
  and re-enter preparation before lanes.
  Exact correction and archive-state cycles pause as `INCOMPLETE`.
  A sibling revision intentionally causes remaining unclaimed blocks to be reviewed again;
  this costs calls but avoids carrying a license across changed parser locations and source context.
  The old `assertArchiveReviewed` terminal and `UnreviewedArchiveError` are removed.
- Unfilled-passage continuation landed in `ed756993b`, with cycle guard test in `1649c480d`.
  Translate version 11 produces from latest exact rejected slate and findings without finite correction count.
  Insertion placement rechecks latest semantic, destination, and shortfall evidence until admitted,
  proven carried elsewhere,
  operationally interrupted,
  or exact task cycle repeats.
  Carried passages map to `not-applicable` at insertion anchor;
  final would-ship page must retain every exact anchored region that proved full coverage.
  This exact-region rule can conservatively pause semantically equivalent rewrites as `INCOMPLETE`.
  `assertPublishableTranslation` is now defensive invariant and cannot trigger fresh whole-entry retry.
- Continuous final-selection recovery landed in `a84bb3a7a`, with role-alias guard in `f858ab538`.
  Consolidation version 16 treats every unendorsed or publication-ineligible standing baseline as unfinished.
  It threads prior selection slate,
  anonymized producer and judge roles,
  selection ballots,
  gate ballots,
  terminal,
  and findings into substantively distinct producer recovery.
  Recovery continues until a fresh consolidation wins selection and fidelity gate,
  provider operation stops,
  caller aborts,
  or exact evidence cycle repeats.
  Identical unsafe twins share one recovery chain;
  only final safe settlement persists.
  `assertFinalSelectionSettled` remains a defensive invariant,
  classified as `INCOMPLETE` rather than whole-entry quality retry.
- One-sided front-matter support landed in `56a47cb81` and creates insertion slice for source-only metadata,
  deterministically admits it,
  and validates candidate against source YAML shape when archive has none.
  Target-only metadata remains exact archive content outside localized slices.
  Missing/misplaced slice and contradictory assembled-page structure pause as `INCOMPLETE` invariants;
  incumbent fallback and candidate YAML/schema invalidity remain handled before publication.
- `assertContributorNamesComplete` throws when final attribution drops target-authoritative public form.
  Generation 15 landed in `5211c54dd` and floors translation candidates,
  excludes unrepairable violator voices without fabricated authorship,
  rejects unsafe ordinary lane winners,
  and floors consolidation and polish candidates.
  Repair/refine text that differs reaches lane winner floor;
  uncontested identical text matches translate lane already floored.
  Invalid slate deterministically retains target-authoritative incumbent.
  Body-slice floor does not replace front-matter comment authority,
  which remains in metadata validator.
  Final completeness guard remains defensive.
  Cache generations move to translate 11,
  refine 4,
  lane contest 5,
  and consolidation 16.

- Visual-evidence guard landed in `d14e641e6` and gives each image retry substantively distinct responsibility:
  complete transcription,
  small text,
  layout,
  then identifier verification.
  Corroborated and reviewed no-text outcomes proceed.
  Missing or unavailable image-dependent evidence pauses as `INCOMPLETE` before lanes,
  so visual content cannot bypass publication review.

On fresh generation-14 corpus path,
`assertFinalNaturalnessComplete` is runtime persistence invariant after continuous naturalness,
not ordinary quality outcome.
Existing artifact readers do not invoke it.
Parser,
ledger,
assembly,
filesystem,
provider,
and cancellation failures are operational errors rather than quality verdicts.
No fresh validation starts until remaining repairable quality paths stop producing terminal refusal.

Corpus-readiness work is defect-driven:
once output proves reproducible systemic blocker,
stop unrelated corpus arms,
fix and verify blocker,
then rerun affected entry before resuming measurement.
More samples do not compensate for known mechanism.

Remaining corpus arms, hard-case output reading, live calibration checks,
site-grammar gaps,
package reading CLI,
Hyper catalog drift check,
and declined-archive seam remain open.
Read milestone figures as history:
they were measured under earlier pipeline shapes and none is readiness claim.
Current evidence and traces are in
`doc/audit/translation-repair-output-reading-20260826.md`
and `doc/planning/translation-repair-corpus-overlap-measurement.md`.
