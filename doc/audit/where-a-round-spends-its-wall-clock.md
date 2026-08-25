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
than the stream being cut. That gap is not yet explained and is worth a look.

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
-   Explain the five voices that went unheard without a stream cut.
-   Prototype the `editor-ensemble.ts` change and measure it, rather than reasoning about it.
-   Recount zero content on a corpus pass, which asks for whole slices
    rather than short ballots and runs stages this calibration never touches.
