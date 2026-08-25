# Measuring test coverage in `module-translation-repair`

Recorded 2026-08-25, after the measure that scoped `#231` turned out to be
measuring something else.

`PKG` says a package is unfinished until its tests cover every exported code
path,
and `TCV` says that means enumerating implementation branches rather than
counting green suites.
This package is large enough that the enumeration has to be mechanical,
so the question becomes which mechanical measure actually answers it.

## The measure that stopped working

`#208` and `#209` measured MODULE reachability:
build the import graph,
mark a module reached when a test names one of its exports,
propagate along import edges,
and report what is left.

That measure reported `unreached that export something: 0` on 2026-08-25,
which reads as complete coverage and is not.

It was inflated by `#231`'s own work.
`#231` added eleven `corpus-run/` helpers to barrels,
and a barrel re-export is an import edge like any other.
So naming any one helper in a test marked the barrel reached,
and the barrel then reached every module it re-exported,
whether or not a test touched them.
The measure improved because the graph got denser,
not because anything got tested.

A second, quieter failure is that module reachability is too coarse even when
the graph is honest.
A module counts as reached when ONE of its exports is named,
so a module with a covered export and an uncovered one reports clean.
`gatherRelabelCases` was invisible that way:
its module `probe-relabel-case.ts` counted as reached because
`locateSlice` beside it had a test.

## The measure that replaces it

Ask the per-function question directly:
does any test name this exported function.

```sh
# From package/module/translation-repair.
# Collect `export function` and `export async function` names per module,
# skipping `*-barrel.ts` and `index.ts` because a barrel's re-export list is
# not its own API, then check each name against the concatenated test sources.
```

Run on 2026-08-25 this reported 107 exported functions no test names,
50 of them under `corpus-run/`.

A bare 107 is not actionable,
so split it by whether a caller can carry a test to the function:

-   72 are called from a module whose own exports ARE named by tests.
    These are exercised transitively.
    Whether `TCV` is satisfied depends on whether the caller's cases drive each
    branch, which the measure cannot see, so these need reading rather than
    counting.

-   19 are called ONLY from modules no test touches.
    Nothing exercises these at all;
    the chain from every test to them is broken.
    This is the real gap.

-   16 are called from no other module at all.
    Either same-module helpers the caller scan excludes by construction,
    or dead code.
    Each needs a ruling before a test is written for it,
    on the precedent `#80` set:
    wire it up or delete it.
    A test written for dead code is worse than no test,
    because it makes the code look load-bearing.

`#232` carries the list and the working order.

## What to rank first inside the 19

Assertions come first.
A guard nobody tested is a guard that may not fire,
and `#224` found exactly that:
the defect was the OPEN rather than the message,
so every reading of the message would have passed while the guard did nothing.

Draw and sampling helpers come next.
`sampleBenchSlices` is reached from four calibration entry scripts,
and a biased draw silently tilts every measurement seated on it
rather than failing.

## What not to do

Do not re-run module reachability to check progress on `#232`.
It cannot see per-function gaps,
and every barrel addition makes its answer better without making the package
better.

Do not read a first-try pass as evidence.
Every guard added under `#231` was proved by removing it,
rebuilding,
running,
and restoring,
per `GFP`,
and two of the three rounds failed exactly their own cases.
The third could not say:
`await describe` throws,
so a failure in the first suite aborts the file before the second suite runs,
and a GFP round whose mutation lands in the first suite proves nothing about
the second.
Split the suites across files when a round needs to read both.
