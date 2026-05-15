# tsgolint `no-unnecessary-type-assertion` false positive on generic-function calls whose type parameter appears in a union with `null`/`undefined`

oxlint 1.55.0 + oxlint-tsgolint 0.16.0 (typescript-go commit
`4a59cd78390d`).

## Symptom

tsgolint (the type-aware backend behind oxlint
`--type-aware`) flags `as T` assertions as unnecessary when
the asserted expression is a call to a generic function whose
parameter type includes a union with `null` or `undefined`
(e.g. `<T>(value: T | null | undefined): T`).

The diagnostic claims "This expression already has the type
'X'" where X is the asserted type, even though removing the
assertion changes the inferred type.

Minimal observation:

```ts
// notNullishOrThrow.ts
export function notNullishOrThrow<T,>(value: T | null | undefined,): T {
  if (value === null || value === undefined)
    throw new Error('nullish',);
  return value;
}

// repro.ts
import { notNullishOrThrow, } from './notNullishOrThrow.ts';

// oxlint reports: "This assertion is unnecessary since it does not change the type of the expression."
// oxlint claims: "This expression already has the type 'HTMLFormElement'"
// Actual type without assertion: Element
const form = notNullishOrThrow(
  document.querySelector('.myForm',),
) as HTMLFormElement;
```

Removing `as HTMLFormElement` changes the inferred type to
`Element`, causing TS2339 errors on `HTMLFormElement`-specific
properties (`.action`, `.method`, `.elements`).

## Root cause

The bug is in tsgolint's `no-unnecessary-type-assertion` rule
interacting with typescript-go's contextual typing for
`AsExpression` nodes.

### Call path

1. The rule calls `getUncastType(node)` to get the
   expression's type **without** the assertion.
2. `getUncastType` calls
   `ctx.TypeChecker.GetTypeAtLocation(expression)` on the
   inner call expression.
3. `GetTypeAtLocation` -> `getTypeOfNode` ->
   `getRegularTypeOfExpression` -> `getTypeOfExpression` ->
   `checkExpressionEx`.
4. `checkExpressionEx` -> `checkCallExpression` ->
   `getResolvedSignature`, which resolves generic type
   parameters.
5. During resolution, TypeScript calls `getContextualType` on
   the call expression.
6. `getContextualType` for the child of an `AsExpression`
   returns the **asserted type**
   (`internal/checker/checker.go:28318-28322`):

   ```go
   case ast.KindTypeAssertionExpression, ast.KindAsExpression:
       return c.getTypeFromTypeNode(parent.Type())
   ```

7. This contextual type (`HTMLFormElement`) feeds into
   generic inference for `T`.
8. With parameter type `T | null | undefined` and argument
   `Element | null`, the contextual return type
   `HTMLFormElement` causes `T` to resolve as `HTMLFormElement`
   instead of `Element`.
9. The resolved signature is cached
   (`signatureLinks.resolvedSignature`,
   `internal/checker/checker.go:8162-8164`), so subsequent
   queries return the same `HTMLFormElement` result.
10. The rule sees `uncastType == castType` and flags the
    assertion as unnecessary.

### Why this is a paradox

The assertion provides the contextual type that changes the
expression's inferred type to match the asserted type.
Removing the assertion removes the contextual type, causing
the expression's type to revert. The assertion makes itself
appear unnecessary.

### Why it only triggers with union parameter types

- `wrap<T>(value: T): T` with arg `Element`: argument
  inference strongly fixes `T = Element`. Contextual
  `HTMLFormElement` cannot override it.
  `as HTMLFormElement` is correctly **not** flagged.
- `stripNull<T>(value: T | null): T` with arg `Element |
  null`: the union in the parameter type allows contextual
  typing to have more influence during inference.
  `as HTMLFormElement` **is** incorrectly flagged.

### Source locations

- **tsgolint rule**:
  `internal/rules/no_unnecessary_type_assertion/no_unnecessary_type_assertion.go`
  - `getUncastType` (line 232-249): uses
    `GetTypeAtLocation`, which includes contextual typing.
  - The IIFE special case (line 235-246) already works around
    a similar issue by using `getResolvedSignature` +
    `GetReturnTypeOfSignature` instead.
- **typescript-go contextual type**:
  `internal/checker/checker.go:28318-28322`: returns the
  asserted type as contextual type for children of
  `AsExpression`.
- **typescript-go signature caching**:
  `internal/checker/checker.go:8162-8164`:
  `getResolvedSignature` caches the resolved signature,
  preserving the contextually-influenced inference.

## Verification

Version under test:

- oxlint 1.55.0
- oxlint-tsgolint 0.16.0
- typescript-go commit `4a59cd78390d`

Reproduce with the snippet above against the workspace's
oxlint configuration. The diagnostic surfaces only when the
generic parameter is unioned with `null`/`undefined` and the
argument types resolve such that the contextual type
overrides the inferred type parameter.

## Verified workaround

Use the generic type parameter on `querySelector` instead of
a post-hoc `as` assertion:

```ts
// Instead of:
const form = notNullishOrThrow(
  document.querySelector('.myForm',),
) as HTMLFormElement;

// Use:
const form = notNullishOrThrow(
  document.querySelector<HTMLFormElement>('.myForm',),
);
```

`querySelector<HTMLFormElement>` returns `HTMLFormElement |
null`, which makes `notNullishOrThrow` infer `T =
HTMLFormElement` and return `HTMLFormElement`. No assertion
is needed, so both tsgo and oxlint are satisfied.

Tradeoff: requires the wrapped helper to accept the generic
hint. For helpers like `notNullishOrThrow` this is already the
shape; for less-generic helpers this approach does not apply
and the assertion must remain (with an
`oxlint-disable-next-line` annotation explaining why).

## What does not work

- Removing the assertion: changes the type to `Element`
  (the actual inferred type), breaking downstream code that
  relies on `HTMLFormElement` methods.
- Adding `oxlint-disable-next-line` without explanation: the
  workspace requires justification on lint disables; the
  justification "tsgolint false positive on generic + nullable
  union" is acceptable.
- Trying to coerce inference via `<T = HTMLFormElement>`:
  TypeScript still uses the contextual type from the
  assertion; the explicit default does not bypass the
  contextual inference.

## Why we would file this upstream

All 5 constraints hold:

1. **Is it really upstream's fault?** Yes; `getUncastType`'s
   use of `GetTypeAtLocation` is the defect.
2. **Can upstream fix it?** Yes; three approaches sketched
   below.
3. **Are they supporting this use case?** Yes; the rule is
   shipped and the case is in scope.
4. **Will they likely fix it?** Plausible; the IIFE workaround
   already exists for a related issue.
5. **Have we prototyped a minimal fix?** Architectural sketch
   below; no PR yet.

Decision: worth filing.

### Suggested fix for tsgolint

The `getUncastType` function should compute the expression's
type **without** contextual typing from the parent
`AsExpression`. Possible approaches:

1. **Extend the IIFE pattern to all generic calls**: use
   `getResolvedSignature` + `GetReturnTypeOfSignature` for any
   call expression, not just IIFEs. Avoids `GetTypeAtLocation`
   entirely for calls.
2. **Check for generic function calls**: if the callee has
   generic type parameters, skip the rule (the same approach
   typescript-eslint acknowledged in
   [typescript-eslint#528](https://github.com/typescript-eslint/typescript-eslint/issues/528)).
3. **Strip contextual type**: temporarily remove the
   `AsExpression` parent before calling `GetTypeAtLocation`,
   or use a checker API that excludes contextual typing.

## Draft upstream issue (kept as reference; revise before filing)

````md
**Title**: `no-unnecessary-type-assertion` false positive on generic function calls with nullable parameter types

**Labels**: bug, rule:no-unnecessary-type-assertion

**Description**:

`no-unnecessary-type-assertion` incorrectly flags `as` assertions on calls to generic functions whose generic parameter appears in a union with `null` or `undefined` in the function signature.

**Reproduction**:

```ts
function notNullishOrThrow<T,>(value: T | null | undefined,): T {
  if (value === null || value === undefined)
    throw new Error('nullish',);
  return value;
}

// Flagged: "This assertion is unnecessary since it does not change the type of the expression."
// Claims: "This expression already has the type 'HTMLFormElement'"
const form = notNullishOrThrow(
  document.querySelector('.myForm',),
) as HTMLFormElement;
```

**Expected**: no warning. Without the assertion, the expression type is `Element` (inferred from `querySelector`).

**Actual**: warns that the assertion is unnecessary and claims the expression already has type `HTMLFormElement`.

**Root cause**: `getUncastType` calls `GetTypeAtLocation(expression)`, which triggers `checkExpressionEx`. The contextual type for the child of an `AsExpression` is the asserted type itself (`internal/checker/checker.go:28318-28322`). This contextual type feeds into generic inference and changes the inferred type parameter, making `uncastType` equal to `castType`. The assertion provides the contextual type that makes itself appear unnecessary.

This is the same fundamental issue as
[typescript-eslint/typescript-eslint#528](https://github.com/typescript-eslint/typescript-eslint/issues/528).

**Suggested fix**: extend the IIFE pattern at `internal/rules/no_unnecessary_type_assertion/no_unnecessary_type_assertion.go:235-246` to all generic call expressions, or skip generic function calls entirely (per typescript-eslint's acknowledged limitation).

**Environment**: oxlint 1.55.0, tsgolint 0.16.0, typescript-go `4a59cd78390d`
````
