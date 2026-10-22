# Audit ledger: providers and seats a run holds out

A provider an owner ruling keeps off,
a seat the tally never withheld although its streams carried nothing,
a meter line that read a held provider differently from the router,
and a model an owner answer took off the late-judge bench.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.
## B760: the owner's ruling to leave Bedrock off was held only as prose, so every run still asked it

Status:
fixed on 2026-10-21 (UTC).
Red `d162a9e9c3`,
fixed in `402f95801e`.

The ruling of 2026-10-20,
"Leave Bedrock off",
stood in the handover only.
Every run still held the expired Bedrock key,
asked once,
was refused (HTTP 401,
`SEAT CREDENTIAL REFUSED google.gemma-4-e2b on bedrock`,
CuspariaKLSY22 log lines 214 and 215)
and only then held the provider out.
The brief for the fix said an existing mechanism turned a provider off.
Read in the source,
none did:
what exists is the unset key,
since a provider with no key has no caller and is never routed to,
and `UNCONFIGURED_METER` reads dry.

Decided:
the ruling becomes data the run reads,
and the unset-key path carries it.
`run/src/corpus-run/providers-off.ts` lists `PROVIDERS_LEFT_OFF` with a provider and the reason for each,
and `configureProviders` (`run/src/corpus-run/run-providers.ts`) takes it as `off` and withholds that provider's key.
The Bedrock client is not deleted;
turning Bedrock on again is removing its entry from the list.
The launch of a corpus pass prints `PROVIDER OFF bedrock: <reason>` after the required-provider lines
(`corpus-pass/src/corpus-run/corpus-pass-lines.ts`),
and `--require-providers bedrock` is refused with the reason "left off" before any key is looked at.

What changed in the run:
no Bedrock exchange is made even when the key is set;
`google.gemma-4-e2b`,
which only Bedrock serves,
is refused as unreachable (`NoProviderForModelError`)
and is named unserved from the first `JUDGE SEATS` line,
where CuspariaKLSY22 read Bedrock wet once.

Red cases:
`run-client-bedrock-off.unit.test.ts` (no Bedrock exchange with the key set;
dry from the first reading),
the required-providers case "REFUSES BEDROCK WHILE IT IS LEFT OFF"
and the launch-line cases of `corpus-pass-lines.unit.test.ts`.
`providers-off.unit.test.ts` pins the list itself.

Not changed:
`budget-sample-keys.ts` and the meter sampler (`budget-sample-run.ts`) still build the Bedrock client
for a read of its local spend ledger;
no request leaves the machine,
so the run does not ask Bedrock anything.

Open to the owner's veto:
whether `google.gemma-4-e2b` stays in the benches as an unserved seat
(it does,
by the short-bench rule of 2026-09-09).

The rule for next time:
an owner ruling that changes what a run does is written as data the run reads and prints at launch,
and the handover keeps the reason.
Recurrence:
`mistake-prevention-inputs-defaults-and-values-read-from-text.md`,
"Rulings held as prose".

Cache account:
no sheet or schema changed,
so no cache version moved.


## B761: a call the round cut that had delivered nothing counted for its seat as no ask at all

Found in the read of CuspariaKLSY22 and zheermao22 for the round `w265`.
It narrows B687.

Status:
fixed on 2026-10-21 (UTC).
Red `2f0116657a` (stage and provider-stream),
fixed in `5473f03750`.

What the logs hold:
B687 counted a call that the round cut after quorum (`runGatherRound` aborts the straggler's signal)
under `abandoned`,
which adds to neither `asked` nor `threw`,
so a seat could never be withheld for slow calls.
That protection is right for a reasoning model caught mid-thought,
and wrong for a stream that never carried any model text.
`inception/mercury-2.5` left 33 streams in CuspariaKLSY22 and 11 in zheermao22 that read
`0 content chars, 0 reasoning chars` while the raw count grew with the wait
(7,450 raw characters at 125 s,
first byte at 703 ms):
framing and no text.
The 33 waited 123 to 179 s each,
4,634 s in all,
and the 11 waited 128 to 219 s each,
1,698 s in all.
The same two logs hold 12 cuts of slow reasoners (Qwen3.8-27B 10,
GLM-5.3-Flash 1,
Kimi-K3 1) that had delivered 25,400 to 69,336 reasoning characters and no answer yet.
The first kind is a dead stream and the second a working one,
and only the first may count against a seat.

Measured threshold,
by `abandon-census.ts` in the round's scratch directory,
a read of every `reportStreamProgress` line in the two logs:
- CuspariaKLSY22:
  mercury 36 completed and 33 silent,
  longest run of silent cuts 9,
  and a completed answer followed after a run of every length from 1 to 9.
- zheermao22:
  mercury 108 completed and 11 silent,
  longest run 3.
- No other seat has a silent cut in either log;
  every other seat's cuts that delivered reasoning are not counted.

Decided:
a silent cut counts as a failed ask when the seat has been asked at least `SEAT_WITHHOLD_ASKS` (4) times
and every ask failed (threw or ended silent).
A seat with one answer in its census is never withheld,
so mercury is withheld in neither log,
and any threshold on a run of consecutive silent cuts below 10 would have withheld a seat that went on to answer
(its longest run was 9 and it answered afterwards).
The threshold is therefore the one the code already had for a thrown call,
and not a new number.
A call that delivered content or reasoning stays out of the count,
and so does a cut that the round did not make
(a caller's own stop is still `abandoned`).

Mechanism:
the round aborts a straggler with a `StragglerCutError` (`stage/src/straggler-cut.ts`),
so the tally tells a cut by the round from a cut by the caller by the abort reason and not by the fact of an abort.
`deliveredNoContent` (`provider-stream/src/abandon-silence.ts`) is true for a `StreamCutShortError`
whose answer and reasoning counts are both zero,
or,
without a count,
whose first byte never arrived (`firstByteMs` below zero);
it is false for every other error.
`seatTallyClient` records `silent` for such a cut:
it adds to `asked` and to `silent`,
and `withheld` reads `threw` plus `silent` against `asked`.
The `SEAT` line gains `silent=N`,
the dark line appends `, silent N` when N is more than zero,
and the refusal of a withheld seat says `after all N asks failed (X threw, Y ended with nothing delivered)`.

Red cases:
`seat-tally-silent.unit.test.ts` (tally,
wrapped client and a `runGatherRound` reason case)
and `abandon-silence.unit.test.ts`,
both failing on the missing export and on the old count.

Not recovered:
the wait itself.
A silent stream still holds the round for the grace window before the cut,
and an interleaving seat like mercury that answers some asks is not shortened by this change.
Cutting a stream that has sent no model text sooner belongs to the idle and first-byte guard of the stream layer.

The rule for next time:
an abort is classified by its cause and by what the call had delivered,
and a threshold for a count is chosen on the seats that later answered.
Recurrence:
`mistake-prevention-sheets-quorums-and-outcome-rules.md`,
"Which seats a quorum counts".

Cache account:
no sheet or schema changed,
so no cache version moved.

## B763: the METERS line and the JUDGE SEATS line read a held provider two ways

Status:
fixed on 2026-10-21 (UTC).
Red `ac43cd02e0`,
fixed in `3542f6650c`.

CuspariaKLSY22 printed `bedrock=wet` on all 27 of its `METERS` lines
while its `JUDGE SEATS` lines read `bedrock=dry` from the second on.
The key was refused on the first call and the router held the provider out for the rest of the run,
but `readStates` printed what the meter said,
and the `METERS` line is the only record of when a provider was available.
Three things keep a provider out of routing beyond its meter:
a refused credential,
a timed hold after a refusal
and a refusal for payment.
The routed view applied all three and the printed line none.

Fixed:
`createProviderBudgets` takes `heldOut`,
which defaults to nothing held,
and a provider prints as `dry` when it is held out,
has hold time left or is paid out.
`configureProviders` hands it the credential holds,
and returns them so that `runClientFrom` shares one set with the router.
The state the refusal logic reads (`read()`) and the routed view are unchanged,
so no decision moved:
only the line.

Red cases:
`provider-budget-held-meters.unit.test.ts`,
one for each of the three holds
(the timed hold is shown dry and then wet again once it lapses),
and `run-providers-held.unit.test.ts`,
which holds Bedrock through the run's credential holds and expects `bedrock=dry` on the line.

Consequence:
after B760 Bedrock reads dry from the first line for its own reason,
and the same reading now holds for a key refused later.

The rule for next time:
two readers of one fact take it from one place;
a printed state that skips a layer the router applies is a second source.
Recurrence:
`mistake-prevention-messages-labels-and-counts.md`,
"Two readers of one fact".

Cache account:
none.

## B815: Qwen3.8-27B sat on the lane contest and consolidation benches, and the grace cut 40 of its 95 streams

Status:
fixed on 2026-10-22 (UTC) in `tr-w277`,
on the owner's answer "Remove from both benches",
red `99eca0e2af`,
fix `9639e19d85`,
reseat test follow-on `89067fb49a` (M287).
Cache versions:
the consolidate (31) and lane-contest (15) keys hash the judges' ids,
so the bench change rides inside both numbers,
which then moved to 32 and 16 with B816.
The reading of "both benches" is open to the owner's veto.

The question and the evidence put to the owner:
B810 (`audit-ledger-provider-streams-usage-and-retries.md`) ended by asking
whether `hf:Qwen/Qwen3.8-27B` should sit on the consolidation and late-judge benches at all while Synthetic serves it.
In `XingZ6017`,
served by Synthetic,
40 of its 95 streams were cut after the grace with no answer,
and the mean consolidation slice cost rose from 149 s to 315 s and 346 s while it was seated.
On `Carena0442`,
when Hyper served it,
17 of 19 lane-contest rounds and 7 of 14 consolidation-gate rounds cut it
(TSDoc of `LATE_JUDGE_DROPPED`,
`run-config.ts`).

The reading recorded:
"both benches" is the lane-contest bench and the consolidation bench,
which are seated from one list,
the late judges (`RUN_LATE_JUDGES`,
filtered by `judgeSeatsFor` in `run-seats.ts`;
the consolidation slate's judges are taken from it).
Qwen keeps its wide seats
(the critic,
the panel and the judges of both lanes),
where `run-seats.ts` still seats it per provider
and `HYPER_SLOW_JUDGES` still withholds it where Hyper would serve it.
The wider reading,
"remove it from every judge seat",
was not taken,
because the question the answer followed named two benches.

What changed:
the `hf:Qwen/Qwen3.8-27B` card in `shared-contract/src/model-cards.ts` holds `late-judge-dropped` beside
`openrouter-dropped`,
and `LATE_JUDGE_DROPPED` in `run-config.ts` reads that hold,
so `RUN_LATE_JUDGES` is seven whichever provider is wet
(it was eight with Synthetic wet and seven with it dry).
The `JUDGE SEATS` line reads `late=7 slate=7` with every provider wet,
where it read `late=8 slate=8`.
The hold is on the card and not in `run-seats.ts`,
so the seat stays off the bench when Synthetic goes dry and when only OpenRouter is left.

Red and green:
`run-seats.unit.test.ts` now expects the late judges without Qwen while the wide and select seats keep it
(the case for OpenRouter alone),
and `run-seats-read.unit.test.ts` expects the new counts in the `JUDGE SEATS` line.
The red commit fails against the card,
which held only `openrouter-dropped`.
The run package's tests were run on the fix commit;
the corpus-pass package's were not,
which is the follow-on.

The follow-on:
`pass-seams-reseat.unit.test.ts` in the corpus-pass package failed at load after the fix commit,
because its fixture guard found that a Synthetic dry-out no longer takes a late judge.
Of the 31 views with at least one provider dry,
4 take a late judge (`hf:moonshotai/Kimi-K3`):
Synthetic and Hyper dry with OpenRouter wet,
with any of NeuralWatt and Bedrock.
`89067fb49a` moved the contest and consolidation reseat cases to that view.
The process mistake is M287.

Not verified:
B810 does not split the 95 streams by bench,
so how many of the 40 cuts fell on the two benches left is not known from the record.
No run has gathered since the change,
so the round time it saves is not measured.

Open to the owner's veto:
the reading of "both benches",
and with it whether the wide seats keep Qwen.

## B826: the writing-bench floor stopped an entry for want of a named return, though NeuralWatt's return was 48 s away

Status:
open,
found by the lead's read of `XingZ6019` on 2026-10-22 (UTC) (the brief's E2).
A fix is in progress in the briefs the lead labelled D4 and E2 and has not landed;
this entry records no design for it.
The D4 of those briefs is the model-level dryness work of B822,
not the D4 candidate of the `XingZ6018` read.

What the run showed:
`XingZ6019` was launched at 18:54 UTC on the frozen build `sha256-tree-v1:44ce3051...` (commit `1d46232457`),
entry `XingZ60`,
and ended `DONE processed=0`,
`artifacts=0/1` at 19:14:20 UTC after 19.2 min.
The `JUDGE SEATS` lines counted editors 1 of 3 and refiners 1 of 3 reachable against a floor of 2,
`TALLY` printed `status=ERROR` twice,
and the entry was `STALLED` with 16 cache records.
NeuralWatt was dry for the whole run,
because its 550 Wh day had been spent by the earlier runs.
That is not a defect:
the owner ruled on 2026-10-22 that launches need not be aligned to NeuralWatt's day.
The editors were `hf:zai-org/GLM-5.3-Flash` (served by NeuralWatt only),
`glm-5.3` (Hyper,
whose balance was empty)
and `deepseek-v4.1-flash` (called directly,
wet),
so one editor was reachable.
`xiaomi/mimo-v2.6-flash` is a checker only (measured) and was never reached.

The defect:
NeuralWatt's dryness has a known return.
The run decides the account's day anchor at its start,
and the next day began at 19:15:08 UTC,
48 s after the stop.
The seat reader logged `no provider has named its return`,
and the floor stopped the entry instead of waiting those 48 s.
The owner's ruling of 2026-09-08 stops an entry only when a writing bench has no reachable seat
"and no provider has named its return" (`doc/decision/translation-repair-writing-bench-floor.md`),
so a return the run itself holds belongs on the waiting side of the ruling.

The cause,
read from the source at the branch tip and not run:
`readDrynessPastShortBench` (`run/src/corpus-run/run-seats-read.ts`) waits only for the shortest of
`client.providerHolds()`,
the holds a provider's refusal set,
and when that is zero with a writing bench below `WRITING_BENCH_FLOOR` in a phase that stops,
it logs `writing bench unreachable ... stopping the entry`
and raises the refusal (`writtenRefusal`).
A provider dry by its meter alone,
NeuralWatt among them,
has no entry in the holds,
although the budgets can state NeuralWatt's return (`neuralwattReturn`,
which B819 added for the refusal's text).
The build of `XingZ6019` predates B818 to B820,
which are not among its ancestors,
and the source was read at the branch tip `b18a4f7a40`,
which holds them.

What is left:
the fix,
its red case (a writing bench below the floor with NeuralWatt dry and its return known waits for the return),
and the prevention rule,
which are owed when the fix lands.
Cache versions:
not known until the fix lands.

Recurrence:
the thirteenth and fifteenth classes of the defect-class history (the hold wait and the writing-bench floor),
and B819 (a NeuralWatt time the router knew and a text did not state).
