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
- `src/known-defect.unit.test.ts`:
   each known runtime divergence asserted to still reproduce,
   so an upstream fix turns it red.
   The comment on each test names the generator region it excludes.
- `src/accepted-behaviour.unit.test.ts`:
   accepted but otherwise untested behaviour
   (the default `maxDepth` fallback,
   getter flattening,
   frozen targets).
- `src/type-*.unit.test.ts`:
   `expectTypeOf` pins of result types beside runtime values;
   `src/type-known-defect.unit.test.ts` pins result types the runtime contradicts.
- `src/type-soundness.generated.ts`:
   1000 generated calls (600 on widened literals, 400 on `as const` literals checked for exact literal and tuple types)
   whose runtime results must type-check against their static result types;
   `src/type-soundness.unit.test.ts` replays them at runtime.

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
```

Replay a campaign record on the host:

```bash
# package/module/deepmerge-ts.fuzz
DEEPMERGE_FUZZ_SEED=<seed> DEEPMERGE_FUZZ_NUM_RUNS=<runs> node <file>
```

## Testing another build

Set `DEEPMERGE_FUZZ_TARGET` to a module path,
for example a local fork's built `dist/index.mjs`,
to run every runtime test and the campaign against it instead of the npm release.
Relative paths resolve against this package directory.
The coverage gate and the type-level tests always use the installed npm release.
