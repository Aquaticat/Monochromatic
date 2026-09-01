# Translation repair history: segment 2.2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

The buckets in the table above used an assumed expansion band of 1.5 to 2.5,
 which was a guess about zh-to-en character growth and was wrong.
A Chinese
 character carries roughly an English word,
so faithful translation expands
 several-fold in characters.
Measured over the same 254 pairs,
the corpus states
 its own band,
and it is tight:

```text
p2    0.74      p50   2.94      p90   3.76
p5    1.55      p75   3.35      p98   4.55
p10   1.83
p25   2.48
```

Median expansion is 2.94x.
Half the median,
1.47x,
is a defensible line for
 "this section carries materially less than a translation should",
and it is
 derived rather than picked.

Below that line sit 10 pairs of 254:

```text
shi_Yumiaoya    1203 ->   12   0.01
shi_Yumiaoya     988 ->   13   0.01
shi_Yumiaoya     695 ->   14   0.02
cheonwoomaeng   1137 ->  529   0.47
Y1Ran            215 ->  150   0.70
shi_Yumiaoya     474 ->  350   0.74
aiyysk           116 ->  153   1.32
Considerate_cat  143 ->  190   1.33
Chinatsu_Suzuki  667 ->  948   1.42
noname3031      1191 -> 1694   1.42
```

The first six are the finding:
three stubs,
and three sections carrying under a
 quarter of the expected text.
The last four sit near the line and are ordinary
 variation.
So roughly 6 of 254 pairs,
2.4%,
are genuinely under-covered,
which
 is the same figure the arbitrary buckets produced.
The number was right before
 and is now right for a stated reason.

`cheonwoomaeng` at 1137 characters rendered as 529 is new,
and it is not in
 `shi_Yumiaoya`.
Under-translation is therefore not confined to one entry,
even
 though the extreme stubs are.

### The 18 expanded pairs, resolved

They are not translator additions and not a pairing artifact:
17 of 18 sit in
 entries with no `structure-mismatch` finding,
and several have identical block
 counts on both sides (`1->1`,
`6->6`,
`8->8`,
`21->21`).
Given p98 is 4.55,
a
 ratio just over 4 is simply the top of the normal distribution,
and the ">4"
 bucket was an artifact of the guessed band.

Five pairs do stand clear of the distribution and remain unexplained:

```text
Zha_Ke          256 ->  4310   16.8
Mio             250 ->  2622   10.5
shihai4h       1813 -> 17764    9.8
zheermao101     615 ->  4655    7.6
MizuharaNagisa  456 ->  3030    6.6
```

Those are the candidates for genuine translator addition,
which house policy
 keeps when accurate.
Nobody has read them.

## Panel parity decides the crosscheck, and it decides against running it

The judge crosscheck of `#31` was re-scoped onto near-tie claims,
the ones where
 removing a single vote could change the plurality.
Counting them as entries
 accumulated produced a result that looked like slow progress and was actually a
 structural ceiling.

### The near-tie rate did not drift, it split by pipeline tip

```text
tip cf68fdd51   2 entries    18 near-ties of  66 claims   27%
tip 9cacc3f02   5 entries     5 near-ties of 253 claims    2%
```

An earlier projection of roughly four near-ties per entry came from averaging
 across that boundary.
It is not a rate;
it is two different regimes.

### The cause is the size of the panel, not its decisiveness

The first guess was that fuller panels produce bigger margins.
Measured,
that is
 false:
mean voters per claim rose from 5.54 to 6.00 while the mean margin FELL
 from 3.00 to 2.71.
What changed is parity.

```text
voters 5   claims  383   margins 0:5   1:169 2:3   3:115 5:91          flippable 45.4%
voters 6   claims 1372   margins 0:198 1:44  2:352 3:31  4:408 6:339   flippable 17.6%
```

With five voters a two-way split lands on an ODD margin,
and margin 1 is the
 single most common outcome,
169 of 383.
With six it lands on an EVEN margin,
so
 margin 1 falls to 44 of 1372,
and the margin-0 cases are exact ties that the
 panel files as `needs-human`,
which both scored arms already exclude.

So on scored claims under a full six-model panel,
the share a single removed
 vote could flip is about 3%.

### What that means for `#31`

The crosscheck asks whether a verdict survives re-asking with its author
 removed.
Under the current panel it cannot change more than roughly three
 verdicts in a hundred,
and reaching a reportable per-arm rate would need most
 of the remaining corpus.
Spending on the order of a thousand calls to bound a
 3% effect is a bad trade,
and the number it produced would be dominated by the
 parity of whichever panels happened to be full.

Recorded as the reason to stop rather than as a reason to wait.

### The finding worth keeping

Voice loss does not merely remove a voice.
It changes the PARITY of the
 electorate,
and parity changes the shape of the verdict distribution:
a
 five-voter panel produces margin-1 verdicts 44% of the time,
a six-voter panel
 3%.
Anything that reads margins,
including any future confidence weighting or
 gating,
is reading panel size as much as panel opinion.
That is a live property
 of the pipeline and nothing currently accounts for it.

## The verse rule described the wrong side of the pair

`#79`:
the editor replaced three correctly translated lines of `Toka_ls`,
a free
 verse entry,
with invented text,
one of them carrying a correct translation of
 a DIFFERENT line.
A computed predicate and an editor addendum had already
 landed for it.
Both were sound;
the sentence between them was not.

### What was already right

`isLineStructured` reads blank-line-separated blocks and fires when a slice has
 at least five of them at a median length of 30 or less.
It is deliberately
 computed rather than judged,
because an earlier heuristic attempt failed its
 positive control by ranking the one known verse entry 42nd of 54.

`buildEditorAddendum` applies it to the SOURCE and says why:
a translation may
 already have merged the lines that make the original verse,
so a predicate
 reading the target would never fire on the case the rule exists for.

Both claims were verified here against real corpus text through the shipped
 functions rather than taken from the comments:

```text
Toka_ls chunk 0   21 blocks  median  22   lineStructured=true
Toka_ls chunk 1    8 blocks  median  49   lineStructured=false
Toka_ls chunk 2    4 blocks  median  86   lineStructured=false
```

### What was wrong

The sentence handed to the editor opened `This region's CURRENT TEXT IS
 line-structured`.
Measured on the same chunk:

```text
Toka_ls chunk 0 SOURCE    21 blocks  median  22   lineStructured=true
Toka_ls chunk 0 CURRENT   18 blocks  median 101   lineStructured=false
```

So on the single case the rule exists for,
the editor was told something untrue
 about the text in front of it.
Worse,
the instruction continued `keep one
 output line per input line`,
and on a translation that has already merged its
 verse that asks for the merge to be preserved,
which is the opposite of the
 intent.

The rule now states what was measured,
that the ORIGINAL is line-structured,
and
 forbids what was actually observed rather than only the shape:
inventing a
 line,
dropping a line,
and filling one line with content belonging to another.
 A rule about line counts alone would have permitted all three fabrications.

### Corpus reach, re-measured

49 of 275 chunks across 31 entries,
against 55 of 286 across 34 recorded when
 the predicate landed.
The predicate did not change.
The ALIGNER did,
in `#71`,
 and chunk boundaries are its output,
so any figure counted in chunks has to be
 retaken after an aligner change.

### What is still not proven

That the corrected sentence changes what the editor does.
`Toka_ls` has still
 not settled in this pass,
so the direct evidence does not exist.
Nothing
 ENFORCES the rule either:
`isLineStructured` is read in exactly one place,
the
 addendum,
so line structure is requested of the model and never checked on its
 output.
A structural check at the apply gate would turn the request into a
 guarantee,
and it is the obvious next step if `Toka_ls` settles and still shows
 fabrication.

## Two magic numbers in a row, the second one better disguised

`#70` proposed re-designing the pipeline to PRODUCE a translation rather than
 repair one.
It died twice in one session,
and the second death is the one worth
 keeping.

### First death: the evidence measured the aligner

The premise was that many sections are only partly translated,
resting on a
 block-count gap of 60 of 172 pairs.
Recomputed under the forced aligner it is
 85 of 275,
and 81% of those pairs carry a full translation by character ratio.
 Block count conflates a stub with a reformatted paragraph.

### Second death: the dichotomy is false

`accuracy/omission` is already a first-class issue category,
and the recall
 benchmark is built by DELETING sentences from the published English and judging
 whether they come back against the Chinese.
Repairing an omission already IS
 translating the missing part from the source.
There is no repair mode needing a
 translate mode bolted beside it;
there is one path.

### The part I got wrong twice

Asked what should replace `#70`,
I proposed a per-entry escape hatch keyed on a
 character ratio.
The user rejected it:
a ratio keyed to a magic number
 inherently misses cases.
Correct,
and worse than they said,
because a ratio
 measures VOLUME rather than COVERAGE.
A section can sit at a healthy 2.5x while
 omitting half its sentences and expanding the rest,
and at section granularity
 it cannot see a skipped paragraph inside an otherwise sound section.

I then reached for "the measured restoration rate" as the thing to improve.
That
 is the same error wearing a lab coat.
Unpacked,
0.60 means:

```text
MIN_SENTENCE_LENGTH        40    only sentences over 40 chars can seed
descending length order          so it measures the LONGEST sentences
RESTORATION_WORD_THRESHOLD 1/2   "restored" is half the vanished words
CONTENT_WORD_MIN_CHARS     4     what counts as a word at all
denominator                      policy-declined and non-derivable removed,
                                 exclusions I adjusted the same night
```

So it reads:
of artificially deleted long sentences,
60% got at least half their
 four-plus-letter words back,
over a population I curated.
That measures the
 instrument,
not the pipeline.

### The distinction to hold

Not every number is a magic number,
and collapsing them would be its own error.
 The panel-parity result is FORCED:
six voters produce even margins because that
 is arithmetic about integers,
with no constant to choose.
Counts of things that
 exist are the same.
What is suspect is a CONSTRUCTED SCORE:
a threshold grader
 over synthetic defects with a curated denominator.
Tonight produced one of each
 and I labelled both "measured".

### What replaces it

For "can this pipeline supply missing translation",
the non-constructed
 observation is to run it on a section that is missing translation and READ the
 output.
`shi_Yumiaoya` carries three sections at ratio 0.01 to 0.02,
a thousand
 characters of Chinese against a dozen of English.
Either the critics file
 omission claims covering that and the editor supplies Chinese-derived text,
or
 it invents.
Three sections read carefully answer it;
no aggregate can,
and `PRF`
 already says to judge the content rather than trust that a generator ran.

That is n=1 and should be reported as n=1.

## Session close: what landed, what is running, what is unproven

### Landed and pushed

-   Judge crosscheck built and then STOPPED on its own measurement.
    `seatJudges`,
    `buildCrosscheckCensus` and `score-crosscheck` are shipped and tested;
    `#31` closed because panel parity bounds the whole measurement at about 3%.
-   Naturalness eligibility widened:
    the filter refused every paragraph
    containing a newline,
    discarding 782 soft-wrapped paragraphs to protect 29
    with real hard breaks.
    Verified after the change,
    120 eligible before
    against 404 now.
-   Verse addendum corrected:
    it asserted the CURRENT TEXT is line-structured
    while the predicate reads the SOURCE,
    and on the one entry it exists for
    those disagree (21 blocks at median 22 against 18 at median 101).
-   `--only Id1,Id2` on the corpus pass,
    so one entry can be run when that entry
    is the evidence.
    Runs into a throwaway `TRANSLATION_REPAIR_RUNS_DIR` by
    instruction,
    so a hand-picked document never enters a pool later draws treat
    as natural accumulation.
-   Every run report now prints `SOURCE <dir>` first.
    `score-crosscheck` read the
    wrong run and printed clean zeros that read as "nothing to report".
-   prefer-readonly findings 33 to 10 across two merges and six named types.
    Issue `#424` filed on the two remaining complaints;
    both were fixed on main
    within the session and the diagnostic now names the producing callable and
    line.

### Running

Two passes:
the main accumulation on the widened lane,
and `Toka_ls` alone in
 `translation-repair-runs-verse` for `#79`.
The acceptance check is written and
 structural only,
at `scratchpad/verse-check.ts`:
line count preserved,
no line
 emptied.
The recorded before-state is 95 corpus lines rendered as 101,
55 lines
 changed,
one emptied outright.

### Unproven, and stated as such

-   That the corrected addendum changes what the editor does.
    The before-state
    sits at tip `95f72e591`,
    several pipeline versions back,
    so a clean result
    means the CURRENT pipeline is sound on that entry and attributes nothing to
    the wording.
-   That the pipeline can supply missing translation on a near-empty section.
    `shi_Yumiaoya` is queued behind the verse run for exactly that,
    and the
    answer is three sections read directly rather than any rate.
-   Nothing ENFORCES the line rule.
    `preservation-check` catches deletion and
    says in its own header that substitution passes,
    and `#79` is substitution,
    so a deterministic guard would catch one fabrication of the three.

## Session 2026-08-13 late: verse fabrication measured, and two measurement bugs of my own

### `#79` is fixed, and the number that says so is not the one I first reported

The acceptance check I wrote earlier compared the two texts BY LINE INDEX.
That
is wrong the moment a line is inserted,
because everything after shifts,
so its
`emptied` and `changed` counts past the first insertion measure the shift rather
than the edit.
It also judged the WHOLE DOCUMENT on line count,
and `Toka_ls` is
one verse chunk plus two prose chunks,
so it condemned legitimate prose reflow.

Rewritten to measure the only thing that decides the question,
net line delta
inside the slices the addendum GOVERNS:

        run          tip          governed edits   net   prose edits   net
        pre-fix      95f72e591          55         +24        14         0
        source-fix   91ba66671          13           0        17        +5

`+24` fabricated lines inside verse becomes `0`.
The `+5` on the later run is
entirely in prose slices,
where reflow is what a repair is for.

The check lives at `scratchpad/verse-check.ts` and recomputes governance from the
shipped rule rather than assuming it.

### The predicate needs the CHUNK, and I measured it at the wrong unit twice

`isLineStructured` refuses to answer below five blocks,
because under that a
stanza and a couple of short paragraphs are indistinguishable.
Two readings I
took were invalid for exactly that reason and are deleted rather than kept:

-   one fed it whole-document BLOCKS and concluded `Toka_ls` has no verse;
-   one fed it individual replaced REGIONS and concluded no repaired region was
    line-structured.

Both could only ever return false.
Anything reading "0 line-structured" from that
period is an artifact of the unit,
not a finding.

At the correct unit the entry is unambiguous:

-   source,
    34 blocks,
    median 23 chars:
    line-structured
-   target,
    30 blocks,
    median 106 chars:
    not

That gap IS `#79`.
The published translation had already flattened the verse into
prose,
so a predicate reading the translation could never fire on the case it
exists for.
Only the original carries the structure.

### Governance is a union, and chunk-inheritance alone was a regression

Deciding per slice dropped the rule on most of the verse:
the `Toka_ls` verse
chunk trips at 21 blocks,
median 22,
subdivides into seven slices,
and only ONE
still trips.
Four of the other six sit at medians 20,
22,
23 and 29.

But moving the decision to the chunk alone was not a widening,
it REPLACED the
slice reading and lost ground.
Measured deterministically across the 92 entries
at the pinned corpus commit,
no model calls:

        slice only      55 governed slices
        chunk only     195 governed, but FOUR entries go BACKWARDS
                       interrgned 5 -> 1, three others 1 -> 0
        union          203 governed, zero entries lose ground

Those four are stanzas inside a section whose prose dominates the chunk median.
The union is not a compromise:
the predicate returns false both for "not verse"
and for "cannot tell",
so a true from either side is evidence and neither false
is evidence against.

The corpus-wide effect is a 3.7x widening of a prompt-shaping rule,
55 slices to
203 across 28 of 92 entries.
That is intended,
but it had never been measured,
and a `--only` run cannot see it.
`scratchpad/governed-widening.ts` recomputes it.

### Runs in flight

-   `translation-repair-runs-verse2`,
    `--only Toka_ls` at tip `080adcafa`.
    That
    tip carries chunk-only governance,
    NOT the union.
    For this entry the two
    agree,
    because pair 0's union adds nothing beyond its chunk verdict,
    so it
    remains valid evidence for `Toka_ls` and does not need restarting.
    It is not
    evidence about the union.
-   `translation-repair-runs-pass13` accumulation,
    restarted 19:41,
    working
    `MTF_0615`.

### `#426`: every artifact draw silently mixes pipeline generations

Artifacts record the repo commit they ran under,
as `tip`.
NOTHING reads it back.
Six readers glob the artifacts directory with no generation filter.

This is not hypothetical.
`pass13` holds 21 settled entries across three tips,
and tested with `git merge-base --is-ancestor` ALL THREE lack both behaviour
fixes that landed on 08-13,
`fc7912929` at 18:41 and `69b81eeec` at 19:40.
The
last artifact settled at 18:28.
So the pool of entries settled under the current
pipeline is ZERO,
not 21.

`#60`,
`#66` and `#68` all name "entries settled under the current pipeline" as
their input and none can be satisfied from that directory today.
**`#426` must
land before the next draw,
or the draw mixes generations.**
The spread is still
growing:
`pass13` loaded its source at 19:41 and keeps stamping that tip while
`SLICE_CACHE_VERSION` has since gone to 23.

### `#427`: what remains of the readonly rule findings

`prefer-readonly-parameter-types` went 10 to 3 in this package.
The seven that
cleared all had a workspace-owned producer and the `#424` origin naming pointed
at the right edit every time.

The three that remain bottom out in types this workspace does not own,
and
`ForeignBorrowed` does not reach them:
I marked the boundary at both placements,
on a parameter and on a local,
and the diagnostic was byte-identical each time.
Reported rather than worked around,
because three bespoke projections over
`@types/mdast` and `Intl.SegmentData` would satisfy the linter by making the code
worse.

Also recorded there:
with the three extracted effect rules temporarily set to
`error`,
this one package goes from 3 errors to 177,
effectively all
`no-opaque-parameter-effects`,
with `JSON.stringify` a large share,
plus 65
`SemanticBridgeError` warnings carrying bundled stack traces.

### `#426` landed: readers now name the generation they read

`censusByTip` partitions an artifacts directory by the commit each run recorded.
`selectEligible` turns that into what one draw may pool and REFUSES when the
directory spans generations and the caller named neither a required commit nor
deliberate pooling.
`resolvePool` reads the policy from the environment and
prints the census,
so a rate cannot be printed without the lines saying which
pipeline produced the entries under it.

        TRANSLATION_REPAIR_REQUIRED_COMMIT   commit an eligible pipeline must contain
        TRANSLATION_REPAIR_POOL_ALL=yes      opt into a deliberately mixed pool

Wired into the four readers that produce numbers:
`score-probe`,
`attribution-read`,
`draw-sample`,
`damage-sample`.
Deliberately NOT wired into
`corpus-pass`,
whose directory reads answer "which entries already settled" and
"how many exist now";
filtering those would make a pass re-run settled work.

Verified on the live directory,
both directions.
Unfiltered,
`score-probe`
refuses.
Requiring `fc7912929` it runs over 1 of 22 and names the other 21.

Two failure kinds are handled OPPOSITELY,
which an existing test forced and was
right to:

-   MALFORMED,
    would not parse:
    kept in the pool.
    `attribution-read` guarantees
    one corrupt file costs its own row and not the run,
    because a pass killed at
    its hard cap leaves truncated artifacts.
    Filtering it here would take the
    file from the reader whose job is to report it.
-   UNTAGGED,
    parsed but no commit:
    excluded and named.
    A real artifact of
    unknown generation is exactly what must not be pooled.

Neither throws.
The first version threw on both,
which would have let one
truncated file destroy every report over the directory.

### The current-generation pool is 1

`MTF_0615` settled 21:12 and is the first entry carrying both 08-13 behaviour
fixes.
Against `fc7912929` the eligible pool is 1 of 22.
`#60`,
`#66` and `#68`
need many more before any rate over them means anything;
the filter now makes
that visible instead of letting 22 read as the denominator.

## Session 2026-08-14: the translate stage, and three voting rules the user changed

The stage that renders a slice rather than repairing it exists and is tested.
Three user decisions landed with it,
and every one of them reaches wider than
the new lane.

### The lane itself

`runTranslateStage` in `package/module/translation-repair/src/translate-stage.ts`:

-   fans `buildTranslateMessages` to the translator roster through
    `gatherStageVoices`,
    one whole-slice rendering per model
-   assembles the slate in `translate-candidates.ts`,
    with the archive's own
    translation standing among the fresh renderings as one more candidate
-   ROTATES the slate by a hash of the source before judges see it,
    so the
    incumbent does not sit in one ballot position.
    Rotation rather than a
    shuffle,
    and keyed on the slice rather than on a draw,
    because a resumed
    slice has to ask the judges the same question a fresh one did
-   ships the incumbent on every failure path,
    and records WHY separately from
    WHAT:
    `decision` distinguishes `judged` from `declined-indecision`,
    `declined-rejection`,
    `sole-candidate` and `no-candidate`,
    so a tie that
    keeps the incumbent is never counted as the incumbent winning
-   judges a sole FRESH candidate rather than shipping it unexamined,
    and skips
    the round only when the sole survivor IS the incumbent,
    where nothing could
    change

`CandidateProducer` gained an `incumbent` variant carrying `matched`,
the models
that independently produced identical text.
A stand-in model id was rejected on
both counts:
it would discount a model that never saw the text and inflate the
producer count the roster guard is arithmetic over.
Incumbency survives a
duplicate collapse,
so "the human translation was kept" cannot be reported as
"a model rewrote it identically" on the slices where the two are the same bytes.

The translator prompt now carries the line-structure fact,
which the editor
addendum carried and the prototype did not.
`Toka_ls` is the case:
21 source
blocks at median 22 characters against 18 target blocks at median 101.
A
translator shown only the merged translation reproduces the merge.

### Decision: no stage waits for its whole roster

User,
2026-08-14:
"full roster should never be a retry target for anything,
because that will block everything even if only one or two model of the
provider is degraded for the day."

`retryTarget` is gone from `gatherStageVoices` entirely rather than left unused,
and the editor and refiner stages that passed `full-roster` no longer do.
This
REVERSES the 2026-08-12 choice recorded under "Every fan-out stage now has a
quorum one voice cannot meet",
which was made believing Kimi-K3 was dead.
The property that choice protected survives without it:
editors,
refiners and
checkers all sit at three with a quorum of two,
so no stage is decided by one
model either way.
