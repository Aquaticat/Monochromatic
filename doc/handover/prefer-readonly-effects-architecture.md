# Handover: `prefer-readonly-parameter-type` effect architecture

Living context for deciding whether the project rule can remain fail closed without handwritten effect catalogs,
meet its lint-latency target,
and benefit from a native implementation.
Update this file after material evidence,
decisions,
prototypes,
or commits.

## Current goal

Choose an architecture for
`package/oxlint-plugin/prefer-readonly-parameter-type`
that:

- enforces honest readonly parameter contracts;
- fails closed when parameter-reachable effects cannot be established;
- avoids maintained external-effect catalogs if possible;
- completes the exact 13-file package lint within 10 seconds,
  including cold or invalidated-cache execution;
- remains auditable across workspace source,
  installed packages,
  ECMAScript,
  DOM,
  and Node boundaries.

The active question is whether moving analysis into Rust behind Node-API would meet these requirements.
This is an architectural evaluation,
not authorization to implement or adopt a dependency.

## User requirements

- Preserve a fail-closed guarantee rather than silently trusting unresolved behavior.
- Treat 10 seconds as the maximum acceptable target for:

  ```bash
  mise run //package/config/oxlint:lint:oxlint
  ```

  on its 13-file workload.
- The cold or invalidated path must meet the target because the stable warm path already finishes in 1.0 second.
- Preserve `/var/home/user/temp/agent/readonly-no-package-catalog-20260722` for inspection.
- Maintain this handover periodically so context survives conversation compaction.

## Terminology and guarantee boundary

The current rule provides fail-closed effect accounting within an explicitly limited runtime model,
not a mathematical proof that arbitrary JavaScript cannot mutate an object.
Unknown calls must be analyzed,
covered by trusted evidence or authored contracts,
or reported as `opaqueEffect`.

A stronger catalog-free guarantee should accept a parameter-reachable call only when:

- effects are conservatively derived from exact reachable implementation source;
- a verified isolation boundary prevents caller-owned identity or capabilities from crossing;
- or the call is rejected.

Under that stronger reading,
a handwritten `@mutates` contract may describe an effect already established by analysis,
but must not discharge an opaque boundary.
TypeScript `readonly` is not ownership or runtime immutability.

The current `plain-data-classifier.ts` excludes proxy and getter-backed runtime values from its model.
Any final guarantee must state that limitation or replace it with enforceable admission checks.

## Catalog findings

Tracked catalog maintenance was measured as:

- 26 production files and 3,604 lines;
- 2,670 lines of catalog-focused tests and evidence validation.

`effect-call-analysis.ts` checks package catalog entries before shipped-implementation inference,
so handwritten summaries can shadow implementation analysis.
`external-evidence.unit.test.ts` does not validate shipped content for `api-contract` entries;
those entries are constrained only by package major.

The native Oxlint rule is not an escape from catalogs.
Its previous configuration used a 363-name allow-list,
which merely moved the catalog.

The catalog-removal experiment emptied `PACKAGE_EFFECTS` and produced 10 errors for observational
`@csstools/css-tokenizer` guards.
That result demonstrates that catalogs are acceptance mechanisms rather than the source of fail-closed behavior:
without entries,
unsupported calls fail instead of passing.

Relevant durable sources:

- `doc/troubleshooting/oxlint-prefer-readonly-package-implementation-inference.md`;
- `doc/troubleshooting/oxlint-prefer-readonly-host-intrinsic-evidence.md`;
- `doc/planning/replace-prefer-readonly-parameter-types.md`;
- `package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-call-analysis.ts`;
- `package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/package-effect-catalog.ts`.

## Performance evidence

`doc/troubleshooting/oxlint-prefer-readonly-incremental-cache.md` is the canonical incident record.
Its measured 13-file run took 62.9 seconds cold and 1.0 second warm.

The cold run opened a semantic project containing 834 source files and built 337 persistent effect-summary entries.
`effect-summaries.ts` starts from every project source,
then scans every cache miss before computing a whole-scope fixed point.
This eager architecture is incompatible with the 10-second cold target.

A standalone probe over
`package/config/oxlint/src/index.ts`
measured semantic-project opening at 181.7 milliseconds and closing at 0.4 milliseconds on the current host.
That single observation is not a bound,
but it shows that project opening alone did not consume the target.
The demonstrated dominant path remains whole-project summary construction.

The cold run also produced:

- 21,616 `intrinsic-effect-query` log records;
- 11,878 failed reads of a `src/package.json` candidate;
- 8 `spawn ENOMEM` records during external implementation inference.

Any retained architecture should memoize every visited manifest-search directory,
aggregate repeated debug records,
and avoid independent TypeScript API processes for each demanded external package.

Latency compliance must be verified at the exact user command boundary with:

- empty persistent cache;
- analyzer or cache-schema invalidation;
- relevant source changes;
- stable warm state.

Moving work into an opportunistic cache,
a prior lint run,
or an unmeasured daemon does not satisfy the cold target.
Budget exhaustion must report incomplete or opaque analysis,
never assume no effect.

## Current architectural ranking

### Demand-driven source proof with exact generated certificates

This remains the leading semantic design only if a prototype meets the cold target.
Start from relevant callables in the 13 lint targets,
follow only edges carrying parameter-derived identity,
referents,
callbacks,
or capabilities,
and compute fixed points only for reached recursive components.

Generated summaries are not catalogs when they are reproducible,
hash-bound to exact source and resolution inputs,
and contain no handwritten per-callable overrides.
Whole-project source-signature validation must leave the lint hot path.

### Verified isolation at explicit plain-data boundaries

Isolation can admit opaque implementations only when no caller-owned identity or capability crosses.
The admitted domain must reject getters,
proxies,
functions,
callbacks,
promises,
ports,
streams,
host handles,
transfer lists,
`SharedArrayBuffer`,
and views backed by shared memory.
`structuredClone()` alone is not a proof because serialization can execute accessors,
and transfer or shared-memory semantics remain observable.

### Handwritten dependency manifests

These are distributed catalogs.
They can improve ergonomics but surrender independent verification.
A manifest derived mechanically from exact source belongs to the source-proof option instead.

## Rust and Node-API investigation

The current hypothesis is:
Rust can accelerate parsing,
graph construction,
fixed-point propagation,
hashing,
and certificate validation,
but Node-API alone does not fix eager scope or supply TypeScript type semantics.
A Rust addon that receives the same 337-source workload can still miss the 10-second target.

Oxlint JavaScript plugin callbacks are synchronous and routed to the main JavaScript thread through a
`ThreadsafeFunction`.
A synchronous Node-API addon can perform native work during that callback,
but an async addon cannot be awaited by the current rule visitor.
Native computation therefore removes JavaScript and chatty-RPC overhead;
it does not automatically add Oxlint worker parallelism.

Current source probes:

- Oxc clone:
  `/home/user/temp/agent/oxc-20260722-napi-eval`,
  revision `90b8fd143c0085f3fb2d47344c578e23ccc33da7`;
- TypeScript-Go clone:
  `/home/user/temp/agent/typescript-go-20260722-napi-eval`,
  revision `4e25827a509ade0b8f48a690e9538be74fb491a6`;
- NAPI-RS clone:
  `/home/user/temp/agent/napi-rs-20260722-eval`,
  revision `e0b87086eefe0e7efeea6d269e9403c4be4ba9aa`;
- Neon clone:
  `/home/user/temp/agent/neon-20260722-eval`,
  revision `38960e4381d9ad13b551cdf2d261f609167c9bc2`.

Oxc now contains `oxc_type_checker`,
but its crate documentation calls it experimental and work in progress.
It is not yet evidence of parity with TypeScript 7 semantics required by this rule,
including mapped readonly state,
resolved overloads,
conditional types,
and declaration merging.

TypeScript-Go remains the semantic authority.
Its sync API exposes individual checker operations over synchronous RPC.
Its source also contains `_tools/customlint`,
which may be a more direct route to running effect analysis beside the Go checker than a Rust addon.
This route needs source and platform analysis before recommendation.

NAPI-RS and Neon both expose Rust through Node-API.
They are bridge alternatives,
not semantic engines.
Their relative ergonomics cannot decide whether the analyzer meets the guarantee or latency target.

## Evaluation candidates

Continue equal-depth assessment of:

- demand-driven TypeScript/JavaScript analysis using the existing TypeScript-Go sync API;
- a Rust Node-API addon using Oxc for syntax and graph work while retaining batched TypeScript-Go semantic facts;
- analysis implemented beside TypeScript-Go's checker through its custom-lint or API extension surface;
- a native Oxlint rule or maintained Oxlint fork,
  if custom native rules can be integrated without losing TypeScript semantic authority.

Do not recommend a pure Oxc Rust checker until parity is tested against the rule's existing semantic corpus.
Do not recommend Node-API based on language-speed intuition.
The decisive evidence is a consumer-boundary prototype on the exact 13-file cold workload.

## Research state and next actions

- Repository precedent search found Rust packages but no existing repo-owned Node-API addon.
- Current Oxc source confirms an experimental Rust type checker and a separate `tsgolint` process integration.
- Current TypeScript-Go source confirms the sync API's per-operation checker RPC handlers
  and a custom-lint tool surface.
- Current NAPI-RS and Neon source confirms both are Node-API binding frameworks
  with synchronous and asynchronous surfaces.
- External discovery has begun and crossed the substantial-evaluation threshold.
  Create or update the required technology vet report before making a recommendation.
- Inspect the exact Oxc native-rule extension boundary,
  TypeScript-Go custom-lint registration,
  NAPI-RS and Neon artifact provenance,
  and platform matrices.
- Measure current analysis time by phase and synchronous TypeScript RPC count.
- Prototype only in a disposable worktree or scratch package,
  never through main-worktree product mutations during this evaluation.
- The prototype must preserve diagnostics on the semantic corpus and exercise the exact 13-file command with cold state.

## Existing commits and worktrees

- `ff7b18fe5` records the 10-second acceptance target in the incremental-cache troubleshooting document.
- `8e3d38882` records the standalone semantic-bridge startup measurement.
- `/var/home/user/temp/agent/readonly-no-package-catalog-20260722` contains the package-catalog-removal experiment and
  must remain intact.

Unrelated worktree changes are concurrent work and must not be modified:

- `mise.toml`;
- `package/module/css-edit.fuzz/src/coverage-driver.ts`;
- `package/webapp-productivity/done-postcss/data/done.db-wal`.
