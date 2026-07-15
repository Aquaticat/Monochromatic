# Lezer SyntaxNode child navigation is observational

## Symptom

`prefer-readonly-parameter-type/prefer-readonly-parameter-types` reported opaque receiver effects for
`SyntaxNode.getChild` and `SyntaxNode.getChildren` in file-enforcer XML transforms.

Type declarations establish the receiver and result types,
but do not prove whether navigation changes tree state.

## Source audit

The audit used `@lezer/common` `1.5.2` at commit
`de5f96276a2954c249de1475e8b03f79c20d9ce4`.

Audited identities:

- `src/tree.ts`,
  digest `640581681d557a446609e2c8e40fd19d2ce3f0ff9ccb99ca743db1a344934d77`;
- shipped `dist/index.js`,
  digest `dab441db7948aae93b8a210d30a0481125bcb8943b129a8c5ebec1354a029e8d`.

Both public methods delegate to the private `getChildren` function.
That function allocates a cursor and result array,
advances only the local cursor,
and pushes matching node views into the local result.
It does not assign to the receiver tree or supplied primitive selectors.

Returned nodes still refer to the receiver's immutable tree storage.
The effect entry therefore preserves receiver provenance through both the single-node and array results.

## Resolution

The exact package-major catalog records empty mutation targets for `SyntaxNode.getChild` and
`SyntaxNode.getChildren`,
plus conservative receiver-to-result provenance.
Unknown Lezer versions and other navigation methods remain fail-closed.

## Verification

A focused semantic test resolves `element.getChild` from file-enforcer source to the exact `@lezer/common`
declaration owner and verifies the observational targets and result provenance.
File-enforcer Oxlint then accepts the XML navigation callbacks without contracts that would falsely claim tree
mutation.

## Upstream filing decision

No upstream issue was filed.
Lezer already implements immutable tree navigation.
The missing effect evidence belonged in this repository's semantic catalog.

## Sources

- [Lezer `SyntaxNode` source][lezer-tree]

[lezer-tree]: https://github.com/lezer-parser/common/blob/de5f96276a2954c249de1475e8b03f79c20d9ce4/src/tree.ts
