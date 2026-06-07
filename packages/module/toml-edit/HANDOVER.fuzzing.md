# Planning brief: strengthen fuzzing coverage for module-toml-edit

This is a brief for a planning agent, not a finished plan. It states the
goal, the diagnosis to design against, scope boundaries, constraints, and
the decisions the planner must resolve. Produce the detailed, step-by-step
plan from this.

## Why this exists

A first pass of property-based fuzzing was added to
`packages/dev-script/file-enforcer` (see its `HANDOVER.fuzzing.md` and
`docs/decisions/file-enforcer-fuzzing.md`). Its TOML coverage shipped all
green yet would not have caught the bugs known to exist in
`@monochromatic-dev/module-toml-edit`. The failure was structural, not a
one-off:

- it fuzzed the thin file-enforcer wrappers, not the package where the
  logic and bugs live;
- its oracle was "returns a string or throws `TomlEditError`", which cannot
  fail on silent corruption (a wrong-but-still-a-string result);
- its generators only produced string values, single bare keys, and empty
  base documents, so most of the grammar was never generated.

Nothing measured whether the suite was any good, so green meant nothing.

## Goal

Improve fuzzing coverage of `@monochromatic-dev/module-toml-edit` and, more
importantly, install a feedback loop and a reusable checklist so future
fuzzing cannot ship green-but-weak again. The goal is coverage and method,
not fixing any specific bug (see non-goals).

## Mental model the plan should satisfy

A fuzzer catches a bug only when all three factors are non-zero, and the
product is dominated by the weakest:

```
reachable(generator)  x  detectable(oracle)  x  present(target layer)
```

The plan must strengthen each factor and, separately, add a meta-layer that
measures `reachable` and `detectable` rather than trusting a green run.

## In scope

- Fuzz `module-toml-edit` directly, at every public entry point and the
  internal seams (parse, `emit-value`, splice, comments, AOT, path-create),
  co-located `*.property.unit.test.ts` files importing sibling source, in
  the same env-parameterized style already established in file-enforcer
  (`src/fuzz-budget.ts`, the `fuzz` mise task).
- Grammar-complete generators: every scalar form (basic/literal/multiline
  strings, ints, floats incl. `inf`/`nan`/exponents, bools, datetimes),
  arrays, inline tables, nested tables, dotted/quoted/bare keys, array-of-
  tables, comments; boundary-biased (empty, huge, deeply nested, duplicate
  keys, unicode and escape edges); plus a real-world seed corpus (the
  repo's own `*.toml`, `Cargo.toml`) and structure-aware mutation of it.
- A ladder of oracles (use all of them; the user asked for "everything"):
  round-trip (`parse` then `stringify` then `parse`, and value-model round
  trips), metamorphic relations (key reorder, whitespace reflow, comment
  add/strip leave effective values unchanged), differential vs a vetted
  third-party TOML parser, the official toml-test conformance corpus
  (valid and invalid cases), and model-based/stateful edit sequences
  checked against an in-memory model.
- A coverage gate: run the campaign under node V8 coverage and treat
  uncovered parser/emitter branches as a `reachable` gap to close; flag or
  fail when coverage regresses.
- Persisted regression corpus: every counterexample becomes a permanent
  fast-check `examples` entry.
- A reusable fuzz-target checklist (in the decision doc or a `fuzzing`
  skill) so any future target is vetted the same way: right layer? every
  entry point? oracle stronger than no-crash? generators cover the whole
  grammar? seeded with real corpus? coverage measured?

## Explicitly out of scope (deferred)

- Mutation testing is OUT OF SCOPE for this plan. It is deferred, not
  rejected. It is the ideal objective measure of oracle strength (it mutates
  the source and checks whether the properties kill the mutant, and would
  have flagged the weak totality oracle directly), and it is the intended
  follow-up, but it is not part of this plan. Do not add Stryker or any
  mutation tooling here. Because the best strength-measure is deferred, this
  plan must lean on the in-scope proxies for oracle strength: branch
  coverage from the coverage gate, and the disagreement count from the
  differential and conformance oracles.

## Non-goals

- Not fixing the specific known bugs. The point is coverage and method; the
  bugs are a rediscovery target, not a work item. Do not request the bug
  list; design the suite to surface its own findings.
- Not widening the public API for testing. Internal helpers needed by tests
  are exported at file level only, never added to `src/index.ts` (mirror the
  file-enforcer approach).

## Constraints and conventions the plan must honor

- Runtime is node (the project is migrating to node). node v26 runs the
  `.ts` files directly; tests run and the harness exits non-zero on failure.
  Author tasks and run verification under node, not bun.
- Tests use the `@monochromatic-dev/module-test/ts` harness and `fast-check`
  (already in the catalog at `>=4.8.0`). Test files are exempt from the
  `stylistic/*-per-line` rules but not from `invocation-depth-per-line`,
  `no-mixed-operators`, or numeric-separator rules.
- Any new third-party dependency (a reference TOML parser for differential
  testing) must go through the `choosing-technology` skill and VQS vetting.
  The toml-test corpus is data only, so it carries no code-dependency risk
  and is the lowest-risk external oracle to stand up first.
- Follow the decision-doc precedent (`docs/decisions/`); no AGENTS.md
  pointer unless the user asks.
- Reference source files by repo-relative path. No em-dashes in prose.

## Decisions for the planning agent to resolve

- Reference implementation for differential testing: which library (for
  example `smol-toml` or `@iarna/toml`), how to reconcile legitimate edge-
  case disagreements without flaky noise, and the vetting record.
- toml-test integration: how to drive our parser/encoder against the
  JSON-tagged corpus from node (a small adapter), and which corpus version
  to pin.
- Coverage gate mechanics: how to collect V8 coverage for a node fuzz run,
  what threshold or no-regression rule to enforce, and where it runs.
- Where the campaign task and any shared fuzz helpers live (reuse the
  file-enforcer `fuzz-budget.ts` pattern, or factor a shared module).
- Seed corpus sourcing and how mutated-corpus inputs are fed to fast-check.
- Whether the reusable checklist becomes a `fuzzing` skill or a doc section.

## Reference artifacts

- Pattern to mirror: the seven `*.property.unit.test.ts` files and
  `src/fuzz-budget.ts` plus the `fuzz` task in
  `packages/dev-script/file-enforcer/`.
- Decision precedent: `docs/decisions/file-enforcer-fuzzing.md` and
  `docs/decisions/forbidden-strings-fuzzing.md`.
- Target package: `packages/module/toml-edit/src/` (entry points in
  `index.ts`; seams in `parse-toml-edit.ts`, `emit-value.ts`,
  `emit-value-string.ts`, `splice.ts`, `comments.ts`, `toml-set-aot.ts`,
  `path-create.ts`, `canonical.unit.test.ts` already does a small
  parse-after-stringify check to build on).
- Tracking issue: GitHub #198 "Add fuzz target for toml-edit parser"; this
  plan should resolve it. Related: #165 (editor completeness), #244
  (`getTomlProperty` sentinel conversion).

## Definition of done

- toml-edit has property/fuzz coverage across all value types, key forms,
  nesting, AOT, inline tables, and comments, exercised at the parser and
  emitter seams.
- The oracle set (round-trip, metamorphic, differential, toml-test
  conformance, model-based) is in place and runs in bounded mode in the
  normal suite and in budgeted campaign mode via the `fuzz` task.
- The coverage gate reports parser/emitter branch coverage for the campaign
  and gates on no regression.
- A fuzz-target checklist exists and is referenced from the decision doc.
- Issue #198 is closed. Mutation testing is recorded as the deferred
  follow-up.
