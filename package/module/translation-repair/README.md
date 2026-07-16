# @monochromatic-dev/module-translation-repair

Multi-model translation critique and conservative repair.

Takes an original text plus its translation,
returns a structured issue list anchored to an immutable document model,
and a repaired candidate translation.

## Contract

The core export is a pure async function composed from pure stage functions:

```ts
import { repairTranslation, } from '@monochromatic-dev/module-translation-repair';

const result = await repairTranslation({
  original,
  translated,
  sourceLocale: 'zh',
  targetLocale: 'en',
  client,
},);
```

- `client` is an injected OpenAI-compatible model client;
  the library performs no IO of its own.
- `policy` is optional prose describing output conventions
  (register, terminology, tense discipline);
  the system functions without it using conservative defaults.
- The result is never an unqualified "corrected translation":
  it carries a repaired candidate,
  accepted, rejected, and unresolved issues,
  and a completion status.
  When no candidate demonstrably beats the input,
  the input is returned unchanged with unresolved issues.

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

Milestone one:
deterministic core (document model, segmentation, footnote graph, span validation),
injected model client,
and the seeded-error benchmark harness whose scorecard
gates all consensus-pipeline decisions.
