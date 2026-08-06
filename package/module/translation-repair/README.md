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
  Selection removes producers from the judge roster per round,
  so `judgeModelIds` must contain at least one model that never edits;
  `assertJudgeableEditorRoster` refuses a roster that does not,
  because an all-editor roster would otherwise degrade silently into
  always shipping the fallback.
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
  Every region it inspects contains a defect by construction, that being why
  the region was edited, so a model asked whether anything is wrong will find
  something;
  until that false-positive rate is measured against human repair grades,
  letting the probe block a repair would discard correct fixes on unmeasured
  evidence.
  Claims are screened deterministically rather than believed:
  a quote must be new in the replacement, or gone from it for dropped content,
  and `screenNonTranslationVotes` is the precedent for evidence that dismisses
  an impossible claim without having to prove a possible one.

## Status

Milestone one (detection) is complete:
the seven-critic ensemble reached 0.981 recall on seeded errors
over the reference corpus,
gated by the seeded-error benchmark harness.

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
