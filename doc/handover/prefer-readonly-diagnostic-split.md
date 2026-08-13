# Handover: split readonly diagnostics by evidence

Live document.
Update it after each implementation decision,
landed increment,
verification stage,
and issue-tracker mutation.

## Goal

Implement the full diagnostic split investigated in
[`doc/planning/prefer-readonly-positive-evidence.md`](../planning/prefer-readonly-positive-evidence.md)
for [GitHub issue #422](https://github.com/Aquaticat/Monochromatic/issues/422).

The target policies are:

- `prefer-readonly-parameter-types` reports only mutable parameters with a proved deeply readonly replacement;
- a separate correctness rule reports readonly declarations with proved caller-reachable mutations;
- a separate audit rule reports unresolved parameter-reachable effects with cause-specific wording.

Effect-summary construction and propagation must remain shared.
Suppressing a report at an honest-readonly declaration must not remove its charge from mutable callers.

## User decisions

The user selected the full split rather than the minimal honest-readonly reporting guard.

The final shared Oxlint configuration must contain all three rule entries.
Only `prefer-readonly-parameter-types` remains enabled at `error` initially.
The dishonest-readonly correctness rule and unresolved-effect audit rule must be set to `off` because the full workspace is
not ready for them.

Each disabled configuration entry must have a comment linking to one newly opened GitHub tracking issue.
That issue must state that both rules move directly from `off` to `error` when readiness criteria are met.
A warning phase is rejected.

Add the shared configuration entries only as the final implementation step.

## Grilling status

Resolved:

- implementation scope:
  full three-rule split;
- initial configuration:
  preference rule at `error`,
  other split rules at `off`;
- future severity:
  both disabled rules move directly to `error`.

Resolved after handover creation:

- public rule IDs:
  `no-readonly-parameter-mutations` and `no-opaque-parameter-effects`;
- terminology cleanup:
  eliminate moralized readonly terminology from the complete current readonly domain,
  including internal discriminants,
  message IDs,
  fixtures,
  tests,
  documentation,
  and editable issue #422 comments;
- policy gap:
  add an `AGENTS.md` rule requiring neutral operation or evidence terms in diagnostic names and messages.

Historical Git commits remain unchanged.
Unrelated prose using the ordinary English term outside readonly analysis remains out of scope.

Further resolved decisions:

- no-disable policy:
  retain the existing preference-rule guard only;
  defer guards or a reviewed acceptance mechanism for disabled rules to the readiness issue;
- shared architecture:
  compute category-neutral parameter evidence once per semantic source snapshot,
  then let thin rule reporters filter their categories;
- previously hidden contract policy:
  add `no-invalid-parameter-effect-contracts` for stale or missing mutation contracts,
  overload-contract disagreement,
  and redundant ownership markers.

The complete public split therefore has four rules.
Only the preference rule starts at `error`.
The other three start at `off`,
share the tracking-issue comment,
and eventually move directly to `error`.

Further policy decisions:

- readiness may use a reviewed acceptance manifest;
  accepted entries require stable site fingerprints and stale-entry detection;
- readiness also includes fixes,
  verified intrinsic or effect modeling,
  and accurate effect contracts;
- `no-readonly-parameter-mutations` reports only proved reachable mutations through readonly parameters;
- projected readonly types retaining unresolved callable capabilities belong to
  `no-opaque-parameter-effects`,
  even when the callable body does not invoke them.

This evidence routing replaces the old type-level classification grouping.
The mutation rule must never report a mutation that analysis has not proved.

Open decision:

- whether implementation completion closes issue #422 or leaves it open until deferred enforcement.

Do not implement until the user confirms the grilling session has reached shared understanding.

## Existing evidence

A detached-worktree prototype at `0d54ea643` added a reporting-only guard for
`classification.kind === 'honest-readonly'` before `opaqueEffectReport`.
On one matched dependency tree,
the package lint moved from 118 to 66 `prefer-readonly-parameter-types` errors.
The guard removed 52 honest-readonly reports.

The direct control pair in
`package/test-fixture/oxlint-no-restricted-syntax/src/readonly-result-provenance-invalid.ts`
proved propagation remained intact:
`handsReadonlyNamesOnward` became silent while `handsMutableNamesOnward` retained the propagated unresolved
`JSON.stringify` effect.

The prototype built,
and
`mise run //package/oxlint-plugin/prefer-readonly-parameter-type:lint:types`
passed.
The full unit suite was not run because current assertions require the old already-readonly report.
Implementation must update those expectations and retain the mutable-caller propagation control.

The accepted audit at
`doc/audit/tech-prefer-readonly-native-effect-analysis-vet-2026-07-22.md`
requires unresolved effects to be derived,
contained by a verified isolation boundary,
or reported as opaque.
It also requires fail-closed behavior.
The split preserves this capability,
but the initial `off` configuration is an explicit temporary enforcement deferral requested by the user.

## Published investigation

The issue contains six investigation comments.
The final synthesis is
[`issuecomment-5286101731`](https://github.com/Aquaticat/Monochromatic/issues/422#issuecomment-5286101731).

One earlier comment incorrectly claimed `grade-agreement.ts` had narrowed `verdict` to a primitive.
The public correction is
[`issuecomment-5286087654`](https://github.com/Aquaticat/Monochromatic/issues/422#issuecomment-5286087654).
Do not restore the withdrawn primitive-provenance claim.

## Repository state at handover creation

The active branch is `main`.
The investigation document is already on `origin/main` through commit `558123c00`.

The main worktree has a pre-existing modification to `.serena/project.yml`.
Do not edit,
stage,
restore,
or otherwise disturb it.

The investigation's detached worktree has been removed.
No implementation source changes have started.

## Planned verification

Use package-specific `mise` tasks from the root and package `mise.toml` files.
At minimum:

- build the plugin before consumers load it;
- run the plugin type lint manually;
- run every unit test covering exported rule paths;
- exercise all three rules through Oxlint configuration at the consumer boundary;
- prove the readonly-to-mutable propagation control still reports under the unresolved-effect rule;
- run the affected shared configuration tests after the final config edit;
- run Markdown lint for changed documentation.

Record exact commands,
results,
and commits here as work lands.
