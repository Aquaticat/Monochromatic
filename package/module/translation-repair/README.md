# @monochromatic-dev/module-translation-repair

Multi-model translation critique and conservative repair.

Takes an original text plus its translation,
returns a structured issue list anchored to an immutable document model,
and a repaired candidate translation.

## Standing redesign constraints

These constraints govern task 41 replacement work and supersede historical architecture notes in this file.
Current shipped pipeline and corpus runbook predate them and remain non-conforming until replacement lands.
Every section after `Standing redesign constraints` describes current or historical implementation
and is non-normative for replacement architecture.
A normal run with working model and publication infrastructure must return one good complete document.
It must not leave its caller with a suspended translation because an auditor,
reviewer,
reviser,
or generic quality Gate timed out,
refused,
or disliked wording.
A node that does not produce usable text cannot receive authority to withhold usable text.

Every model invocation belongs to a statically finite manifest.
No finding,
text change,
round,
nonce,
cache event,
or failed review may add work.
No hidden scheduler may keep creating manifests.
One model plus one canonical substantive prompt may produce at most one provider payload.
Caller cancellation throws exact abort identity and deterministic restart reuses completed nodes.

Model nodes have two kinds.
Preparation-evidence node may produce brief or specification before authorship;
its unusable response contributes nothing and cannot withhold producer work.
Candidate-producer node returns complete candidate under one concrete responsibility,
or it has no effect and prior complete candidate survives byte-for-byte.
Every model stage after preparation is candidate producer.
First adopted producer owns full concrete quality contract,
including fidelity,
completeness,
identity,
grammar,
clear references,
consistent tense,
paragraph relations,
and appropriate register.
Later stages are targeted improvements,
not required rescue for deficient baseline.
Before first candidate exists,
the manifest may try statically named fallback producers once each.
Operational run begins after provider preflight and finite manifest persistence.
First candidate is adopted only after one response yields complete document passing deterministic obligations.
If every planned producer has transport failure or unusable response before first adoption,
command throws bounded `ProductionUnavailableError` with exhausted node identities.
It does not suspend,
wait for human continuation,
automatically create another manifest,
or publish archive text as though repaired.
`ProductionUnavailableError` concerns exhausted candidate producers only;
failed preparation-evidence node never causes it.
This physical infrastructure or model-output failure is only no-output exception.

Runtime quality responsibility belongs to these producing stages,
not a final generic model Gate.
Deterministic adoption checks protect source coverage,
identities,
structure,
links,
media,
formatting,
and publication bytes.
A later producer supplies complete candidate plus exact edit transaction anchored to prior bytes and source evidence.
Deterministic adoption recomputes candidate from transaction,
rejects undeclared changes,
and preserves prior text when transaction or candidate fails.
These checks bound change authority but cannot prove semantic judgment.
Every prototype comparison and every readiness claim must read complete actual output,
not only artifact,
status,
or tally.
Any repeatable concrete defect means producer contract is not ready.

`naturalness`,
`absolute naturalness`,
and similar aggregate labels are not measurements,
thresholds,
floors,
or verdicts in new work.
Use concrete located defect classes such as wrong meaning,
omission,
addition,
identity change,
grammar,
unclear reference,
tense inconsistency,
broken paragraph relation,
and register mismatch.
One wet provider remains normal operation.
Manifest planning builds complete role and fallback roster reachable through whichever provider is wet;
no cross-provider response is correctness dependency.
Finite manifest does not imply serial execution.
Replacement scheduler must dispatch dependency-independent nodes concurrently
up to dated live-measured per-provider and per-model limits.
Dependency edges still serialize work whose prompt consumes prior output.
Concurrency and request-rate limits are separate constraints and must be measured separately.
Production uses 5 Synthetic slots per active model and can expose 20 aggregate slots across the four-model roster.
A width-10 gpt-oss arm returned 3 HTTP 429 responses,
so model size does not justify a larger setting.
Hyper has no local concurrency ceiling;
a live width-64 arm completed 64 of 64 structured calls.
Its 1,000 requests-per-hour account limit remains a separate rate budget.
OpenRouter,
the third provider since 2026-09-03,
has no local ceiling either:
a width-32 chat-completions arm completed 32 of 32 on two models with no refusal,
and the provider states no request-rate limit for paid models.
Amazon Bedrock,
the fourth provider since 2026-09-07,
publishes no requests-per-minute quota and no token quota for the four models it serves here,
asks for retry with backoff on throttling and a gradual ramp,
and has no local ceiling either.
Routing walks `PROVIDER_ORDER` (Synthetic,
Bedrock,
Hyper,
OpenRouter;
Bedrock ahead of Hyper by the owner's decision of 2026-09-07,
so the seats both serve spend the expiring credits before the balance the Hyper-only seats run on):
the first provider that serves the model and has budget takes the call,
a saturated provider overflows to the next usable one,
and a dry provider passes the call down the order.
See `doc/troubleshooting/translation-repair-provider-concurrency.md`.
A2's 432-second intentionally serial run measures its implementation,
not provider concurrency capacity.
Measured arms may explicitly require any subset of the providers.
Each node prompt digest binds exact source,
archive,
brief,
prior-candidate bytes or explicit absence marker,
role,
and response contract so restart cannot change fallback into different revision task.
Restart requires same manifest digest and checkpoint and may execute pending nodes only.
Completed,
failed,
unusable,
aborted,
or indeterminate nodes are spent.
Indeterminate transmission may reuse recorded payload but may never resend canonical prompt.
Caller abort bypasses fallback immediately and throws exact `signal.reason`.

Assembly,
atomic write,
or readback failure after candidate exists throws bounded `PublicationUnavailableError`.
It does not suspend,
automatically requeue,
publish partial bytes,
publish archive fallback,
or become quality outcome.

## Operating a corpus pass

This file describes the design.
To RUN the pipeline over the corpus,
follow [the corpus pass runbook](../../../doc/runbook/translation-repair-corpus-pass.md),
which carries the environment,
the launch,
what to watch while it runs,
and how to read the output back once it has exited.

Read-back tools,
none of which spends quota or calls a model:

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
    Its `--model` view prints corpus wording,
    so it must not be pasted anywhere.

The runbook carries the exact invocation and the expected output for each,
including what each one prints when the run recorded nothing for it,
which is never the same as the run having done nothing.

The pass also prints,
beside each settled entry's `TALLY` line,
`DESTINATIONS <id> source=N page=M dropped=K`:
how many distinct web addresses the source page links to,
how many the published page carries,
and how many of the source's the page lacks (`#265`).
A source destination the archive rendered another way is not lacking when the page carries the archive's rendering
(`doc/decision/translation-repair-rewritten-destination.md`):
the line then ends with `destinations-archive-rendering`,
and with `destinations-both-renderings` when the page carries the original's and the archive's for one reference.
The addresses themselves go to the run log at info,
never to stdout.
A dropped destination from a wording both deciders approved is a finding,
not a late publish rewrite.
The neutral pronoun the sources write as `TA`,
`Ta` or `ta` renders as singular they:
the declared-identity pronoun line counts all three spellings (`identity-context.ts`),
the house rule says what English makes of it,
and a translation that leaves it standing fails the deterministic slice rule (`translate-neutral-pronoun.ts`),
which names the spelling and its count to the model that wrote it.
Measured over the pinned corpus,
that rule flags one archive (a rewrite keeping `TA`) and 15 sources.
A different rule protects a source-only passage:
whole-document coverage must call it absent,
then page shortfall or a destination missing from target admits translation.
Any source passage still unfilled fails entry before contest,
artifact and publication;
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
  critic fan-out,
  provenance-blind adjudication panel,
  editors,
  selection judges,
  and resolution checkers.
  A stage that loses voices retries exactly the lost ones until at least half its roster is heard.
  An optional `editorRuleAddendum` splices one extra machine-enforced
  rule line into the editor prompt for calibration experiments.
- No single model decides the repaired text.
  Every editor in `editorModelIds` rewrites the chunk independently,
  each proposal passes the same deterministic apply gate,
  and judges drawn from `judgeModelIds` choose what ships.
  Selection seats the WHOLE judge roster,
  producers included,
  and counts a judge's ballot for its OWN candidate at half weight;
  every other ballot it casts carries full weight,
  including one for another producer's candidate.
  A winner needs weight 2,
  so on these rosters no candidate is selected by its own authors alone.
  `assertJudgeableEditorRoster` still requires two judges with no stake in the set,
  which is now a policy rather than an arithmetic necessity:
  it keeps a whole slate from being ranked only by the models that wrote it.
  `checkerModelIds` should likewise exclude every editor,
  so nothing certifies text it wrote.
- Judging runs at two granularities.
  Per envelope,
  the best fix for each individual issue can win even when the model that wrote it botched the rest of the chunk;
  the winners are assembled into a composite candidate.
  Per chunk,
  whole candidates compete,
  including that composite,
  which is the only level at which coherence across envelopes is visible.
  The composite has to win on its merits rather than being adopted by construction.
  When judges decline,
  the strongest editor patch ships anyway:
  falling back to the untouched translation would turn a disagreement about wording into a lost repair.
- The result is never an unqualified "corrected translation":
  `repairedText` ships with a completion status (`repaired`,
  `unchanged`,
  or `blocked-non-translation`),
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
  `repairDisposition` says what became of that repair in the returned document (`shipped`,
  `not-selected`,
  `withdrawn`,
  or `no-region`),
  and is decided after document-level blocking and the naturalness lane,
  neither of which any single slice can see.
  `refined` marks a slice the naturalness lane rewrote afterwards,
  which is where the recorded replacement stops being the returned wording,
  and `finalSliceText` carries that wording exactly there.
- Translation policy files (register,
  terminology,
  tense discipline) are deliberately open;
  the system functions without them using conservative defaults.

## Where the rest lives

The rest of this package's documentation sits beside the code in `doc/`,
one file per subject:

- [Reading the pictures a document shows](doc/pictures.md):
  the deterministic reader,
  the four model readers,
  what is sent and what is not.
- [Evidence beside a slice](doc/slice-context.md):
  the neighbouring passages,
  the pages the original cites,
  what is folded out of candidate and archive text at intake.
- [Repetition and the site's grammar](doc/repetition.md):
  the repetition the pipeline introduced and how it is caught,
  and why the site's grammar is not this package's.
- [Design commitments](doc/design-commitments.md):
  what the pipeline promises and refuses,
  with the measurements behind each.
- [Configuration](doc/configuration.md):
  credentials,
  where a run writes,
  bounding and choosing a run,
  kill and relaunch,
  pooling artifacts,
  schema generations.
- [Current roster changes](doc/roster-changes.md):
  the one-card workflow and every seating and unseating with its date.
- [Provider availability, measured](doc/provider-availability.md):
  latency,
  running out of budget,
  how much of the time each provider was there.
- [Deciding who fills a seat](doc/seats-and-calibration.md):
  calibrations,
  standings,
  editor and refiner credit.
- [Status](doc/status.md):
  the milestone and generation history since 2026-07.
- [Redaction timing](doc/redaction-timing.md):
  when redaction happens.
