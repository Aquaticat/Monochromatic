# Readonly parameter semantic bridge technology vet

Status:
 in progress,
discovery and feasibility validation.
No recommendation or adoption decision exists.

Subject:
 readonly parameter semantic bridge.

Decision scope:
 choose the analysis pipeline for a project-owned Oxlint JavaScript rule replacing
`typescript/prefer-readonly-parameter-types`.

Started:
 2026-07-12.

Last updated:
 2026-07-12.

Governing skill commit:
 `3b6d1bd6ac0c6eb5704152ddb00e2b69ddcf653b`.

Governing skill SHA-256:
 `71c50a51d0f0086f789e350ef43824f8aead66435f9ab92d94aae751d16d8359`.

Compatibility fingerprint:
 `e949b2efc01b5c3df8a5044e24b4762403b9db2d82c5e581a21502d681c52fac`.

Active audit owner:
 current Pi session for the readonly-parameter replacement plan.

Prior compatible report:
 none found.

## Authority boundary

This audit may update planning,
audit,
and troubleshooting documents.
It may use disposable external clones and probes.
It may not add product dependencies,
change lint configuration,
or implement the rule before the user confirms shared understanding.

## Hard constraints

- Run inside the existing `no-restricted-syntax` Oxlint JavaScript plugin boundary.
- Preserve the selected layered deep-readonly and caller-observable mutation-effect contract.
- Produce deterministic offline diagnostics and editor code actions.
- Support active TypeScript workspace source on Linux x64,
  macOS arm64,
  and Windows x64.
- Keep tests,
  benchmarks,
  and declaration files exempt from source enforcement.
- Preserve `@mutates` blocks through declaration generation and bundling.
- Resolve owned aliases,
  packages,
  generics,
  recursive structures,
  brands,
  callbacks,
  capabilities,
  and cross-file effects to the depth required by the policy.
- Permit no global type-name allow list and no inline rule suppression.
- Keep native or prebuilt artifacts source-mapped and inspectable.

## Components and overlays

Every candidate is an inspectable open-source local technology or a custom composition of such technologies.

Applicable overlays:

- incumbent dependency replacement;
- high-trust plugin execution;
- native or prebuilt artifact boundary where applicable;
- multi-platform support.

Managed-service,
SaaS,
sensitive-data,
privacy,
residency,
and browser overlays are not applicable.
The rule runs locally over repository source and needs no network service.

## Frozen decision criteria

All weights are 1 because the user removed time and money constraints without assigning relative quality weights.
Hard-gate failures remain outside scoring.

- Semantic completeness for the selected readonly and effect contract.
- Reliability of Oxlint-node to semantic-node mapping.
- Incremental and editor lifecycle behavior.
- Cross-package and project-reference behavior.
- Explainability of diagnostics and generated summaries.
- Human auditability of source,
  native boundaries,
  and caches.
- Reuse of already-required repository components without semantic compromise.
- Platform and artifact provenance quality.

Ratings and sensitivity remain pending finalist validation.

## Frozen discovery query schedule

### Package registries

- npm search:
  `typescript type checker project service library`;
- npm search:
  `typescript semantic analyzer cross file`;
- npm search:
  `oxc parser type checker`;
- npm search:
  `typescript effect analysis`;
- npm metadata for every named candidate and direct semantic dependency.

### Repository hosts

- GitHub repository search:
  `typescript createProgram getTypeChecker incremental language service`;
- GitHub repository search:
  `TypeScript effect analysis parameter mutation`;
- GitHub repository and code search for Oxc parser,
  isolated declaration,
  and JavaScript-plugin integration;
- GitHub repository and code search for Yuku analyzer type inference and type objects;
- GitHub repository and code search for `rolldown-plugin-dts` program cache APIs.

### Broader web

- `TypeScript compiler API incremental program custom linter`;
- `TypeScript project service library custom rule`;
- `Yuku analyzer TypeScript type checker inference`;
- `Oxc isolated declarations semantic type information`;
- `rolldown-plugin-dts TypeScript Program API`.

### Repository evidence

- current Oxlint plugin packages and test support;
- root TypeScript and `oxc-parser` dependencies;
- current `ReadonlyDeep` uses;
- Oxc isolated declaration and `rolldown-plugin-dts` build integration;
- existing troubleshooting reports for readonly types,
  declaration generation,
  and build performance;
- hand-rolled scope,
  parser,
  and output-filter systems.

One de-duplicated expansion round will be added after the initial schedule records new taxonomy.
Discovery is not yet saturated.

## Candidate ledger

### Native Oxlint rule, the incumbent

Discovery source:
 repository config and installed Oxlint.

Lifecycle:
 screened out for category fit after serving as the behavioral baseline.

Reason:
 the user explicitly chose replacement,
and the measured allow-list and suppression surface is the defect under remediation.
The native implementation remains differential-test evidence rather than an adoption candidate.

### Syntax and body analysis using only the Oxlint JavaScript context

Discovery source:
 existing `no-restricted-syntax` rules and Oxlint plugin API.

Lifecycle:
 hard-gate exit.

Reason:
 the context has AST,
scope,
and references but no TypeScript type information.
It cannot satisfy alias,
generic,
package,
or deep readonly requirements alone.
It remains a baseline component for local effect syntax.

### Direct TypeScript compiler program and checker

Discovery source:
 repository root TypeScript dependency,
TypeScript compiler API,
and `rolldown-plugin-dts` source.

Lifecycle:
 serious alternative,
targeted validation pending.

Provisional role:
 authoritative type,
symbol,
assignability,
project,
and declaration analysis;
map Oxlint visitor nodes to TypeScript nodes through source file and spans.

Open gates:
 incremental lifecycle,
node-span mapping across Unicode and transformed source,
project-reference coverage,
TypeScript 7 API stability,
and plugin-worker reuse.

### TypeScript project or language service

Discovery source:
 compiler ecosystem taxonomy discovered while examining incremental program needs.

Lifecycle:
 discovered,
screening pending.

Provisional role:
 reuse TypeScript's incremental project graph and change invalidation rather than constructing programs per file.

### `oxc-parser` plus TypeScript semantics

Discovery source:
 user correction,
repository catalog,
and Oxc source.

Lifecycle:
 serious composition,
targeted validation pending.

Provisional role:
 Oxc-compatible syntax or span bridge paired with a TypeScript program for semantic facts.

Open gate:
 Oxlint already supplies an Oxc AST,
so the additional parse must prove a mapping or lifecycle benefit rather than duplicate syntax work.
`oxc-parser` does not itself provide TypeScript type objects.

### Yuku parser and analyzer plus a custom type evaluator

Discovery source:
 user correction,
`yuku.fyi`,
npm,
and `yuku-toolchain/yuku` source at
`d41e37c9eeac42ba72f1f7d5ef3c76a09975adc9`.

Lifecycle:
 serious composition,
targeted validation pending.

Provisional role:
 Oxc-compatible AST,
scopes,
symbols,
resolved references,
write flags,
and cross-file links with native transfer-friendly data.

Open gate:
 Yuku 0.6.1 exposes binding and module semantics,
not TypeScript inferred type objects or a `TypeChecker`.
A custom evaluator would need to implement generics,
conditional and mapped types,
assignability,
and external declaration semantics or pair with TypeScript.
Native prebuilt provenance and platform artifacts also require validation.

### Oxc isolated declarations plus semantic analysis

Discovery source:
 user correction,
Oxc documentation,
Oxc source,
and repository tsdown configuration.

Lifecycle:
 serious composition,
targeted validation pending.

Provisional role:
 normalize source into per-file declarations before a later type or effect analysis stage.

Open gate:
 isolated declarations deliberately avoid type checking and require source annotations.
The transform must prove that normalization preserves every internal parameter and effect-relevant declaration needed by
the rule,
not only public emit.

### `rolldown-plugin-dts` declaration pipeline and TypeScript context

Discovery source:
 user correction,
repository lockfile and docs,
and `sxzz/rolldown-plugin-dts` source at
`e7de7e9210b94ddae88f6a7eae36e5ffd4d82d42`.

Lifecycle:
 serious composition,
targeted validation pending.

Provisional role:
 reuse its TypeScript `Program` cache,
file invalidation,
project parsing,
Oxc isolated declaration path,
and declaration bundling.

Open gate:
 public operations generate declarations rather than answer arbitrary type queries.
Its exported `TscContext` exposes cached programs only after emit-oriented setup,
and its build lifecycle may be the wrong seam for per-file editor linting.
The repository currently resolves 0.27.4,
while the audited main clone declares 0.27.7.

### `ReadonlyDeep` utility candidates

Discovery source:
 122 repository references and the selected ownership-aware remediation.

Lifecycle:
 candidate subcomponent family,
discovery pending.

Provisional role:
 construct honest parameter-local projections when a shared type remains legitimately mutable.

Open gate:
 compare existing `type-fest` behavior,
a project-owned utility,
and synthesized structural syntax across all calibrated type classes.

## Evidence collected

### Oxlint host separation

The installed Oxlint 1.73 plugin context exposes an empty `parserServices` object even under `--type-aware`.
Oxc source runs the regular JavaScript linter and tsgolint as separate paths.
Evidence and reproduction:
[`docs/troubleshooting/oxlint-js-plugin-type-information.md`](../troubleshooting/oxlint-js-plugin-type-information.md).

### Oxlint JavaScript fix kinds

JavaScript diagnostics expose direct fixes and suggestions,
not a dangerous-fix marker.
The selected semantic rewrites will use suggestions.
Evidence and reproduction:
[`docs/troubleshooting/oxlint-js-plugin-fix-kinds.md`](../troubleshooting/oxlint-js-plugin-fix-kinds.md).

### Yuku semantic surface

Yuku's analyzer documentation and exported declarations expose scopes,
symbols,
resolved references,
write flags,
module links,
and node identity.
Searches of its npm and Zig source found parser support for TypeScript type syntax but no TypeScript `TypeChecker`,
`getTypeAtLocation`,
or inferred type-object API.
This supports an effect-binding role but does not yet satisfy deep type evaluation alone.

### Oxc isolated declaration surface

Oxc documents `isolatedDeclaration` and `isolatedDeclarationSync` as per-file declaration emit without the TypeScript
compiler for source satisfying `isolatedDeclarations`.
The result contains declaration code,
source map,
and errors,
not type checker objects.

### `rolldown-plugin-dts` program cache

`src/tsc/context.ts` stores `ts.Program[]`,
in-memory file text,
and project maps,
and invalidates every program containing a changed file.
`src/tsc/emit-compiler.ts` creates or reuses programs but returns declaration code and maps through `tscEmitCompiler`.
The public `./tsc-context` export exposes context construction and invalidation;
the program creation helper remains internal.

## Execution manifests

No third-party candidate command tree has been executed yet.
Source-only inspection and repository-owned installed Oxlint probes have run.

Before candidate execution,
record package revision,
artifact checksums,
lifecycle scripts,
native downloads,
subprocesses,
network policy,
and the bounded disposable environment here.

## Validation plan

Use one adversarial calibration corpus for every surviving pipeline:

- owned mutable and readonly object aliases;
- nested arrays,
tuples,
maps,
sets,
weak collections,
and typed arrays;
- branded primitives at top level and nested;
- callbacks and higher-order generics;
- external SDK and DOM capabilities;
- recursive,
conditional,
mapped,
indexed-access,
and union/intersection types;
- overloads,
interfaces,
abstract methods,
and project references;
- Unicode before parameter spans;
- aliasing,
destructuring,
closures,
async effects,
and callback propagation;
- declaration emit and bundled comment preservation.

Every finalist must cross the real consumer boundary by running as an Oxlint JavaScript rule against disposable package
fixtures using repository tasks or an equivalent isolated harness.

## Scoring and sensitivity

Pending discovery saturation,
hard-gate confirmation,
equal-depth source audits,
and runtime validation.
No candidate has a score or rank.

## Current outcome

No recommendation.
The next action is discovery saturation followed by disposable feasibility probes.
