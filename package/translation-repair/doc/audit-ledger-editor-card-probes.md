# Audit ledger: probes that read one editor card

A card the editor calibration could not bench,
the seats that flag leaves unconfined,
a relative share that moves with the run,
the probe that reads one card's edit against a known fix,
the frozen pool of forty-one trials it now reads,
and the guard that holds an arm to its amount call by call.

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
before any call
(replaced by the guard of B881,
which refuses a call and not a run).
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

## B880: four trials could not separate effort levels, so the probe reads a frozen pool of forty-one

Status:
fixed on 2026-10-23 (UTC) in `56ff293b924b06fb8de0ce0b670ec969712ea52b`,
red `88e995ca38fb9418cd0029c41e68632077ac2400`,
open to the owner's veto (the lead's ruling of at least forty scoreable trials per card).

B875 recorded the limit:
a card that fixes all four reviewed twins reads the same as a stronger one.
The pool (`probe/src/editor-fidelity-pool-manifest.ts`) is the three reviewed references,
first and unchanged,
and thirty-four heading sections drawn beside them from the same corpus pin
(`probe/src/editor-fidelity-pool-drawn-1.ts` to `probe/src/editor-fidelity-pool-drawn-4.ts`).
Together they stand for forty-one trials over twenty-four entries:
twenty-three insertions and eighteen alterations,
none of the entries holding more than four.
The twins come from the machinery the judge probe and `damage-sample` use
(`insertBorrowedSentence` and `alterSharedNumber` in `repair/src/fidelity-damage.ts`),
and every one is replayed through `buildReviewedFidelityReference` against the pinned clone,
so a range or a damaged twin that drifted from its hash refuses the run.
Only ids,
offsets and hashes are committed;
the corpus is unlicensed.

The machinery yields far more than forty.
Over the 92 readable entries,
90 split into the same heading sections in both languages,
and 221 of their sections hold a reference of at least 400 characters,
183 of which admit an insertion and 123 an alteration.
The draw stops at forty-one because that is the ruling's floor,
not what the machinery can give.
It is deterministic:
a second run gave the same manifest.

The rule is in the header of the manifest.
Entries in id order,
the reviewed entries left out,
the production aligner's equal-shape entries only,
sections of 400 to 2200 English characters,
the first section that builds an insertion twin and passes the scoreability check,
and the first other section that builds an alteration twin.
A trial is scoreable when it builds with one envelope,
the clean text scores exact,
the damaged text scores not fixed,
and a scripted editor applying the known fix through the real stage path
(its sheet,
its parse and its apply gate)
reads fixed with nothing else touched.

What the pool is not:
it is not source-reviewed.
A drawn section was chosen by a rule and never read for meaning by a person.
That suffices because the score compares the patched text with the text before the defect was planted,
so what the reference says is not what is measured.
`reviewedOn` on a drawn specification dates its freeze and says nothing of review.
The first entries by id are not a random sample,
two trials an entry is a thin spread,
and forty-one trials still bound the claims an arm can make:
a difference of a few trials between two efforts is inside what the spread arm shows.
`--cap` defaults to 64,
so an arm run without it asks every trial,
and a run prints its pool on the line `pool: N trials over M entries (insertion i, alteration a)`.

No cache version moves:
the probe reads no cache and the pool touches no stage key.

## B881: the gate on the first-pass total refused every arm of a forty-trial pool, so a guard holds each call to the measured spend

Status:
fixed on 2026-10-23 (UTC) in `4434c4257a2a7462fce3700fcff3e7591dd2830e`,
red `2219151053267b904ca3a0dc84650e4768ecb998`,
`27b17b9065a6d91fbc77fe2d9a1536708bdd9741`,
open to the owner's veto.

B878 refused a run whose first-pass ceiling passed `--max-usd`.
The ceiling takes the whole completion cap on every ask,
so forty-one trials price at 14.97 USD for one Sonnet card against the default of 2.
`spendGuardedClient` (`probe/src/corpus-run/editor-fidelity-spend-guard.ts`) asks the question at each call instead:
the spend measured so far plus that call's ceiling must not pass `--max-usd`,
or the call is refused and the arm ends there,
with the rows it finished in their files.
The one-ask and worst-case ceilings are still printed,
and a line after them says the guard is on.

Spend is read from the replies.
A reply reports the tokens it used,
thinking counted in the completion,
and the card's prices turn them into dollars.
The report folds cached prompt tokens into one prompt count,
so the prompt is priced at the higher of the input and cache-write rates:
the figure does not fall under the bill and an overcount only stops the arm sooner.
A reply that reports no usage is counted at its call's ceiling.
A call that throws counts nothing,
and the attempts a client retries inside a call are its own to report and are invisible to the guard.
So the guard is a runaway stop on the replies it sees,
not an exact ledger,
and the process meter (`SPEND` lines) remains the record of what was billed.

## B882: a refusal thrown inside the client is a lost voice, so the guard ends the arm through the arm's signal

Status:
fixed on 2026-10-23 (UTC) in `4434c4257a2a7462fce3700fcff3e7591dd2830e`.

`attemptStageCall` (`stage/src/stage-call.ts`) turns a call that throws into a lost voice and asks again,
except when the signal has aborted,
the request is a fault of the caller's own building,
or every provider is dry.
A guard that only threw would have read as a lost voice,
been re-asked up to five times a trial,
and let the next trial begin.
The guard aborts the arm's signal with the refusal as its reason before it throws,
so every layer carries the refusal out,
and every later call is refused with the same one without reaching the client.
A test runs the whole probe with a fake client whose replies cost 0.205 USD against `--max-usd 0.5`:
the second call is never made and the finished row stays in its file.

## B883: an insertion at the end of a section is not scoreable, because removing it leaves the separator before it

Status:
recorded on 2026-10-23 (UTC),
no code changed.

The insertion splice leads the borrowed sentence with a space.
Mid-section,
removing the sentence leaves two spaces,
and the whitespace-collapse equivalence reads that as the clean text.
At the end of a section it leaves one trailing space,
which the equivalence does not cover,
so a perfect edit scores defect only with collateral.
The draw's scoreability check found two such insertions
and passed over them.
They are not in the pool,
and a later round that wants them has to extend the equivalence to trailing whitespace,
with a red test,
before it draws again.

## B884: the process slips of this round and of round 2, for the commit comments

Status:
recorded on 2026-10-23 (UTC).

Round 2 wrote `editor-fidelity-probe-read.unit.test.ts` after the code with no red run.
It is shown red here by mutating each of its four helpers in the working tree and rebuilding:
`seatedCardsOf` no longer requiring `--candidates-alone`,
`sheetCharsOf` counting nothing,
`pairName` swapping its handles,
and `readingWord` shortening the refusal wording.
Each of the four suites failed on its own assertion,
and the tree was restored from the committed text.
Round 2 also revised the red test files in the fix commit
(`0f2b490642a33a9d35a74a67f18957585d795251` against the red `00cb16908aaada55b9f01a26cf6ea332637a190c`):
formatting and structure for the source scans.
This round the red tests stayed byte-identical to their fix commits
(`git diff` between each red commit and its fix commit lists no test file of the probe).
The one exception is a layout change of a single statement,
made in its own commit (`27b17b9065a6d91fbc77fe2d9a1536708bdd9741`) between the red commit and the fix,
because the red commit left a `no-await-in-loop` warning that `lint:oxlint` reads as a failure.
