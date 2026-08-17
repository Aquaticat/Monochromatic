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

## What the first full run said

Run `2026-08-17T14-25-51.584Z-b7d84b5b`,
all 40 subjects,
three auditors each:

```text
                subjects   drew a claim   claims   corroborated   agreed   near   degraded
ARCHIVE text          16             10       30              5        7      8          4
FRESH   text          24             14       25              1        1      4          1
```

```text
hf:openai/gpt-oss-120b                 asked 40   spoke on 17   claims 25   dropped  3
hf:nvidia/NVIDIA-Nemotron-3-Super      asked 37   spoke on 13   claims 16   dropped  9
hf:Qwen/Qwen3.6-27B                    asked 38   spoke on 11   claims 14   dropped  4
```

Relocation candidates under the `#107` rule: two.
`grace-remeasure-2026-08-17/Aniloviraw` pairs an omission at slice 1
with an addition at slice 2,
and `grace-remeasure-2026-08-17/zheermao101` pairs an omission at slice 1
with an addition at slice 0.
Both are named rather than subtracted:
this reading can say which pairs a human should look at,
and cannot say whether either is really one move.

### The one thing this run cannot support is the comparison it was bought for

Archive text drew five corroborated defects over 16 subjects
and fresh text drew one over 24.
That is the headline shape,
and it is NOT QUOTABLE from this run,
because this run measured no band.

`QNB` says a comparison resolves nothing narrower than the spread
the instrument moves through on unchanged input,
and that spread is known to be wide here without being known to be how wide.
It was seen directly during this task:
`grace-remeasure/Aniloviraw#0` read `claimed=1 corroborated=0` on a capped buy
and `claimed=5 corroborated=1 agreed=1` on this run,
identical text,
identical roster,
minutes apart.

The rows of this run carry no recorded text identity,
because the field that records it landed after the run started,
so the six character-identical subjects cannot be paired inside it
and the report says so instead of printing zeroes.
A second full run over the same 40 supplies the pairing at full width.
Until that lands,
the two halves are two single readings and the difference between them
has no scale to be read against.

### What is already worth saying

The per-voice rates do not reproduce `#68`.
Over the introduced-defect probe,
Qwen raised claims at about a tenth the rate of the other two.
Here the three voices are within a factor of two of each other
on both subjects-spoken-on and total claims,
and Qwen is not the quietest on subjects spoken on.
That is one run of 40 subjects against 857 probed regions,
so it does not overturn `#68`;
it says the quiet-voice finding is specific to that stage or that population
rather than a fixed property of the model,
and `#68` should be re-read on the stage it is going to gate.

Nemotron dropped 9 claims at the screen against 3 and 4 for the others,
and answered 37 of 40 against Qwen's 38 and gpt-oss's 40.
A voice that answers less often and anchors less well
contributes less than its seat suggests,
which is the same shape as `#68` in a different quantity.

## Provenance of the first run, which its own file gets wrong

The run file records pipeline digest `...b7d84b5b`.
That is not the build that produced these rows.

Every probe read its digest at the END of a run until this task,
and `dist` was rebuilt at 14:38:56Z while this run was in flight,
having started at 14:25:51Z.
So the file stamps a build that landed mid-run.
The build that actually ran is `...291b354f`,
which the capped run at 14:22:55Z recorded three minutes earlier.
That is an inference from the surrounding evidence rather than a reading:
nothing records a build in the 176 seconds between,
and nothing rules one out either.

The persisted file is left exactly as written.
The store is the record,
and editing a run to say something it did not say is worse
than a run with a wrong field and a note next to it.
All three probes now read the digest at run start,
so the second full run answers for itself.
