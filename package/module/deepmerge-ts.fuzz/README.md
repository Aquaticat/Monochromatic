# @monochromatic-dev/module-deepmerge-ts.fuzz

Consumer-side verification of the third-party
[`deepmerge-ts`](https://github.com/RebeccaStevens/deepmerge-ts) package:
a fast-check property campaign,
a reference model of its documented semantics,
a known-defect registry,
type-level tests,
and a V8 coverage-reachability gate.

Non-runtime sidecar:
nothing here ships,
and deepmerge-ts is a dev dependency only.
Decisions,
evidence,
and open items:
`doc/handover/deepmerge-ts-hardening.md`.

## What is checked

- `src/merge-model.property.unit.test.ts`:
   `deepmerge`,
   `deepmergeCustom({ maxDepth })`,
   `deepmergeInto`,
   and both `FastUnsafe` variants agree with `src/model.ts` on generated trees
   (accessors,
   hidden keys,
   null prototypes,
   frozen records,
   prototype-named keys,
   symbols,
   Sets,
   Maps).
- `src/merge-invariant.property.unit.test.ts`:
   inputs are never mutated,
   `Object.prototype` is never polluted,
   `undefined` arguments are neutral,
   and same-chain cycles merge into a result with that cycle.
- `src/model.unit.test.ts` and `src/json-case.ts`:
   the model against documented examples,
   independent of deepmerge-ts,
   plus a JSON-serializable corpus intended for the Rust unified-linter merge.
- `src/realm.ts`:
   realm-independent record,
   Set,
   and Map checks shared by the model and `src/shape.ts`,
   pinned by `src/realm.unit.test.ts`.
- `src/exotic-*.ts`:
   subclasses,
   typed arrays,
   boxed primitives,
   Proxies,
   and other-realm objects against the model,
   plus characterization of `isRecord` branches and non-writable `deepmergeInto` targets.
- `src/options-*.ts`:
   the four `*Custom` entry points against an options-aware model over generated option plans
   (custom and disabled merge functions,
   `actions.skip` and `actions.defaultMerge`,
   filters,
   `enableImplicitDefaultMerging`,
   `maxDepth`).
- `src/alias-*.ts`:
   shared references,
   cycles through records,
   arrays,
   Sets,
   and Maps,
   and `deepmergeInto` aliasing,
   checked by a graph bisimulation oracle under upstream's cycle rule.
- `src/scale-width.unit.test.ts`:
   linear scaling of wide two-input merges.
- `src/known-defect*.unit.test.ts`:
   each known runtime divergence asserted to still reproduce,
   so an upstream fix turns it red.
   The comment on each test names the generator region it excludes.
- `src/accepted-behaviour.unit.test.ts`, `src/exotic-behaviour.unit.test.ts`, and `src/alias-accepted.unit.test.ts`:
   accepted but otherwise untested behaviour
   (the default `maxDepth` fallback,
   getter flattening,
   frozen targets,
   single-input reference sharing).
- `src/type-*.unit.test.ts`:
   `expectTypeOf` pins of result types beside runtime values;
   `src/type-known-defect.unit.test.ts` pins result types the runtime contradicts.
- `src/type-soundness.generated.ts`:
   1000 generated calls (600 on widened literals, 400 on `as const` literals checked for exact literal and tuple types)
   whose runtime results must type-check against their static result types;
   `src/type-soundness.unit.test.ts` replays them at runtime.
- `src/declared-type-*.ts`:
   the same soundness check over generated declared types
   (unions,
   optional keys,
   index signatures,
   tuples,
   `deepmergeInto` targets);
   `src/declared-type-soundness.generated.ts` keeps the fixed-seed draws outside pinned classes,
   and `src/type-known-defect-declared.unit.test.ts` pins the classes it found.
- `src/mutation-*.unit.test.ts`:
   example tests that detect the upstream mutants the rest of the suite missed
   (custom merge functions, cycle resolution, record paths, custom metadata),
   each naming the mutant ids it kills;
   method and results in `doc/audit/deepmerge-ts-mutation-2026-09-24.md`.

Machine-local files matching `*.local.*` (gitignored) hold embargoed security findings until upstream publishes an advisory.

## Running

```bash
# Bounded, fixed-seed layer (also what the coverage gate measures)
mise run //package/module/deepmerge-ts.fuzz:test:unit

# Result types, including the generated soundness corpus
mise run //package/module/deepmerge-ts.fuzz:lint:types

# Unbounded campaign in a 2 GiB / 2 CPU podman container; stops at the first
# counterexample and writes a replay record under dist/fuzz-failure/
mise run //package/module/deepmerge-ts.fuzz:fuzz --round-runs 10000

# Coverage-reachability gate over the installed dist; --write ratchets the baseline
mise run //package/module/deepmerge-ts.fuzz:fuzz:coverage

# Regenerate the type-level soundness corpus after a generator or version change
mise run //package/module/deepmerge-ts.fuzz:generate:type-cases

# Declared-type campaign, positive control, and fixed-seed corpus, each in a 2 GiB / 2 CPU podman container;
# the campaign report lands in dist/declared-type/<seed>/report.json
mise run //package/module/deepmerge-ts.fuzz:fuzz:declared-types --seed 11 --size 1500
mise run //package/module/deepmerge-ts.fuzz:fuzz:declared-types:control
mise run //package/module/deepmerge-ts.fuzz:generate:declared-type-cases
```

Replay a campaign record on the host:

```bash
# package/module/deepmerge-ts.fuzz
DEEPMERGE_FUZZ_SEED=<seed> DEEPMERGE_FUZZ_NUM_RUNS=<runs> node <file>
```

## Testing another build

Set `DEEPMERGE_FUZZ_TARGET` to a module path
to run every runtime test and the campaign against it instead of the npm release.
Relative paths resolve against this package directory.
The type-level tests always use the installed npm release's types.

For a deepmerge-ts checkout (the fork lives at <https://github.com/Aquaticat/deepmerge-ts>),
`fork:build` builds a read-only copy with source maps inside a capped container,
and `fuzz:coverage` then reports coverage per `src/*.ts` file with uncovered line ranges
instead of gating the npm baseline:

```bash
mise run //package/module/deepmerge-ts.fuzz:fork:build --checkout /absolute/path/to/deepmerge-ts
DEEPMERGE_FUZZ_TARGET=dist/fork-build/index.mjs mise run //package/module/deepmerge-ts.fuzz:test:unit
DEEPMERGE_FUZZ_TARGET=dist/fork-build/index.mjs mise run //package/module/deepmerge-ts.fuzz:fuzz:coverage
```
