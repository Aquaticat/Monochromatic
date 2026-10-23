# Audit ledger: probes that read one editor card

A card the editor calibration could not bench,
the seats that flag leaves unconfined,
a relative share that moves with the run,
and the probe that reads one card's edit against a known fix.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B870: the editor calibration had no flag naming a card, so an unmeasured card could not be benched as an editor

Status:
fixed on 2026-10-23 (UTC),
found by the lead's brief for the effort-level bench of the Sonnet 5.5 cards.
Red `005b05672c8cd8e4649737834b555a0a104a6d9c`,
fixed in `f5e3745d6c8b4be784f0ec0e6a80e6819e7d028c`.

`editor-calibrate` seated the editor chair from the measured roster,
and the Sonnet effort cards carry `judge-unmeasured`,
so no command line could seat one of them as an editor.
The fix gives the command the `--candidates` and `--candidates-alone` flags the judge fidelity probe reads,
with the same readers and the same refusal wording
(`probe/src/corpus-run/probe-candidates.ts`).

No cache version moves:
the editor roster is key material of the slice key (`repair/src/repair-slice-key.ts`),
so a card arm has a different key by content,
and the calibration reads no payload cache.

## B871: `--candidates-alone` on the editor calibration confines only the editor chair

Status:
found on 2026-10-23 (UTC) while reading the fix of B870,
documented in `f5e3745d6c8b4be784f0ec0e6a80e6819e7d028c`,
not changed.

The critics,
the panel and the judges of a calibration arm stay the whole roster,
so every arm needs every provider's key and calls every provider.
The flag means "the editors are these cards",
not "nothing else is asked".
The bench package README says so beside the flag ("the flag confines the editing and not the spend").

## B872: a lone editor's slate ships unjudged, so a calibration with `--candidates-alone` has no ballots

Status:
found on 2026-10-23 (UTC),
the run does not refuse,
and the bench package README states it.

With one editor seated there is one candidate,
and the stage ships it without asking a judge.
The per-model vote share the calibration reports has nothing to count,
so the alone mode reads edits but not votes.
`EDITORS SHIPPED` is the only reading in that mode.

## B873: the usage assertion of the editor calibration's test moved with the flag declaration

Status:
fixed on 2026-10-23 (UTC) in `decd0d0836057e51e594965ae15c87c1d43a3359`.

The existing `editor-calibrate.unit.test.ts` compared the usage text to a string the declaration no longer produced.
The case now names the new flags.
The failure was found by the package's own `test:unit`,
and no behaviour changed.

## B874: the editor calibration gives a relative share that moves too far between identical runs to separate effort levels

Status:
recorded on 2026-10-23 (UTC),
no code changed,
so no later round benches an effort level on it.

The calibration reads a card's disinterested vote share against the writers seated beside it.
That is a relative reading with no ceiling.
The bench package records how far it moves:
the TSDoc of `sliceStandingLines` in `bench/src/corpus-run/editor-calibrate-standing.ts` states that
a four-slice standing moved one model from 52.2 to 26.7 to 10.0 percent across identical runs.
Critics are asked fresh in each run,
so the accepted issues differ between arms.
Every arm also calls every provider (B871),
so a bench of one card at three effort levels costs the whole roster three times and still cannot tell the levels apart.

Decided by the lead:
keep the flags of B870,
and measure an editor card with the absolute probe of B875.

## B875: no instrument read one editor card's edit against a known fix

Status:
fixed on 2026-10-23 (UTC).
Red `246f55480b4b2c6a10b46549a6d8d151a41ee15f`,
`00cb16908aaada55b9f01a26cf6ea332637a190c`;
fixed in `7e94b96fa3161d18361dd1b0df8970830f4a5e11`,
`0f2b490642a33a9d35a74a67f18957585d795251`.

The new command `editor-fidelity-probe` (`probe/src/corpus-run/editor-fidelity-probe.ts`)
mirrors the judge fidelity probe's flags:
`--only`,
`--cap`,
`--damage`,
`--candidates`,
`--candidates-alone`,
and `--max-usd` (default 2).
Each trial is a reviewed reference's damaged twin with a known fix.
The probe seats only the named card as editor,
through the sheet and the patch format of the real editor stage,
and scores the patched text without a model:
fixed (exact,
or equal to the clean text once whitespace runs are collapsed),
collateral (text outside the defect changed),
and refused or unusable replies counted apart.
It asks no critic,
panel,
judge or checker.

The tally per card reads fixed,
collateral,
unusable,
out of the trials.

What the probe reads is bounded:
the reviewed references give three insertion twins and one alteration twin,
so a card meets four trials in a run.
A card that fixes all four reads the same as a card that fixes them with nothing to spare,
and the probe cannot see a ceiling effect.
A reading is a floor on a card's fidelity,
not a ranking between cards that all pass.

No cache version moves:
the probe reads no cache,
and the gather it shares with the stage gives the stage the same output (B876).

## B876: the part of the editor stage before selection could not be asked without a judge roster

Status:
fixed on 2026-10-23 (UTC) in `7e94b96fa3161d18361dd1b0df8970830f4a5e11`,
red `246f55480b4b2c6a10b46549a6d8d151a41ee15f`.

`runEditorStage` built the sheet,
asked the editors,
passed what they said through the apply gate,
and then asked the judges.
It refuses a roster too short to judge,
so a probe could not seat one card through it.
The part before selection is now `gatherEditorProposals` (`repair/src/editor-gather.ts`),
and the stage calls it.
The probe asks the same function,
so the sheet is byte-identical to the stage's and no judge is in the call.
A test sends both the same inputs and compares the messages.

`sentenceRegionAround` (`repair/src/sentence-region.ts`) widens a defect span to the whole sentences it touches,
which is the region an accepted issue's critic would quote and an editor may rewrite.

No cache version moves:
the stage's output for the same inputs is unchanged,
and the existing stage tests pass as written.

## B877: a deletion twin has a fix the editor must write, which no deterministic test can score

Status:
decided on 2026-10-23 (UTC),
open to the owner's veto.

For an inserted sentence the fix is its removal,
and for an altered number the fix is the clean digits,
and both can be read from the patched text.
A deleted sentence is restored only if the editor writes the sentence again,
and the wording that counts as the same sentence is a judgement.
`--damage deletion` is refused with that reason,
and the default is the two families the probe can score.

## B878: the probe prints a per-arm cost ceiling and gates on the first-pass figure

Status:
fixed on 2026-10-23 (UTC) in `0f2b490642a33a9d35a74a67f18957585d795251`,
open to the owner's veto on the gate.

The ceiling counts one input token to the character of the sheet,
and the whole completion cap of the Claude cards
(`CLAUDE_COMPLETION_CAP`,
32000 tokens,
thinking counted in it) at the output price,
for each ask.
The first-pass figure is one ask a trial,
summed over the cards and trials.
The run is refused when it passes `--max-usd`,
before any call.
The worst case,
which asks again in each retry round and once more in a recovery round (five asks a trial),
is printed and not gated,
because the five-ask figure for four Sonnet trials passes the default of 2 USD that the first pass stays under.
A card with no price table in `claude-card-sides.ts` is refused rather than priced at zero.

## B879: the probe's client holds the Claude key alone and refuses any model that is not a named card

Status:
fixed on 2026-10-23 (UTC) in `0f2b490642a33a9d35a74a67f18957585d795251`.

`editorProbeEnv` hands the client builder only `TRANSLATION_REPAIR_CLAUDE_API_KEY`,
so a launch that holds every provider's key reaches one route.
When the key is unset,
the refusal names the Claude route alone.
`cardsOnlyClient` wraps the client and refuses a request for any model id the run did not seat.
A keyed launch still logs the unconfigured warnings for the other providers,
which the entry does not ask for.
