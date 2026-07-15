# Node writeFile keeps data effects opaque across VFS and native boundaries

## Symptom

`prefer-readonly-parameter-type/prefer-readonly-parameter-types` reported opaque effects when private Git policy
storage passed `Uint8Array` values to `node:fs/promises` `writeFile` and `FileHandle.writeFile`.

The JavaScript implementation does not visibly assign into the supplied bytes.
That observation is insufficient to classify the calls as observational.

## Source audit

The audit used `Node.js` `v26.5.0` embedded module `internal/fs/promises`.
The embedded source digest is
`783a0f44a0689f4d4773f7202e3d0425defe9fe8b900ee125174ceba7fbb0bdf`.

The public `writeFile(path, data, options)` implementation first checks the configured VFS handler.
When present,
it calls `h.writeFile(path, data, options)` with the original values.
That dynamically installed handler is an opaque capability.

The default path calls `writeFileHandle`.
For custom iterables,
that function invokes asynchronous iteration and consumes each yielded value.
For an `ArrayBufferView`,
it creates successive `Uint8Array` views over the same buffer and passes them through the internal `write` boundary.
The JavaScript loop changes only local view variables,
but the native write implementation receives caller-owned storage.

`FileHandle.writeFile(data, options)` delegates through `fsCall` to the same `writeFile` implementation with the
handle as its path argument.
The handle receiver has its own reference lifecycle,
and data still crosses the VFS or native boundary.

## Resolution

The calls remain fail-closed.
Boundary contracts name `writeFile` or `handle.writeFile` and the exact byte provenance exposed to the boundary.
Generated snapshot callbacks and their enclosing preparation functions propagate the same uncertainty rather than
promoting native access to proven mutation.

This does not claim that Node normally changes the supplied bytes.
It records that shipped JavaScript alone cannot prove absence of caller-observable effects for every supported VFS,
iterable,
and native path.

## Verification

The Git policy CLI Oxlint task checks every propagated boundary contract.
Omitting a callback or enclosing contract restores a documented-uncertainty diagnostic naming `handle.writeFile`.

## Upstream filing decision

No upstream issue was filed.
Node's behavior and supported extension points are intentional.
The fail-closed effect requirement belongs to this repository's semantic policy.

## Sources

- [Node `fs/promises` implementation][node-fs-promises]
- [Node `fs/promises` API][node-fs-api]

[node-fs-promises]: https://github.com/nodejs/node/blob/v26.5.0/lib/internal/fs/promises.js
[node-fs-api]: https://nodejs.org/docs/latest-v26.x/api/fs.html#fspromiseswritefilefile-data-options
