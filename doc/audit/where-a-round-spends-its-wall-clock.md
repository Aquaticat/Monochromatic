# Where a round spends its wall clock

Measured 2026-08-25 against the second editor calibration while it was still running,
at 52 rounds of an expected 250 or so.
Every number here is provisional and must be re-read when the run finishes.
The shape is already unambiguous, and it points somewhere different from where `#213` was looking.

Read with `run-timing-report`, which `#215` added and which had never been run on a live log:

```text
run-timing-report: 1 logs, 1997 lines
rounds                 51, 1.63h in total
  waiting after quorum 1.44h, 88.3% of round time
  voices never heard   15
calls in flight        mean 2.56, peak 10
  busy against span    4.22h of calls across 1.65h of run
```

## The two numbers that decide it

ROUNDS DO NOT OVERLAP.
Round time sums to 1.63 hours inside a run spanning 1.65 hours.
Nothing else is happening while a round waits.

A ROUND SPENDS 88.3% OF ITS LIFE PAST QUORUM.
Ten voices are dispatched together, which the peak of 10 in flight confirms.
Most arrive quickly, quorum is reached, and then the round waits a median of 99 seconds
for the last one or two.
Mean calls in flight is 2.56 because that is what the round looks like most of the time:
eight seats finished, two still running, nothing else queued.

## So fan-out inside a round is not the lever

`#213` opened on eleven `no-await-in-loop` disables resting on a premise about per-model
concurrency, and asked whether removing the serialization would speed the pipeline up.

For the stage round itself the answer is no, and the reason is that the serialization
was never there: a round already dispatches all ten seats at once.
Raising per-model concurrency cannot help a round that is waiting on one model's single call.

The lever is between INDEPENDENT UNITS OF WORK, so that one unit's straggler wait is
another unit's dispatch window.
That is the same site `#213` had already singled out as having a clean argument,
`editor-ensemble.ts:248`, on grounds that survive this measurement:
envelopes within a slice are independent, nothing in the loop reads back what an earlier
envelope decided, and `Promise.all` preserves order, so folding the outcomes in index
order afterwards gives byte-identical output.
It is a pure latency change with no quality risk, which under a max-quality guideline is
the only kind worth taking.

## The straggler window is close to right, and shortening it is expensive

`#214` asked whether 180 seconds is too generous.
Measured against what each shorter window would newly have cost, counting only rounds
that did hear everyone, since a round already at the wall loses nothing extra:

```text
  window   rounds that would newly lose a voice, of 52
     15s   40
     30s   38
     45s   32
     60s   27
     90s   18
    120s   12
    150s    4
    180s    0
```

Grace spent per round: min 10.9s, p25 53.2s, median 98.8s, p75 151.0s, p90 180.0s.
No round finished within five seconds of quorum.
There is no fast mode to cut back to.
Ten of 52 rounds spent the whole window and still lost a voice.

So the window is not waste to be reclaimed.
It is the price of hearing every seat, and the distribution says the price is real.

## The cost is concentrated in two models

Mean whole-call latency over completed streams, all ten seats:

```text
   68286ms  qwen3.8-max                                        n=48  max 186808ms
   61518ms  hf:zai-org/GLM-5.2                                 n=48  max 185281ms
   39712ms  deepseek-v4-flash-0731                             n=53  max  83782ms
   38472ms  hf:Qwen/Qwen3.8-27B                                n=53  max 163304ms
   14982ms  minimax-m3                                         n=53  max  53809ms
   13900ms  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4  n=53  max  76187ms
   12172ms  hf:moonshotai/Kimi-K3                              n=53  max  53964ms
   11379ms  gemma-4-26b-a4b-it                                 n=52  max 135918ms
    5202ms  deepseek-v4-pro-0813                               n=53  max 117479ms
    4190ms  hf:openai/gpt-oss-120b                             n=53  max  10526ms
```

A sixteenfold spread from fastest mean to slowest.
Ten stream cuts in the whole log, and nine of them are the top two:
five `hf:zai-org/GLM-5.2`, four `qwen3.8-max`, one `gemma-4-26b-a4b-it`.

Fifteen voices were never heard against ten cuts, so five went missing some other way
than the stream being cut. Recounted at 54 rounds the numbers are 16 and 11,
and the gap of five closes exactly against the warning lines:

-   3 `MalformedCompletionError` on `panel gemma-4-26b-a4b-it`, a body that failed the
    protocol contract rather than a stream that ran out of time.
-   2 schema mismatches at `critic`: one on `qwen3.8-max` where the content was not valid
    JSON, one on `gemma-4-26b-a4b-it` where it parsed and failed the caller's guard.

So a voice is lost three ways, not one, and only the first is what the window governs.
Shortening the window does nothing about the other two.

### The gap also exposed a diagnostic that named the wrong provider

The `gemma-4-26b-a4b-it` warning read
`MalformedCompletionError: Synthetic completion body violated the OpenAI-compatible contract`,
and every one of that model's 51 billed calls in this run went to Charm Hyper.

The log could not settle it alone, since a failed call bills no `SPEND` line,
so the deciding source was read instead:
`hyper-client.ts` imports `SyntheticHttpError` from `completion-shape.ts`
and documents throwing `MalformedCompletionError`.
Both providers throw both classes, and both messages named one of them.

`hyper-client.ts` already records why it reuses the class and that the rename is held
with the `SyntheticClient` rename, so nothing was renamed.
That note covers the NAME, read by whoever edits the file.
The MESSAGE is read by whoever is holding a broken run, and is now provider-neutral,
with the two meter endpoints naming their own provider through the `summary` seam
that already existed for it. Fixed in `4af3068fa`.

### The first of those two is a defect, not weather (`#228`)

Recounted at 768 streams the classes stand at 13 cuts, 4 `MalformedCompletionError`
and 2 `SyntaxError`, still `panel gemma-4-26b-a4b-it` every time.

The message says `anthropic stream ended without message_stop`,
which is a stream the provider truncated, arriving as HTTP 200.
Both clients extracted the completion AFTER `exchangeWithRetry` returned,
and 200 is not a retryable status, so the ladder handed the reply straight back
and extraction threw with nothing left that could re-dispatch it.
Every other transport failure carries a status the ladder recognises;
this one wore a success status, which is why it was invisible.

Fixed in `38a5178d7` by running the terminator check inside `attemptExchange`'s own try,
so a truncated body lands in the same catch, behind the same `isSelfEndedStream` predicate,
as a dropped connection. `doc/handover/translation-repair.md` carries the measurement.

So of the three ways a voice is lost, the window governs one, the second was a defect
and is now retried, and the third, a critic answer that fails its schema, is still open.

## What `#211` actually bought

The earlier reading in `doc/audit/every-volume-guard-is-blind-to-one-model.md`
had 34 voices cut over 29 straggler events, 21 of the 34 `qwen3.8-max`, in a 3.73 hour run.
`#213` said to land `#211` first because it might remove most of the straggler cost by itself.

It did not, and it did help.
`qwen3.8-max` falls from 21 of 34 cuts to 4 of 10.
It is no longer the whole story; `hf:zai-org/GLM-5.2` is now the larger share.

## Two measurement traps this walked into

BOTH ARE THE SAME TRAP, a pattern that matched less than it appeared to.

A first pass counted stream outcomes with `stream [^:]+:`, which cannot cross the colon
in `hf:zai-org/GLM-5.2`, so every Hyper-side seat was silently excluded.
It reported five cuts across five models rather than ten across ten,
and the missing half was exactly the half carrying the most cuts.
The tell was arithmetic that did not close: rounds reported ten seats and the model
table listed five.

A first pass at grace also grepped `[0-9]+ ms in grace`, with a space.
The emitter writes `30001ms in grace`, so nothing matched, and the surrounding
`round` grep instead matched judges' prose containing the word.
Anchoring on the emitter's own template rather than on remembered wording fixed it.

## The zero-content count is zero, and the probe was proven able to see one

`#221` was opened to recount zero-content streams, with `deepseek-v4-pro-0813` at
36 of 356 completed streams as the number to beat,
and an expectation that `qwen3.8-max` would stay high as an accounting artifact:
it is the sole `toolChoice: 'auto'` seat, and an answer arriving as tool-call arguments
is not counted by `generatedChars.content`.

Both halves are refuted on this workload.
Across 527 model streams, ZERO have no content.
The minimum is 3 characters, p10 is 42, the median is 350.

POSITIVE CONTROL FIRST, because a null from an unvalidated probe means nothing.
The same probe, run without the filter that drops the two meter endpoints,
reports `quotas` at 47 of 47 zero and `credits` at 47 of 47 zero,
which is correct: they are not model calls and produce no content.
So the probe can see a zero. There are none among the seats.

Content against reasoning, which is where the old count was going wrong:

```text
  deepseek-v4-flash-0731                             content  443   reasoning     0   on  0 of 54
  gemma-4-26b-a4b-it                                 content  429   reasoning     0   on  0 of 53
  deepseek-v4-pro-0813                               content  436   reasoning   708   on  3 of 54
  hf:openai/gpt-oss-120b                             content  302   reasoning  2827   on 54 of 54
  hf:moonshotai/Kimi-K3                              content  440   reasoning  1867   on 54 of 54
  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4  content  397   reasoning  7822   on 54 of 54
  minimax-m3                                         content  490   reasoning  7996   on 54 of 54
  hf:zai-org/GLM-5.2                                 content  472   reasoning  9222   on 48 of 49
  qwen3.8-max                                        content  320   reasoning 10948   on 48 of 48
  hf:Qwen/Qwen3.8-27B                                content  411   reasoning 14419   on 54 of 54
```

`deepseek-v4-pro-0813`, the model that was 36 of 356, is the one that now emits a
reasoning channel on 3 calls out of 54.
That is consistent with `#211`: a ballot filed as reasoning leaves the content counter
at zero while the model in fact answered.
`qwen3.8-max` answers on the content channel every time despite being the `auto` seat,
so the predicted accounting artifact is not present here either.

WHAT THIS DOES NOT SHOW. One workload. An editor calibration asks for short ballots,
median 350 content characters, where a corpus pass asks for whole slices and runs
stages this calibration never touches.
A clean count here is not a clean count for the pass.

## What is still owed

-   Re-run every number here when the calibration finishes, at roughly five times the rounds.
-   Prototype the `editor-ensemble.ts` change and measure it, rather than reasoning about it.
-   Recount zero content on a corpus pass, which asks for whole slices
    rather than short ballots and runs stages this calibration never touches.
-   Recount the three loss classes on a run built after `38a5178d7`.
    The truncation class should fall to whatever survives four retries,
    and any residue is a different defect than the one just fixed.

## A lost voice is a model still thinking, and two volume hypotheses died on the way there

Measured 2026-08-25 at 947 completed streams and 19 cut ones, same run.

18 OF THE 19 CUT STREAMS HAD PRODUCED ZERO CONTENT CHARACTERS.
The one exception had 301.
So at the moment the window closed, the model had not begun its answer;
it was still in the reasoning channel.
Waiting longer would not have salvaged a partial answer, because there was no answer yet.

That refines what `#214` measured rather than contradicting it.
Shortening the window costs voices because the window is buying THINKING TIME,
not answer time.

### Two hypotheses this refuted first, both mine

VOLUME RUNAWAY. The abandon line reads `cut-mid-reply after 306685 delivered chars`,
which looks like a model that would not stop.
It is not: `partialText.length` counts RAW WIRE characters, frames and JSON envelopes
included, and a completed stream's median is 49595 with a maximum of 3627449.
Every cut stream is smaller than the largest completed one.
Raw volume does not separate the two populations at all.

A REASONING BOUND. If cut streams were thinking runaways, a bound would catch them:

```text
  cut streams        reasoning  median  30984   max  41953   n=19
  completed streams  reasoning  p99     35113   max  60674   n=947
```

The distributions overlap almost entirely.
A bound low enough to catch the cut ones kills more than one percent of completed streams,
and a bound high enough to be safe catches none of them.
So `#156`'s decision to decline a reasoning bound is CONFIRMED by this workload
rather than overturned.

### A recorded prediction that did not hold

`doc/handover/translation-repair.md` records `#211` predicting that post-fix bytes would
meet `contentCap`, cutting a runaway at roughly 32000 rather than 300000,
and it says in the same breath to record the outcome rather than the prediction.

The outcome: `qwen3.8-max` is still abandoned after 283620 to 345064 raw characters,
the same tight cluster as before the fix.
The reason is legible in the source rather than the log.
`maxAnswerChars` is passed by `translate-produce.ts` and `translate-repair.ts` and by nobody
else, so `contentCap` is undefined for every judging stage,
and the 32000 bound `#156` set has never applied to a panel, editor, critic or select call.

### Where that points

Neither request builder sends any reasoning control.
Searching `src` for `thinking`, `reasoning_effort`, `reasoningEffort` and `budget_tokens`
returns scanners and comments only.
This pipeline has never asked a model to think less.

Filed as `#229`, with the provider research owed first,
and with the measurement that decides it named in advance:
ballot agreement with and without a budget on the same slices.
Those seats contribute nothing today, so the comparison is a possibly shallower vote
against no vote at all, but that is a thing to measure rather than to assume.
