# Implementation plan: strengthen fuzzing coverage for module-toml-edit

This is the source-of-truth plan for the toml-edit fuzzing work. It replaces the
brief-only version with resolved sequencing, explicit oracle design, and pass
criteria for each layer.

## Evidence checked

This plan was sharpened against current repository state, not written from memory:

- `packages/dev-script/file-enforcer/mise.toml` and
  `packages/dev-script/file-enforcer/src/fuzz-budget.ts` show the existing
  env-parameterized property-test campaign pattern.
- `packages/dev-script/file-enforcer/src/pipeline/toml.property.unit.test.ts`
  shows the weak TOML wrapper properties this plan must not copy as the whole
  target.
- `packages/module/toml-edit/src/index.ts` lists the public API surface to cover.
- `packages/module/toml-edit/src/fixtures.unit.test.ts` and
  `packages/test-fixture/toml-edit/src/` already provide 91 valid and 108 invalid
  TOML fixture files.
- GitHub issue #198 is still open and asks for a bounded toml-edit fuzz task, a
  committed seed corpus entry, CI wiring for toml-edit changes, and explicit issue
  closure.
- `toml-test` was inspected at `/tmp/agent/toml-test-20260606` commit
  `af5f8052e9109206ad3977508263c97907f0797d`; its README documents the valid and
  invalid corpus split, tagged JSON format, TOML 1.0 and 1.1 file lists, and the
  option to reimplement the runner inside another language's test suite. The
  implementation still needs to pin a release or commit deliberately; the scratch
  clone path is research evidence only.
- A local node v26.3.0 smoke run with `NODE_V8_COVERAGE` produced V8 JSON containing
  covered and uncovered source ranges, so the coverage gate can start from raw V8
  coverage without first adding a coverage dependency.

No root `CONTEXT.md` or `CONTEXT-MAP.md` exists. No glossary file was created,
because the terms here are TOML and fuzzing terms, not project-domain language.

## Core diagnosis

The file-enforcer TOML properties were green but weak because every factor in
this product was too small:

```txt
reachable(generator)  x  detectable(oracle)  x  present(target layer)
```

- `present(target layer)` was small because the tests hit file-enforcer wrappers,
  not `@monochromatic-dev/module-toml-edit`, where the parser, editor, splicer,
  and emitter logic live.
- `detectable(oracle)` was small because “returns a string or throws
  `TomlEditError`” cannot catch silent value corruption.
- `reachable(generator)` was small because the generators mostly produced strings,
  single bare keys, and empty base documents.
- There was no measurement layer, so a green run said nothing about grammar reach,
  branch reach, or oracle strength.

The implementation must strengthen all three factors and must add feedback that
measures whether the suite is still strong.

## Goal

Improve fuzzing coverage of `@monochromatic-dev/module-toml-edit` and install a
repeatable method so future fuzzing cannot ship green-but-weak again. The work
should close issue #198 after implementation and verification.

The goal is not to request a hidden bug list. If the new properties discover real
bugs, fix the bugs needed to make the properties land green, then pin each
counterexample as a permanent regression example. The original “not fixing known
bugs” rule means “do not depend on a supplied bug list,” not “land failing tests.”

Related issue boundaries:

- #198 is the issue this plan should close. Its original acceptance criteria ask
  for smoke fuzzing and CI, while this plan adds a stronger coverage gate because
  the wrapper-only fuzzing failure proved smoke fuzzing is not enough.
- #165 tracks broader editor completeness and workspace adoption. Do not widen this
  fuzzing plan into replacing every TOML edit caller.
- #244 tracks sentinel conversion in file-enforcer wrappers. It can add wrapper
  regressions, but it does not replace direct toml-edit fuzzing.

## Non-goals

- Do not add mutation-testing tooling in this plan. Mutation testing remains the
  intended follow-up for measuring oracle strength more directly.
- Do not widen `packages/module/toml-edit/src/index.ts` only for tests. Internal
  helpers may be exported at file level and imported by co-located seam tests.
- Do not use the file-enforcer wrapper properties as proof that toml-edit itself
  is covered. They remain wrapper coverage only.
- Do not create an AGENTS.md pointer or global agent rule unless the user asks.

## Constraints

- Runtime is node. node v26 runs `.ts` files directly, the harness exits non-zero
  on failure, and campaign tasks must invoke node, not bun.
- Tests use `@monochromatic-dev/module-test/ts` and `fast-check`.
- Normal unit runs stay bounded. Campaign runs use a per-property time budget.
- Test files remain subject to `invocation-depth-per-line`, `no-mixed-operators`,
  and numeric-separator rules.
- New third-party parser dependencies require the `choosing-technology` skill and
  VQS source vetting before selection.
- The `toml-test` corpus is data. Pin it by release or commit before vendoring or
  generating fixture files from it.
- Reference source files by repo-relative path. Keep prose free of em dashes.

## Resolved planning decisions

### Campaign shape

Use the file-enforcer pattern, but package-local:

- Add `packages/module/toml-edit/src/fuzz-budget.ts` with
  `TOML_EDIT_FUZZ_BUDGET_MS`.
- Add a `fuzz` task to `packages/module/toml-edit/mise.toml`, mirroring
  file-enforcer's task, with `--budget <ms>` defaulting to `60000`.
- Keep the same `*.property.unit.test.ts` files in both normal and campaign modes.
- Co-locate property files beside the source seam they exercise.
- Put shared arbitraries, semantic-normalization helpers, and corpus loaders under
  `packages/module/toml-edit/src/fuzz/` so individual test files do not exceed the
  max-lines budget.

### Import boundary

Use source and artifact imports deliberately:

- Campaign properties that run `.ts` files directly under node may import
  `./index.ts` for the public API and sibling source files for internal seams.
- Internal seam helpers may be exported at file level only. Do not add them to
  `packages/module/toml-edit/src/index.ts`.
- Add at least one built-artifact smoke that imports the built package entry point
  and exercises a generated public-API case, so user-boundary coverage is not
  source-only.

Document this exception in `docs/decisions/toml-edit-fuzzing.md`, because the
standard unit-test preference is built-artifact imports.

### Corpus source

Use three corpus tiers:

1. Existing fixture package:
   `packages/test-fixture/toml-edit/src/valid/` and
   `packages/test-fixture/toml-edit/src/invalid/`.
2. Real repository TOML files, excluding generated, dependency, and build-output
   directories.
3. `toml-test` valid and invalid files, generated or vendored from a pinned release
   or commit.

The existing fixture package is the right home for reusable TOML corpus data. Add
new generated corpus files there if the data is useful beyond one property test;
keep one-off shrunk counterexamples in the owning property via fast-check
`examples`.

### External oracle order

Bring up the external oracles in this order:

1. `toml-test` conformance first, because it is data and already specifies tagged
   JSON comparison semantics for integers, floats, booleans, datetimes, arrays,
   tables, and invalid inputs.
2. Differential parser second, after VQS. Compare only normalized semantic values,
   not raw formatting.
3. Mutation testing later, in a separate plan.

The differential-parser vetting task must survey at least `smol-toml`,
`@iarna/toml`, `@ltd/j-toml`, and any current npm TOML parser that appears from a
fresh search. The chosen parser must have source inspected under `/tmp/agent`,
tests and CI inspected, maintenance signals checked, and rejected alternatives
recorded in the decision doc.

### Coverage gate

Use raw V8 coverage first:

- Add a node-driven coverage campaign that runs the property files with
  `NODE_V8_COVERAGE` pointed at a temporary output directory.
- Summarize coverage for target files under `packages/module/toml-edit/src/`,
  especially `parse-toml-edit.ts`, `emit-value.ts`, `emit-value-string.ts`,
  `splice.ts`, `comments.ts`, `toml-set-aot.ts`, `path-create.ts`,
  `toml-set.ts`, `toml-delete.ts`, `effective-value.ts`, and `resolve.ts`.
- Treat V8 uncovered ranges as a reachability signal. If a branch-like range in
  parser, emitter, comments, AOT, splice, or path-create code is untouched, add a
  generator case or a seed before calling the campaign strong.
- Gate on no regression from a committed baseline after the first complete
  campaign lands. Do not set an arbitrary percentage threshold before the baseline
  exists.
- If raw V8 ranges cannot give enough human-readable signal, vet a coverage
  summarizer as a separate dependency decision rather than silently adding one.

Call the task `fuzz:coverage` or make `fuzz --coverage` available. The task should
produce a text summary suitable for CI logs and a machine-readable baseline file
under the package, not under a generated output directory.

### Reusable checklist

Record the reusable fuzz-target checklist as a section in
`docs/decisions/toml-edit-fuzzing.md` first. Do not create a project-local
`fuzzing` skill in this plan. A skill becomes worthwhile after the checklist is
used on at least one more target and the wording proves stable.

## Implementation phases

### Phase 1: Scaffold the campaign

Deliverables:

- `packages/module/toml-edit/src/fuzz-budget.ts`.
- `packages/module/toml-edit/mise.toml` `fuzz` task.
- One smoke property file that proves bounded mode and campaign mode both run
  under node.
- A fast-check seed and counterexample policy copied from the file-enforcer
  decision: random seeds in normal and campaign modes, pinned `examples` for every
  discovered counterexample.

Pass criteria:

- `mise run //packages/module/toml-edit:test:unit` still passes.
- `mise run //packages/module/toml-edit:fuzz --budget 1000` exits cleanly.

### Phase 2: Build semantic helpers and generators

Deliverables:

- A normalized TOML value model matching the `toml-test` tagged JSON shape.
- Equality helpers that handle `nan`, signed infinities, integer spelling, float
  equivalence, boolean case, datetime equivalence, arrays, inline tables, standard
  tables, and array-of-tables.
- Grammar-focused arbitraries for:
  - basic, literal, multiline-basic, and multiline-literal strings;
  - integers in decimal, hex, octal, binary, signed, and underscore forms;
  - floats with decimal points, exponents, `inf`, `-inf`, `nan`, and `-nan`;
  - booleans;
  - offset datetimes, local datetimes, local dates, and local times;
  - arrays, nested arrays, inline tables, standard tables, nested tables, and
    array-of-tables;
  - bare, quoted, empty, dotted, unicode, escaped, numeric-looking, and
    float-looking keys;
  - comments before keys, same-line trailing comments, header comments, blank
    lines, and CRLF variants;
  - duplicate keys, table collisions, path-create-through-scalar cases, deep
    nesting, huge strings, and unicode edge cases.
- Structure-aware mutators for valid corpus inputs, so invalid and near-invalid
  documents are not just arbitrary byte noise.

Pass criteria:

- Every generator has at least one deterministic `examples` value for each grammar
  family above.
- The generator file set stays below max-lines by splitting helpers rather than
  compressing code.

### Phase 3: Parser and stringify properties

Properties:

- Arbitrary text either parses to a state or throws `TomlEditError`, never a raw
  `ParseError` or unrelated exception.
- Valid generated documents parse successfully.
- Invalid generated and corpus documents reject with `TomlEditError`.
- Splice mode with no deltas is byte-identical for every accepted source.
- `parseTomlEdit` then `tomlStringify` then `parseTomlEdit` preserves the
  normalized semantic model.
- `emptyTomlEdit` plus setters emits TOML that reparses and matches the intended
  model.
- `tomlVersion` is part of the generated case. TOML 1.0 and 1.1 differences are
  asserted explicitly rather than treated as flake.

Pass criteria:

- The parser properties cover both current fixture-package files and generated
  grammar cases.
- A failing parse on a supposedly valid generator case shrinks to a useful example
  and is added to the property examples before the fix lands.

### Phase 4: Emitter and seam properties

Properties:

- `encodeKey` output reparses as one key segment and never creates an unintended
  dotted path.
- `jsValueToTomlText` output reparses under a synthetic key for every accepted JS
  and wrapped TOML input.
- `emitContentNode` preserves parse-time spelling for unchanged strings, numbers,
  floats, booleans, datetimes, arrays, and inline tables when the AST carries that
  spelling.
- `emitStringValue` covers quote styles, multiline trimming, escapes, backslashes,
  control characters, unicode, and source-escaped variants.
- `spliceEmit` preserves untouched byte ranges and only replaces the ranges marked
  by edits, insertions, deletions, or header-comment changes.
- Comment helpers preserve the documented distinction between attached preceding
  comments, blank-line-separated comments, same-line trailing comments, and header
  comments.

Pass criteria:

- Every seam named in the target package reference section has at least one
  property file or a named property block.
- Coverage output shows each seam file is exercised by the campaign.

### Phase 5: Stateful edit model

Model commands:

- Start from either `parseTomlEdit({ source })` over generated or corpus TOML, or
  `emptyTomlEdit()`.
- Set existing scalar, array element, inline-table entry, table body, and
  array-of-tables collection.
- Path-create under top-level, under a standard table, and inside an inline table.
- Delete key-values, table blocks, array elements at multiple depths, and
  array-of-tables collections.
- Read with `tomlGet`, `tomlGetValue`, `tomlHas`, `tomlKeys`, `tomlGetRaw`,
  `tomlGetNode`, and comment accessors after each mutation.
- Insert comments before and after keys, and set header comments.

Oracles:

- The in-memory model predicts effective reads after every command.
- `tomlStringify` output reparses after every command sequence unless the command
  is expected to throw.
- Repeating an identical set or delete is idempotent when the API contract says it
  should be.
- Operations that should reject do so with the documented `TomlEditError` subclass.
- Parse-time views (`tomlGetNode` and `tomlGetRaw`) stay parse-time views after
  deltas; delta-aware reads reflect pending edits.

Pass criteria:

- The command generator includes successful and rejecting paths.
- The model covers AOT, inline tables, comments, cross-path effective reads, and
  dotted-key collisions.

### Phase 6: toml-test conformance

Deliverables:

- A node adapter that converts toml-edit parse output to the `toml-test` tagged
  JSON shape.
- Valid corpus tests for TOML 1.0 and 1.1 using the pinned `tests/files-toml-*`
  lists.
- Invalid corpus tests that assert parse rejection.
- Encoder-style tests where tagged JSON is converted through toml-edit setters,
  stringified, reparsed, and compared semantically.

Pass criteria:

- Legitimate TOML 1.0 versus TOML 1.1 differences are named and tested under the
  right `tomlVersion`.
- Any unsupported encoder cases are skipped only with a documented reason and a
  follow-up issue if they represent a real toml-edit capability gap.

### Phase 7: Differential parser oracle

Deliverables:

- VQS record in `docs/decisions/toml-edit-fuzzing.md` for the selected parser and
  rejected alternatives.
- A semantic normalizer for the selected parser's output.
- A disagreement classifier with three outcomes:
  - toml-edit wrong;
  - reference parser wrong or less capable;
  - spec ambiguity or intentional version difference.
- A stable allow-list for intentional disagreements, with each entry tied to a
  source path, spec clause, or issue.

Pass criteria:

- Differential properties fail on unexplained disagreements.
- Explained disagreements do not become broad suppressions.

### Phase 8: Coverage and meta-checks

Deliverables:

- `fuzz:coverage` or `fuzz --coverage` task.
- Coverage summary for parser, emitter, splice, comments, AOT, path-create,
  effective-value, and resolve files.
- Committed baseline after the first complete strong campaign.
- Checklist section in `docs/decisions/toml-edit-fuzzing.md`.

Pass criteria:

- Coverage task fails or flags when target-file coverage regresses from baseline.
- The checklist requires all five questions for future targets:
  - Is the tested layer where the logic and bugs live?
  - Are all public entry points and internal seams covered?
  - Is every oracle stronger than no-crash or returns-a-string?
  - Do generators cover the full grammar and boundary cases?
  - Are real corpus seeds, counterexamples, and coverage feedback wired in?

### Phase 9: CI and issue closure

Deliverables:

- CI workflow or workflow step running a short bounded toml-edit fuzz smoke on PRs
  and merge groups that touch `packages/module/toml-edit/**`,
  `packages/test-fixture/toml-edit/**`, or the toml-edit fuzz decision doc.
- CI command uses the package task, not raw `node` commands pasted into workflow
  logic.
- Explicit `gh issue close 198` after the implementation commit and verification.

Pass criteria:

- Local verification includes:
  - `mise run //packages/module/toml-edit:lint:types`;
  - `mise run //packages/module/toml-edit:test:unit`;
  - `mise run //packages/module/toml-edit:fuzz --budget 60000`;
  - the coverage task.
- CI path filtering is proven with an actual workflow run or a documented dry-run
  mechanism before issue #198 is closed.

## Target package reference

Public entry points from `packages/module/toml-edit/src/index.ts`:

- `parseTomlEdit`
- `emptyTomlEdit`
- `tomlHas`
- `tomlGet`
- `tomlGetValue`
- `tomlGetRaw`
- `tomlGetNode`
- `tomlKeys`
- `tomlGetComments`
- `tomlGetCommentsBefore`
- `tomlGetCommentAfter`
- `tomlSet`
- `tomlDelete`
- `tomlSetHeaderComment`
- `tomlInsertCommentBefore`
- `tomlInsertCommentAfter`
- `tomlStringify`
- re-exported `getStaticTOMLValue` and `parseTOML` from `toml-eslint-parser`

Internal seams that need direct properties or named coverage blocks:

- `packages/module/toml-edit/src/parse-toml-edit.ts`
- `packages/module/toml-edit/src/emit-value.ts`
- `packages/module/toml-edit/src/emit-value-string.ts`
- `packages/module/toml-edit/src/values.ts`
- `packages/module/toml-edit/src/value-encoders.ts`
- `packages/module/toml-edit/src/keys.ts`
- `packages/module/toml-edit/src/splice.ts`
- `packages/module/toml-edit/src/comments.ts`
- `packages/module/toml-edit/src/toml-set.ts`
- `packages/module/toml-edit/src/toml-set-aot.ts`
- `packages/module/toml-edit/src/path-create.ts`
- `packages/module/toml-edit/src/path-create-merge.ts`
- `packages/module/toml-edit/src/toml-delete.ts`
- `packages/module/toml-edit/src/effective-value.ts`
- `packages/module/toml-edit/src/resolve.ts`
- `packages/module/toml-edit/src/walk.ts`
- `packages/module/toml-edit/src/collision.ts`

## Definition of done

- toml-edit has property coverage across all scalar values, key forms, nesting,
  inline tables, standard tables, AOT, comments, path-create, delete, and splice
  behavior.
- The oracle set includes round-trip, metamorphic, conformance, differential, and
  stateful model oracles.
- The normal unit suite runs bounded properties; the `fuzz` task runs a budgeted
  campaign; the coverage task reports and gates target-file coverage.
- Every discovered counterexample is either fixed and pinned in `examples`, or
  recorded as a separate issue only when it cannot be fixed in this scope without
  changing the package contract.
- `docs/decisions/toml-edit-fuzzing.md` records the method, the dependency vetting
  record, rejected alternatives, the reusable checklist, and mutation testing as
  deferred follow-up.
- CI runs a short toml-edit fuzz smoke for relevant changes.
- Issue #198 is closed explicitly with `gh issue close 198` after verification.
