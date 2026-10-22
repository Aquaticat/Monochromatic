# Audit ledger: providers and seats a run holds out

A provider an owner ruling keeps off,
a seat the tally never withheld although its streams carried nothing,
and a meter line that read a held provider differently from the router.

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
