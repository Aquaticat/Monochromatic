# @monochromatic-dev/module-css-edit.conformance

Curated CSS conformance corpus for
[`@monochromatic-dev/module-css-edit`](../css-edit/README.md),
category-modeled on the
[css-parsing-tests](https://github.com/tabatkins/css-parsing-tests) suite:
stylesheet structure, at-rules, declarations, nesting,
strings and escapes, and strict error boundaries.

Non-runtime sidecar, mirroring `jsonc-edit.conformance`.
The corpus is curated in-repo rather than imported wholesale because
css-edit is deliberately stricter than the spec's error-recovery behavior
(malformed input throws instead of producing recovery nodes),
so the suite's invalid-input expectations differ by design.

Valid cases must parse and round-trip byte-exactly with expected top-level
node kinds; invalid cases must throw `CssParseError` with a stable message
fragment.

## Running

```bash
mise run //package/module/css-edit.conformance:test:unit
```
