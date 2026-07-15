# Keep the hand-written JSONC parser for module-jsonc-edit

## Status

Accepted,
2026-06-30.

## Context

`package/module/jsonc-edit` is the comment-preserving JSONC read, edit, and write
package, split out of the paused `package-paused/module/es` taxonomy and shaped after
its sibling `package/module/toml-edit`.
The goal is full edit parity with `toml-edit`: a free-function edit API over an immutable
state, with a serializer.

The open question was the parser foundation:
keep the hand-written JSONC parser that already lives in `module-es`, or adopt an
off-the-shelf parser the way `toml-edit` wraps `toml-eslint-parser`.
A `/choosing-technology` survey cloned, source-read, built, and functionally tested every
serious candidate.

The hand-written parser exists for reasons no surveyed library satisfies:

- A normalized, queryable comment model:
  every object key and every value carries at most one attached comment, and stacked
  `//` or `//region` lines merge into a single `mixed` comment.
- A hybrid fast-path that runs native `JSON.parse` over clean (comment-free) regions and
  only custom-parses where JSONC features appear.
- Zero runtime dependencies and house-style ownership of a stable syntax module (no regex
  where an index scan expresses the rule, immutable data, `max-lines`, rustdoc-equivalent
  TSDoc), per `doc/decision/stable-syntax-modules.md`.
- It must run in every modern environment, so a WebAssembly core is disqualified.
- Branded input types (`StringJsonc`) are non-optional.

## Decision

Keep the hand-written parser (as a clean rewrite, since the original is in disrepair) and
build the serializer and free-function edit API on top of it.
The write model is canonical rebuild from the structured tree with comments as first-class
data, not byte-identical splice;
this matches the parser's position-discarding design and exceeds `toml-edit` by making
comments queryable and editable rather than merely preserved.

## Consequences

- No source ranges are threaded through the parse, and no splice mode is offered.
  Unedited whitespace is normalized by canonical emit;
  raw scalar tokens and all comments are preserved.
- The fast-path stays an internal read optimization.
  Clean regions are comment-free, so their `PlainJson` form canonical-emits losslessly, and
  the fast-path never leaks into the public API.
- The branded `StringJsonc` type is redefined locally inside `jsonc-edit`, decoupled from
  the abandoned `module-es` taxonomy.
- Performance is a stated goal, so the package ships benchmarks against
  `jsonc-eslint-parser` and `jsonc-parser` to keep the fast-path honest.

## Rejected alternatives

Each library fails at least one reason-for-existence above.
Versions and behaviors below were confirmed by cloning and running each candidate, not from
documentation alone.

- `jsonc-eslint-parser` (ota-meshi, the direct `toml-eslint-parser` sibling):
  positioned AST plus a flat `ast.comments` array, but `traverseNodes` skips comment keys,
  so it never attaches a comment to its node;
  parse-only (no serializer);
  throws on the first syntax error (no recovery);
  pulls in `acorn` and statically imports `node:module` and `node:path`, so a browser bundle
  needs shims.
  Fails the comment model, the fast-path, zero-dep, and run-everywhere.
- `jsonc-parser` (microsoft):
  zero-dep, browser-safe, fault-tolerant, and a strong offset-splice editor
  (`modify` plus `applyEdits`), but comments are trivia with offsets, never attached to
  nodes;
  insert and delete drop neighboring comments (upstream issues 125 and 108);
  there is no value-tree serializer (`getNodeValue` discards comments).
  Cannot model comments as data.
- `comment-json` (kaelzhang):
  the closest match, with queryable per-key and per-value comments via Symbol positions and
  a stringifier, but stacked comments stay unmerged token arrays, duplicate keys silently
  collapse (data loss), and it is CJS-only with an `esprima` dependency.
- `@humanwhocodes/momoa`:
  well-maintained AST and tokenizer, but comments are flat tokens and `print()` discards
  comments and whitespace.
  A parser and pretty-printer, not a comment-preserving editor.
- `jju` (rlidwka):
  a working token-splice editor that preserves comments incidentally, but no queryable
  comment model, JSON5-scoped, CJS-only, and unreleased since 2018.
- `json5` and `@std/jsonc` (Deno std):
  both drop comments on parse.
- `jsonc-morph` (dsherret, Rust compiled to WebAssembly):
  the best byte-faithful round-trip in the field, with comments as CST nodes, but the
  comments are positional rather than attached or merged, it is pre-1.0, and its inlined
  WebAssembly cannot instantiate synchronously on a browser main thread.
  Fails run-everywhere.

## Related

- `doc/handover/jsonc-edit.md`:
  living implementation status.
- `doc/decision/stable-syntax-modules.md`:
  owning long-lived syntax modules in-repo.
- `doc/troubleshooting/toml.md`:
  why JSONC was chosen over TOML for workspace configuration.
- `doc/troubleshooting/c-like-comments.md`:
  the accepted block-comment-nesting limitation.
