# Oxlint flags identity helpers and registries that accept policy declarations

## Symptom

Cli-git's side-effect-free authoring helpers preserve caller-owned declarations by identity:

```ts
const options = definePolicyOptions(schema);
const policy = definePolicy(definition);
```

Oxlint's `typescript/prefer-readonly-parameter-types` still reports both parameters after wrapping their surface types
in `Readonly`.
The same diagnostic applies to the policy engine's internal sequencing-test registry because it accepts the same
callback-bearing declarations:

```text
Parameter should be a readonly type.
```

## Root cause

The repository config in
`packages/config/oxlint/src/rules/prefer-readonly-parameter-types.ts`
keeps `treatMethodsAsReadonly` disabled because enabling it would hide actual mutable class,
map,
and set inputs.
It allows selected third-party symbols through
`packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts`.

Valibot 1.4.2 defines `GenericSchema` as an alias of `BaseSchema` in
`node_modules/.pnpm/valibot@1.4.2_typescript@7.0.1-rc/node_modules/valibot/dist/index.d.mts:3141`.
The schema contract includes function members and generic input/output positions whose complete structure is not deeply
readonly.
Cli-git's `PolicyDefinition` in `packages/git-policies/cli/src/api/policy-types.ts` contains that schema plus a policy callback.

The helpers cannot clone or transform these values:
`packages/git-policies/cli/SPEC.md` requires each helper to return the exact input object,
and Valibot consumers need the original schema type for parsing and output inference.
The internal `registeredPolicies` adapter in
`packages/git-policies/cli/src/policy-engine/engine.ts`,
filesystem-failure adapter in
`packages/git-policies/cli/src/policy-engine/commit-transaction-boundary.ts`,
and command-facts adapter in
`packages/git-policies/cli/src/policy-engine/pre-forward-engine.ts` must retain executable callbacks so tests can prove
sequential order,
keep-going behavior,
immediate exception stopping,
and fail-closed transaction setup with deterministic policies.
They read the declarations and never mutate them.

## Verification

`mise run //packages/git-policies/cli:lint:oxlint` reproduced the two warnings against:

- `definePolicyOptions` with `Readonly<GenericSchema<TInput, TOutput>>`;
- `definePolicy` with `Readonly<PolicyDefinition<Readonly<TOptions>, TName>>`.

Adding both `GenericSchema` and its resolved `BaseSchema` symbol to the package allow list did not change either warning.
Commits `9ced4d01e` and `e36b89d73` record that attempted configuration path;
commit `0108b0db2` removes the ineffective global allowance.
This demonstrates that the warning follows nested mutable structure rather than a directly exemptible parameter symbol.

## Verified workaround

Keep the parameter types honest and add a tightly scoped
`typescript/prefer-readonly-parameter-types` disable/enable pair around each affected helper or internal engine
boundary.
Each justification must identify the identity or registry contract,
the callback-bearing policy shape,
and the fact that the function neither mutates nor clones its input.

This is narrower than globally allowing Valibot or enabling `treatMethodsAsReadonly`.
It preserves findings for ordinary mutable parameters everywhere else.

## What does not work

### Wrap the parameter in `Readonly`

`Readonly` changes only surface properties.
It does not rewrite nested schema and callback structures,
so the rule still reports the parameter.

### Add Valibot aliases to the package allow list

Both surface and resolved symbol names were tested.
Neither suppresses the warning emitted for the complete identity-helper parameter.
Keeping those entries would weaken global configuration without fixing this boundary.

### Clone or deeply freeze the declaration

That would violate the helper contract,
change object identity,
and risk changing third-party schema behavior.

### Enable `treatMethodsAsReadonly`

The linter configuration source documents why this hides legitimate mutation through maps,
sets,
and classes.
Changing the repository-wide semantic would be disproportionate to two explicit identity boundaries.

## Local aliases hide allowlisted lib types

`packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-lib.ts`
already allowlists `ReadonlyMap` and `ReadonlySet`,
but the specifier matcher resolves the parameter's declared symbol.
A repo-local alias such as `type IndexRecordMap = ReadonlyMap<string, string>`
is a file-domain symbol,
so the `from: 'lib'` entry no longer matches and the rule reports the parameter again.

Remediation:
spell the lib type directly in parameter positions
(`before: ReadonlyMap<string, string>`).
The allowlist is correct;
the alias indirection is the problem.
Do not reach for a scoped `oxlint-disable`:
`packages/git-policies/cli/src/policy-engine/add-staged-delta.ts` hit this in 2026-07
and the direct spelling removed the warning with no suppression.
Types genuinely outside our control that are still missing from the list
belong in `prefer-readonly-parameter-types.allow-lib.ts`
(or `.allow-pkg.ts` for package types),
not behind per-site disables.

## Upstream filing decision

No upstream issue should be filed.
The rule correctly identifies that these external and callback-bearing structures are not deeply readonly.
The mismatch is local:
cli-git deliberately exposes identity helpers whose non-mutation guarantee is behavioral rather than expressible as a
deep structural TypeScript type.
The scoped suppression communicates that exception without asking Oxlint to weaken its rule.
