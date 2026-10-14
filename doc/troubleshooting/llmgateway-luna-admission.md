# LLM Gateway Luna Decisions returns complete answers without complete native admission

## Symptom and version

On 2026-10-14,
`openai/gpt-6-luna-decisions` through `POST /v1/decisions` accepted the installed native assessment
and returned all 84 named answers.
The maintained consumer nevertheless could not admit a complete interpretation at the adopted `0.80` cutoff.
This is an application admission boundary,
not an HTTP error or established upstream defect.

The initial baseline contains 584,007 bytes and reports 126,129 input tokens.
Repeated baseline responses admit four supported meanings,
including the primary permission meaning at `0.83`.
Independent confidence remains a separate returned field.
The model name is the returned Gateway identity;
the provider's immutable model revision and hosted Gateway commit are not established.

## Root cause and limits of the source trace

The observed application hold is consistent with unresolved categorical estimates.
No experiment establishes why the model assigns those distributions.
Neither batching invariance nor repeated identical answer data proves caching,
independent model evaluation,
or a provider implementation defect.

There is also a separate missing native consumer for an admitted whole-request
`potential-instruction` answer.
The baseline selects that answer at `0.96`.
An actual built native contrast admits all clause meanings and changes only the authored whole-request relation:
`none` executes three prepared children;
`potential-instruction` executes zero.
Both runs retain five accounted partial source associations and 33 original sources.
Each uses one local HTTP response and zero provider requests.
`${HOME}/temp/agent/pi-luna-request-use-control-20261014.log` retains the complete contrast.

The owned consumer in `package/pi-plugin/auto-mode/src/request-material-obligations.ts:65`
keeps that governing-use obligation:

```ts
// package/pi-plugin/auto-mode/src/request-material-obligations.ts:65
if ((interpretation.admission === 'admitted') && (interpretation.relation === 'potential-instruction')) {
```

Its emitted issue at line 69 is `request-material-instruction-use`.
Existing partial source contributions do not supply the missing complete interpretation.
That gap must be implemented through original source ownership;
prompting the model to report absence would not repair it.

The fresh read-only Gateway clone is
`${HOME}/temp/agent/llmgateway-decisions-20261014/`,
revision `8d7a6f3a65af6a11d7646cc3e927a0acd0a2b961`.
Its `apps/gateway/src/decisions/decisions.ts:315` forwards the parsed input and question array:

```ts
// apps/gateway/src/decisions/decisions.ts:315 in the cited read-only clone
model: upstreamModel,
input: request.input,
questions: request.questions,
```

The same file at line 326 retains the upstream body while assigning the Gateway response model:

```ts
// apps/gateway/src/decisions/decisions.ts:326 in the cited read-only clone
? { ...upstream, model: responseModel }
```

These paths explain the public forwarding and response-normalization contract.
They do not identify the deployed revision or expose the model's interpretation process.
The [official Decisions guide][openai-guide] distinguishes choice probabilities from confidence
and recommends application-labeled examples for threshold selection.
The current cutoff is the user's adopted operating choice,
not an accuracy measurement.

## Verification

The [frozen experiment record][experiments] contains schedules,
request hashes,
durations,
and private artifact locations.
Every experiment preserves complete shared input,
question membership,
original criteria,
and the five-second deadline.
No represented tool operation executes.
The built maintained adapter validates model identity,
question identity,
complete distributions,
and independent confidence before comparison.

Working controls:

- The six-call baseline and explicit-rubric comparison returns complete valid answers without refusals.
- Replaying all six responses through the built adapter preserves all 504 distributions and confidence values.
- Partitioning the original questions into three groups of 28 returns every original answer.
  All three repetitions exactly match the baseline answer data.
- Repeating exact selected text beside its original JSON binding returns valid answers in every observation.
  All three repetitions have identical answer data.

Incomplete operating results:

- The baseline admits four answers at `0.80`.
- Explicit existing rubrics beside each question admit six;
  four absence estimates newly cross the cutoff and two formerly admitted estimates fall below it.
- Question batching admits four and reports 246,783 input tokens per complete assessment.
- Readable selected text admits eight and reports 178,834 input tokens per assessment.
  Its primary permission estimate is `0.82`,
  with independent confidence `0.78`.

Every format still has unresolved interpretation obligations.
The explicit-rubric and readable-text variants provide positive controls:
the comparison detects distribution changes when they occur.
Admission counts are not accuracy results.
The latency ranges overlap across observations and do not establish a speed improvement.

The original network namespaces are consumed and must not be rerun in place.
Local built-consumer verification needs no provider credential:

```sh
# Repository root; no external provider calls
mise run //package/pi-plugin/auto-mode:test:decision-wire
mise run //package/pi-plugin/auto-mode:test:semantic-operating-policy
```

Those commands verify the adapter and admission rule;
they do not reproduce provider distributions.
A new provider reproduction requires a fresh finite schedule retaining the complete frozen request.

## Verified workarounds

There is no verified workaround yielding complete native admission for this captured input.
The maintained lossless single-call adapter remains the selected implementation.
It preserves every original obligation and may withhold execution when estimates remain unresolved.
That behavior does not implicitly open an approval dialog.

## What does not work

Question batching supplies no answer change for this input and repeats shared-input tokens.
Repeating rubrics or readable selected text changes estimates but does not establish complete admission or accuracy.
Further representation-only trials on the same input are deferred in favor of source-boundary investigation
and the maintained native quality queue.
Removing received source material,
treating unknown as absence,
or weakening independent authority requirements would change the accepted policy.
None is an adopted remedy.

## Upstream filing decision

The repository's `.out-of-scope/` filenames were checked;
none names Luna or this Gateway Decisions behavior.
No upstream issue or comment is being sent.

1.  Upstream fault is unestablished:
    valid probabilistic output with unresolved application admission is not a demonstrated defect.
2.  Fixability is undetermined because no upstream cause has been identified.
    The source does expose the expected forwarding boundary.
3.  Typed shared-input questions are supported by the public Decisions schema and guide.
    Those documents do not promise this application's categorical certainty.
4.  The cloned `README.md` and `.github/ISSUE_TEMPLATE/` were inspected.
    No AI-report ban was found there;
    the README's new-provider contribution restriction is unrelated.
    No root `CONTRIBUTING.md` exists in this clone.
5.  `gh search issues --repo theopenco/llmgateway 'decisions confidence' --limit 30`
    and `gh search prs --repo theopenco/llmgateway 'decisions questions' --limit 30`
    returned no matches.
    That limited search supplies no maintainer position on this application.
6.  No upstream patch is proposed or prototyped because the upstream-fault gate fails.
    The measured consumer experiments remain local and unadopted.

Nothing to add upstream:
the available evidence supports an application investigation,
not a defect report or speculative provider patch.

[openai-guide]: https://developers.openai.com/api/docs/guides/decisions
[experiments]: ../planning/pi-auto-mode-gateway-decisions-current-contract.md
