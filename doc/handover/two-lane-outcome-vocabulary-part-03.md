# Handover: the lane outcome vocabulary and what is mid-flight, part 03

Part 03 of [Handover: the lane outcome vocabulary and what is mid-flight](two-lane-outcome-vocabulary.md),
whose index lists every part in order.

## What is owed the moment the cost run exits

DO THIS FIRST, BEFORE READING THE RUN, because it is the half that is not yet verified.

`2ff6228d9` added per-slice cost telemetry (`slice-cost-log.ts`, `slice-cost-read.ts`) and its unit
tests import from `dist/`, which the cost run is reading. Building would have swapped code under a
live multi-hour run, so the build and the full sweep were deferred on purpose:

1.  `mise run //package/module/translation-repair:build`
2.  `mise run //package/module/translation-repair:test:unit`
3.  `mise run //package/module/translation-repair:lint`
4.  `mise run //package/module/translation-repair:lint:types`

WHAT WAS ALREADY VERIFIED, so this is a sweep rather than an unknown: the source modules were
exercised directly with node, outside `dist`, and every assertion held. The round trip between
writer and reader, the early-exit path where a lane leaves a slice by `continue`, a mixed log with
unrelated lines, and all three refusals (half-written line, unknown lane, non-integer measurement).
What the sweep adds is the built artifact, the lint rules and the types.

NOTHING ELSE MAY RUN `mise` IN THIS PACKAGE UNTIL THE RUN EXITS. `lint:types` runs `tsc --build`
and `build` writes `dist/` outright; `test:unit` reads `dist/` and would test the wrong code.

THE DECIDED WORK THAT FOLLOWS THE SWEEP, in order, all of it now unblocked:

1.  THE VOICE LOSS, first because everything else is measured through it. 135 of 327 judgings lost at
    least one voice of six, dominated by `hf:zai-org/GLM-5.2` abandoned 60000 ms after quorum. Widen
    that deadline or seat a replacement, then re-measure the decline rate.

    DONE 2026-08-17, recorded in `doc/decision/translation-repair-straggler-grace.md`. The window
    moved from 60 to 180 seconds; no model was replaced.

    WIDEN WON ON MEASUREMENT. Whole-call latency over 602 bench exchanges puts
    `hf:zai-org/GLM-5.2` at p50 24.0 s, p95 74.0 s, max 85.5 s and `hf:zai-org/GLM-4.7-Flash` at p50
    30.5 s, p95 72.9 s, max 88.6 s, so 60 seconds sat between those medians and their 95th
    percentiles and cut working voices by construction. In the cost run 91 of 96 losses were this
    window firing, 95 of 96 were the two GLM models, and `hf:zai-org/GLM-5.2` was still heard in 220
    full panels. Replacing a model that answers in three quarters of its stages would have worked
    around a mis-set constant by discarding a working voice.

    ONE CLAIM I MADE HERE WAS WRONG and is corrected in that decision: widening does NOT push the
    wrong way on entry cost. The window is only paid when a voice is late, so the added wall time is
    about 21 minutes across a seven and a half hour run, under half a percent, against entries that
    cost hours.

    THE RE-MEASURE FINISHED 2026-08-17 and is written up in
    `doc/audit/straggler-grace-remeasure.md`. NO RUN IS IN FLIGHT and NO `mise` EMBARGO IS IN FORCE;
    an earlier version of this section said both, and a session reading it would have held itself
    back from a run that had already exited. Its artifacts and log survive at
    `~/temp/agent/grace-remeasure.UfE5pP1J`, also recorded in the scratchpad as `grace-run-dir.txt`.

    HEADLINE: per-stage voice completeness fell from 11 of 80 stages (0.138) to 3 of 77 (0.039) on
    the same two entries. One abandonment survived at 180000 ms on `hf:zai-org/GLM-5.2`, so the tail
    the decision warned about is real but is one call rather than a class. The other two residual
    losses are `schema-mismatch`, a different fault that the window never touched.

    COST ROSE, by more than the estimate the decision carried: +7.1 percent and +28.6 percent on the
    two entries. No unchanged-build repeat exists, so the run-to-run band is unmeasured and 21
    percent aggregate cannot yet be separated from provider variance. The audit says so at length.

    COMPARE ON PER-STAGE VOICE COMPLETENESS and nothing else, for any future re-measure. The
    old-window baseline on that definition is 63 of 483 stages, 0.130, per entry 5/22, 6/58, 30/208,
    22/195. The 0.413 quoted elsewhere in this handover counts JUDGINGS and is not comparable; the 96
    loss lines in the cost run count retries and are not comparable either.

2.  ~~`#105`'s retry policy~~ DONE 2026-08-17 (`3a667a187`), as `src/translate-retry.ts`.
    A declining slate is judged ONCE more against the same panel, and what still declines is recorded
    as `no-candidate-backed`. The delivery vocabulary already said WHERE such a slice lands, so this
    is a reason rather than a new kind: with an incumbent it stays `incumbent-retained`, without one
    it stays `gap-remains`. Both exit doors are covered, since a decline RETURNS when an incumbent
    exists and THROWS when none does, and covering one would have applied the policy to half the
    slices.

    PRICED FROM THE SETTLED ARTIFACTS, since the retry landed after the last run and has never
    executed in production: 8 of 40 slices declined under the new window and 4 of 40 under the old,
    every one of them `declined-indecision`, so the retry buys a second judging round on roughly one
    slice in five rather than the one in sixteen a full-panel rate predicts. `no-candidate` never
    occurred, so the exclusion in `RETRIED_DECLINES` protects nothing on this evidence. Budget
    accordingly; the audit carries the working.

    EVERY TIMING COMPARISON FROM HERE IS TWO CHANGES DEEP against the 2026-08-16 baselines, the
    window and this retry, and no arithmetic separates them afterwards. Record the `pipeline=` digest
    from a run's own `START` line beside any number taken from it.
3.  `#74` and `#98`, the aligner. **`#74` IS CLOSED. `#98` IS BLOCKED, and this item as written
    misdirects**, which cost a sitting on 2026-08-17 before the task itself was read. Corrected here
    so it cannot cost another.

    THE CENSUS THIS ITEM ASKS FOR HAS ALREADY BEEN RUN, on 2026-08-15, at zero quota, WITH a positive
    control. Of 92 complete pairs, 85 take the equal-shape fast path, and forced alignment would pair
    NONE of them differently. The control was invented headings (`Intro/Life/Notes` against
    `Intro/Notes/Afterword`, equal counts, one dropped and one added) and `alignHeadingsForced`
    returned a non-identity script with two refusals and one shift, so the probe can show the defect
    and the corpus simply does not contain a case it can see. Do not rebuild this.

    WHY THE ZERO IS NOT A CLEAN BILL, and why routing the fast path through the aligner anyway is
    the wrong move: `headingAffinity` scores SHARED LATIN RUNS, so it pairs a handle carried across
    (`Mikä`, `wing`, `Baimao suki`) and has nothing whatever to prefer between two headings with no
    Latin in common, which is the common case here. Routing the 85 through it would change no pairing
    while looking like a fix, and REFUSING every equal-count pairing would discard real repair
    coverage to catch a case nothing here can detect.

    WHAT ACTUALLY UNBLOCKS IT is a heading signal that works on handle-free headings. Three
    deterministic substitutes are already measured and REFUTED, recorded on `#106` so they are not
    re-derived: neighbour length excess, distinctive body tokens (which made alignment WORSE, raising
    unpaired source sections from 11 to 18, because weak plentiful evidence promotes a spurious
    pairing to a trusted anchor), and float-equality in the scorer. The one instrument measured
    CORRECT on this question is the coverage stage, eleven of eleven at section scale, and wiring it
    is question 28's subject rather than a free choice.

    `#98` also carries `blockedBy: #106` in the tracker, and `#106` waits on question 28. Landing
    section-scale insertion behind it is decided (paragraph scale is refused); the aligner gate in
    front of it is not.
4.  SECTION-SCALE insertion, with the heading defect fixed, over the population that then reaches the
    matcher. When a source section's counterpart is a heading with no body, the body belongs UNDER
    that heading; landing it as designed would have produced eight duplicate headings on `XIEPT2`.
    PARAGRAPH-SCALE insertion is REFUSED on the evidence and is not part of this.
5.  The rendering audit, standalone over EVERY settled version 2 artifact rather than a sample. A
    census has no sampling error and can settle questions about particular entries. Nothing in the
    producing path changes, so an instrument whose production error rate is still unmeasured cannot
    reach what ships, and it can be re-run against those same artifacts when the instrument changes.
6.  Persisting `coverage-probe` output into the runs directory rather than stdout only. This is the
    one piece of the parked coverage work that survives on its own account, being the reason its
    2026-08-16 numbers exist nowhere but a transcript.

NONE OF IT BEFORE THE SWEEP. Every item is code, and there is already one unverified change in the
tree; three would compound into a sweep that cannot say which change broke what.

ONE KNOWN GAP TO CLOSE IN THE SAME SITTING: CLOSED 2026-08-17 (`3309ffff8`). A `SLICE-COST` line
could not say WHY a slice was cheap. Both lanes leave a slice early on a cache hit and on an
insertion chunk, and both emitted a row near zero milliseconds at any size, which on a RESUMED pass
would have scattered near-zero points across every size band and flattened the very slope the line
exists to show.

Every line now carries `exit=`, one of `computed`, `resumed`, `no-translation` or `unfilled`.
Ordinary completion is the default and needs no call, so the common path cannot be forgotten; the
other three name themselves before leaving, which the disposable cannot infer once scope has ended.
The reader REQUIRES the field rather than treating it as optional, because the telemetry landed
after the only pass that has run, so no production log carries the older shape.

THE MIRROR HOLE WAS FOUND AND CLOSED IN THE SAME SITTING (`dab4c6946`): `using` fires dispose on
THROW, so a slice killed by the entry deadline was logging `exit=computed` with near-cap
milliseconds, which is one poisoned row per aborted entry sitting inside the very population the
field exists to keep clean, passing an `exit=computed` filter. There is now an `aborted` exit, READ
FROM THE SIGNAL at dispose rather than named at each throw site: a slice can throw from the abort
check, from the stages, or from an assertion after them, and `Symbol.dispose` is not told which. A
named exit still wins, since a cache hit bought nothing either way. Both lanes now pass `signal`.

BOTH GUARDS WERE GFP'D, each committed before its strip.

-   The round trip, which its own header calls the only thing keeping writer and reader agreed about
    a shape neither owns: the writer's `sourceChars=` was renamed to `sourceCharacters=`, rebuilt,
    and the suite exited 1 with that case failing by name and the reader reporting `sourceChars
    missing`.
-   The abort exit: the signal check was replaced with a bare `taken.exit`, rebuilt, and the suite
    exited 1 with the cut-slice case failing by name.

Restored in both cases, and the suite passes.

THEN READ THE RUN, and only then: the `TALLY <id> status=... ms=` lines against the 180 minute cap,
the cost split between lanes, the voice-loss rate, and `XingZ60` as the full-scale check of `#71`'s
alignment fix. The `6/6 heard` critic line already in the log is one stage of one entry and is not
a rate; report what the whole run measures.

THE COST TELEMETRY DOES NOT APPLY TO THIS RUN. It was added after launch, so the run in flight
emits no `SLICE-COST` lines. This run answers the ENTRY-scale slope, over four entries spanning 28
times in size; the next run answers the per-slice question in `#92`.

DO NOT RUN THE COVERAGE MEASUREMENT. Option A of `doc/planning/coverage-wire-rerun-trade.md` exists
to say how much of the BLOCK-scale null to believe, and block-scale insertion is refused, so it
informs no decision that remains open. Section-scale insertion does not need it: the instrument was
eleven of eleven correct there, and its false-CARRIED weakness suppresses insertion rather than
causing it. The trade note stays as the record of why.

ONE PIECE OF IT SURVIVES ON ITS OWN ACCOUNT: persisting probe output into the runs directory rather
than stdout only. That is why the 2026-08-16 coverage numbers survive nowhere but a transcript, and
it is worth doing whatever happens to insertion.

THE FOUR DECISIONS, taken on the best-quality guideline and recorded with their reasoning in
`doc/decision/translation-repair-four-answers.md`. They were first put to the owner as option sets;
the owner answered and then WITHDREW the answers, because three of the four sets were priced on cost
and cost is not a constraint here, so they were decided on quality instead. Two came out differently
from what the owner clicked, and both differences are flagged in that file for a cheap veto:

-   The rendering audit runs standalone over EVERY settled artifact, not a sample. A census has no
    sampling error and can settle questions about particular entries; the sample won its earlier
    place on price alone.
-   Declines get one retry AND the voice loss gets fixed. These were offered as alternatives, which
    was the error: the retry treats the symptom and the deadline treats the cause.
-   Insertion splits in two. PARAGRAPH scale is refused on the evidence. SECTION scale is real and
    gets landed, but AFTER `#74` and `#98`, because 85 of 92 entries never reach the matcher and
    every section-scale number was drawn from the 7 that do.
-   The window trial is dropped, unchanged, and this one was decided on its merits rather than its
    price: a fourth arm would refine a measurement whose practical action is the same either way.

## The launch gate has lifted

The trial finished at 2026-08-16T23:58Z after 25622 seconds, so the reason for holding the corpus
pass is gone: nothing else is competing for the same six models.

What the trial cost in voices is worth carrying into whatever runs next, because it is the honest
rate for this roster and this deadline: 135 of 327 judgings lost at least one voice of six, a rate
of 0.413, dominated by `hf:zai-org/GLM-5.2` abandoned 60000 ms after quorum. Panels that seat six
and hear four still decide, and the trial's strict reading threw two thirds of its slices away on
that account.

A pass launched now should either widen the deadline for that model, seat a replacement, or accept
that a two-thirds strict-population loss is the price of the current configuration.

One plan-mode pass ran against a throwaway runs directory to check the wiring at the
user boundary: `PLAN ok`, 92 pending entries, zero quota. That exercises the scheduler
and stops before any entry settles, which is why `settleEntry` has its own tests.

## Queue item 5 is under way: the rendering audit over settled artifacts (`#115`)

The FREE HALF is done, committed and green, and it changed the plan in three ways worth carrying:

-   The population is 40 subjects, not "roughly 40 per run". Every translate delivery row in all
    four archived artifacts is `decided`, so the whole ledger is the population.
-   16 of those 40 audit the ARCHIVE's own English rather than a fresh rendering. That split is
    recorded per subject and must be reported apart, or the instrument's first real measurement
    blurs its own denominator.
-   The audit needs NO corpus text. Delivery rows carry `sourceText`, and `outcome.acceptedText`
    equals `shippedText` on all 40. Re-preparation is still done, but only for `identityContext`
    and for provenance.

Everything measured, with the numbers, is in `doc/audit/rendering-audit-settled-population.md`.
That file also records the `#107` reading rule, fixed BEFORE the run so the tally cannot move it.

Landed so far:

-   `src/corpus-run/rendering-audit-settled-input.ts`, the zero-quota reader.
-   `src/corpus-run/rendering-audit-settled-input.unit.test.ts`, eight cases on a throwaway git
    corpus of cat-themed invention.

A TRAP WORTH REMEMBERING: the reader's first name, `readSettledArtifact`, already existed in
`artifact-read.ts` and reached the package through `sheet-barrel.ts`. `export *` drops an ambiguous
name SILENTLY, so `corpus-barrel.ts` exported one of the two new functions and quietly did not
export the other. The only symptom was an import error in a test. Anything added to a barrel should
be checked against the package's runtime exports, not just against a type-check.

The fixture had to resolve the REAL git binary through `resolveGit()`. This repository's PATH
exposes the policy shim, which rejects fixture staging patterns and settles worktree copies against
the real repository; concurrent cases then raced on `.git/cli-git-worktree-copy/v1/settlement.lock`
and `git init` failed with `ENOTEMPTY`. `corpus-source.unit.test.ts` already had this right and
says so in a comment.

STILL OWED on `#115`: the driver itself (`rendering-audit-settled.ts` plus a mise task), which must
carry an `import.meta.main` guard from the start, take `--cap` and `--only`, treat `--cap 0` as the
zero-quota boundary check, buy a small cap first and have it read in full before the rest, and
persist through `persistProbeRun({ probeName: 'rendering-audit-settled', ... })`. The probe name
deliberately does NOT say "census": the write-up must not let the word carry an implication two
entries cannot support.

### Where `#115` stands at 14:40Z

The full run is IN FLIGHT: `node dist/final/node/rendering-audit-settled.mjs`, logging to
`~/temp/agent/audit-settled-full.log`, 18 of 40 subjects bought. It persists to the real runs
directory on completion. If it dies, rerun it; nothing is cached, so a rerun buys all 40 again.

Landed since the last note:

-   `rendering-audit-settled.ts` plus `-args.ts`, the probe and its command line, with the
    `import.meta.main` guard and a `--cap 0` zero-quota mode that was run FIRST, on a throwaway runs
    directory: four artifacts read, all four verified, 40 subjects counted, nobody asked anything.
-   `rendering-audit-settled-row.ts`, the shared row shape.
-   `rendering-audit-settled-read.ts` and `-relocation.ts`, the readings, plus eight cases.
-   A `mise` task, `//package/module/translation-repair:rendering-audit-settled`.

TWO THINGS THE SMALL FIRST BUY PAID FOR, which is the entire argument for capping the first run:

-   The rows were storing COUNTS. One subject read `corroborated=0 agreed=0 near=1` over two voices
    claiming two defects each, and the file could not say what any of them claimed. That makes
    `#66`, `#68` and the `#107` relocation rule all unanswerable from the artifact the probe exists
    to produce. Fixed: the whole report is persisted, uninterpreted.
-   It priced the rest at roughly 30 seconds a subject.

ALSO OBSERVED, and worth carrying: the SAME subject (`grace-remeasure/Aniloviraw#0`) read
`claimed=1 corroborated=0` on the capped buy and `claimed=5 corroborated=1 agreed=1` on the full
run. Identical text, identical roster, minutes apart. Whatever the final tally says, a single audit
of a slice is not a measurement, and the six character-identical repeat subjects in the archive are
the only principled way to put a number on that.

STILL OWED when the run lands: apply `splitFor`, `rateByVoice` and `auditRelocationPairs` to the
persisted rows and write the result into `doc/audit/rendering-audit-settled-population.md`, which
already holds the population and the reading rules. Report the archive and fresh halves apart, and
say plainly that two entries settle nothing about any entry.

### Where `#115` stands at 15:30Z

The first full run LANDED, all 40 subjects, as
`node_modules/.monochromatic/translation-repair-runs/rendering-audit-settled/2026-08-17T14-25-51.584Z-b7d84b5b.json`.
Its numbers are written up in `doc/audit/rendering-audit-settled-population.md`.

A SECOND full run over the same 40 is IN FLIGHT, logging to `~/temp/agent/audit-settled-run2.log`.
It buys two things at once: a pipeline digest that is actually the build that ran, and the
run-to-run band. Both matter because `QNB` says a comparison resolves nothing narrower than the
spread on unchanged input, and the headline of `#115` is a comparison. When it lands:

```sh
mise run //package/module/translation-repair:rendering-audit-settled-report -- \
  --against node_modules/.monochromatic/translation-repair-runs/rendering-audit-settled/2026-08-17T14-25-51.584Z-b7d84b5b.json
```

Then write the band into the population doc beside the halves. That doc already says, in its own
words, that the archive-versus-fresh difference is not quotable without it.

Landed since the last note:

-   `rendering-audit-settled-repeat.ts`, the two pairings: within one run, where two artifacts of
    one entry carry identical characters at one slice; and across two runs, where every subject
    appears in both.
-   `rendering-audit-settled-band.ts`, `repeatBandOf`, which reads the spread off those pairs.
-   `rendering-audit-settled-digest.ts`, the recorded text identity. Rows now carry a DIGEST of the
    two texts each audit saw, never the texts: a run file is read, grepped and quoted, and the
    corpus goes only to the production provider. It is a tagged union so rows that predate it read
    as "cannot say" rather than pairing through their shared absence.
-   `rendering-audit-settled-print.ts`, split out of the report to keep it under its line budget.
-   `--against <run>` on the report, plus the fix that made the report print the archive the RUN
    named rather than the one this invocation defaulted to.
-   `rendering-audit-settled-repeat.unit.test.ts`, thirteen cases, mostly refusals.

TWO TRAPS FOUND, both worth carrying:

-   NUL BYTES IN COMMITTED SOURCE. Six of them, where spaces were intended, between the
    interpolations of every composite key these readings build; one had been there since the `#107`
    key builder landed. Nothing misbehaved, because a NUL is a better separator than a space and
    both sides built keys the same way. `rg` and `grep --perl-regexp` report a CLEAN FILE. Full
    write-up and the searches that do work:
    `doc/troubleshooting/nul-bytes-land-invisibly-in-source.md`. The separator is now
    `SLOT_SEPARATOR`, a shared constant written as an escape.
-   ANOTHER BARREL COLLISION, `bandOf`, already in `band-order.ts`. This one failed LOUDLY as
    TS2308, unlike `readSettledArtifact`, which was also a value and was dropped in silence. Why
    the two differ is not established, so
    `doc/troubleshooting/barrel-star-export-drops-ambiguous-names.md` keeps its warning: a clean
    type-check does not prove there is no collision.

### `#115` IS DONE, and its answer is a refusal

Three audits of the same 40 subjects, all persisted in
`node_modules/.monochromatic/translation-repair-runs/rendering-audit-settled/`:

```text
run 1  2026-08-17T14-25-51.584Z-b7d84b5b   digest stamped WRONG, see below
run 2  2026-08-17T15-06-37.885Z-c157db5b
run 3  2026-08-17T15-44-00.750Z-eeda8b9b
```

The comparison the audit exists to make CANNOT BE MADE on this population, for two
independent reasons, either sufficient alone: it is confounded with the entry, and the
band is wider than the effect. Over 40 digest-verified pairs of identical text the
corroborated total moved from four to ten, and ten of forty subjects flipped between
claiming something and claiming nothing. Full write-up and every number:
`doc/audit/rendering-audit-settled-population.md`. Task `#115` carries the summary.

WHAT UNBLOCKS IT: more ENTRIES, not more slices. Slices tighten each cell without adding
a degree of freedom. That means more settled version 2 artifacts, which is what `#108`
would produce, and `#108` now records this as a second reason to run.

RE-READING ANY RUN COSTS NOTHING:

```sh
cd /var/home/user/worktrees/translation-repair
R=/var/home/user/worktrees/translation-repair/node_modules/.monochromatic/translation-repair-runs/rendering-audit-settled
mise run //package/module/translation-repair:rendering-audit-settled-report -- \
  --run $R/2026-08-17T15-44-00.750Z-eeda8b9b.json \
  --against $R/2026-08-17T15-06-37.885Z-c157db5b.json
```

Paths must be ABSOLUTE: the mise task runs from the package directory, so a repo-relative
path gives `ENOENT` naming a path that exists. Run 1 pairs against nothing, because its
rows predate the recorded text identity; the report says so in its own sentence rather
than reporting it as an archive that moved.

TWO TASKS CAME OUT OF THIS AND ARE OPEN: `#116`, stamp runs with the runner's own
dependency closure rather than a whole-tree digest, since the closure is what a band
measurement needs. `#117`, every stage round leaks a live 180-second timer, so any CLI
running one outlives its own work; NOT fixed because `stage-round.ts` is in the producing
path `#115` was forbidden to touch.

### Where `#115` stood at 15:45Z, kept for the trail

RUN 2 LANDED as `2026-08-17T15-06-37.885Z-c157db5b.json` and is written up. RUN 3 IS RUNNING,
launched DIRECTLY in background task `bveiyodmy`, log `~/temp/agent/audit-settled-run3.log`.

THE CHAIN THAT WAS MEANT TO START IT DID NOT WORK, and the reason is worth carrying:
`pgrep --full 'node dist/final/node/rendering-audit-settled.mjs'` matches the SHELL RUNNING THE
PGREP, because that pattern is inside the shell's own command line. The wait loop found itself and
never exited. It was killed by PID and run 3 started by hand. Separately, the probe holds its
process open for about three minutes after printing `kept at`, on sockets left by voices abandoned
after quorum, so `kept at` is the completion signal and process exit is not. Both are written up in
`doc/troubleshooting/chaining-a-command-behind-a-long-run.md`.

RUN 2 AND RUN 3 ARE NOT ON THE SAME BUILD, and the doc says why that is acceptable rather than
pretending otherwise. `rendering-audit-settled-digest.ts` gained `isDigested` between them, and
that module IS in the runner's closure, so the chunk changed. `digestAuditedText`, the only part of
it the runner calls while writing rows, did not change, so both runs produce rows by identical
logic. The population doc records the closure and the distinction.

REBUILDING NOW IS SAFE: run 3 loaded its code at startup and reads its digest at start, so neither
its behaviour nor its recorded identity can move under it.

Why three runs and not two: run 1 has no recorded text identity, so pairing it against anything
yields 40 subjects that match by position and cannot be vouched for. Run 2 alone supplies six
digest-verified pairs from the character-identical subjects. Run 2 against run 3 supplies forty.

WHEN RUN 3 LANDS:

```sh
cd /var/home/user/worktrees/translation-repair
R=/var/home/user/worktrees/translation-repair/node_modules/.monochromatic/translation-repair-runs/rendering-audit-settled
mise run //package/module/translation-repair:rendering-audit-settled-report -- \
  --run $R/<run3>.json --against $R/<run2>.json
```

Paths must be ABSOLUTE. The mise task runs from the package directory, so a repo-relative path
gives `ENOENT` naming a path that exists.

Then write the band into `doc/audit/rendering-audit-settled-population.md`, which already fixes how
to read it: the headline gap is a CORROBORATED gap, so the band on corroborated counts decides
whether it survives, and the doc says in advance that about four means noise and nought or one
means it stands. It also predicts `auditRepeatsWithin` will find exactly the six subjects the
population count named, by a different route through different data.

Landed since the last note:

-   The three-way split in `auditRepeatsAcross`. It would have reported all 40 subjects of run 1 as
    "the archive moved between the two runs" in exactly the `--against` command this handover
    prescribes. The archive did not move; run 1 predates the field. Now `paired`, `textMoved` and
    `unverifiable`, worded apart by the printer, with the new case shown to fail first.
-   The relocation candidates measured structurally, no text: both anchor against their shared slice
    boundary, which is the geometry `#107` predicts, and that is in the population doc.
-   A double count found in the same data: on `zheermao101` slice 0, Qwen anchored BOTH an
    `altered-actor` and an `unsupported-addition` to the identical candidate span. `claimed` counts
    claims, not distinct problems.
-   `#116`, a task: stamp runs with the runner's own dependency closure instead of a whole-tree
    digest, since the closure is what a band actually needs and the built entry already names it.

VERIFIED, so nobody re-does it: full unit suite green at FINAL HEAD, 371 passing describes, zero
failures, zero assertion or type errors, `~/temp/agent/suite-final.log`. Checked from the FILE with
a positive control rather than from an exit code: the six new reading modules appear in the log as
having run, and so does the fourteenth case, `SEPARATES "the archive moved" FROM "nobody recorded
what this saw"`, which was added after the previous green suite.

That positive control is not ceremony. An earlier suite run in this session was piped through
`rg ... | head --lines=30`, and `head` closed the pipe on a stream whose first thirty matching lines
were all `Error` fixtures, so nothing of the actual result survived and the exit code was `head`'s.
Grep the file, never the pipe.

GFP was satisfied for the sharpest guard: removing the unrecorded-rows refusal from
`sameAuditedText`, rebuilding and running gave `expected true to equal false`, and the guard was
restored and re-verified. The run aborted at that describe, so the OTHER refusals in
`auditRepeatsWithin` were not exercised under the broken guard and have not been shown to fail.

### A PRODUCING-PATH FREEZE IS IN FORCE while the corpus pass runs

Started 2026-08-17 18:00Z: `mise run //package/module/translation-repair:corpus-pass` over 92
entries, `TRANSLATION_REPAIR_RUNS_DIR=~/translation-repair-runs-20260817`, log
`~/temp/agent/corpus-pass-20260817.log`. This is `#108`, and it is also the only source of the
more ENTRIES that `#115` proved the rendering audit needs.

DO NOT CHANGE ANYTHING THE PIPELINE RUNS, and do not rebuild after doing so, until it finishes or
is abandoned. The running process is safe either way, because Node loaded its code at startup and
`corpus-pass` reads its digest before settling anything. THE RESUME IS NOT SAFE:
`assertResumableGeneration` throws `GenerationDriftError` when the settled entries in a pool record
a build other than the one resuming, and the driver's own plan output says why in as many words,
that continuing "would stamp a second pipeline into one pool and every reader that computes a rate
would then refuse the lot". At up to 7 hours an entry over 92 entries, this run will want resuming.

WHAT THAT RULES OUT for now, each otherwise ready:

-   `#91`'s half-weight self-certification. Settled and authorized, and it changes how the checker
    stage tallies, which is the producing path.
-   Anything in `#90`, `#100` or `#106` that touches slicing.

WHAT IS STILL SAFE: telemetry readers, reporting entry points, documentation, decision write-ups,
and anything under `corpus-run/` that only READS. `slice-cost-report.ts` was built under this
freeze and is the model: it reads a log and prints.

THE FREEZE IS NOT A REASON TO IDLE. Re-read the cost telemetry as the pass accumulates slices; the
answer it owes `#92` improves on its own:

```sh
mise run //package/module/translation-repair:slice-cost-report -- ~/temp/agent/corpus-pass-20260817.log
```

### Where things stand at 18:45Z, with the pass still running

THE PASS: 153 lane starts, 7 slices priced, no aborts, no entry settled yet. First artifacts land in
`~/translation-repair-runs-20260817/artifacts/`. The freeze above is still in force.

LANDED UNDER THE FREEZE, all of it read-only or tooling:

-   `slice-cost-report.ts` and its task. Nothing had ever read the per-slice cost telemetry, which
    is `#71`'s failure exactly. Interim reading on `#92`: `ms/char` falls fourfold across three size
    bands while `min/slice` only doubles, which is the shape a FIXED per-slice overhead makes. Seven
    slices, all repair lane, so it is a shape and not yet a finding.
-   `runner-closure.ts`, `#116` closed. Runs now record which chunks the entry imports, so two runs
    can be compared for "same code" by string equality. The whole-tree digest could never say that.
-   Sample manifests record the pipeline that settled their pool, `#60`'s last named mechanic.
-   The audit reader accepts the FLAT layout a pass writes, not only the hand-built nested archive.
    This one mattered: pointing the audit at a pass's own output found nothing and refused with "no
    artifacts under", which reads like an empty pass rather than a layout it cannot see. The four
    archived artifacts only ever read because somebody copied them into run-set directories by hand.
-   `doc/planning/artifact-archive-text.md`, `#96`: its premise was measured and is wrong. Storing
    the whole target text costs 0.6 to 0.9 percent of an artifact, not the "doubles" the task
    assumed, because an artifact is judge evidence rather than text.

WHEN THE PASS LANDS, in order:

1.  Re-read the cost telemetry; by then it will include translate-lane slices and the larger bands.
2.  Re-run the settled rendering audit over the new artifacts. It reads the flat layout directly
    now, so point it at `~/translation-repair-runs-20260817/artifacts` with no copying:
    `mise run //package/module/translation-repair:rendering-audit-settled -- --archive <that path>`.
    More ENTRIES is the one thing `#115` proved the audit needs.
3.  `#108`'s replacement rate, which is what `#107`'s remaining decision waits on.
4.  Lift the freeze: `#91`'s half-weight first, since it is settled, authorized and located.

### The pass is being STOPPED AT 6 ENTRIES, on the user's instruction

Decided by the user 2026-08-17 22:50Z, who noted 6 is low and defensible at this stage. A watcher
polls the artifact directory and stops the pass by PID once six exist; the seventh entry's slices
stay in the cache, so nothing is lost and a later run resumes them.

WHY NOT MORE: measured rate is about 86 minutes an entry (73, 139 and 45 for the first three, the
spread being #114's size dependence). All 92 would take about 128 hours against a 72-hour soft
budget, so the pass would have stopped near 50 anyway, and the freeze would have held for days.

### THE ACCUMULATION BAR IS NOW SIX, EVERYWHERE, AND IT IS PROVISIONAL

Lowered by the user 2026-08-17 from the "15+" set on 2026-08-14, in their words low but defensible
at this early stage, to be flipped back to 15 "when we're more confident".

RESTORING IT TO 15 IS THE USER'S CALL AND NOBODY ELSE'S, and the user said so explicitly when this
was first written down as "the trigger is confidence": confidence will need their approval AFTER an
agent already believes it is confident. Two steps, in that order. An agent reaching its own
threshold is the moment to ASK, never the moment to act, and "we're more confident now" is not a
reason to raise the bar unasked. Nobody should read a six-entry result as having met the older bar
either.

It lives in prose only; there is no constant. `#60` carries the authoritative statement and the
reason. Older passages in `doc/handover/translation-repair.md` still reason about fifteen (bands per
draw, hours to accumulate, when a draw stops reproducing); those are correct FOR FIFTEEN and are
kept as the record of what was computed then. Read them as superseded arithmetic rather than as the
current bar.

WHAT SIX BUYS, stated plainly so it is not read as more: it unblocks `#60`'s redraw under the new
bar, and it is a real step for `#115`, whose confound was two entries against two. It does NOT make
claims about particular entries safe, and it does not separate an effect from an entry, which is the
confound `#115` measured and could not break at two.

### The GLM finding, corrected

A first reading said "GLM models are slow" from abandon counts alone. THAT IS RETRACTED. The same
window carries 262 successful GLM answers against 24 abandons, and the abandons are stage-shaped:
15 `select`, 6 `panel`, 4 `critic`, 0 `checker`, spread evenly with no clustering. Selection carries
the largest prompts (`#92`: 12119 tokens against a slate of 7), so the shape is a tail on the
largest prompts rather than a slow model. It is a hypothesis, not a finding.

IT CANNOT BE SETTLED WITH WHAT IS LOGGED, which is `#118`, and the reason is better than first
recorded. Streaming is always on, so an aborted call HAS ALREADY DELIVERED partial content:
`drainBody` accumulates it in `parts`, then the catch rethrows and the accumulated text is dropped.
The answer to "was it mid-reasoning" is sitting in memory at the moment of the cut and is thrown
away.

WORSE, AND IT INVALIDATES A MEASUREMENT: the `drainBody` progress line is emitted AFTER the
try/catch, so an aborted stream logs nothing at all. Every latency figure read off a pass log
therefore covers SURVIVING calls only. The "1349 streams, mean firstByte 1822ms" figure recorded
earlier excluded every abandoned call by construction, which is survivorship bias; it should not be
quoted, and it says nothing about the stragglers it was used to describe.

### When the freeze lifts, in order

1.  `#91` half-weight self-certification. Settled, authorized, located at `tallyResolutionChecks`
    in `src/tally-resolution.ts`, called from `runCheckerStage`.
2.  `#118`, the two diagnostics above. Small, and they make `#68`'s latency axis answerable.
3.  Re-read the slice cost telemetry, which by then includes translate-lane slices.
4.  Re-run the settled rendering audit over the six new artifacts. The reader takes the flat layout
    now, so point it straight at `~/translation-repair-runs-20260817/artifacts`.

## READ THIS FIRST AFTER A COMPACTION (written 2026-08-17 23:22Z)

### What is running right now

```text
corpus pass      PID 3768707, node dist/final/node/corpus-pass.mjs
runs directory   ~/translation-repair-runs-20260817
artifacts        ~/translation-repair-runs-20260817/artifacts   (FLAT, no run-set subdirectories)
log              ~/temp/agent/corpus-pass-20260817.log
watcher          background task bkfhlg7ya
progress         3 entries settled of the 6 the user asked for, ~86 min an entry
```

THE WATCHER polls the artifact directory and kills the pass by PID once six artifacts exist. It
exits early and says so if the pass dies first. If it is gone after a compaction, do the same by
hand; there is nothing subtle in it:

```sh
A=~/translation-repair-runs-20260817/artifacts
while [ "$(ls "$A" | wc --lines)" -lt 6 ]; do sleep 60; done
kill 3768707
```

DO NOT write a `pgrep --full` wait loop for this. It matches the shell running it and never exits;
that trap was documented here at 09:16 today and then walked into at 15:50 anyway. See
`doc/troubleshooting/pgrep-wait-loop-matches-itself.md`.

Stopping loses nothing: the in-flight entry's slices stay in `slice-cache/`, and a later run resumes
them PROVIDED THE BUILD HAS NOT MOVED.

### The freeze, which is the one thing that can be broken by accident

DO NOT CHANGE ANYTHING THE PIPELINE RUNS, and do not rebuild after doing so, until the pass has
stopped. `assertResumableGeneration` throws `GenerationDriftError` when a pool holds entries settled
under another build, so a rebuild costs this run's resumability. Reading, reporting, documentation
and anything under `corpus-run/` that only reads are all safe; `slice-cost-report.ts` was built under
this freeze as the model.

Frozen and waiting: `#91` (half-weight, settled and located at `tallyResolutionChecks`), `#118` (the
stream diagnostics), and anything in `#90`, `#100` or `#106` touching slicing.

### When the pass stops, in order

1.  `#91` half-weight self-certification. Settled, authorized, located.
2.  `#118`: keep the partial text on abort, emit the `drainBody` progress sample on the abort path
    too, and put the model id on that line. Small, and it makes `#68`'s latency axis answerable.
3.  Re-read the slice cost telemetry, which by then includes translate-lane slices:
    `mise run //package/module/translation-repair:slice-cost-report -- ~/temp/agent/corpus-pass-20260817.log`
4.  Re-run the settled rendering audit over the six artifacts. The reader takes the flat layout, so:

    ```sh
    mise run //package/module/translation-repair:rendering-audit-settled \
      -- --archive ~/translation-repair-runs-20260817/artifacts
    ```

    Verified working against the real artifacts at `--cap 0` on 2026-08-17.
5.  `#60`'s redraw, now unblocked at the lowered bar of six.
6.  `#108`'s replacement rate ON displacement-flagged slices against off them, which is what `#107`'s
    remaining decision waits on.

### Claims of mine that were retracted today, so they are not re-quoted

-   "GLM models are slow." NO. 262 successful GLM answers against 24 abandons in the same window,
    and the abandons are stage-shaped: 15 `select`, 6 `panel`, 4 `critic`, 0 `checker`, evenly
    spread. Selection carries the largest prompts. A tail on large prompts, and still a hypothesis.
-   "1349 streams, mean firstByte 1822ms." NO. The `drainBody` progress line is emitted after the
    try/catch, so aborted streams log nothing and that figure covers survivors only. Survivorship
    bias over exactly the population it was describing.
-   "An abandoned call leaves nothing." NO. Streaming is always on and `drainBody` accumulates the
    partial text in `parts`; the catch rethrows and drops it. The evidence exists at the cut and is
    discarded, which is `#118` item 1.
-   "#96 storing the target text doubles artifact size." NO, it is 0.6 to 0.9 percent. An artifact
    is judge evidence, not text. `doc/planning/artifact-archive-text.md`.
