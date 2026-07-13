# `@monochromatic-dev/ownership-marker-foreign-borrowed`

Zero-runtime TypeScript ownership marker used by semantic readonly analysis.

```typescript
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

function inspect(node: ForeignBorrowed<ESTree.Node>,): void {
  void node.type;
}
```

`ForeignBorrowed<T>` records that a mutable value's ownership and type are dictated by a foreign interface.
It does not claim immutability and does not waive mutation analysis.
Direct or transitive caller-observable mutation still requires an accurate `@mutates` contract.

The package contains one type declaration,
no runtime code,
and no runtime dependencies.
