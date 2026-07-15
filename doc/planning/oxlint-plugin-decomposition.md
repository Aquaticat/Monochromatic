# Oxlint plugin decomposition

## Purpose

This proposal records a maintainable decomposition for
`packages/oxlint-plugin/no-restricted-syntax/`.
It does not select a new public namespace or authorize an implementation.

## Current shape

The plugin registers 45 rules in `src/index.ts`:
26 substantive code rules and 19 directive-governance rules.
`packages/config/oxlint/src/rule/restriction.ts` configures 43 of them.
`no-disable-max-lines` and `no-disable-no-misused-promises` are registered but not enabled there.

All rule configuration is centralized in `restrictionRules`.
The development config resolves one source plugin entry,
and the built config bundles one plugin sidecar.
A fixture config and integration test exercise the complete namespace together.

The current namespace occurs 529 times across 211 repository files.
393 occurrences remain after excluding paused and deprecated package trees;
76 occur in `doc/`.
A namespace migration therefore changes executable inline suppressions,
directive-governance targets,
fixture expectations,
configuration,
and documentation, not only package imports.

## Ownership constraint

A split should minimize rules in project-invented namespaces and packages.
Use established ecosystem homes when their behavior is equivalent.
Keep custom ownership only for behavior the project must maintain.

No external dependency is selected by this proposal.
`eslint-no-restricted` demonstrates an established way to generate individually configurable
`no-restricted-syntax` rules from selectors,
but any dependency adoption needs a separate technology evaluation.

## Target decomposition

A completed split should expose no more than one project-invented plugin namespace.
Internal catalogs may still organize each published plugin's implementation.

### `no-restricted-syntax`

Keep the established namespace for rules whose primary condition is a bounded AST shape and a diagnostic.
Examples include `no-switch`, `no-for-in`, `no-enum`, `catch-binding`,
`no-rest-params`, and `no-variable-function-expression`.

The package may retain local implementations behind this canonical interface.
It does not require an external dependency.
Selector-only rules are future candidates for replacement by an established selector-rule factory,
but only when its behavior and consumer boundary are verified.

### Built-in and upstream namespaces

Use an existing Oxlint or ESLint namespace directly when an upstream rule has equivalent behavior.
Do not move a local rule merely because its name resembles an upstream rule.

`restrictionRules` records material differences for `unicorn/no-array-callback-reference`,
`unicorn/no-immediate-mutation`, and `node/no-sync`.
Those local rules accept explicit arity wrappers, allow efficient clone-and-mutate cases,
or distinguish Node APIs from unrelated `Sync`-named APIs.
They remain local until an upstream option or contribution provides the same behavior.

`prefer-error-is-error`, `no-hasownproperty`, and `no-trim-left-right` require the same behavior check.

### `aquaticat`

Use `aquaticat` only for irreducibly local policy and verified upstream adaptations.
It is an ownership namespace, not a taxonomy.

Likely local rules include `no-function-root-let`, `no-nullish-union`,
`no-optional-escape`, `no-low-information-symbol-description`,
`no-regex`, and `prefer-describe-function-ref-name`.
The final catalog must document each rule's local rationale or upstream behavior delta.

### Directive governance

Do not create a `lint-directives` package containing 19 nearly identical wrappers.
`src/rule/_ban-disable-factory.ts` shows that the behavior is one rule family with a data catalog.

Replace the wrapper rules with one configurable `aquaticat` directive-governance rule.
Its options should name protected rule IDs and messages.
The target catalog remains local because it governs both project and upstream rules.

## Package seams

The local configuration and fixture suite currently consume one deployment unit.
A package split adds plugin namespaces, sidecar entries, versioning, and dependency edges.
The target decomposition justifies only two published plugins:
`no-restricted-syntax` and the small `aquaticat` residue.

The TypeScript semantic support under
`src/rule/prefer-readonly-parameter-types/` remains an internal subsystem initially.
Extract it only when its dependencies, performance characteristics,
compatibility requirements, or consumers diverge from the `aquaticat` residue.

## Required evidence before a namespace migration

- Classify every current namespace occurrence as active source, paused source, fixture, configuration,
  documentation, or directive-governance target.
- Decide whether the two unconfigured directive rules should remain published but disabled.
- Test a candidate migration in a disposable fixture, including inline suppression,
  unused-disable reporting, and diagnostics.
- Test any candidate upstream replacement against the local rule's current fixtures and project exceptions.
- Do not assume dual namespace registration is safe.
  It may duplicate diagnostics or change directive matching.
- State `aquaticat` ownership and the local rationale for every rule in its README.

## Recommendation

If a split is adopted, retain `no-restricted-syntax` for selector-equivalent restrictions,
use upstream namespaces only after equivalence verification,
and place only the irreducibly local residue under `aquaticat`.
Collapse directive governance to one configurable local rule instead of creating another package.
