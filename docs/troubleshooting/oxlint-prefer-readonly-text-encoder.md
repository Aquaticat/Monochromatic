# `TextEncoder.encode` creates output without changing its receiver

## Symptom

`no-restricted-syntax/prefer-readonly-parameter-types` initially treated
`encoder.encode(text)` as an unresolved method effect.
The call is observational,
but a full `Readonly<TextEncoder>` projection remains dishonest because it also retains mutating `encodeInto`.

## Root cause

TypeScript 7 declares `TextEncoder.encode(input?: string): Uint8Array<ArrayBuffer>` in the platform-specific
`lib.dom.d.ts` bundled by `@typescript/typescript-<platform>@7.0.2`.
The declaration alone does not describe receiver effects,
so the semantic rule correctly failed closed until the exact platform method was audited.

The [WHATWG Encoding Standard][encoding-standard] commit
`a985b62a9b45c17da3e17a9f0a0b4e30c34c4a8a` specifies that `encode`:

- converts primitive string input to a scalar-value queue;
- runs a fresh UTF-8 encoder instance;
- creates and returns a new `Uint8Array`;
- does not update an associated state slot on the `TextEncoder` receiver.

This differs from `encodeInto(source, destination)`,
which writes into caller-supplied `destination` and therefore cannot share an empty-target catalogue entry.

## Verified resolution

`packages/oxlint-plugins/no-restricted-syntax/src/rules/prefer-readonly-parameter-types/intrinsic-effect-catalog.ts`
now records exact DOM provenance:

- Owner:
  `TextEncoder`.
- Member:
  `encode`.
- Mutation targets:
  none.
- Evidence:
  WHATWG Encoding Standard commit `a985b62a`.

Semantic tests resolve the actual TypeScript 7 declaration to that owner and member.
Effect-summary coverage proves exact `TextEncoder.encode` plus primitive text produces no caller-observable mutation.
Classifier coverage separately proves a full `Readonly<TextEncoder>` remains dishonest while
`Pick<TextEncoder, 'encode'>` is honest.
Same-named methods on other owners do not inherit this treatment.

## Authoring guidance

Use `Pick<TextEncoder, 'encode'>` when a function only needs fresh byte arrays.
Do not use `Readonly<TextEncoder>` as a shortcut because it retains `encodeInto`.
Do not catalogue `TextEncoder.encodeInto` as observational:
its destination argument is deliberately mutated and needs an exact argument-target effect.

[encoding-standard]: https://encoding.spec.whatwg.org/#dom-textencoder-encode
