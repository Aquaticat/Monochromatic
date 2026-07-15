# forbidden-regex-bench

Throughput benchmark comparing `forbidden-regex` against the `regex` crate.

This is a sidecar of `package/rust-module/forbidden-regex`,
 kept out of that
crate's build and test graph so the comparison dependency (`regex`) never enters
the published engine.
 `resharp` is deliberately excluded:
 its serialized matcher is
too slow to be a useful baseline,
 so that comparison is deferred.

## What it measures

Both engines compile the same secret-detection pattern set (chosen from the dialect
overlap,
 so no intersection or complement).
 `forbidden-regex` is serialized and
reloaded first,
 so the timed form is the one a caller would load from disk.
 The
benchmark then verifies both engines agree on how many corpus lines match,
 and times
`is_match` over a mostly-non-matching,
 code-like corpus (the secret scanner's common
case:
 scan a whole line,
 find nothing).

The thesis:
 even though `regex` is handicapped out of `&`/`~`,
 the restricted
dialect lets `forbidden-regex` win on raw scanning throughput.

## Run

```sh
# from the repo root
mise run //package/rust-module/forbidden-regex.bench:run
```

It prints lines/s and MB/s for each engine,
 the speedup ratio,
 and the serialized
ruleset size.
 The corpus and pass counts are fixed in `src/`,
 sized to keep a run to
a few seconds on a modest machine.
