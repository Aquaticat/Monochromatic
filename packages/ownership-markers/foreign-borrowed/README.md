# `@monochromatic-dev/ownership-marker-foreign-borrowed`

Zero-runtime TypeScript ownership marker used by semantic readonly analysis.

```typescript
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

function inspectNode(node: ESTree.Node,): void {
  void node.type;
}

export function acceptForeignAst(
  root: ForeignBorrowed<ESTree.Node>,
): void {
  inspectNode(root,);
}
```

`ForeignBorrowed<T>` records that a mutable value's ownership and type are dictated by a foreign interface.
It does not claim immutability and does not waive mutation analysis.
Direct or transitive caller-observable mutation still requires an accurate `@mutates` contract.

Place the marker only where foreign ownership enters or is deliberately retained.
Do not repeat it on aliases,
properties,
elements,
destructured values,
callback parameters,
iteration bindings,
or every internal helper.
The semantic rule propagates guaranteed provenance through those paths.
A helper parameter inherits foreign provenance only when every owned inbound call supplies wholly foreign mutable state.

Workspace consumers import the package's `/ts` subpath so cross-package resolution targets TypeScript source.
A 2026-07-13 audit corrected 74 package-root imports;
active TypeScript source now has 179 `/ts` imports and no root import for this marker.

The package contains one type declaration,
no runtime code,
and no runtime dependencies.

See
the [foreign-provenance guide](../../../docs/troubleshooting/oxlint-prefer-readonly-foreign-provenance.md)
for the analyzer model,
negative mixed-origin case,
and migration verification.
