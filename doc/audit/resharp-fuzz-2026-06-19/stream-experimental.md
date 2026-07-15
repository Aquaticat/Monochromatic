# stream feature: phantom zero-width matches (known, by design)

The self-consistency lane's C5 check (stream non-empty iff find_all non-empty,
 and
the documented zero-width coincidence) reports violations only in the `stream`
API.
 These are the 06-11 bug-03 family,
 and they are by design at 0.6.13:
 upstream
gated `stream` behind an off-by-default Cargo feature and documents it as not for
production.

## Evidence

```text
/(?=[a\n]\z)/  (ascii)
  "a"  : stream=[]  find_all=[(0,0)]
  "aa" : stream=[]  find_all=[(1,1)]
  ...  stream misses the zero-width matches find_all reports
```

C5 violations appear whenever a generated pattern has zero-width matches that the
`stream` (leftmost-shortest) driver enumerates differently from `find_all`.
 The
production APIs (`find_all`,
 `is_match`,
 `find_anchored`) are not involved in C5.

## Why this is by design, not a new finding

- `resharp-engine/Cargo.toml` gates the feature and warns inline:
   "experimental,
  off by default:
   zero-width / anchored patterns can report phantom matches.
   do
  not enable in production.
  " (One caveat:
   the inline comment and `doc/api.md`
  both point to a `TODO.md` that does not exist in the repo or its history;
   the
  pointer is dangling,
   but the warning itself stands.
  )
- `doc/api.md` repeats:
   "Experimental,
   off by default ... Zero-width and anchored
  patterns can report phantom matches ... Not recommended for production.
  "
- The maintainer's stated position (issue #21,
   #22):
   "i decided to pull stream
  feature entirely for now and later support it with a restricted feature set";
  "currently it's hard to reason about how the matches relate to is_match or
  find_all".
   The implementation gates it experimental rather than removing it.
- A regression test `resharp-engine/tests/stream.rs` (`repro_bug03_stream_*`)
  tracks the phantom-match issue,
   so it is known and pinned upstream.

## Adjudication

Catalogued as KNOWN-EXPERIMENTAL.
 Not counted among the campaign's findings and
not a production-API soundness issue,
 because the feature is off by default and
documented as unsafe to enable.
 A consumer must opt in via the `stream` Cargo
feature to be exposed;
 none of this workspace's consumers do.
