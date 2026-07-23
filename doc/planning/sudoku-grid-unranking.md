# Completed Sudoku grid unranking

## Goal

Build a package that maps every integer in
`0n <= index < 6_670_903_752_021_072_936_960n`
to exactly one completed 9 by 9 Sudoku grid.
Every completed grid must have exactly one index.

The interface under consideration is:

```ts
unrankCompletedSudoku(index: bigint): CompletedSudoku
```

An inverse `rankCompletedSudoku` can share the same canonical decomposition,
but decode-only behavior remains the requested scope.

## Rejected positional encoding

A fixed radix over 81 cells indexes every filled grid,
not only completed Sudoku grids.
Valid completed grids form a sparse subset,
so base-9 decoding cannot make every in-range index valid.

Cell-by-cell lexicographic unranking is mathematically correct:
each candidate digit receives a range sized by its number of valid completions.
It is not the implementation direction because it repeats exact completion counting throughout one lookup.

## Structural unranking

Felgenhauer and Jarvis counted
`6_670_903_752_021_072_936_960` completed grids.
Their normalization separates each grid into:

- one of `3_546_146_300_288` reduced grids;
- one digit relabeling among `9!` choices;
- one top-band normalization inverse among 72 choices;
- one left-stack normalization inverse among 72 choices.

The factors satisfy:

```text
3,546,146,300,288 * 9! * 72 * 72
= 6,670,903,752,021,072,936,960
```

A full unranker can therefore split the input into a reduced-grid rank and a mixed-radix transformation rank.
The transformation rank uses permutation unranking and fixed row or column operations.
The reduced-grid rank remains the irregular part.

The decomposition must define a deterministic canonicalization and inverse ordering.
Applying arbitrary Sudoku symmetry elements is insufficient because general symmetry orbits can have stabilizers.

## T-Doku reduced-grid index

T-Doku commit `af426180dc53aef89b82868e7b3fdfcf42165654`
implements numbered access to the reduced grids.
It combines 36,288 normalized top-band configurations with 36,288 normalized left-stack configurations.
A generated `uint16_t` table stores the number of completions for every pair.
A sparse checkpoint index locates the neighborhood of a requested reduced rank.
T-Doku then enumerates only within the selected structural configuration.

Measured release assets:

- `grid.counts`: `2_633_637_888` bytes;
- `grid.index`: `20_291_214` bytes;
- compressed `tables.tar.xz`: `471_499_152` bytes.

The release notes state that generating the tables requires about 500 core-hours.
The source's example reports about 8 hours with 64 processes on a Threadripper 2990WX.
These are upstream measurements,
not measurements from this repository.

## Lookup benchmark

The released tables and exact T-Doku commit were built and exercised in a Fedora 44 container
capped at 4 GiB RAM and 2 CPUs.
The AVX2 executable was built inside the same container image used for execution.

A warm-cache batch of 1,000 random reduced-grid lookups completed in:

```text
Time (mean +/- sigma): 455.5 ms +/- 9.2 ms
Range: 441.7 ms to 462.8 ms
Runs: 5
```

This is 2,195 lookups per second when calculated from the measured mean.
The batch includes one container startup and table mapping per run.
It does not measure the unimplemented full-grid inverse transformations.

A 100-lookup batch measured `171.6 ms +/- 10.0 ms` over 5 runs,
showing that process and mapping overhead matter for short-lived batches.

## Endpoint defect found during verification

Unpatched T-Doku `grid_tools list_grids` reads one count past `grid.counts`
when a requested range ends in the final reduced-grid pattern.
The resulting `SIGSEGV` is unrelated to lookup throughput.
A one-line early-return prototype passed first-index and final-range probes.

Diagnosis and upstream-ready issue draft:
[`doc/troubleshooting/tdoku-final-grid-enumeration.md`](../troubleshooting/tdoku-final-grid-enumeration.md).

## Implementation options

### Full extracted table

Pros:

- Exact contiguous unranking.
- Existing source and released data.
- Measured random-access throughput.
- Memory mapping avoids loading the full table into JavaScript heap memory.

Cons:

- `471_499_152`-byte download.
- `2_653_929_102` extracted bytes across both table files.
- Requires a native or WebAssembly structural enumerator rather than a TypeScript-only implementation.

### Independently compressed table blocks

Pros:

- Preserves exact unranking.
- Reads and decompresses only the selected count block.
- Can avoid keeping the extracted count table on disk.

Cons:

- Requires a new random-access asset format and generator.
- Distribution size and lookup performance are unmeasured.
- Still depends on precomputed completion counts.

### Completion counts on demand

Pros:

- Avoids the released count-table asset.
- Keeps the data distribution small.

Cons:

- Moves the irregular indexing work back into each lookup.
- No measured implementation currently meets the package's performance expectation.
- A decision-diagram alternative has no demonstrated compact representation for all blank-grid solutions.

Ranking:
full extracted table > independently compressed blocks > on-demand counts.
The extracted table ranks first because it is the only exact approach with working source,
released data,
and measured lookup throughput.
Compressed blocks rank next because they preserve exactness but require implementation and measurement.
On-demand counting ranks last because it recreates the cost rejected during design review.

## Open decision

Implementation depends on the acceptable data budget.
The next action is to choose between the measured extracted-table design and an unmeasured block-compressed asset design.
A small package with no count data cannot simultaneously promise fast lookup,
full coverage,
and a one-to-one contiguous index under the evidence gathered so far.

## Sources

- Bertram Felgenhauer and Frazer Jarvis,
  [Enumerating possible Sudoku grids](http://www.afjarvis.org.uk/sudoku/sudoku.pdf).
- T-Doku,
  [`src/grid_lib.cc`](https://github.com/t-dillon/tdoku/blob/af426180dc53aef89b82868e7b3fdfcf42165654/src/grid_lib.cc).
- T-Doku,
  [`src/grid_tools.cc`](https://github.com/t-dillon/tdoku/blob/af426180dc53aef89b82868e7b3fdfcf42165654/src/grid_tools.cc).
- T-Doku,
  [`tables` release](https://github.com/t-dillon/tdoku/releases/tag/tables).
- Ben Lynn,
  [Sudoku ZDD notes](https://crypto.stanford.edu/pbc/notes/zdd/sudoku.html).
