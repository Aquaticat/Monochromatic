# `@monochromatic-dev/oxlint-plugin-prefer-readonly-parameter-type`

Oxlint JavaScript plugin containing the project-owned
`prefer-readonly-parameter-type/prefer-readonly-parameter-types` semantic rule.

## Contract

The rule combines TypeScript 7 semantic types with whole-project mutation summaries:

- nonmutating structural data requires an honest deep-readonly type;
- proven caller-observable effects permit mutable parameter types and make `@mutates` optional;
- traversal of statically plain data
  (primitives including branded intersections,
  literals,
  and arrays,
  tuples,
  records,
  object types,
  and unions composed only of those)
  is not a caller-observable effect;
  a runtime `Proxy` or getter-backed object satisfying a plain type is out of
  model by design because static analysis cannot observe it;
- workspace package calls resolve through symlinked repository source and are
  analyzed live;
  workspace packages never appear in the audited catalog;
- unresolved possible effects require complete repeatable `@mutates` contracts
  at the boundary function that contains them;
  callers inherit the documented effect without re-documenting it,
  exactly as an audited catalog entry would behave;
- locked package calls resolve lazily through package exports to shipped JavaScript or TypeScript implementations;
- exact native platform effects use audited owner,
  member,
  declaration provenance,
  and evidence;
- package catalog entries declare an audit tier:
  `shipped-content` entries pin an audited version whose
  `shipped <path> sha256 <hex>` claims are machine-validated against
  installed content so version bumps force a loud re-audit,
  while `api-contract` entries pin compatibility through the provenance
  major alone so routine dependency bumps stay quiet;
  a package entry with no declared tier fails evidence validation;
- unresolved calls fail closed with diagnostics naming affected inputs,
  calls with bracketed origin locations,
  uncertainty,
  every valid remediation,
  and an echo of every parsed `@mutates` block including names matching no
  input;
- a parsed contract that leaves calls unnamed additionally gets a coverage
  note listing exactly those calls and stating the literal matching rule
  (explanation contains the call name, or a documentation URL plus the final
  member name);
- inert `ForeignBorrowed` markers over deeply readonly types and stale
  `@mutates` contracts are reported for removal;
- ordinary `--fix` does not alter signatures or contracts;
- semantic rewrites remain suggestion-only;
- inline suppression is prohibited by the companion no-restricted-syntax rule.

CLI diagnostics are authoritative because Oxlint's language server does not execute JavaScript plugins.
Semantic-plugin state is process-local because Oxlint serializes JavaScript-plugin callbacks on its main JavaScript thread.
Package lint and fix tasks leave Rust worker count at Oxlint's default so native work remains parallel.
Repository-wide package fanout pins each child to one worker to avoid cross-package oversubscription.
Process-local final-index reuse assumes Oxlint's input snapshot stays stable for one bridge lifecycle.
`closeSemanticBridge()` clears every process cache;
persistent cache entries use complete content fingerprints across later Oxlint processes.

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
the [foreign-provenance guide](../../../doc/troubleshooting/oxlint-prefer-readonly-foreign-provenance.md).

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
- include repository-owned implementation in the nearest TypeScript project
  (workspace dependency source resolves automatically through `/ts` subpaths);
- expose an inspectable locked package implementation or audit an exact
  external native callable with tested evidence;
- document every actual possible effect with `@mutates` at the boundary
  function containing the call.

Never add `@mutates` for effects known to be absent.
Move work to an ownership-known site,
pass a primitive result,
or improve semantic proof instead.

## Global `String`

Exact global `String(value)` accepts primitive unions,
`symbol`,
branded primitives,
and statically plain structured data whose traversal is hook-free.
Object-capable values may dispatch getters,
proxy traps,
`Symbol.toPrimitive`,
`toString`,
or `valueOf`.
Deliberate object coercion is accepted through a complete contract naming those effects.

## Host intrinsic evidence

TypeScript library declarations establish host callable identity,
not behavior.
ECMAScript and browser-host entries therefore require exact standard commits,
authoring-source digests,
and algorithm identities.
Node entries additionally require exact installed declaration major,
runtime version,
embedded JavaScript module,
source digest,
and callable-definition marker.
Unavailable private source access,
version drift,
digest drift,
native-only implementations,
and unlisted APIs remain uncertain.
See the
[host intrinsic evidence troubleshooting guide](../../../doc/troubleshooting/oxlint-prefer-readonly-host-intrinsic-evidence.md).

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
