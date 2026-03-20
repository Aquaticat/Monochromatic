# editord design philosophy

## Scope and constraints

editord is a local-only editor daemon.
It serves a single user on `localhost` over WebSocket.

### Deliberate non-goals

Certain scenarios are considered **user error** and are not optimized for:

- **Directories with 1000+ entries** -- the file tree renders every entry into the DOM
  without virtualization. Flat directories at that scale indicate
  a missing `.gitignore` or an unconventional project layout.
- **Multiple projects in one tab** -- editord serves one project root per instance.
  Opening unrelated project trees in the same session is unsupported.
- **Text files over 1 MB** -- `contenteditable` with CSS counter line numbers
  degrades on very large files. Generated output, minified bundles,
  and binary-disguised-as-text fall outside the intended use case.

### Localhost assumptions

Because editord runs locally, certain optimizations that matter
for networked editors are unnecessary:

- **Full-file saves are acceptable** -- Ctrl+S sends the entire file over WebSocket.
  On loopback, even large files transfer in under a millisecond.
  Incremental diffing or operational transforms add complexity
  without meaningful latency improvement.
- **DOM rebuild on expand is fine** -- `replaceChildren` replacing a subtree
  on directory expand is a single synchronous paint.
  Layout thrashing is a non-issue at local directory sizes.
- **Prefetch cache needs no eviction** -- each cache entry is a small array
  of `{ name, isDirectory }` objects. Even with hundreds of directories
  preloaded, total memory is negligible.

### Path containment

All filesystem operations (`openFile`, `saveFile`, `listDir`) validate
that the resolved path falls within the server's root directory.
The root is the highest writable ancestor of the working directory,
determined at startup by `resolveRoot`.
Even with a valid auth token, a client cannot read or write outside this boundary.
