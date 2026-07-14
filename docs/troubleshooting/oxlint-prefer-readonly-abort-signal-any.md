# TypeScript 7.0.2 anonymous constructor typing hides `AbortSignal.any` effects from exact Oxlint matching

## Symptom

`prefer-readonly-parameter-type/prefer-readonly-parameter-types` originally reported:

```text
The function inputs named "source" and "options" are used by these calls: AbortSignal.any.

This rule cannot inspect enough of those calls to know what they might change.
```

The semantic query identified the call as DOM provenance with owner `__type` and member `any`.
That identity cannot safely support a catalog entry because TypeScript's DOM declarations contain other anonymous
constructor objects with an `any` member,
including `TaskSignal.any`.

A second problem remains after exact identity recovery:
`AbortSignal.any` changes hidden dependency state on supplied signals.
It is not an observational zero-effect call.

## Root cause

TypeScript commit `168e7015edf98244febc8f4ae450b673b5d195d7` declares the constructor object as an ambient variable
whose type is an inline object literal.
`internal/bundled/libs/lib.dom.d.ts:3408` contains:

```typescript
declare var AbortSignal: {
    prototype: AbortSignal;
    new(): AbortSignal;
```

The `any` member is inside that anonymous type literal at
`internal/bundled/libs/lib.dom.d.ts:3418` to `3422`:

```typescript
/**
 * The **`AbortSignal.any()`** static method takes an iterable of abort signals and returns an AbortSignal.
 */
any(signals: AbortSignal[]): AbortSignal;
```

As a result,
the member's declaring type symbol is `__type` rather than `AbortSignal`.
The exact authored owner is available only by walking to the enclosing ambient variable declaration.

Recovering every enclosing variable name is also wrong.
`@oxlint/plugins` uses package-local `const` declarations such as `FIXER` and `FILE_CONTEXT` to construct anonymous
fixture types.
Changing their owner identity would break existing package catalog matches and couple the catalog to implementation
names.
`packages/oxlint-plugins/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/intrinsic-effect-owner.ts`
therefore recovers only named type aliases and ambient `var` declarations.

The WHATWG DOM Standard commit `5796f716c857f0a563d11d32e0ca6b49232191be` defines
`AbortSignal.any` in `dom.bs:2053` to `2056`:

```html
<p>The static <dfn method for=AbortSignal><code>any(<var>signals</var>)</code></dfn> method
steps are to return the result of <a>creating a dependent abort signal</a> from <var>signals</var>
using {{AbortSignal}} and the <a>current realm</a>.
```

Creating that dependent signal appends the result to each source signal's dependency state.
`dom.bs:2194` to `2198` contains:

```html
<li><p><a for=set>Append</a> <var>signal</var> to <var>resultSignal</var>'s
[=AbortSignal/source signals=].

<li><p><a for=set>Append</a> <var>resultSignal</var> to <var>signal</var>'s
[=AbortSignal/dependent signals=].
```

The stored relationship later propagates abort state.
The rule must therefore target the supplied signal argument.
That proven effect permits a mutable parameter type without requiring `@mutates`;
a present contract must describe the dependency relation accurately.

## Verification

The external sources under test are:

- TypeScript commit `168e7015edf98244febc8f4ae450b673b5d195d7`;
- WHATWG DOM Standard commit `5796f716c857f0a563d11d32e0ca6b49232191be`;
- TypeScript package `7.0.2` through `typescript/unstable/sync`.

Run the focused checks:

```sh
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:build:js:node
mise run //packages/oxlint-plugins/prefer-readonly-parameter-type:test:unit
mise run //packages/cli/git-clone-size:lint:oxlint
```

### Patterns that now work

- Exact `AbortSignal.any` resolves to DOM owner `AbortSignal` and member `any`.
- Exact `TaskSignal.any` cannot match the `AbortSignal` entry merely because both use an anonymous inline type.
- Package-local anonymous `const` fixtures retain owner `__type` and existing package catalog identities.
- `packages/cli/git-clone-size/src/stream.ts` declares the dependency mutation on `options.signal`,
  and its exported `estimate` boundary propagates that optional accurate contract.

### Patterns that fail closed

- An uncatalogued anonymous DOM constructor member remains unresolved.
- `AbortSignal.any` without a matching `@mutates` contract remains valid because exact evidence proves the effect.
- An inaccurate or stale present contract reports when it disagrees with the exact dependency-producing call.

## Verified workarounds

Use exact ambient-owner recovery plus an argument mutation target:

```typescript
{
  provenance: { kind: 'dom' },
  ownerType: 'AbortSignal',
  member: 'any',
  targets: [{ kind: 'argument', index: 0 }],
  evidence: 'DOM commit 5796f716 AbortSignal.any stores dependent-signal relations on supplied signals',
}
```

Optionally document each affected caller boundary:

```typescript
/**
 * @mutates options - `AbortSignal.any` stores a dependent-signal relation on `options.signal` when provided
 */
```

This preserves cancellation semantics and exposes the deferred relationship.
Its tradeoff is maintaining a public effect contract that the rule does not require once the effect is proven.

## What does not work

- Cataloging DOM owner `__type` and member `any` can bless unrelated anonymous constructor methods.
- Recovering every enclosing variable declaration changes package-local anonymous `const` identities.
- Recording no mutation targets hides the source signal's dependent-signal state.
- Claiming `Readonly<AbortSignal>` proves immutability is dishonest because it retains behavioral capabilities.
- Suppressing the diagnostic discards both exact provenance and contract verification.

## Upstream filing artifact

### Upstream filing decision

1. **Is it really upstream's fault?
   ** No.
   TypeScript accurately represents an authored anonymous object type,
   and DOM requires the dependency relation.
2. **Can upstream fix it?
   ** No applicable upstream defect was found.
3. **Are they supporting this use case?
   ** TypeScript supports semantic symbol queries,
   but project-specific effect identity is consumer policy.
4. **Would the repo welcome our contribution?
   ** Not applicable because neither upstream behavior is defective.
5. **Will they likely fix it?
   ** Not applicable because no upstream change is requested.
6. **Have we prototyped a minimal fix compatible with their architecture?
   ** Yes,
   the consumer-side ambient-owner recovery and mutation catalog pass focused tests.

Nothing should be filed upstream.
