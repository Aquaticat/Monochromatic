# @monochromatic-dev/module-toml-edit.fuzz

Property-based verification campaign for
[`@monochromatic-dev/module-toml-edit`](../toml-edit/README.md).

Non-runtime sidecar,
 mirroring `logger.fuzz`,
 `jsonc-edit.fuzz`,
 and `css-edit.fuzz`:
the runtime package's `src` stays pure production code and ships in its tarball,
while the generators,
 the semantic-equality oracle,
 the corpus loader,
 the properties,
 the run-budget tooling,
 and the coverage gate live here and never publish.
The campaign lived under `package/module/toml-edit/src/fuzz/` until 2026-09-06;
the decision record and the implementation plan below predate the move and name that location in places.
Decision record:
 `doc/decision/toml-edit-fuzzing.md`.
Implementation plan and status:
 `HANDOVER.fuzzing.md` beside this file.

## Layout

- `src/fuzz-budget.ts`:
   the two run layers (bounded in `test:unit`,
   time-budgeted in `fuzz`) keyed on `TOML_EDIT_FUZZ_BUDGET_MS`.
- `src/arb-*.ts`,
   `src/escape.ts`,
   `src/mutators.ts`,
   `src/corpus.ts`:
   grammar-complete generators with an independent string escaper,
   structure-aware corruption mutators,
   and the committed-fixture and live-repository corpus loader.
- `src/equality.ts`:
   the semantic-equality oracle over the parser's static-value projection.
- `src/*.property.unit.test.ts`:
   the properties;
   every one imports the built runtime artifact through the package name,
   never the runtime package's source.
- `src/coverage-driver.ts` and the other `src/coverage-*.ts` modules:
   the fixed-seed reachability driver over the runtime package's `/ts` source
   and the V8 line-coverage projector and baseline gate.
- `coverage-baseline.json`:
   covered code lines per runtime source file;
   the gate fails on any per-file decrease.

## Running

```bash
# Bounded layer, the same files the unit suite runs
mise run //package/module/toml-edit.fuzz:test:unit

# Time-budgeted campaign (rebuilds module-toml-edit first)
mise run //package/module/toml-edit.fuzz:fuzz --budget 60000

# Coverage-reachability gate; --write refreezes the baseline
mise run //package/module/toml-edit.fuzz:fuzz:coverage
```
