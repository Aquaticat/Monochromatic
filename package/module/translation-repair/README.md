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
