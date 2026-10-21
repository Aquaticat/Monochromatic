# OpenRouter and the corpus passes: the rotation restarted on build 2a336603bf after the Gemma readers were lifted (2026-10-21)

What was read on 2026-10-21 of the first passes of the rotation after it restarted a second time,
on the build that lifted the Gemma picture readers.
One entry settled and its read is filed,
one settled and its read is running,
and one is running.
Entries:
zheermao22,
CuspariaKLSY22,
XingZ6017.

Part of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
which lists every file of this record.
The passes of the first restart (`zheermao21`,
`CuspariaKLSY21` and `XingZ6016`) are in
[the rotation restart overview](translation-repair-openrouter-2026-09-03-2026-10-21-rotation-restart.md).
The standing account of the readiness signal is [the readiness signal](translation-repair-readiness-signal.md).

## Where each pass is recorded

Each pass has its own file or files,
so that no file passes the repository's limit of 1,000 lines:

- `zheermao22`:
  [the run](translation-repair-openrouter-2026-09-03-2026-10-21-gemma-lift-restart-zheermao22-run.md)
  (log,
  NeuralWatt meter,
  seats,
  why the repair counts rose,
  whether the new rulings fired,
  the traces to code,
  the class verdict),
  [the letter](translation-repair-openrouter-2026-09-03-2026-10-21-gemma-lift-restart-zheermao22-letter.md)
  (the archive block review of the letter and the email,
  the shipped letter line by line)
  and [the page](translation-repair-openrouter-2026-09-03-2026-10-21-gemma-lift-restart-zheermao22-page.md)
  (the rest of the shipped page line by line,
  departures D01 to D30,
  the recurrence of earlier findings,
  the comparison with `zheermao21`).
- `CuspariaKLSY22`:
  settled;
  its read against the source is running and has no file here yet.
- `XingZ6017`:
  running;
  it has no file here yet.
- The causes of the findings of the first restart are in
  [the causes](translation-repair-openrouter-2026-09-03-2026-10-21-rotation-restart-causes.md);
  the `zheermao22` read checks its Findings 3,
  5,
  7,
  9 and 10 against this entry.

## The build

- Tip `2a336603bf38a6a53aeb4f3e70f0a3447acf5487`,
  pipeline `sha256-tree-v1:5d4265dfab83b5a6e61b5b8c23d597519c7ca24293065473c883ec82af54c78c`.
  The `START` line of `zheermao22` carries both as given,
  and so do the `tip` and `pipelineDigest` of its artifact.
- It is the merge that gate g148 landed on 2026-10-21 (UTC),
  as [the handover](../handover/translation-repair-handover-2026-09-06-neuralwatt-provider-2026-10-20.md#next) records.
  The launcher holds that digest as the rotation's frozen build.
- The corpus input is the pin `a41fc607ea` (`corpusSha` `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`).
- What changed against `3637592bd4`,
  the build of the first restart,
  as the read names it:
  - The Gemma picture readers were lifted:
    `gemma-4-26b-a4b-it` read all three photos of `zheermao22` and each photo was corroborated by 5 of 5 readers
    (4 of 4 on the first restart).
  - A KaTeX shim landed;
    no entry of this restart touches it so far.
  - The owner ruled that polished text wins ties
    and that a reason comes before the vote everywhere.
    Tied finalists are run off.
  - The archive block review fixes B712 to B715 are in this build
    (the read also lists B716,
    not exercised because no composite built).
    The first restart's overview lists them as missing from `3637592bd4`.
- The launch times:
  `zheermao22` 21:05:30 UTC (log from 21:05:44.369 to 22:24:46.483 UTC),
  `CuspariaKLSY22` 22:25:13 UTC,
  `XingZ6017` 23:05:12 UTC.
  The launch times come from the handover;
  the log times come from the read.

## The three outcomes

- `zheermao22` (entry `zheermao101`):
  SETTLED in 79.0 min of pass,
  `TALLY ... status=SETTLED slices=15 ... selection=contested ms=4741311`,
  38.3 min longer than `zheermao21`.
  The email and the opening quote recovered;
  Arts's letter regressed to the archive's text with ten lines changed.
  The read names three classes traced to code (K1 to K3),
  one design class (K4) and two items it could not trace (U1 and U2).
  30 departures were listed.
- `CuspariaKLSY22` (entry `CuspariaKLSY`):
  SETTLED (`slices=4`,
  `repairChanged=4`,
  `alignmentFindings=1`) after 2355731 ms (39.3 min),
  as the handover records.
  Its read is running.
- `XingZ6017` (entry `XingZ60`):
  running.
  It is the first `XingZ60` run since the Gemma readers were lifted;
  `XingZ6016` stopped INCOMPLETE on its one picture on the first restart.

## What the settled run shows about the build

From the `zheermao22` read:

- The NeuralWatt baseline was taken once,
  on the first attempt,
  in the plain wording
  (`NeuralWatt quota at the start of the run: 3.712 kWh charged this period`),
  and all 58 `stream quota:` lines read `completed`,
  so the 60 s retry rule never had a failure to act on.
  No stop line fired,
  and the closing line reads that no plan energy was spent.
- The run began 1 h 50 min into a NeuralWatt day that started at 19:15:08.000 UTC,
  so it ran on a fresh allowance of 550 Wh;
  the meter stood at 509.607 Wh at its last reading,
  and computes to near 509.09 Wh at the end.
- Measured NeuralWatt energy was 40.9099 Wh over 190 calls against an estimate of 29.4515 Wh,
  1.39 times.
  Four calls that ran to the 18,316-token cap with no content took 12.0174 Wh,
  29 percent of it.
- The 13 meter readings whose meter and account disagree each differ by the estimate of one call in flight
  (the causes document's Finding 9 explains it).
- Hyper stayed wet all run and Synthetic stayed wet to 22:14:48.707 UTC (69.1 of 79.0 min),
  so the full panel of nine writers and judges was seated and heard.
  That is the main reason the run took 38.3 min longer:
  rounds that waited 100 s or more of straggler grace rose from 7 to 30.
- `threw=0` on all 12 `SEAT` lines and no `[error]` line.
  Bedrock's key was still expired (HTTP 401) and its meter read 5.02 USD.
- No quorum closed short:
  all 14 introduced-defect probe rounds read `3/3 heard`.
- Of the rulings since `zheermao21`:
  reason before vote fired on every provider except Hyper,
  whose replies carry their keys in alphabetical order (untraced,
  U1);
  polished text wins ties was not exercised,
  because no polish gate tied;
  tied finalists were run off in three places;
  the Gemma lift fired;
  the KaTeX shim could not be exercised on this entry.
- The B712 composite was attempted three times and built nothing (23 against 24 lines,
  an overlap,
  34 against 36 lines).

## Where the read agrees and differs with the handover

[The handover](../handover/translation-repair-handover-2026-09-06-neuralwatt-provider-2026-10-20.md#next) states the outcome and the classes of `zheermao22` in short.
The read agrees with it on the launch time,
the 79.0 min,
the 7 to 30 rise in long-grace rounds,
the four capped calls and three capped Hyper re-asks of K1,
the eleven `inception/mercury-2.5` streams of K2,
slice 8's 因着 claim of K3,
the line-count rule of K4,
and the two untraced items.

Differences found:

- K2's comment line.
  The handover says an SSE comment line resets the idle timer.
  The read infers it:
  the log holds counts and not bytes,
  all 11 raw-character counts are multiples of 25 (the length of `: OPENROUTER PROCESSING` plus two newlines),
  and a probe of the bytes was not run.
- K1's owner lift.
  The handover and the read's open item say the owner's lift of the reasoning parameter covers text calls.
  The read's trace says the client's header comment (`neuralwatt-client.ts:66` to `73`) applies the lift to pictures
  and says "no reasoning parameter on a text call".
  Whether `deepseek-v4.1-flash` accepts the parameter was not read.
- The re-seat line of the first restart.
  The `chunk re-seated under a hold` line printed 0 times here against 23 in `zheermao21`;
  the read ties the count to when Synthetic went dry (during consolidation here)
  and closes that item of the first restart.

## What is not yet known

- The reads of `CuspariaKLSY22` and `XingZ6017` are not filed.
- U1:
  why Hyper returns tool input with its keys in alphabetical order,
  so that the reason-before-vote ruling cannot be confirmed on Hyper without a keyed probe.
- U2:
  why the boundary between slices 1 and 2 moved against `zheermao21`
  (`chunk-document.ts` is not among the files changed between the two builds).
- That the seating of the archive block review moved because a sheet edit moved the rotated window
  is an inference from a code comment;
  the rotation was not run.
- One sample of each page cannot separate a regression from run to run spread,
  and the read did not measure that spread.

## What follows

From [the handover](../handover/translation-repair-handover-2026-09-06-neuralwatt-provider-2026-10-20.md#next):

- K1,
  K2,
  K3 and the run-off line that says "2 tied finalists" for what was a plurality (`translate-runoff.ts:90`)
  are fixed in one scratch worktree,
  and K4 in a second.
  Each is gated and landed,
  then the branch worktree is rebuilt once no pass runs there,
  its digest taken and its rotation sweep run,
  and the rotation restarts at `zheermao23`.
- Meanwhile the rotation continues on `2a336603bf` for evidence:
  the read of `CuspariaKLSY22` is finished,
  `XingZ6017` is read when it ends,
  and then the rotation continues with `yingying`,
  `hulicaijia`,
  `mikaela_khara`,
  `shi_Yumiaoya` and `TianqiChen666`.
