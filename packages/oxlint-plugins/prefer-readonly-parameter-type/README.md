# `@monochromatic-dev/config-oxlint-prefer-readonly-parameter-type`

Oxlint JavaScript plugin containing the project-owned
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` semantic rule.

## Contract

The rule combines TypeScript 7 semantic types with whole-project mutation summaries:

- nonmutating structural data requires an honest deep-readonly type;
- proven caller-observable effects permit mutable parameter types and make `@mutates` optional;
- unresolved possible effects require complete repeatable `@mutates` contracts;
- exact platform and package effects are audited by owner,
  member,
  declaration provenance,
  evidence,
  and package major;
- unresolved calls fail closed with diagnostics naming affected inputs,
  calls,
  uncertainty,
  and every valid remediation;
- ordinary `--fix` does not alter signatures or contracts;
- semantic rewrites remain suggestion-only;
- inline suppression is prohibited by the companion no-restricted-syntax rule.

CLI diagnostics are authoritative because Oxlint's language server does not execute JavaScript plugins.
Semantic-plugin lint and fix tasks use one Oxlint worker because TypeScript bridge state is process-local.

## Ownership marker

Externally dictated mutable values use
`ForeignBorrowed<T>` from `@monochromatic-dev/ownership-marker-foreign-borrowed/ts`.
That zero-runtime package contains only the ownership marker.
The marker records foreign ownership without claiming immutability.
Proven direct or transitive effects permit mutable types without requiring `@mutates`;
when a contract is present,
it must remain accurate.
Unresolved effects still require complete contracts.
Place it only where foreign ownership enters or is deliberately retained.
Properties,
elements,
destructured bindings,
callback elements,
synchronous iteration elements,
and owned helper parameters inherit guaranteed provenance through semantic analysis.
A helper parameter is foreign only when every owned inbound call supplies wholly foreign mutable state.
One ordinary owned path restores normal readonly enforcement.

See
the [foreign-provenance guide](../../../docs/troubleshooting/oxlint-prefer-readonly-foreign-provenance.md).

## Callback invocation

Invoking a caller-provided callback is an affected capability.
Proven invocation permits a mutable capability without requiring a contract;
unknown or unresolved invocation requires complete `@mutates` documentation.
Invocation alone does not prove mutation of the function object or every captured value.
The rule tracks invoked capability separately from referent mutation,
so pure and throwing owned callbacks do not make captured readonly values dishonest.
Unknown and external callbacks remain fail-closed.

## Unknown calls

Unknown calls list every supported remediation:

- remove or rewrite the call;
- include repository-owned implementation in the nearest TypeScript project;
- audit exact external callable and add a tested catalogue entry;
- document every actual possible effect with `@mutates`.

Never add `@mutates` for effects known to be absent.
Move work to an ownership-known site,
pass a primitive result,
or improve semantic proof instead.

## Global `String`

Exact global `String(value)` accepts primitive unions,
`symbol`,
and branded primitives.
Object-capable values may dispatch getters,
proxy traps,
`Symbol.toPrimitive`,
`toString`,
or `valueOf`.
Deliberate object coercion is accepted through a complete contract naming those effects.

## Verification

Package acceptance includes:

- TypeScript type lint and Oxlint;
- readonly classification,
  intrinsic provenance,
  effect propagation,
  diagnostic,
  suggestion,
  bridge lifecycle,
  and cache tests;
- declaration preservation through bundled output;
- staged publication and installation outside monorepo dependency ancestry;
- Linux,
  macOS,
  and Windows host bridge workflows.
