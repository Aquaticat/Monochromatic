# Valibot safeParse can execute input property hooks and schema callbacks

## Symptom

`prefer-readonly-parameter-type/prefer-readonly-parameter-types` reported opaque effects when the Git policy engine
passed runtime configuration to Valibot `safeParse`.

The validation schema does not intentionally mutate its input.
That fact alone does not make validation observational for arbitrary JavaScript objects.

## Source audit

The audit used Valibot `1.4.2` at commit
`0dc26ea88cf07a414653375f0da43f97e0eed607`.

Audited identities:

- `library/src/methods/safeParse/safeParse.ts`,
  digest `cd145a6509e77f0f3726051b78f7429d26d74eef3e51d6bf1594f7a98e4167f1`;
- shipped `dist/index.mjs`,
  digest `df5a9ac0c6b7183af2571ab48e22719e4ab5fe331bc7afe04301472607b80a60`.

`safeParse` calls `schema['~run']` with a dataset containing the exact input value.
Schemas are executable capabilities rather than passive descriptors.
Custom schema implementations can run arbitrary caller-owned behavior.

The Git policy engine uses a built-in `looseObject` schema.
Its `~run` implementation still uses `in`,
`for...in`,
and indexed property reads against the supplied object.
Those operations can invoke proxy traps and property getters.
Nested schemas repeat property access for reachable values.
The validator builds a separate output object,
but input hooks can change state while the validator observes them.

## Resolution

The engine keeps `safeParse` fail-closed rather than adding an observational package-catalog entry.
Its boundary contract names `valibot@1.4.2 . safeParse` and documents schema property access,
getter or proxy hooks,
and schema callbacks.

This contract describes possible caller-observable effects without claiming direct mutation of the configuration
object.
Unknown Valibot versions and other schemas retain their own unresolved effects.

## Verification

The Git policy CLI Oxlint task verifies that the contract is complete for the exact inferred package provenance.
Removing the Valibot provenance from the contract restores the opaque-effect diagnostic.

## Upstream filing decision

No upstream issue was filed.
Valibot correctly validates JavaScript objects according to normal property access semantics.
The effect documentation belongs at this repository's trust boundary.

## Sources

- [Valibot `safeParse` source][safe-parse]
- [Valibot `looseObject` source][loose-object]

[safe-parse]: https://github.com/open-circle/valibot/blob/0dc26ea88cf07a414653375f0da43f97e0eed607/library/src/methods/safeParse/safeParse.ts
[loose-object]: https://github.com/open-circle/valibot/blob/0dc26ea88cf07a414653375f0da43f97e0eed607/library/src/schemas/looseObject/looseObject.ts
