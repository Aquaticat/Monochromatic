# Whole-repo oxlint timing, first attribution

Opened against issue #374,
 which asks for a warm whole-repo `mise run lint:oxlint` under sixty
seconds.
Measured 2026-08-08 on the machine running this session.
No optimization proposed yet:
 this records where the time goes,
 because every number quoted
for this before was a cold run.

## What was measured

Warm run,
 with `node_modules/.cache/prefer-readonly-parameter-type` populated by the previous
sweep:
 3m04.7s wall,
 2m36.8s user,
 30.0s system.
The cache is 45 MB.

Cold runs of the same command through this session,
 with that cache deleted first:
 10m24s to
11m10s across eight measurements,
 clustering near 10m45s.

So the persistent summary cache removes roughly seventy per cent of the work,
 and the warm
figure is about three times the target rather than the eleven times a cold number implies.

Findings are identical between the warm and cold runs,
 1555 in both,
 with the same error and
warning totals.
That matters before trusting any timing:
 a cache that changed results would make the fast number
meaningless,
 and this one does not.

## Which three minutes

Measured by turning the one rule off in `oxlint.config.ts`,
 keeping the same task, invocation
and warm cache,
 and putting the file back afterwards.

Warm run with `prefer-readonly-parameter-type/prefer-readonly-parameter-types` disabled:
**13.0s** wall,
 against 3m04.7s with it on,
 and zero findings from it confirming it really was
off.

So this rule is about 171 of the 184 seconds,
 roughly ninety-three per cent of warm whole-repo
lint time.
Everything else oxlint does across the repository,
 core passes and every other plugin together,
is thirteen seconds.

That reframes issue #374 entirely.
The target is not a broad performance problem to chase across the linter;
 it is one rule,
 and
the rest of the run already sits comfortably inside sixty seconds with two thirds of the budget
to spare.
Reaching the target means taking this rule from 171 seconds to about 47,
 a factor of three and
a half,
 with no other component needing to change.

## What this does not yet say

### How to measure the next split, and what tripped

`EffectAnalysisBudget` in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-analysis-budget.ts`
already receives every timed span through `record({ startedAt, phase, },)`,
 and already knows
the phase label.
It accumulates only a single total,
 so the breakdown needs a temporary map keyed by the first
word of the label plus a dump on process exit.
That instrumentation type-checks and is the shortest path to the answer.

What tripped is the harness rather than the method:
 the run takes about three minutes and a
foreground command is cut off at two,
 which killed the workers before the exit handler wrote
anything and left the instrumented file in place until it was restored deliberately.
Run it in the background.

Only five sites report a phase at present,
 so the breakdown will account for part of the 171
seconds rather than all of it,
 and the size of the unaccounted remainder is itself the useful
number:
 it says how much sits outside every span the rule currently times.

### Which phase, measured

Warm run with per-phase accumulation,
 summed across every worker:

- `source` 583.3s
- `project` 23.4s
- `fixed-point` 4.5s
- `foreign` 0.8s
- 611.9s recorded in total

Two cautions before reading anything into those,
 both of which change what the numbers mean.

The total exceeds the rule's 171 seconds of wall time because the sweep runs workers in
parallel and each contributes its own spans,
 so these are worker-seconds and only their
*proportions* are meaningful.
And only five sites report a phase,
 so 611.9 worker-seconds is the total of instrumented spans
rather than of the rule's work;
 what falls outside them cannot be derived from this,
 because
wall time and summed time are not comparable under parallelism.

Within what is instrumented,
 `source` is 95.3 per cent and nothing else is close.

That is the phase to look at next,
 and the sharper question it raises is why it costs so much on
a *warm* cache:
 the cache exists to avoid re-deriving summaries,
 and a source phase still
dominating afterwards suggests either that it covers work the cache does not cover,
 or that
reuse is missing more often than intended.
Answering that needs the phase broken down further rather than another total.

### What the earlier suspects were


The suspects are the whole-program summary construction,
 the checker queries each summary
makes,
 and the per-file diagnostic pass,
 and nothing here separates them.

Nor does it say what the cache is worth per phase.
Cold costs 645 seconds against 184 warm,
 so 461 seconds are avoided by reuse,
 but whether the
remaining 171 is mostly unavoidable analysis or mostly cache misses is unmeasured.

## Why the cold number was the one being quoted

Every sweep in `doc/planning/prefer-readonly-return-substitution.md` deletes the cache first,
deliberately:
 a warm cache masked an analysis-internal failure earlier in that work,
 and the
guarded failure there is a wrong offer rather than a slow run.

Correct for that purpose and misleading for this one.
Anyone reading those eleven-minute figures as the cost of linting this repository would
conclude the target is an order of magnitude away.
It is closer to three times,
 and the first question is which three minutes.

### Why `source` costs so much warm, measured and then doubted

Instrumented the hit and miss branches inside `loadSource` and ran the warm sweep:
 4899 calls,
2584 hits and 2315 misses,
 a 47.3 per cent miss rate on an unchanged repository.

That would answer the question cleanly.
Nearly half of all source loads redo semantic analysis despite a populated cache,
 which is
where the seconds would be.

It is not safe to report yet,
 and the reason is the instrumentation itself.
Measuring required editing `effect-demand-index.ts`,
 which is plugin source.
If the layered summary cache keys on plugin identity or content in any way,
 then editing the
plugin invalidated every entry and the miss rate is an artifact of the act of measuring rather
than a property of the rule.

A quick search for a plugin version or hash in the cache key found nothing,
 which is weak
evidence against the confound and not enough:
 absence of a match for the names guessed is not
absence of the mechanism.

To settle it,
 either read `layered-summary-cache` and establish exactly what the key contains,
or measure without touching plugin source,
 for instance by counting from the cache directory's
own contents across two consecutive unmodified runs.
Until one of those is done the 47.3 per cent should be treated as unmeasured.

This is the same failure this repository's `QPC` and `QIV` rules were written for,
 reached
from a new direction:
 not an instrument that could not see a difference,
 but one that created
the difference it then reported.

#### Settled: the miss rate was an artifact

Read the key rather than guessing at its field names.

`effect-summaries.ts` builds
`projectDigest = contentDigest(`${projectFingerprint.digest}\0${analysisRoot ?? ''}`,)`,
 and
`effect-summary-cache.ts` stores each entry under that digest together with the file's own
`sourceText`.

Both halves are reached by editing a plugin file.
The plugin's own sources sit in the workspace this command lints,
 so changing
`effect-demand-index.ts` changes that file's `sourceText` directly and feeds a project-level
fingerprint that is not per-file.

So the 47.3 per cent miss rate measured the cost of having just edited the analyzer,
 not the
cost of running it.
Withdrawn.

The earlier search for a plugin version or hash found nothing and was read as weak evidence
*against* the confound.
It was evidence of nothing:
 the mechanism is there under names that describe the project
rather than the plugin,
 and the plugin is part of the project.
Guessing field names is not reading a key.

What remains true and unaffected:
 the warm run is 3m04.7s,
 the rule is ninety-three per cent
of it,
 and `source` is ninety-five per cent of instrumented spans.
Those came from runs with no plugin edit in place.

Measuring the warm miss rate needs a method that touches no plugin source,
 such as reading the
cache directory's own contents across two consecutive unmodified runs.

#### Measured without touching the plugin: the cache is not the problem

Two consecutive `mise run lint:oxlint` runs with the working tree clean,
 comparing the cache
directory's own contents by path, modification time and size.

- 4104 entries after the first run,
 4124 after the second
- 4095 identical across both
- 29 rewritten or added

A hit does not rewrite its entry,
 so 29 of 4124 is an upper bound on misses:
 about 0.7 per
cent,
 and lower still if any of those rewrites are ordinary bookkeeping rather than
recomputation.

That refutes the withdrawn 47.3 per cent outright,
 by a method with no plugin edit anywhere
near it.
Cache reuse on an unchanged repository is essentially complete.

So the 171 seconds are not cache misses,
 and improving the hit rate is the wrong target.
The time is spent on work that happens *despite* hits:
 candidates are the cache read and
validation path itself,
 which runs for every one of those 4000-odd entries,
 and whatever
per-source work sits inside the `source` span outside `loadSource`'s cached branch.

That is the next thing to separate,
 and the method is now established:
 measure from outside the
plugin,
 or accept that any edit to it invalidates what is being measured.

#### The cache read is not it either

Bounded from outside the plugin,
 by a standalone script reading and parsing every file in the
cache directory:
 4124 files,
 71.1 MB,
 **0.26s** single-threaded,
 with all 4124 parsing as JSON.

So deserialising the entire cache costs a quarter of a second against 171 seconds of rule time.
The read and validate path is eliminated as the explanation,
 and with cache misses already
eliminated at 0.7 per cent,
 both candidates named in the previous section are gone.

One number worth carrying to whoever continues:
 the confounded run counted 4899 `loadSource`
calls against 4124 cache files on disk.
If that call count survives re-measurement by an uncontaminated method,
 then roughly 775 loads,
about sixteen per cent,
 have no cache entry to hit at all,
 and full analysis of those would be
a candidate the phase labels do not currently distinguish from cached ones.
It is a lead rather than a finding,
 since its source is the run that was withdrawn.

What is established for issue #374,
 all of it from runs with no plugin edit in place:
 warm is
3m04.7s,
 the rule is ninety-three per cent of it,
 `source` is ninety-five per cent of
instrumented spans,
 cache reuse is essentially complete,
 and reading the cache is free.
The remaining time is per-source work done despite hits,
 and separating it needs instrumentation
inside the plugin,
 which is precisely what the cache key makes self-defeating.
Resolving that tension is the first problem for whoever takes this further,
 not the profiling.

#### The tension resolves by running the instrumented build twice

The obstacle was that instrumenting the plugin changes the cache key,
 so a probe measures its
own edit.
The fix needs no cleverness:
 run the instrumented build twice.
The first run repopulates the cache under the new fingerprint and the second is genuinely warm
relative to that code,
 with the counters differing from production only by two integers.

- Run A,
 repopulating:
 4778 calls,
 51.5 per cent hits,
 48.5 per cent misses
- Run B,
 warm:
 4764 calls,
 **100.0 per cent hits,
 zero misses**

Run A reproduces the withdrawn 47.3 per cent almost exactly,
 which confirms what that number
was:
 the cost of repopulating after an edit,
 measured once and mistaken for steady state.

Run B is the answer.
Every single one of 4764 source loads hits,
 and the run still takes 2m49s.

So the rule's warm cost is entirely work done *despite* a perfect hit rate.
With deserialising the whole cache measured at 0.26s,
 it is not reading the entries either.
Whatever `loadSource` does with a hit beyond reading it,
 validation and reconstruction being
the obvious candidates,
 or work in the `source` span outside `loadSource` altogether,
 is where
the 171 seconds are.

That is a much smaller haystack than this section started with,
 and the method for searching it
is now established rather than blocked.

#### Withdrawn too: `source` is not ninety-five per cent

The phase split recorded earlier came from a single instrumented run,
 which is the same
mistake as the miss rate and was not noticed at the time.
Re-measured with the two-run method:

- Run A,
 repopulating:
 `source` 595.0s (95.7 per cent),
 `project` 21.2s,
 `fixed-point` 4.6s,
`foreign` 0.8s
- Run B,
 warm:
 `project` 21.8s (87.3 per cent),
 `source` **2.0s** (8.0 per cent),
 `foreign`
0.8s,
 `fixed-point` 0.4s

Run A reproduces the withdrawn 95.3 per cent,
 confirming its origin.
Warm,
 `source` is two worker-seconds,
 not five hundred and eighty-three,
 and the phase that
led every earlier conclusion in this document leads nothing.

The larger fact is the total.
Warm,
 every instrumented span in the rule sums to **25.0 worker-seconds** while the rule takes
about 169 seconds of wall time,
 across workers that together have far more than 25 seconds of
work to do.

So the rule's own phase instrumentation accounts for almost none of its warm cost.
The time is outside every span the analyzer currently times,
 which points at the per-file
diagnostic pass or setup that no `record` call wraps,
 rather than at anything measured so far.

That is where the search should start,
 and it is not where any earlier section of this document
pointed.

#### What survives, and what does not

Sound:
 warm total 3m04.7s,
 ninety-three per cent of it attributable to this rule by disabling
it,
 cache hit rate 100 per cent warm,
 cache deserialisation 0.26s.
Each came from runs whose instrumentation could not affect what they measured.

Withdrawn:
 the 47.3 per cent miss rate,
 and the ninety-five per cent `source` share.
Both came from single instrumented runs and both are now explained rather than merely
replaced,
 which is the only reason to trust the corrections more than the originals.

Two of the five substantive numbers in this document were wrong in the same way,
 and the second
survived a reading pass that was looking for exactly that fault.

#### Where to instrument next, and the shape the edit must take

The target is the rule's per-file entry:
 `Program` in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types.ts`,
which opens a semantic file session inside a `try` and is wrapped by no `record` call.
Timing entry to exit there,
 summed and compared against the rule's 169 warm seconds,
 says
directly whether the unaccounted time is inside the rule body or in setup around it.

An attempt at that edit failed and is worth describing so the next one does not repeat it.
The visitor's body is a single `try` whose `catch` uses a logger bound above it,
 so splicing a
timing `try` around the outside by text substitution detaches that binding and the file stops
compiling with `Cannot find name 'rl'`.
The edit needs to add accounting *inside* the existing `try` and a `finally`,
 not wrap it.

Run it with the two-run method like everything else here,
 and read run B only.

The three cautions this document has earned,
 in the order they bit:

1. Instrumenting the plugin changes the cache key,
 because the key derives from a
project-level fingerprint and the plugin's sources are in the linted workspace.
Run twice and read the second run.
2. Recorded spans are summed across parallel workers,
 so they exceed wall time and only
proportions are comparable.
3. The rule's own phase labels cover a small fraction of its warm work,
 so a breakdown of them
is not a breakdown of the rule.

#### Found: the time is inside `Program`, outside every phase span

Instrumented the per-file entry as described,
 accounting inside the existing `try` with a
`finally`,
 and run twice.

- Run A,
 repopulating:
 636.7 worker-seconds across 2080 file visits,
 306.1ms per file
- Run B,
 warm:
 **172.3 worker-seconds across 2080 file visits,
 82.8ms per file**

The rule contributes about 171 seconds to the warm wall time,
 and `Program` accounts for 172.3
worker-seconds of it,
 so the per-file visitor is essentially the whole cost rather than a part
of it.

Set that against the 25.0 worker-seconds all instrumented phases sum to,
 and roughly **147
worker-seconds,
 about eighty-five per cent,
 sits inside `Program` and outside every span the
analyzer times.**

That is the answer this section has been circling.
The warm cost is not summary construction,
 not cache misses,
 not reading the cache,
 and not
any labelled phase.
It is the per-file work that happens after `buildEffectSummaryIndex` returns:
 opening the
semantic file session,
 and verifying each callable to decide what to report.

Eighty-three milliseconds per file across 2080 files is the shape of the target,
 and the
repopulating figure of 306ms per file gives the contrast:
 even with every summary already
built,
 each file still costs a quarter of what a full analysis costs.

Whoever optimizes this should start by splitting those 82.8ms between session opening and
per-callable verification,
 which is one more `finally` in the same visitor and the same two-run
method.

#### The split: index construction dominates even at a perfect hit rate

Same visitor,
 accounting around `openSemanticFile` and `buildEffectSummaryIndex` with the
remainder attributed to verification,
 run twice.

Run B,
 warm,
 172.1 worker-seconds across 2080 files:

- `buildEffectSummaryIndex` **104.0s,
 60.4 per cent,
 50.0ms per file**
- verification of callables 56.5s,
 32.8 per cent,
 27.2ms per file
- `openSemanticFile` 11.5s,
 6.7 per cent,
 5.5ms per file

Run A,
 repopulating,
 for contrast:
 546.6s index,
 54.3s verification,
 11.0s session.

Two things follow.

The index build is the target.
It costs 104 warm seconds *with every summary a cache hit*,
 down from 546 when they are not,
so the cache already removes eighty-one per cent of it and fifty milliseconds per file remain
regardless.
That residue is per-file index construction rather than analysis:
 assembling and wiring an
index from summaries already in hand.

And it reconciles the earlier finding.
Instrumented phases sum to 25.0 warm worker-seconds while `buildEffectSummaryIndex` alone takes
104.0,
 so roughly seventy-nine seconds are spent inside that call in code no `record` wraps.
The untimed eighty-five per cent is not scattered:
 it is nearly all inside index construction.

Verification is second at 27.2ms per file and worth knowing about,
 since it barely moves
between the two runs,
 11.0s against 11.5s for the session and 54.3s against 56.5s for
verification.
Both are insensitive to the cache,
 which is expected:
 they work from the index rather than
building it.

#### Reaching sixty seconds

The rule must go from about 171 seconds to about 47 for the whole command to fit the target.
Removing index construction entirely would leave roughly 68 warm seconds of rule time,
 which is
still over.
So the target is not reachable by fixing one of these three alone,
 and any plan for #374 has to
say which combination it intends.

#### The index is reused; deciding whether to reuse it is what costs

`buildEffectSummaryIndex` does hold a whole-index cache,
 `cachedFinalEffectIndex`,
 with an
early return.
So the index is not simply rebuilt per file.
Measured warm,
 across 2080 calls:

- final-index hits **64.4 per cent**,
 1340 of 2080
- work performed *before* the cache check:
 **63.8 worker-seconds,
 30.7ms per call**

That is 61 per cent of the 104 warm seconds spent deciding whether the cached index applies,
paid on every file whether it hits or not.

The pre-check work is the key computation itself:
 collecting file names,
 building
`indexedSourceFileMap`,
 then `contentDigest` over every indexed file name sorted and joined.
The digest is over the whole file list,
 so its cost scales with project size and is repeated
once per linted file:
 2080 files each hashing a list of some four thousand names.

So the answer to "is the index rebuilt per file" is no,
 and the useful finding is the one
underneath it:
 a cache whose lookup costs 30.7ms cannot pay for itself at this call frequency,
and roughly 64 of the 171 warm seconds are spent on cache administration rather than on
analysis or on reporting.

The remaining 35.6 per cent of calls miss and build the index fully,
 which is the other half of
the 104 seconds.

Two independent directions follow,
 and both are now grounded rather than guessed:
 make the
key cheaper,
 since the file list does not change within a run and its digest could be computed
once per worker;
 or raise the hit rate above 64 per cent,
 since a third of calls still rebuild.
The first looks like the larger and safer win,
 and neither has been attempted.
