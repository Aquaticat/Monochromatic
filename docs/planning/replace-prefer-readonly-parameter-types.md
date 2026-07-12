# Replace `prefer-readonly-parameter-types` with a project rule

Status:
 design interview in progress.
No implementation is authorized until the grilling interview reaches shared understanding.

Last updated:
 2026-07-12.

## Goal

Retire Oxlint's type-aware `typescript/prefer-readonly-parameter-types` rule and replace its useful policy with a
project-owned JavaScript rule in
`@monochromatic-dev/config-oxlint-no-restricted-syntax`.

The replacement must reduce false positives and configuration maintenance without quietly claiming semantic guarantees
that an Oxlint JavaScript plugin cannot provide.

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

## Confirmed platform constraint

Oxlint 1.73 JavaScript plugins do not receive TypeScript type information.
The installed `@oxlint/plugins` declaration says parser services are unavailable,
and a disposable probe run with `--type-aware` observed an empty `context.sourceCode.parserServices` object.
Oxlint's source separately runs the regular linter,
 which hosts JavaScript plugins,
and the tsgolint type-aware linter.

The source trace and runnable probe are recorded in
[`docs/troubleshooting/oxlint-js-plugin-type-information.md`](../troubleshooting/oxlint-js-plugin-type-information.md).

Consequences:

- a normal rule in `packages/oxlint-plugins/no-restricted-syntax/` can inspect syntax,
  scopes,
  references,
  and function bodies;
- it cannot ask Oxlint for resolved aliases,
  package provenance,
  generic instantiations,
  class members,
  or deep structural readonlyness;
- exact parity with the retired rule would require creating and maintaining a separate TypeScript program inside the
  plugin,
  not merely writing another AST visitor.

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

The semantic contract is not settled.
That decision determines the rule name,
visitor shape,
fixtures,
migration edits,
and whether a separate TypeScript compiler dependency is needed.

## Implementation sequence after approval

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

## Decision log

### Settled before the interview

- Replace the native rule rather than adding another layer of allow-list entries.
- Implement the replacement in the existing `no-restricted-syntax` JavaScript plugin package.
- Keep this planning document current as decisions are made.
- Do not implement until the user confirms shared understanding.

### Awaiting decision

The first unresolved decision is the replacement rule's semantic contract.
