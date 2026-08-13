# Turso `Database.exec` mutates database and lock state

## Symptom

Done and Done PostCSS each received opaque-effect diagnostics for
`database.exec(...)` inside migration helpers.
The resolved declaration owner was `Database` from
`@tursodatabase/database-common` major `0`,
not the public subclass from `@tursodatabase/database`.

## Source audit

The installed packages were `@tursodatabase/database@0.6.1`
and `@tursodatabase/database-common@0.6.1`.
The audit used Turso tag `v0.6.1`,
commit `76af5a1250cd98bb26c13862093a638714b0a3a6`.

Audited sources:

- [`bindings/javascript/packages/common/promise.ts`][turso-promise],
  digest `e3f721edd511079ad107707a0636481d9444668e454e44b969abcfd9d46f5715`;
- [`bindings/javascript/packages/common/async-lock.ts`][turso-lock],
  digest `1801290f7b9b215ca7ec9cd0147a06fe5a6f8e87cd1863d1786f47f3e093051a`.

`Database.exec` checks connection state,
acquires the receiver's `AsyncLock`,
creates a native executor from SQL and query options,
steps the executor through database I/O,
resets it,
and releases the lock.
SQL statements can change database state controlled by the receiver.
Lock acquisition and release also change JavaScript receiver-reachable state.

The SQL and query-options arguments cross a native boundary.
The catalog therefore keeps their possible conversion or property-access effects explicit,
even though the migration callers pass primitive SQL strings and omit query options.

## Implementation

`turso-package-effect-catalog.ts` records an exact entry for:

```text
@tursodatabase/database-common major 0, Database.exec
```

Its proven effect target is the receiver.
The SQL and optional query-options positions are opaque native-boundary targets,
not proven mutations.
The migration inputs receive a proven receiver effect,
while their primitive SQL constants do not acquire opaque caller-owned effects.
Mutable `Database` parameters are sound without redundant `@mutates` contracts.

The unit test also resolves `database.exec` from Done source through TypeScript
and checks that another package major does not match.

## Upstream filing decision

No upstream report is warranted.
The database and lock mutations are expected behavior for `exec`.
The missing information belonged in this project's audited package-effect catalog.

[turso-promise]: https://github.com/tursodatabase/turso/blob/76af5a1250cd98bb26c13862093a638714b0a3a6/bindings/javascript/packages/common/promise.ts
[turso-lock]: https://github.com/tursodatabase/turso/blob/76af5a1250cd98bb26c13862093a638714b0a3a6/bindings/javascript/packages/common/async-lock.ts
