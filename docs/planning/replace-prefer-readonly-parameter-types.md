# Replace `prefer-readonly-parameter-types` with a project rule

Status:
 design interview in progress.
No implementation is authorized until the grilling interview reaches shared understanding.

Last updated:
 2026-07-12.

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
- settled decisions and the still-ordered question queue;
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

## Confirmed host constraint and open bridge investigation

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

The feasibility investigation must compare at least:

- the Oxlint ESTree already supplied to the rule plus a TypeScript `Program` and `TypeChecker`,
  with source-span or binding mapping between the two trees;
- `oxc-parser` plus the TypeScript compiler;
- `yuku-parser` and `yuku-analyzer`,
  including whether Yuku exposes TypeScript type semantics rather than only scopes,
symbols,
resolved references,
and cross-file module links;
- Oxc isolated declaration generation as a normalized per-file input to later analysis;
- `rolldown-plugin-dts` as an existing declaration pipeline,
  including whether its bundling lifecycle can serve lint-time queries rather than only build output;
- a syntax or function-body analysis rule as the no-extra-semantic-engine baseline.

No candidate is selected or ruled out yet.
Exact parity also requires defining which parts of the retired rule's semantics are worth preserving,
not merely obtaining any type checker.

## Provisional architecture

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

The semantic contract and semantic-analysis pipeline are not settled.
Those decisions determine the rule name,
visitor shape,
fixtures,
migration edits,
and dependency or generated-declaration boundaries.

## Implementation sequence after approval

### Prototype semantic-information candidates

Build disposable probes against the same representative type catalog used to calibrate the final rule.
Each candidate must prove how a plugin invocation obtains reusable project state,
maps the Oxlint visitor node to semantic data,
resolves local and package aliases,
handles project references,
and invalidates caches after edits.

Measure cold and warm lint behavior through the normal package lint boundary.
Inspect native artifact provenance for parser or analyzer packages before execution.
Do not select a bridge from parser speed alone because readonly analysis depends on semantic depth,
not AST throughput.

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

Implement the rule in a focused sibling module and register it in the plugin index.
Use scope/reference APIs rather than source-text matching when the selected contract concerns bindings or mutations.

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
- sites violating the new contract receive a structural code change or a scoped replacement-rule directive according
  to the agreed exception policy;
- comments and helper types created only to placate the retired rule are removed or simplified;
- historical troubleshooting documents remain as historical evidence but gain a supersession note when their remedy is
  no longer current.

Repeat the classification for `packages-paused/` if paused packages are included in the rollout decision.
Do not perform blind string replacement because old block disables may contain another still-active rule.

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

A full active-workspace lint is the rollout gate after targeted consumer checks pass.

## Decision queue

Resolve one item at a time during the grilling interview:

- semantic contract;
- treatment of actual parameter mutation;
- scope for inline versus named type declarations;
- inferred and externally dictated callback parameters;
- exception and suppression policy;
- test-file and declaration-file overrides;
- paused-package migration;
- initial severity and promotion gate;
- autofix or suggestion policy;
- rule name and diagnostic wording;
- historical documentation updates;
- acceptance criteria for deleting the native rule.

## Research checkpoint

Current checkpoint:

- commit `5eb558033` added the initial plan and Oxlint host-API investigation;
- that initial documentation overstated the host limitation as an impossibility result;
- the user corrected the assumption and named additional bridge candidates:
  `oxc-parser` plus TypeScript,
  Yuku,
  Oxc isolated declarations,
  and `rolldown-plugin-dts`;
- the docs now distinguish absent Oxlint-supplied parser services from the feasibility of an independently loaded semantic
  pipeline;
- preliminary source findings narrow candidate roles without selecting one:
  - TypeScript can create the required `Program` and `TypeChecker` independently of Oxlint;
  - `oxc-parser` supplies syntax rather than TypeScript type objects,
    so pairing it with TypeScript still needs a TypeScript program and a cross-tree mapping;
  - Yuku 0.6.1 supplies Oxc-compatible AST,
    scopes,
    symbols,
    resolved references,
    and cross-file module links,
    but its documented and exported analyzer surface does not expose inferred TypeScript type objects or a
    `TypeChecker`;
  - Oxc isolated declarations emit per-file `.d.ts` text without TypeScript type checking when source satisfies
    `isolatedDeclarations`;
  - `rolldown-plugin-dts` 0.27.7 contains a reusable-looking TypeScript program cache and invalidation model,
    while its public operation remains declaration generation and bundling rather than arbitrary type queries;
- these role findings do not rule out compositions,
  such as declaration normalization followed by TypeScript analysis or Yuku-assisted binding and mapping;
- no candidate has been selected,
  rejected,
  or performance-qualified;
- the user required every tagged `AGENTS.md` rule to stay under 50 words and 200 normalized characters;
- `RLM` now records that global limit,
  `DCK` was shortened,
  and the only other over-limit rules (`GCL` and `GCG`) were split;
- a normalized scan measured 216 rules in both `AGENTS.md` and generated `CLAUDE.md`,
  with no rule reaching either limit;
- no implementation code or dependency change is authorized.

Next action:
ask which semantic guarantee the replacement should target.
That answer freezes the bridge evaluation's hard requirements before disposable probes and equal-depth candidate
validation.

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
Independent analysis through the TypeScript compiler,
`oxc-parser`,
Yuku,
Oxc isolated declarations,
or `rolldown-plugin-dts` remains open pending source audit and disposable probes.

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

Every owned callable signature carries its own effect tags,
including overload declarations,
interface and type-literal call signatures,
abstract methods,
ambient declarations owned by this repository,
and the concrete implementation signature.

Overload effects may differ.
The implementation summary must cover the union of reachable overload effects,
with parameters mapped by resolved signature rather than assumed name equality.
The TSDoc plugin validates each signature independently;
the semantic rule validates cross-signature consistency.

Raw external mutable-effect calls are isolated behind locally owned,
documented adapters.
Production code calls the adapters rather than maintaining a global package-symbol effect registry.
Adapter tags state the external effect at the repository boundary and must name the upstream callable in their
description or link.

`@mutates` means "may mutate,
"
not "always mutates.
"
The effect analyzer uses three outcomes:

- proven mutation requires the tag;
- proven absence rejects a stale tag;
- possible mutation through an opaque external boundary requires and accepts the tag,
  while retaining the unresolved boundary in diagnostics or audit output.

This permits honest external adapters without pretending their implementation was proved from unavailable source.

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

### Deferred feasibility outcome

No user policy decision is needed until feasibility probes compare inferred symbolic summaries with TypeScript-checked
effect metadata for bodyless generic callables.

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
Add companion `no-disable-*` enforcement so opaque cases must gain an honest type,
verified effect summary,
local external adapter,
or existing file-class exemption instead of a comment bypass.

An implementation branch may use a temporary warning only while its own migration commit series is incomplete.
The merge-ready state has no active violations and error severity.

### Chosen remediation fix kind

Offer proven type rewrites as Oxlint suggestions.
Do not attach them as direct fixes,
so ordinary `--fix` and the repository's normal `format:oxlint` task cannot apply semantic signature changes.
Suggestions remain available as editor code actions and through explicit `--fix-suggestions` or `--fix-dangerously` use.

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
- signature and overload effect inconsistencies discovered during implementation.

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

The disposable Oxlint-boundary prototype proved all of the following with installed TypeScript 7.0.2:

- imported aliases,
  generics,
  unions,
  overloads,
  function types,
  call signatures,
  and method signatures resolve from the TypeScript project;
- source offsets from the TypeScript tree produce exact Oxlint diagnostic spans;
- explicitly readonly types and recursively mapped `DeepReadonly` projections can be distinguished from mutable
  types;
- direct,
  cross-file transitive,
  and higher-order callback mutation summaries reach the owning parameter;
- a virtual filesystem overlay changes queried parameter types in the next snapshot without writing source to disk.

Readonly detection must isolate the unstable detail behind a tested adapter.
TypeScript 7.0.2 exposes transient mapped-property readonly state through `Symbol.checkFlags`,
whose upstream `CheckFlagsReadonly` value is `1 << 3` but whose enum is not exported.
Pin adapter contract tests to the installed TypeScript version and fail closed with `opaqueEffect` or a dedicated
semantic-bridge diagnostic when the expected capability disappears.

### Deferred readonly projection outcome

The exact authoring mechanism remains evidence-driven:
existing `ReadonlyDeep`,
a project-owned utility,
or synthesized structural syntax must be compared against brands,
functions,
collections,
capabilities,
recursive types,
conditional types,
and generic variance before selection.
The chosen TypeScript 7 bridge can evaluate each candidate without selecting its source-level spelling in advance.

### Grilling status

The currently known user-policy branches are resolved.
Technical feasibility work may uncover another genuine policy fork;
if it does,
resume one-question-at-a-time grilling rather than choosing a preference implicitly.
Otherwise complete the implementation plan from measured prototype results and request confirmation of shared
understanding before any implementation.
