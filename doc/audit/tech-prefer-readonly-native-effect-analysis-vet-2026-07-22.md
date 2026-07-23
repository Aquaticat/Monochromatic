# Native effect analysis for `prefer-readonly-parameter-type`

Status: targeted evaluation in progress;
no adoption recommendation until a consumer-boundary prototype passes semantic and latency gates.

Lifecycle phase: targeted evidence.

Subject: Prefer-readonly native effect analysis.

Decision scope:
choose an implementation architecture for fail-closed `prefer-readonly-parameter-type` effect analysis
under a 10-second cold 13-file lint target.

Started: 2026-07-22.

Last updated: 2026-07-22.

Governing skill commit: `25d237fe220d813f5d10367ad3d487707d48bb42`.

Governing skill SHA-256:
`393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

Compatibility fingerprint:
`2a5f32a502953a5e2dcee8ae76de13432a0bb68909b0731e1973659667cff11d`.

Active audit owner: current Pi coding-agent session.

Prior compatible report: none found.

## Context

The incumbent project JavaScript rule opens TypeScript 7.0.2 through `typescript/unstable/sync`.
Its cold 13-file package run took 62.9 seconds because `buildEffectSummaryIndex` eagerly indexed
337 non-declaration sources from an 834-source semantic project.
The same command completed in 1.0 second with a valid warm cache.
Disabling only the project rule while keeping Oxlint type-aware and type-check analysis completed in 396 milliseconds.

A standalone `openSemanticFile` probe completed project opening in 181.7 milliseconds on the current Linux host.
That isolates whole-project effect-summary construction,
rather than semantic-project startup,
as the demonstrated cold path.
The canonical measurements are in
`doc/troubleshooting/oxlint-prefer-readonly-incremental-cache.md`.

The requested architecture must not recover speed by trusting handwritten external-effect catalogs.
An unresolved effect must be derived,
contained by a verified isolation boundary,
or reported as opaque.

## Hard constraints

- Complete the exact 13-file package lint within 10 seconds with cold or invalidated state.
- Fail closed when parameter-reachable effects cannot be derived or isolated.
- Preserve required TypeScript 7 semantic behavior and the existing rule corpus.
- Avoid handwritten external-effect catalogs.
- Support repository Linux x64,
  macOS arm64,
  and Windows x64 lint hosts.
- Keep native and prebuilt source-to-artifact provenance inspectable.

## Components and overlays

Every candidate is an inspectable open-source local technology or a project-owned custom implementation.
The active overlays are:

- incumbent dependency replacement;
- high-trust linter and CI execution;
- native or prebuilt artifact;
- multi-platform delivery.

## Frozen discovery schedule

Initial source classes and literal queries:

### Registries and official ecosystem indexes

- `site:crates.io/crates Node-API Rust bindings napi neon nodejs addon`
- `site:npmjs.com/package oxlint-tsgolint TypeScript Go linter`
- `site:crates.io/crates node-bindgen rust node api addon`

### Repository hosts

- `site:github.com/oxc-project/oxc Rust custom lint rule plugin dynamic native N-API`
- `site:github.com/microsoft/typescript-go API custom analyzer plugin semantic batch query`
- `site:github.com/topics/node-api rust bindings native addon`
- `site:github.com napi-rs vs neon rust node api addon comparison`

### Broader web

- `Rust TypeScript type checker library Oxc semantic type synthesis 2026`
- `Rust TypeScript compiler type checker library stc swc 2026 maintained`
- `Node-API Rust bindings alternatives napi-rs neon node-api 2026`
- `Oxlint JavaScript plugin NAPI native addon synchronous custom rule performance`

### Repository incumbent and parallel systems

- repository search for `napi`,
  `oxc_semantic`,
  `typescript-go`,
  and `tsgo` in manifests and source;
- `doc/troubleshooting/typescript-7-unstable-sync-readonly.md`;
- `doc/troubleshooting/oxlint-js-plugin-lazy-child-enomem.md`;
- `doc/troubleshooting/oxlint-prefer-readonly-incremental-cache.md`.

Expansion terms discovered during the initial schedule:

- `tsgolint` direct TypeScript-Go rules;
- `ttsc` TypeScript-Go contributor rules;
- `Oxc type-aware linting`;
- `STC abandoned`.

Expansion queries:

- `typescript-go custom linter rule plugin in process Go tsgolint extension`
- `Oxc Rust TypeScript type checker complete parity TypeScript Go alternative`
- `stc Rust TypeScript type checker repository maintenance archived status`

The query schedule is frozen after this expansion round.

## Query ledger

The web provider returned the following visible result counts:

- Oxc custom native-rule query: 10 results.
- Oxc JavaScript-plugin query: 10 results.
- Rust TypeScript-checker query: 10 results.
- NAPI-RS concurrency query: 10 results.
- TypeScript-Go API query: 10 results.
- Rust checker and STC query: 10 results.
- Node-API binding alternatives query: 10 results.
- Oxlint plus Node-API query: 10 results.
- crates.io Node-API query: 10 results.
- GitHub Node-API topic query: no provider output.
- npm `oxlint-tsgolint` query: 10 results.
- TypeScript-Go custom-linter query: 10 results.
- Oxc checker-parity query: 10 results.
- STC maintenance query: 10 results.
- NAPI-RS versus Neon query: 10 results.
- `node-bindgen` query: 10 results.

The searches discovered NAPI-RS,
Neon,
`node-bindgen`,
`node_api`,
Oxc,
STC,
`tsgolint`,
and `ttsc`.
STC exits because its repository is archived and its tracker declares the project abandoned.
Low-level or older Node-API crates do not change the architecture question:
they supply a bridge,
not TypeScript semantics.

## Candidate ledger

### Demand-driven incumbent TypeScript sync bridge

Discovery source:
repository implementation and incremental-cache incident.

Base category:
project-owned custom implementation.

Screening:
serious alternative.
It already preserves the semantic corpus and platform behavior,
but the eager whole-project implementation fails the latency hard gate.
A demand-driven redesign has not been prototyped.

### Rust Node-API hybrid

Discovery source:
user proposal,
NAPI-RS,
Neon,
Node-API documentation,
and repository Oxc integration.

Base category:
project-owned custom native implementation using an inspectable bridge framework.

Screening:
serious alternative only as a hybrid.
Rust can own parsing,
effect graph construction,
fixed-point propagation,
hashing,
and certificate validation.
TypeScript-Go must still provide semantic facts unless a replacement checker proves parity.

### Pure Rust analyzer on Oxc

Discovery source:
Oxc repository and official docs.

Base category:
inspectable open-source local technology plus project-owned analyzer.

Screening:
exited on semantic compatibility.
Current Oxc `oxc_type_checker` source explicitly says it performs no type checking.
Oxc JavaScript plugins also do not receive type-aware APIs.

### Project-owned native Oxlint fork

Discovery source:
Oxc source and contributor documentation.

Base category:
project-owned fork of inspectable open-source local technology.

Screening:
retained only as a control candidate.
Oxc provides JavaScript plugins for external rules;
its contributor docs say the project does not plan new Rust-based plugins.
A project rule in native Rust therefore requires a maintained custom Oxlint build,
and it still lacks TypeScript-Go checker parity unless a second semantic boundary is added.

### Project-owned `tsgolint` fork

Discovery source:
Oxlint type-aware documentation and `oxc-project/tsgolint` source.

Base category:
project-owned fork of inspectable open-source local technology.

Screening:
serious alternative.
It runs Go rules directly against TypeScript-Go AST and checker objects,
shares the program used by Oxlint type-aware linting,
and integrates through `OXLINT_TSGOLINT_PATH`.
It has no dynamic custom-rule API;
adding this project rule requires a maintained binary fork.

### `ttsc` contributor rule

Discovery source:
expansion search for TypeScript-Go custom lint rules.

Base category:
inspectable open-source local technology plus a project-owned Go contributor rule.

Screening:
serious alternative pending validation.
`@ttsc/lint` exposes a public contributor API,
a `TypeAwareRule` marker,
and a project-rule surface over the in-process TypeScript-Go checker.
It is a separate lint host rather than Oxlint's existing `tsgolint` backend,
so consumer integration may duplicate TypeScript program setup.
Its contributor binary build and cache behavior must be included in the 10-second cold measurement.

### STC

Discovery source:
Rust TypeScript checker expansion search.

Base category:
inspectable open-source local technology.

Screening:
exited because `dudykr/stc` is archived and issue 1101 states that the project is officially abandoned.

## Source evidence

### Node-API is a transport and ABI boundary

Node.js documentation classifies Node-API as stable and ABI-stable across Node.js versions.
It exposes native functions to JavaScript,
but it does not provide TypeScript AST or checker semantics.
NAPI-RS documentation says an ordinary synchronous `#[napi] fn` runs on the JavaScript thread.
Its asynchronous forms return promises or complete later on the JavaScript thread.

That matters because Oxlint's JavaScript `lintFile` callback is synchronous.
Oxc
`apps/oxlint/src/js_plugins/external_linter.rs:151-198`
routes the callback through a `ThreadsafeFunction` to the main JavaScript thread,
then blocks the originating Rust worker on `rx.recv()`.
A synchronous native addon can make work inside that callback faster,
but it cannot make Oxlint await an asynchronous result.

Outcome:
Node-API removes JavaScript execution cost only for work fully moved into native code.
It does not remove eager scope,
TypeScript checker RPC,
or the main-thread callback serialization by itself.

### Pure Oxc cannot preserve the current semantic contract

At revision `90b8fd143c0085f3fb2d47344c578e23ccc33da7`,
`crates/oxc_type_checker/src/lib.rs:3-6` says:

```rust
//! An **experimental**, work-in-progress type checker for JavaScript and TypeScript.
//!
//! This crate is intentionally a thin scaffold. It does *not* type check anything yet.
```

The crate is unpublished,
and its visitor performs an empty walk.
Oxc's official JavaScript-plugin documentation also lists
"Lint rules that rely on TypeScript type-awareness"
as unsupported.

Outcome:
a pure Rust Oxc rewrite fails the semantic compatibility hard gate today.

### External native Oxlint rules require a fork

Oxc's official contributor guide says:

> Since ESLint-compatible JavaScript plugin support is now available,
> we do not plan to add new Rust-based plugins.

The supported external configuration surface is `jsPlugins`.
The Rust `Rule` registry is generated into the Oxlint binary.
No dynamic external Rust-rule loader was found in the audited source.

Outcome:
a native Oxlint implementation is a maintained custom distribution,
not a loadable project plugin.

### `tsgolint` runs beside the TypeScript-Go checker

At revision `744b737d9743274217b01a54f5ff51bd6857da48`,
`internal/rule/rule.go:118-127` gives each rule the direct TypeScript Program and Checker:

```go
type RuleContext struct {
    SourceFile  *ast.SourceFile
    Program     *compiler.Program
    TypeChecker *checker.Checker
```

`internal/linter/linter.go:464-598` distributes target source files through checker-backed worker queues.
The existing `prefer_readonly_parameter_types` rule directly queries mapped readonly flags,
properties,
arrays,
tuples,
unions,
and intersections.

The architecture avoids the JavaScript sync API's per-operation JSON RPC.
It also avoids a TypeScript-to-ESTree conversion.
The current project measurement with its JavaScript rule disabled shows
that the existing Oxlint type-aware and type-check path completes the 13-file workload in 396 milliseconds.
That measurement does not include the proposed effect engine.

Outcome:
Go code beside TypeScript-Go is the strongest measured native direction,
but a project-owned `tsgolint` fork carries release and merge maintenance.

### `ttsc` has a supported custom TypeScript-Go rule boundary

At revision `017b4d808689f57d4e30391844ab897e5f9f3dce`,
`packages/lint/rule/rule.go` defines public contributor rules over TypeScript-Go AST and checker objects.
Its `TypeAwareRule` marker explicitly selects the live checker path.
The project also exposes project-scoped contributor rules whose state can be reused by file rules in one Program cycle.

Contributor source is statically linked into a generated plugin binary.
That is favorable for checker locality,
but the cold latency test must count its binary generation and cache behavior.
The project publishes Linux,
Darwin,
and Windows packages for x64 and arm64,
and its CI includes Ubuntu,
macOS,
and Windows lanes.

Outcome:
`ttsc` avoids a maintained linter fork and fits project-wide effect analysis,
but it does not currently share Oxlint's existing `tsgolint` process.

### TypeScript-Go has no third-party in-process server plugin surface

TypeScript-Go issue 2824 states that third-party code cannot be dynamically linked into the server process.
The intended extension boundary is the IPC API.
The repository's `_tools/customlint` directory is not a TypeScript lint extension:
`_tools/customlint/plugin.go` imports `golang.org/x/tools/go/analysis`
and registers analyzers for TypeScript-Go's own Go source.

Outcome:
the earlier hypothesis that `_tools/customlint` could host this TypeScript rule was incorrect.
An in-process Go rule needs `tsgolint`,
`ttsc`,
or a maintained TypeScript-Go-derived binary.

## Hard-gate outcomes

### Semantic compatibility

- Demand-driven incumbent:
  pending prototype,
  with existing corpus as a favorable baseline.
- Rust Node-API hybrid:
  pending because semantic authority remains TypeScript-Go.
- Pure Oxc Rust:
  fail.
- Native Oxlint fork:
  fail unless paired with a TypeScript-Go semantic boundary.
- `tsgolint` fork:
  pass at the checker-access level;
  effect-rule corpus parity remains pending.
- `ttsc` contributor:
  pass at the checker-access level;
  effect-rule corpus parity remains pending.

### Cold latency

- Incumbent eager implementation:
  fail at 62.9 seconds.
- Every replacement:
  pending exact prototype.
- Existing Oxlint `tsgolint` path without the project rule:
  measured favorable evidence at 396 milliseconds,
  not proof for the added effect workload.

### Catalog removal and fail-closed behavior

Every surviving design can reject unresolved effects without a catalog.
Rust or Go does not change the information limit:
an opaque implementation receiving a caller-owned identity cannot be accepted without derived semantics,
verified isolation,
or trusted metadata.

### License and inspectability

- Oxc:
  MIT.
- TypeScript-Go:
  Apache-2.0.
- `tsgolint`:
  MIT.
- `ttsc`:
  MIT.
- NAPI-RS:
  MIT.
- Neon:
  MIT or Apache-2.0.

No inspected candidate fails the license gate.
Native artifact provenance remains pending for any adopted distribution.

### Platform support

- Node-API is available on required Node hosts.
- NAPI-RS and Neon are cross-platform frameworks,
  but a project addon still needs a verified prebuilt matrix.
- `tsgolint` publishes platform binaries through `oxlint-tsgolint`.
- `ttsc` declares Linux,
  Darwin,
  and Windows packages for x64 and arm64.

Consumer-boundary execution has not yet validated the required matrix.

## Pros and cons of surviving directions

### Demand-driven incumbent bridge

Pros:

- retains the current package and diagnostics surface;
- reuses the existing semantic corpus;
- avoids a native artifact owned by this package.

Cons:

- still pays synchronous TypeScript-Go RPC for semantic queries;
- JavaScript-plugin callbacks remain serialized on the main JavaScript thread;
- the current eager implementation has already failed the latency gate.

### Rust Node-API hybrid

Pros:

- can make graph,
  hashing,
  cache,
  and fixed-point work native;
- can expose one coarse synchronous call instead of many JavaScript functions;
- Node-API provides a stable Node ABI.

Cons:

- does not supply TypeScript type semantics;
- preserving TypeScript-Go facts still requires RPC or a second custom boundary;
- an asynchronous addon cannot satisfy Oxlint's synchronous rule callback;
- prebuilt release provenance and platform coverage become project responsibilities.

### Project-owned `tsgolint` fork

Pros:

- runs effect logic directly beside TypeScript-Go AST and checker objects;
- shares Oxlint's existing type-aware program and command boundary;
- avoids Node-API and per-query JSON RPC;
- the rule-disabled 13-file path measured 396 milliseconds.

Cons:

- requires carrying a fork because upstream limits new rules to its `typescript-eslint` scope;
- TypeScript-Go shims use `go:linkname` and must track compiler versions;
- external shipped JavaScript implementation inference still needs project-owned design.

### `ttsc` contributor rule

Pros:

- offers an explicit public custom-rule API over TypeScript-Go;
- supports project-scoped state and direct checker access;
- avoids maintaining a linter fork;
- source and platform packaging are inspectable.

Cons:

- runs through a separate host rather than Oxlint's existing type-aware process;
- may duplicate program setup;
- contributor binary generation and cache behavior may violate the cold target;
- current repository integration and semantic parity are unverified.

## Preliminary ordering for prototype investment

This is not an adoption recommendation.
It orders which prototype should be built first:

1.  Project-owned `tsgolint` rule or minimal fork.
2.  `ttsc` contributor rule.
3.  Demand-driven incumbent JavaScript bridge.
4.  Rust Node-API hybrid.
5.  Native Oxlint fork.
6.  Pure Oxc Rust analyzer.

`tsgolint` precedes `ttsc` because both place Go analysis beside TypeScript-Go,
but `tsgolint` already shares the exact Oxlint type-aware command.
That command's rule-disabled baseline measured 396 milliseconds.

`ttsc` precedes the incumbent bridge because it provides a supported direct-checker contributor boundary,
while the incumbent retains synchronous RPC.

The incumbent precedes Rust Node-API because it already preserves semantic parity;
a Rust hybrid does not remove checker RPC without an additional TypeScript-Go modification.

Rust Node-API precedes a native Oxlint fork because it can remain a loadable project JavaScript plugin,
while a native Oxlint rule requires distributing a custom Oxlint binary.

A native Oxlint fork precedes pure Oxc type checking because it could still call TypeScript-Go;
the current Oxc checker explicitly performs no type checking.

## Prototype gate

No candidate becomes recommendable until one disposable prototype proves:

- the exact existing semantic corpus produces equivalent diagnostics;
- package implementation inference remains fail closed without handwritten catalogs;
- the exact 13-file package command completes within 10 seconds with empty state;
- analyzer-version,
  relevant-source,
  declaration,
  lockfile,
  and resolution invalidations remain within the target;
- budget exhaustion reports opaque analysis rather than passing;
- Linux x64,
  macOS arm64,
  and Windows x64 consumer boundaries load the verified artifact;
- no bare shutdown,
  panic,
  or process-lifecycle diagnostics reach stderr.

The first prototype should use direct TypeScript-Go rule execution,
not Rust Node-API.
That tests the highest-leverage hypothesis:
removing JavaScript checker RPC while reusing the existing Oxlint type-aware program.

## Scoring and sensitivity

Scoring is deferred because no finalist has completed runtime and consumer-boundary validation.
Hard latency and semantic gates cannot be offset by soft points.
No sensitivity matrix is meaningful before at least two candidates pass those gates.

## Recommendation status

No adoption recommendation.
Current evidence answers the narrower question:
Rust can accelerate native effect-engine work,
but Node-API alone does not address the measured architecture or preserve TypeScript semantics.
Direct Go analysis beside TypeScript-Go is the stronger prototype direction.
