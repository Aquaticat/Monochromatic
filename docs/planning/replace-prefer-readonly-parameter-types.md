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

### Awaiting decision

The first unresolved decision is the replacement rule's semantic contract,
informed by the bridge feasibility results.
