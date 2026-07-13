# Oxlint plugin decomposition

## Purpose

This proposal records a maintainable decomposition for
`packages/oxlint-plugins/no-restricted-syntax/`.
It does not select a new public namespace or authorize an implementation.

## Current shape

The plugin registers 45 rules in `src/index.ts`:
26 substantive code rules and 19 directive-governance rules.
`packages/config/oxlint/src/rules/restriction.ts` configures 43 of them.
`no-disable-max-lines` and `no-disable-no-misused-promises` are registered but not enabled there.

All rule configuration is centralized in `restrictionRules`.
The development config resolves one source plugin entry,
and the built config bundles one plugin sidecar.
A fixture config and integration test exercise the complete namespace together.

The current namespace occurs 529 times across 211 repository files.
393 occurrences remain after excluding paused and deprecated package trees;
76 occur in `docs/`.
A namespace migration therefore changes executable inline suppressions,
directive-governance targets,
fixture expectations,
configuration,
and documentation, not only package imports.

## Proposed internal modules

Keep one published plugin while its interface and release lifecycle remain shared.
Organize its implementation and configuration through these internal modules.

### Syntax restrictions

Rules belong here when a bounded AST shape is the primary reporting condition.
Examples include `no-switch`, `no-for-in`, `no-enum`, `catch-binding`,
`no-rest-params`, and `no-variable-function-expression`.

The module should own a rule catalog and its configuration catalog.
It should not promise that every rule is expressible as an ESLint selector;
small project-specific structural exceptions may remain.

### Project conventions

Rules belong here when reporting needs provenance, call semantics, names,
static string classification, arity reasoning, type modeling, or a project-specific migration.
Examples include `no-sync`, `no-array-callback-reference`,
`no-low-information-symbol-description`, `prefer-error-is-error`,
and `prefer-describe-function-ref-name`.

This is the candidate home for a branded namespace such as `aquaticat`.
The namespace would mean Aquaticat-maintained opinionated rules,
not one technical category.

### Directive governance

Rules belong here when they inspect `oxlint-disable` comments.
The existing 19 rules share `src/rules/_ban-disable-factory.ts`,
but their protected targets include both local and upstream rule IDs.
This makes directive governance cross-cutting rather than a child of syntax restrictions.

Represent protected targets in one declarative catalog,
then derive the rule map from it.
The catalog should remain next to directive governance so target policy has one owner.

## Why not split published packages now

A package split introduces package names,
plugin namespaces,
sidecar entries,
versioning,
and dependency edges at the external seam.
The local configuration and fixture suite currently consume the rules as one deployment unit.
No independent consumer or configuration lifecycle establishes a durable package seam.

Internal catalogs make future extraction cheap while preserving locality today.
A published package should be extracted only when its consumers,
release cadence,
runtime dependencies,
performance characteristics,
or Oxlint compatibility requirements diverge materially.

The TypeScript semantic support under
`src/rules/prefer-readonly-parameter-types/` is the strongest future extraction candidate.
Its dependencies and execution model differ more from lightweight AST rules than directive governance does.

## Required evidence before a namespace migration

- Classify every current namespace occurrence as active source, paused source, fixture, configuration,
  documentation, or directive-governance target.
- Decide whether the two unconfigured directive rules should remain published but disabled.
- Test a candidate migration in a disposable fixture, including inline suppression,
  unused-disable reporting, and diagnostics.
- Do not assume dual namespace registration is safe.
  It may duplicate diagnostics or change directive matching.
- State the branded namespace's scope in its README so future rules do not recreate this naming ambiguity.

## Recommendation

First introduce the three internal rule and configuration catalogs,
without changing the package or plugin namespace.
Use the resulting change history to measure whether any catalog gains an independent seam.
Defer package extraction and namespace migration until that evidence exists.
