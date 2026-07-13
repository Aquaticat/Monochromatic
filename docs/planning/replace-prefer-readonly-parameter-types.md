# Replace `prefer-readonly-parameter-types` with a project rule

Status:
 implementation in progress after user confirmation on 2026-07-13.

Last updated:
 2026-07-13.

## Implementation progress

The user confirmed shared understanding and authorized implementation.
The TSDoc contract phase is complete:

- commit `7c25431a6` specified parser and fixture behavior;
- commit `dbde47701` registered and validated `@mutates`;
- commit `0c7931fa0` documented external TSDoc registration behavior;
- commit `cac9e6a1d` added bounded cross-rule parsed-body reuse;
- commit `d6ea31e25` covered method,
  call,
  and ambient signatures.

The semantic-bridge foundation is complete:

- commits `9283e2e7a` and `de9578f10` declared and locked TypeScript 7 as a runtime dependency;
- commits `12071895f` and `39c2ac5e9` added tagged lifecycle logging;
- commit `73aecdf47` added configured-project discovery,
  virtual overlays,
  snapshot disposal,
  BOM-aware node mapping,
  and fail-closed errors;
- commit `32d84ac10` added exact owner,
  member,
  provenance,
  evidence,
  and package-major intrinsic effects;
- the built overlay test exposed stale semantics when `openFiles` persisted;
  the adapter now uses it only for project discovery before switching to `openProjects` and `closeFiles`;
- the user corrected ambiguous virtual-filesystem callback names;
  commit `a53861211` names both callbacks and return types by overlay and delegation behavior,
  and commit `07d2c6934` records that naming standard in `XNC`.

Verified package tasks:

- `mise run buildAndTest --` with TSDoc parser,
  cache,
  and integration tests;
- `mise run //packages/oxlint-plugins/tsdoc:lint:types`;
- `mise run //packages/oxlint-plugins/tsdoc:lint:oxlint`;
- `mise run //packages/config/oxlint:lint:types`;
- `mise run //packages/config/oxlint:lint:oxlint`.

Next action:
implement readonly classification,
effect summaries,
semantic diagnostics,
and suggestions on the bridge foundation.

## Continuity contract

This session is expected to cross repeated automatic context compactions.
This document is the canonical task state,
not a summary written only at the end.
Update it whenever research changes feasibility,
the user corrects an assumption,
a decision is settled,
a candidate exits,
a probe completes,
or the next action changes.

Keep the following recoverable from repository documents:

- user's actual request and subsequent scope corrections;
- measured repository facts and exact source locations;
- external candidates,
  versions,
  source revisions,
  evidence,
  and unresolved gates;
- discarded hypotheses and why they failed;
- settled decisions and any still-ordered question queue;
- verification commands,
  relevant outputs,
  changed files,
  and commit hashes;
- one explicit next action for a continuation session.

Compaction prompts do not change scope or authorize implementation.
After compaction,
resume from this document and the task list,
then re-derive the next action from the user's request and recorded decisions.

## Decision posture

The user set implementation time and money to unlimited for this replacement.
Do not rank an option lower because it takes longer,
requires more engineering,
uses more analysis passes,
or needs a wider migration.
Correctness,
semantic coverage,
explainability,
and durable maintenance decide between feasible designs.

When removing cost constraints leaves one option that strictly covers the others without weakening those qualities,
adopt and record it without asking.
Ask only when alternatives encode genuinely different policy or correctness outcomes.

## Goal

Retire Oxlint's type-aware `typescript/prefer-readonly-parameter-types` rule and replace its useful policy with a
project-owned JavaScript rule in
`@monochromatic-dev/config-oxlint-no-restricted-syntax`.

The replacement must reduce false positives and configuration maintenance without claiming guarantees that its chosen
analysis pipeline has not proved.

## Measured baseline

A repository scan on 2026-07-12 found:

- 372 textual references to `prefer-readonly-parameter-types`;
- 154 `oxlint-disable` directives naming the rule across 113 files;
- 55 active files with those directives after excluding `packages-paused/`;
- 809 lines across the four dedicated config and allow-list files;
- 363 allowed type names,
   comprising 190 TypeScript library names and 173 package type names;
- 122 uses of `ReadonlyDeep` across the repository;
- one output-level false-positive suppression in
  `packages/dev-script/task-util/src/oxlint-suppress.ts`.

The active disable reasons include external SDK types,
mutable-by-design accumulators and caches,
branded primitive intersections,
callback-bearing declarations,
and generic types whose caller-owned identity must be preserved.
The current rule is therefore enforcing several different concerns through one deep structural readonly test.

## Confirmed host constraint and chosen bridge

Oxlint 1.73 does not supply its JavaScript plugins with TypeScript type information.
The installed `@oxlint/plugins` declaration says parser services are unavailable,
and a disposable probe run with `--type-aware` observed an empty `context.sourceCode.parserServices` object.
Oxlint's source separately runs the regular linter,
 which hosts JavaScript plugins,
and the tsgolint type-aware linter.

The source trace and runnable probe are recorded in
[`docs/troubleshooting/oxlint-js-plugin-type-information.md`](../troubleshooting/oxlint-js-plugin-type-information.md).

This establishes only what the Oxlint host supplies.
It does not establish that a JavaScript plugin must remain syntax-only.
The plugin can load other parser,
semantic-analysis,
declaration-generation,
or TypeScript compiler components.

The selected independent bridge is TypeScript 7.0.2's `typescript/unstable/sync` API.
One project-owned adapter owns the native client,
project discovery,
snapshots,
virtual current-file overlays,
source-node lookup,
semantic queries,
and fail-closed bridge diagnostics.
TypeScript 6 fallbacks are prohibited.
The complete technology vet and remaining implementation acceptance gates are recorded in
[`docs/audit/tech-readonly-parameter-semantic-bridge-vet-2026-07-12.md`](../audit/tech-readonly-parameter-semantic-bridge-vet-2026-07-12.md).

## Architecture

The implementation location is settled by the request:

- rule implementation:
  `packages/oxlint-plugins/no-restricted-syntax/src/rules/`;
- plugin registration:
  `packages/oxlint-plugins/no-restricted-syntax/src/index.ts`;
- shared config entry:
  `packages/config/oxlint/src/rules/restriction.ts`;
- fixture config and source cases:
  `packages/test-fixture/oxlint-no-restricted-syntax/`;
- integration tests:
  `packages/oxlint-plugins/no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts`;
- user-facing rule contract:
  `packages/oxlint-plugins/no-restricted-syntax/README.md`.

The semantic contract is the layered readonly-type and mutation-effect model recorded in the decision log.
The plugin package adds direct runtime dependencies on TypeScript 7 and the existing shared plugin package.
Packages receiving `ReadonlyDeep` projections declare `type-fest` directly through the pnpm catalog.

## Implementation sequence after approval

### Build the TypeScript 7 semantic adapter test-first

Add contract tests around every unstable API operation before rule logic consumes it.
The adapter must prove configured-project discovery,
current-file virtual overlays,
BOM normalization,
source-span mapping,
snapshot reuse and disposal,
changed/deleted/renamed-file invalidation,
multiple package projects,
symlink and path-case behavior,
and fail-closed handling of missing or changed API capabilities.

Retain the disposable corpus for brands,
recursive and conditional types,
indexed access,
callable objects,
collections,
capabilities,
overloads,
bodyless signatures,
higher-order callbacks,
and Unicode spans.
Extend it for parser recovery,
dynamic dispatch,
closures,
deferred effects,
recursion,
and external callbacks.
Run platform artifact probes on Linux x64,
macOS arm64,
and Windows x64 before completion.
Add intrinsic-effect contract tests for exact ECMAScript,
DOM,
Node,
and package symbols;
package aliases and subpath exports;
supported and unsupported majors;
duplicate installed majors;
and unresolved package metadata.

### Define the rule contract

Record an explicit valid and invalid catalog before writing implementation code.
The catalog must cover declarations,
function expressions,
methods,
constructors,
callback signatures,
destructured parameters,
default values,
rest parameters,
generics,
external API callbacks,
and mutable-by-design state carriers where applicable.

State what the rule does not prove.
In particular,
a syntax-only or body-analysis rule must not be documented as deep type immutability.

### Build the rule test-first

Add invalid and valid fixture files under
`packages/test-fixture/oxlint-no-restricted-syntax/src/`.
Extend the dedicated fixture config and integration test so the new diagnostic appears under
`no-restricted-syntax/<settled-rule-name>`.

Implement the rule as focused sibling modules for the host rule,
semantic adapter,
readonly classifier,
effect summaries,
TSDoc effect lookup,
and source suggestions.
Use TypeScript symbols and resolved signatures for semantic identity,
and use Oxlint scope/reference APIs for current-tree diagnostics.
Unknown calls or unsupported semantic states fail closed with `opaqueEffect` or a dedicated bridge diagnostic;
method-name lists cannot serve as effect proof.

### Implement the `@mutates` TSDoc contract

Register the custom block tag in the TSDoc parser configuration and expose parsed mutation targets through the shared
document-model seam.
Add dedicated validation for syntax,
known parameter targets,
duplicates,
descriptions,
overload consistency,
missing tags,
and stale tags.
Keep malformed-tag diagnostics in the TSDoc plugin and semantic effect diagnostics in the readonly rule.

Update the TSDoc plugin registration,
fixture config,
valid and invalid fixtures,
unit tests,
and README.
Verify that the shared parser performs one parse per comment for all participating rules.

### Switch shared configuration

Add the project rule to
`packages/config/oxlint/src/rules/restriction.ts` at the agreed rollout severity.
Remove `typescript/prefer-readonly-parameter-types` from
`packages/config/oxlint/src/rules/correctness.ts`.
Update overrides so test and external-signature behavior matches the settled policy rather than inheriting the old
rule's exemptions accidentally.

### Remove retired configuration

Delete the obsolete dedicated configuration files:

- `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.ts`;
- `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-lib.ts`;
- `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts`;
- `packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg-unbash.ts`.

Remove the obsolete output suppression and its dedicated test cases from
`packages/dev-script/task-util/src/oxlint-suppress.ts` and
`packages/dev-script/task-util/src/oxlint-suppress.unit.test.ts`.

### Migrate source directives and explanatory types

Classify every active directive before deleting it:

- sites accepted by the new contract lose the directive;
- sites violating the new contract receive an honest `ReadonlyDeep` projection,
  an ownership-correct declaration improvement,
  an accurate `@mutates` contract,
  or a local adapter around external mutation;
- comments and helper types created only to placate the retired rule are removed or simplified;
- historical troubleshooting documents remain as historical evidence but gain a supersession note when their remedy is
  no longer current.

Keep `packages-paused/`,
generated,
fixture,
invalid,
and build-output trees under their existing ignores.
Do not perform blind string replacement because old block disables may contain another still-active rule.
No inline suppression of the replacement rule is permitted.

### Verify the consumer boundary

Run the package unit tests,
fixture lint,
plugin type lint,
config build,
and config type lint through their `mise` tasks.

Build the shared Oxlint config,
then lint representative consuming packages through their normal package `lint:oxlint` task.
Verify that:

- intended new violations are reported under the project rule ID;
- accepted external and mutable-by-design boundaries no longer require old directives;
- old directives and config references are absent;
- the normal `--type-aware` wrapper still runs the remaining native type-aware rules;
- no output suppression hides replacement-rule diagnostics.

Build the published plugin artifact and load it from a disposable external consumer with no monorepo-root dependency
resolution.
Verify TypeScript 7 native artifact startup and rule diagnostics on Linux x64,
macOS arm64,
and Windows x64.
Build declarations through the installed Oxc and `rolldown-plugin-dts` path and assert every `@mutates` target and
description survives overloads,
call signatures,
and re-exports.

A full active-workspace CLI lint is the rollout gate after targeted consumer checks pass.
The CLI is authoritative;
editor diagnostics remain deferred while Oxlint's language server cannot load JavaScript plugins.

## Interview resolution

All discovered policy branches are resolved:

- preserve readonly type-contract semantics and add mutation effects;
- require universal,
  verified `@mutates` contracts for owned mutation;
- recognize ECMAScript,
  DOM,
  Node,
  and major-version-gated effects for packages present in the recorded pnpm lockfile baseline intrinsically,
  with local adapters as the fallback;
- infer higher-order relationships rather than adding a TSDoc relation language;
- enforce active production source while retaining test,
  benchmark,
  declaration,
  paused,
  generated,
  fixture,
  invalid,
  and build-output exemptions;
- prohibit inline suppression and enable the replacement at `error`;
- expose semantic rewrites only as suggestions;
- keep one rule identity with distinct diagnostic message IDs;
- preserve `@mutates` in published declarations;
- use TypeScript 7's unstable synchronous API without a TypeScript 6 fallback;
- treat the CLI as authoritative until Oxlint supports JavaScript plugins in its language server;
- author local projections with `type-fest`'s `ReadonlyDeep` while rejecting dishonest capability projections.

No policy question remains known.
A newly discovered genuine policy fork reopens one-question-at-a-time grilling;
implementation details that have a correctness-dominant answer do not.

## Research checkpoint

Current checkpoint:

- the technology vet selected TypeScript 7.0.2's `typescript/unstable/sync` API and rejected every TypeScript 6
  fallback;
- real Oxlint-boundary probes covered imported semantic types,
  mapped readonly state,
  representative direct and higher-order effects,
  current-file overlays,
  configured-project discovery,
  snapshot reuse,
  BOM and Unicode mapping,
  and native child cleanup;
- the type corpus confirmed that `ReadonlyDeep` handles the tested collections and recursive structures but cannot make
  retained capability methods honest;
- installed Oxc isolated declarations and `rolldown-plugin-dts` 0.27.4 preserved all tested `@mutates` blocks through a
  re-exporting declaration bundle;
- the advisor review converted unproved generalizations into explicit implementation acceptance gates;
- the user chose CLI-only authority while Oxlint's language server lacks JavaScript-plugin support;
- the user chose `type-fest`'s `ReadonlyDeep` instead of a project-owned duplicate or synthesized structural types;
- all discovered policy questions are resolved;
- no implementation code or dependency change is authorized.

Next action:
request the user's confirmation that this document reflects shared understanding.

## Decision log

### Settled before the interview

- Treat implementation time and money as unlimited.
- Never choose a narrower design merely because it is easier,
faster,
or cheaper to build.
- Resolve a decision without asking when removal of resource constraints leaves one strictly dominant option.
- Replace the native rule rather than adding another layer of allow-list entries.
- Implement the replacement in the existing `no-restricted-syntax` JavaScript plugin package.
- Keep this planning document current as decisions are made.
- Do not implement until the user confirms shared understanding.

### Corrected during investigation

The initial plan incorrectly treated absent Oxlint parser services as proof that a replacement could not reproduce
 type-aware semantics.
The verified fact is narrower:
Oxlint does not supply type information to JavaScript plugins.
Independent analysis was therefore investigated.
The completed vet selected TypeScript 7's synchronous unstable API;
the other candidates remain recorded as rejected alternatives or declaration-only components.

### Resolved from scope and the no-resource-constraint posture

The replacement remains a type-contract rule.
A behavior-only `no-param-reassign` variant is not a replacement for
`prefer-readonly-parameter-types` because it abandons the declared API contract.
No resource constraint justifies that loss.

The comprehensive design may analyze body writes,
aliases,
callee effects,
and capability use as supporting evidence.
That analysis helps distinguish accidental mutable exposure from a truthful mutable parameter contract;
it does not replace type analysis.

Existing active code proves that intentional parameter mutation is legitimate in this repository:
visited sets,
caches,
DOM transforms,
streams,
render sessions,
and assertion trackers all have documented mutable contracts.
The replacement must express these contracts without restoring a global type-name allow list or treating every method as
readonly.

### Chosen mutation-intent declaration

Intentional parameter mutation uses a verified custom TSDoc block tag.
Canonical proposed grammar:

```typescript
/**
 * Clears shared traversal state before reuse.
 *
 * @param visited - Shared cycle detector retained across calls.
 *
 * @mutates visited - Clears caller-owned traversal state.
 */
function clearVisited(visited: Set<string>,): void {
  visited.clear();
}
```

One `@mutates` block names one top-level parameter or destructured parameter property,
using the same naming rules as `@param`.
The description states why mutation belongs to the function's contract.
The semantic rule reports missing tags,
stale tags,
and mutation that reaches an undeclared parameter through aliases or callees.

### Confirmed TSDoc ripple

`@mutates` is not a standard TSDoc tag.
The repository's TSDoc plugin currently hardcodes standard tags and carries only `@yields` as a custom tag.
Supporting `@mutates` therefore requires coordinated changes rather than a one-line allow-list edit:

- `packages/oxlint-plugins/tsdoc/src/rules/tag-names.ts`:
  recognize the custom tag and correct its standard-only documentation;
- `packages/oxlint-plugins/tsdoc/src/tsdoc-blocks.ts`:
  terminate preceding blocks at `@mutates` and parse mutation blocks;
- `packages/oxlint-plugins/tsdoc/src/tsdoc-doc-model.ts`:
  represent target names and descriptions;
- TSDoc parameter extraction:
  validate mutation targets against plain,
  rest,
  defaulted,
  and destructured parameters;
- dedicated TSDoc rules:
  reject missing names,
  unknown names,
  duplicate targets,
  and missing descriptions independently of semantic mutation analysis;
- `packages/oxlint-plugins/tsdoc/src/index.ts` and
  `packages/config/oxlint/src/rules/tsdoc.ts`:
  register and enable the new validation rules;
- `packages/test-fixture/oxlint-tsdoc/` and TSDoc unit tests:
  add valid,
  malformed,
  duplicate,
  destructured,
  fenced-example,
  and unknown-tag cases;
- `packages/oxlint-plugins/tsdoc/README.md` and shared config documentation:
  disclose the project-specific TSDoc extension and its grammar;
- the readonly rule:
  consume the same parsed mutation blocks rather than implementing a second comment scanner.

The TSDoc plugin owns tag grammar and signature-name validation.
The readonly rule owns effect verification against types,
body writes,
aliases,
and callee summaries.
Shared parsing primitives must move behind one dependency seam,
likely `@monochromatic-dev/config-oxlint-shared`,
so the sibling plugins cannot drift.

`tsdoc/tag-lines` already applies to every leading tag,
so `@mutates` automatically requires a preceding blank line.
`tsdoc/empty-tags` must not classify `@mutates` as a modifier because the new tag requires content.

### Chosen layered type and effect contract

For a nonmutating parameter,
require a deeply readonly TypeScript type whenever that type honestly represents the callable contract.
For external,
identity-sensitive,
callback-bearing,
branded,
or capability types where a readonly projection would misrepresent the usable API or break required assignability,
retain the original type only when whole-program effect analysis proves no mutation path.

This is not a global type-name allow list.
The decision is made per parameter from resolved declarations,
provenance,
assignability,
used members,
and effect summaries.
A plain owned object that can become `Readonly<T>` remains a violation when declared mutable.
An opaque capability is not forced through a facade merely to satisfy syntax.

Readonlyness and mutation effects are transitive through reachable properties,
aliases,
destructuring,
closures,
and callee arguments.
Unknown external or dynamic effects fail closed:
the implementation must obtain an explicit effect summary or require `@mutates` rather than assuming safety.

The absence of `@mutates` is a verified negative effect contract,
but it does not replace an honest TypeScript readonly type where one is available.

### Chosen callable coverage

Every callable that intentionally mutates a parameter requires `@mutates`:
exported functions,
local helpers,
methods,
constructors,
getters or setters with parameters,
function expressions,
and inline callbacks.

The rule infers effects to verify tags and propagate diagnostics,
not to make internal mutation implicit.
Every call edge therefore has an inspectable contract.
Moving a callable between local and exported scope does not change the requirement.

The TSDoc plugin already visits function expressions and arrow functions as documentable nodes.
The implementation must add mutation-tag fixtures for direct declarations,
methods,
and callback comment attachment so Oxlint's comment ownership cannot silently skip an effect contract.

### Chosen bodyless and external contract model

Every owned callable signature in enforced source carries its own effect tags,
including overload declarations,
interface and type-literal call signatures,
abstract methods,
source `declare` signatures in `.ts` files,
and the concrete implementation signature.
Signatures inside `.d.ts`,
`.d.mts`,
and `.d.cts` files remain exempt.

Overload effects may differ.
The implementation summary must cover the union of reachable overload effects,
with parameters mapped by resolved signature rather than assumed name equality.
The TSDoc plugin validates each signature independently;
the semantic rule validates cross-signature consistency.

The analyzer intrinsically recognizes effects for ECMAScript,
DOM,
Node,
and common ecosystem packages.
Package effects are keyed by resolved package identity and supported major version;
an effect entry for one major must never apply to another major implicitly.
A package is eligible for intrinsic coverage when its package name occurs in the current pnpm lockfile baseline,
`pnpm-lock.yaml` lockfile version 9.0 with SHA-256
`3912af5f960cef4c459f6dc99966dcdf9947507690f39969a4951404036cf76d`.
Transitive and direct packages use the same eligibility rule.
A later lockfile addition is not silently admitted to this baseline.

Eligibility does not itself assert an effect.
Each catalog entry still records exact callable symbols,
effect targets,
source provenance,
supported declaration versions,
and tests proving both accepted and rejected major-version matches.
Method names alone are never evidence.

An uncatalogued package,
unsupported major,
or unresolved symbol falls back to a locally owned,
documented adapter.
Adapter tags state the external effect at the repository boundary and must name the upstream callable in their
description or link.
This supersedes the earlier adapter-only design while retaining adapters as the fail-closed boundary.

`@mutates` means "may mutate,
"
not "always mutates.
"
The effect analyzer uses three outcomes:

- proven mutation requires the tag;
- proven absence rejects a stale tag;
- possible mutation through an opaque external boundary reports `opaqueEffect` unless it occurs inside a verified local
  adapter.

A local adapter is verified structurally:
every opaque effect must map to a parameter carrying `@mutates`,
and no opaque effect target may remain unaccounted for.
The adapter's generated summary retains the opaque upstream provenance for diagnostics and audit output.
A tag on an arbitrary production callable does not by itself waive `opaqueEffect`.
This permits explicit external adapters without pretending their implementation was proved from unavailable source.

### Rejected higher-order TSDoc relation DSL

A proposed tag such as
`@propagates visitor.value to value`
is rejected.
It embeds parameter relations,
path syntax,
and directional keywords in unchecked comment text.
Typos and renames would depend on a second custom grammar,
and the authored contract would be harder to read than the code it describes.

Keep `@mutates` limited to one signature-local parameter target plus prose description.
The TSDoc plugin can validate that one target against the callable signature and report on the tag line,
like its existing `@param` name checks.
Do not expand TSDoc into a general effect-language syntax.

Higher-order propagation should instead come from machine-readable program structure:

- infer symbolic parameter-to-callback-argument relations from owned function bodies;
- resolve callback call signatures and their `@mutates` summaries through the type checker;
- specialize generated effect summaries at call sites when concrete callback effects are known;
- persist generated summaries for incremental and cross-package analysis rather than asking authors to write relation
  strings;
- use conservative signature-local `@mutates` effects for bodyless or opaque callables when specialization cannot be
  proved;
- prototype TypeScript-level effect metadata only if a bodyless generic API needs expressiveness that generated summaries
  cannot carry.

### Chosen test and declaration exemptions

Tests and declaration files retain their exemptions from the readonly and mutation-effect contract.
The shared config must turn the replacement rule off for all test and benchmark filename forms already recognized across
config and TSDoc handling:

- `*.test.ts`,
  including unit,
  browser,
  and end-to-end variants;
- `*.spec.ts`;
- `*.bench.ts`;
- `*.d.ts`,
  `*.d.mts`,
  and `*.d.cts`.

The TSDoc `@mutates` validation rules use the same exemption predicate,
so exempt files do not gain tag requirements indirectly through the TSDoc plugin.
The dedicated plugin fixture configs remain allowed to enable the rules on fixture files because those files test the
rule itself rather than adopting production policy.

This preserves the current reason for the test override:
framework-owned mutable callbacks,
fixtures,
spies,
and mocks are not production API contracts.
Declaration files remain descriptive ambient shapes without bodies to verify.
Generated and published declarations are preservation-test inputs,
not source files subject to the replacement rule or `tsdoc/*` enforcement.

### Resolved bodyless generic feasibility boundary

Use generated symbolic summaries for owned higher-order implementations.
Bodyless generic callables expose only signature-local `@mutates` effects;
they cannot express an unchecked parameter-relation language.
When specialization cannot prove whether a callback propagates mutation to another parameter,
report `opaqueEffect` and require an owned wrapper with an analyzable body.

### Resolved rollout scope

Do not redefine repository lifecycle categories as part of a lint-rule replacement.
The replacement enforces the active production lint scope.
Existing global ignores remain for paused,
deprecated,
generated,
fixture,
invalid,
and build-output trees.

Migration still removes obsolete native-rule directives and misleading explanatory comments from ignored authored source
when that cleanup does not require making the source compile or pass the new rule.
Historical troubleshooting and audit documents retain factual references with a supersession note.
Generated artifacts are regenerated from their owner or left untouched when no owner is in scope;
never hand-edit them for textual cleanup.

### Resolved suppression and severity policy

The final replacement rule and `@mutates` validation rules are errors.
No inline suppression of either rule is allowed.
Add `no-disable-prefer-readonly-parameter-types.ts`,
register it in the plugin index,
enable it in shared and fixture configs,
and cover line,
block,
and list-style disable directives in fixtures and integration tests.
Opaque cases must gain an honest type,
verified effect summary,
local external adapter,
or existing file-class exemption instead of a comment bypass.
Retired native-rule directives must be parsed and edited token-by-token so mixed directives retain every other rule.

An implementation branch may use a temporary warning only while its own migration commit series is incomplete.
The merge-ready state has no active violations and error severity.

### Chosen remediation fix kind

Offer proven type rewrites as Oxlint suggestions.
Do not attach them as direct fixes,
so ordinary `--fix` and the repository's normal `format:oxlint` task cannot apply semantic signature changes.
Suggestions remain available through explicit `--fix-suggestions` or `--fix-dangerously` use.
They can become editor code actions only after Oxlint's language server supports JavaScript plugins.

Oxlint 1.73 JavaScript plugins cannot mark a fix dangerous directly.
Their protocol maps `Diagnostic.fix` to a normal fix and `Diagnostic.suggest` to a suggestion;
there is no JavaScript dangerous-fix field.
The verified source trace and disposable probe are recorded in
[`docs/troubleshooting/oxlint-js-plugin-fix-kinds.md`](../troubleshooting/oxlint-js-plugin-fix-kinds.md).

The rule sets `meta.hasSuggestions: true` and omits a direct `fix` for semantic rewrites.
A suggestion is emitted only when the semantic pipeline constructs one exact replacement and verifies the rewritten
program against the relevant TypeScript projects.
Ambiguous cases remain diagnostics without a suggestion.

### Chosen rule identity and taxonomy

Use one project rule:

```text
no-restricted-syntax/prefer-readonly-parameter-types
```

The recognizable basename preserves lineage from the retired native rule.
One semantic analysis owns the complete layered readonly and effect contract.
Distinct message IDs classify findings without independently configurable partial rules:

- `shouldBeReadonly`;
- `missingMutatesTag`;
- `staleMutatesTag`;
- `opaqueEffect`;
- `dishonestReadonly`;
- `inconsistentMutatesContract`;
- `semanticBridgeUnavailable`.

Malformed tag names,
duplicate targets,
missing descriptions,
and unknown parameter targets remain `tsdoc/*` diagnostics because they are documentation-grammar failures.

The rule has no semantic-relaxation options.
The public package may expose the fixed project policy,
but consumers cannot configure away depth,
effect verification,
or opaque-boundary handling.

### Resolved suggestion coverage

Offer a suggestion only when the analyzer can generate a complete remediation without inventing human rationale:

- replace a mutable type with one verified honest readonly form;
- remove a stale `@mutates` block only after closed-world proof of no effect;
- perform exact mechanical syntax normalization around an otherwise complete tag.

Do not synthesize missing `@mutates` descriptions,
external adapters,
or effect rationales.
Those diagnostics require authored design because project TSDoc requires comments to explain why.

### Chosen mutation boundary

`@mutates parameterName` means the callable may cause any caller-observable state change through state reachable from
that parameter at entry.
It covers:

- property assignment,
  update,
  and deletion;
- transitive writes through nested objects and aliases;
- collection mutators;
- stream,
  iterator,
  cancellation,
  event,
  DOM,
  and other capability operations that change receiver state or external state represented by the receiver;
- synchronous,
  asynchronous,
  deferred,
  and closure-captured effects;
- effects propagated through callees and callbacks.

Local rebinding of the parameter variable does not mutate the caller's referent and is outside this rule.
A separate parameter-reassignment policy could govern that syntax later.
Do not introduce separate `@consumes`,
`@writes`,
or `@cancels` tags;
the prose description explains the domain-specific transition while the machine-readable effect remains one concept.

### Chosen ownership-aware remediation

Use whole-program ownership evidence to choose the remediation location.

When every valid use treats a repository-owned type as immutable,
make the type declaration deeply readonly and let consumers retain the canonical name.
When lifecycle owners legitimately mutate the type,
keep that declaration mutable and apply an honest readonly projection only at nonmutating parameter boundaries.
External capability types retain their original form only under the selected effect proof.

Type-owner suggestions originate when the owner file is linted,
not as cross-file edits attached to a consumer diagnostic.
Oxlint JavaScript fix payloads carry ranges for the current file rather than workspace edits.
The semantic pipeline may coordinate findings across files,
but each suggestion must be independently valid in its own file and pre-verified against all affected TypeScript
projects.

For mixed ownership,
do not automatically split one domain type into mutable and immutable sibling types.
Prefer a local projection unless an independently meaningful domain distinction already exists or is separately designed.

### Chosen declaration publication

Preserve `@mutates` blocks in emitted and bundled declaration files.
Mutation effects are part of the published API contract,
not repository-only lint metadata.
Do not strip them or translate them into prose-only `@remarks` blocks.

The custom tag documentation must explain how external TSDoc consumers register it.
Declaration verification must exercise Oxc isolated declaration output,
`rolldown-plugin-dts` bundling,
overloads,
interface call signatures,
re-exports,
and declaration comments to prove targets and descriptions survive intact.
Published rule and config packages must expose the custom-tag contract in their READMEs.

A disposable probe against the repository-installed Rolldown 1.1.5 and `rolldown-plugin-dts` 0.27.4 verified the
selected path.
Oxc isolated declarations preserved three `@mutates` blocks on a function,
an overload,
and a call signature with zero transform errors.
Bundling those declarations through a re-exporting entry preserved all three blocks and their descriptions.
The implementation suite must retain this corpus and add package-level README and external-consumer checks.

### Chosen semantic bridge

Use TypeScript 7's project-native synchronous API through `typescript/unstable/sync`.
Do not install or fall back to TypeScript 6.
The repository accepts the API's unstable compatibility status in exchange for matching its installed TypeScript 7
compiler semantics.

The rule will keep one process-scoped `API` client,
open projects through snapshots,
provide unsaved current-file text through virtual filesystem callbacks,
and invalidate changed files with `updateSnapshot`.
Oxlint's synchronous JavaScript-rule visitors require the synchronous TypeScript API rather than its asynchronous
counterpart.

The disposable Oxlint-boundary prototype proved representative feasibility with installed TypeScript 7.0.2:

- one fixture covering imported aliases,
  generics,
  unions,
  overloads,
  function types,
  call signatures,
  and method signatures resolved from one TypeScript project;
- TypeScript source offsets produced the expected Oxlint spans on ASCII LF source;
- explicitly readonly properties and one recursive mapped `DeepReadonly` projection were distinguished from mutable
  properties;
- one direct mutation,
  one cross-file call,
  and one immediate generic callback-invocation shape propagated to the owning parameter;
- one virtual filesystem overlay changed a queried parameter type in the next snapshot without writing source to disk.

Follow-up probes added these bounded results:

- `openFiles` discovered the distinct package `tsconfig.json` files for the no-restricted-syntax and JSONC-edit
  packages and returned zero semantic diagnostics for each queried source file;
- one Oxlint run configured with 16 threads invoked the JavaScript plugin in one process;
  a cache revision reused one snapshot across ordinary disk-backed files,
  while the BOM fixture exposed a required `sourceCode.hasBOM` normalization before overlay comparison;
- a BOM plus CRLF fixture with an astral character and a combining sequence before the parameter mapped to the expected
  line,
  column,
  and UTF-8 Oxlint output offset;
- brands,
  recursive types,
  callable objects,
  conditional types,
  indexed access,
  arrays,
  maps,
  sets,
  weak maps,
  typed arrays,
  and an `AbortController` capability all produced queryable TypeScript 7 type structures;
- `ReadonlyDeep<Map<...>>` and `ReadonlyDeep<Set<...>>` produced readonly mapped projections,
  while `ReadonlyDeep<AbortController>` retained the mutating `abort` capability and therefore demonstrated why
  structural readonly alone cannot satisfy `dishonestReadonly` detection.

These results select the primary bridge but do not complete its acceptance suite.
The remaining effect,
parser-recovery span,
lifecycle,
cache,
packaging,
and platform probes remain mandatory before the replacement can be enabled and declared complete.

Readonly detection must isolate the unstable detail behind a tested adapter.
TypeScript 7.0.2 exposes transient mapped-property readonly state through `Symbol.checkFlags`,
whose upstream `CheckFlagsReadonly` value is `1 << 3` but whose enum is not exported.
Pin adapter contract tests to the installed TypeScript version and fail closed with a dedicated semantic-bridge
diagnostic when the expected capability disappears.
Do not misreport unavailable readonly semantics as `opaqueEffect`,
which is reserved for unresolved mutation effects.

The published `no-restricted-syntax` package must declare TypeScript 7 as a runtime dependency and prove that its built
artifact resolves `typescript/unstable/sync` in a disposable external consumer.
It may not rely on the monorepo root's development dependency.

Oxlint's language server currently does not support JavaScript plugins.
The CLI is the sole authority for this rule until Oxlint adds JavaScript-plugin language-server support.
Do not retain the incumbent rule for editor-only approximation,
build a separate editor integration,
or block CLI rollout on the upstream capability.
Live editor diagnostics and code actions for this rule are therefore explicitly deferred.

### Chosen readonly projection authoring

Use `ReadonlyDeep` from `type-fest` for parameter-local deep-readonly projections.
Do not create a project-owned duplicate or synthesize inline structural readonly types.
Each package that imports `ReadonlyDeep` must declare `type-fest` through the pnpm catalog rather than relying on a
transitive or root dependency.

`ReadonlyDeep` is authoring syntax,
not proof that the resulting capability is honestly immutable.
The semantic rule must still inspect the resolved projection and its reachable effects.
The probe showed that `ReadonlyDeep<Map<...>>` and `ReadonlyDeep<Set<...>>` produce useful collection projections,
while `ReadonlyDeep<AbortController>` retains `abort()` and must produce `dishonestReadonly` when used as a supposedly
nonmutating contract.

Suggestions may introduce `ReadonlyDeep<T>` only when the target package already declares `type-fest` or when the
migration explicitly adds that dependency.
A suggestion cannot edit `package.json`,
so it must not offer an import that would leave the source unresolved.

### Grilling status

The intrinsic-effect boundary includes ECMAScript,
DOM,
Node,
and package names present in the recorded current `pnpm-lock.yaml` baseline.
Package entries remain gated by resolved major version and source audit.
All currently known policy questions are resolved.
Implementation remains blocked until the user confirms that this final plan reflects shared understanding.
