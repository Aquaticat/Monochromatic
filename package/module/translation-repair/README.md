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
    editorModelId,
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
  editor, and resolution checkers.
  A stage that loses voices retries exactly the lost ones until over
  half its roster is heard.
- The result is never an unqualified "corrected translation":
  `repairedText` ships with a completion status
  (`repaired`, `unchanged`, or `blocked-non-translation`),
  every adjudicated issue with its resolution fate,
  and degradation findings.
  When no candidate demonstrably beats the input,
  the input is returned unchanged with its unresolved issues.
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

## Status

Milestone one (detection) is complete:
the seven-critic ensemble reached 0.981 recall on seeded errors
over the reference corpus,
gated by the seeded-error benchmark harness.

Milestone two (repair) is in progress:
the full loop
(critics, claim aggregation, adjudication panel, editable envelopes,
editor through a deterministic apply gate, resolution checkers,
lexicographic candidate selection)
runs end to end live,
and budgeted benchmark runs are accumulating the seeded repair rate
(fraction of planted omissions whose distinctive vocabulary the
repaired candidate restores).
