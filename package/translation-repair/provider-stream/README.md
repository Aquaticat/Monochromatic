# @monochromatic-dev/translation-repair-provider-stream

The wire-level half of the model clients:
masking credentials out of text,
scanning streamed deltas,
watching a stream for stalls and degeneration,
and the synthetic transport that tests drive.
It is its own package so `provider` and the stream consumers share one copy of the failure classes,
which production code tests with `instanceof`.

## What it provides

`src/index.ts` re-exports each public name from the module that declares it.
The groups below name the main ones.

- Credential masking:
  strip API keys and their encoded forms from text before it is logged or stored.
  Names:
  `maskCredentials`,
  `maskCredentialsInCutText`,
  `credentialsOfHeaders`,
  `CREDENTIAL_MARKER`,
  `findNeedles`.
  Declared in `credential-mask.ts` and `credential-search.ts`.
- Stream scanning:
  split a streamed reply into channel deltas for each wire format.
  Names:
  `scanStreamDeltas`,
  `scanAnthropicDeltas`,
  `scannerFor`,
  `DEFAULT_WIRE_FORMAT`,
  `ssePayloadOf`,
  `drainBody`,
  `deliveredCharsOf`.
  Declared in `stream-delta-scan.ts`,
  `anthropic-delta-scan.ts`,
  `stream-wire-format.ts`,
  `sse-data-line.ts`,
  `stream-drain.ts`,
  and `stream-delivered-chars.ts`.
- Stream failure detectors:
  cut a stream that stalls,
  degenerates,
  recurs or runs away,
  and name the failure.
  Names:
  `armIdleGuard`,
  `watchForDegeneration`,
  `watchForRecurrence`,
  `watchRunaway`,
  `StreamStalledError`,
  `StreamDegenerateError`,
  `StreamOverrunError`,
  `StreamCutShortError`.
  Declared in `stream-idle-guard.ts`,
  `stream-degeneration.ts`,
  `stream-recurrence-watch.ts`,
  `stream-runaway-watch.ts`,
  `stream-overrun.ts`,
  and `stream-cut.ts`.
- Transport:
  the fetch-based transport,
  its reply shape and the errors a failed exchange raises.
  Names:
  `fetchTransport`,
  `ModelTransport`,
  `TransportReply`,
  `TransportRequestFailedError`,
  `SyntheticHttpError`,
  `exchangeFailureText`.
  Declared in `synthetic-transport.ts`,
  `transport-request-error.ts`,
  `completion-shape.ts`,
  and `exchange-failure-text.ts`.
- Model content parsing:
  strip code fences and think blocks from a reply and read the JSON an answer holds.
  Names:
  `parseModelJson`,
  `stripCodeFence`,
  `stripThinkBlock`,
  `parseAnswerJson`,
  `readJsonPastFalseStart`,
  `readMaskedJsonBody`.
  Declared in `model-content.ts`,
  `json-false-start.ts`,
  and `masked-json-body.ts`.
- Quote preservation and quota:
  count the quoted passages a rewrite must keep,
  and read the Synthetic quota snapshot.
  Names:
  `countQuotedPassages`,
  `dropsQuotedPassage`,
  `quoteLossRefusalFinding`,
  `parseQuotaSnapshot`,
  `QuotaShapeError`.
  Declared in `quote-preservation.ts` and `synthetic-quota.ts`.

## Family dependencies

Short names are directory names under `package/translation-repair`;
a package is named `@monochromatic-dev/translation-repair-<short name>`.

### Depends on

Production dependencies (`dependencies` in `package.json`):

- `document-structure`
- `glossary`
- `house-rule`
- `markup`
- `typography`

### Used by

Packages that list it in `dependencies`:

- `bench`
- `corpus-pass`
- `coverage-census`
- `insertion`
- `page-pass`
- `probe`
- `provider`
- `reference`
- `repair`
- `run`
- `slice-cache`
- `slice-reading`
- `stage`
- `translate-floor`
- `translate-lane`

Packages that list it only in `devDependencies`:

- `consistency`

## Tests

Tests sit beside the sources as `*.unit.test.ts` and import built output:
this package through its own build,
`../dist/final/node/index.mjs`,
and the siblings they need through their package names,
which resolve to each sibling's built entry.

Build before testing:
`mise run //package/translation-repair/provider-stream:build` builds this package,
and the library build keeps family siblings external,
so this package's built entry imports the siblings' built entries.
Its `build:js:node` task therefore declares `depends` on the `build:js:node` of every sibling
listed in `package.json`,
and the siblings build first.

Run the tests with `mise run //package/translation-repair/provider-stream:test:unit`,
or build and test together with
`mise run //package/translation-repair/provider-stream:buildAndTest`.
Pass test file paths to run only those files.

Its `./ts/*` export also serves test fixtures that sibling tests import,
for example `recorded-transport.test-fixture.ts` and `corpus-run/cap-census-log.test-fixture.ts`.

Test helpers used across the family,
such as scratch directories and capturing loggers,
come from `test-fixture`,
imported as `@monochromatic-dev/translation-repair-test-fixture/ts/<file>`.

## Family docs

- `../../module/translation-repair/README.md`:
  the overview of the pipeline,
  from before the split.
- `../../../doc/planning/translation-repair-package-split.md`:
  the split plan,
  with the package map and the rules the move keeps.
