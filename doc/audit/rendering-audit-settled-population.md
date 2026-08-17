# The population the rendering audit will run over

Everything here was measured before a single model was asked anything,
from the four archived version 2 artifacts at `~/translation-repair-v2-archive/`
and the corpus clone at `~/one-among-us/data`.
Task `#115` is the work these numbers scope.

## It is 40 subjects, and "every artifact" costs no more than one run did

The archive holds four artifacts:
two entries settled twice,
under `two-lane-cost-2026-08-16` and `grace-remeasure-2026-08-17`.

```text
                                          slices   decided   retained   replaced
two-lane-cost-2026-08-16/Aniloviraw            5         5          1          4
two-lane-cost-2026-08-16/zheermao101          15        15          6          9
grace-remeasure-2026-08-17/Aniloviraw          5         5          2          3
grace-remeasure-2026-08-17/zheermao101        15        15          7          8
                                              --        --         --         --
                                              40        40         16         24
```

EVERY delivery row in the translate lane is `decided`.
There is no `not-evaluated` row and no withdrawal anywhere in the archive,
so the audit population is the whole delivery ledger rather than a subset of it,
and the earlier estimate of roughly 40 audits was right by accident:
it was reasoning about one run per entry,
and 40 is all four artifacts.

## 16 of the 40 audit the archive, not a fresh rendering

`incumbent-retained` means the judges preferred the wording the archive already had,
so the document carries it unchanged.
Auditing that slice audits a human translation from years ago.
`replacement-shipped` means the document carries something the lane produced.

The instrument was built for output with no BEFORE text,
which is the second case.
Reading both in one denominator would blur the first real measurement it produces,
so `auditsArchiveText` is recorded per subject and the two are reported apart.

The invariant that makes this free was checked on all 40:
`outcome.acceptedText` equals `shippedText` everywhere,
`shippedText` equals `incumbentText` on every retained slice,
and differs from it on every replaced one.

## The two runs are directly comparable, slice for slice

Both entries produced the SAME preparation identity under both builds,
at the same corpus commit,
under different pipeline digests:

```text
Aniloviraw     sha256-preparation-v1:d8f64be98e6143dee73f36   5 slices
zheermao101    sha256-preparation-v1:100b954149dcaf28a05a1f  15 slices
corpus         a41fc607     digests  3e6902fb  and  8a63a9cd
```

Same slices, same source text, two independent runs.
That buys two readings nothing was paid for:

-   SIX SUBJECTS ARE CHARACTER-IDENTICAL ACROSS BOTH RUNS
    (`zheermao101` slices 0, 2, 7, 8, 9, 11),
    so the instrument can be asked the same question twice
    and its own run-to-run band read off real text rather than fixtures.
    Five of those six are retained-in-both, identical by construction.
    The sixth, slice 9, is `replacement-shipped` in BOTH runs with identical text:
    two independent productions converged on the same characters.
-   SIX OF TWENTY SLICES CHANGED THEIR DECISION between the runs
    (`Aniloviraw` 1, 2, 3; `zheermao101` 3, 6, 13).
    That is the per-slice instability measured on identical inputs,
    and it is the reason a single run of anything here settles very little.

## What re-preparation is for, and what it is not for

The artifact carries `sourceText` on every delivery row.
So the audit reads the two texts straight out of the artifact and never re-slices.
Auditing re-sliced text would audit a different input than the one the judges saw.

Re-preparation still happens, for two things that live only in the preparation:

-   `identityContext`.
    Both entries declare real names,
    and the producing judges were given them:
    236 characters for `Aniloviraw`, 218 for `zheermao101`,
    declaring name, alias and location on both sides.
    An auditor shown a rendering WITHOUT that block sees a name
    it cannot derive from the source
    and has every reason to call it a fabrication.
    That is the defect `#36` was opened for,
    and rediscovering it as findings would poison every name-bearing slice.
    So it is passed, and recorded as a tagged value rather than an optional string,
    because "this pair declared nothing" and "nobody recorded whether it did"
    mean opposite things when a name-shaped finding turns up.
-   Provenance.
    All four artifacts VERIFY against a preparation recomputed at HEAD.
    Slice source text at HEAD is character-identical to what the artifacts carry,
    so nothing in the slicing has moved under them.

A verification refusal is carried as a value rather than thrown.
A slicing that moved is a finding about that artifact,
not a reason to refuse to read the rows it settled.

The corpus pin comes from each artifact's own `corpusSha`,
never from `RUN_CORPUS_PIN`,
and the read goes through the commit object rather than the working tree,
so neither a moved pin nor a dirty clone can change the answer.
The clone was clean when this was measured, and it would not have mattered.

## What this population cannot answer

Two entries is not a census in any useful sense,
whatever the word "every" suggests about four files.
Nothing about a particular entry can be settled from two of them.

The instrument's own production error rate is still unmeasured:
`#66` is the false-negative half and is open,
`#68` records that one of the three checkers raises claims
at a tenth the rate of the others.
So nothing this run says may gate what ships.
It is telemetry, and the producing path does not change.

Read `corroborated` and `agreed` apart.
Four runs of `audit-sensitivity` now show the strict tier
reporting a unanimous defect as nothing.

## Decided before the run, so the result cannot move the goalposts

`#107` is open:
per-slice judging cannot tell a RELOCATION from a fabrication.
A passage the archive carried across a slice boundary
reads as an omission on one slice
and as an unsupported addition on its neighbour.

So: paired omission and addition findings on ADJACENT slices of one entry
get checked against each other and counted as one relocation,
not as two defects.
This is written down before the tally exists,
because deciding it afterwards is exactly the move that was refused
when the voice-loss re-read was read on the at-risk population.

The 16 retained subjects are where `#107` bites hardest,
since those are the archive's own text,
which is what the relocation claim is about.
