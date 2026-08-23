# module-array-at

Private pending publication clearance.

Throwing array accessor with exact tuple return types,
 negative indices,
 safe-integer proofs,
 and structured diagnostics.

## Publication gate

This package is intentionally configured with `"private": true`.
Do not remove that field or publish the package until the repository owner explicitly clears publication.
The remaining package metadata is prepared for a future public release.

## Intended interface

The package will export:

- `arrayAt`
- `ArrayAtError`
- `ArrayAtDiagnostic`
- `ArrayAtDiagnostics<A, I>`
- `SafeInteger`
- `isSafeInteger`
- `assertSafeInteger`
- `asSafeInteger`

## Intended behavior

`arrayAt` accepts a correlated `{ array, index }` record.
For fixed tuples and literal indices,
 TypeScript resolves the exact element type.
Negative indices count backward from the array end.
A plain `number` index must first pass through one of the safe-integer proof helpers.

At runtime,
 the accessor returns an assigned in-range element or throws one `ArrayAtError`.
Its `diagnostics` array contains every independently actionable diagnostic detected for the call.
Diagnostic order is not part of the interface.

## Publication readiness

Before publication clearance,
 verify the built artifact from an external consumer and review the final README,
 export map,
 package contents,
 and license metadata.
