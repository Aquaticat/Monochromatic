# @monochromatic-dev/module-css-edit.fuzz

Property-based fuzz campaign for
[`@monochromatic-dev/module-css-edit`](../css-edit/README.md).

Non-runtime sidecar, mirroring `jsonc-edit.fuzz`:
the runtime package's `src` stays pure production code
while the fuzz generators, properties, and campaign task live here.

## Properties

- **Byte round-trip**:
  every generated structurally-valid document
  (declarations, custom properties, `&` and relaxed nesting,
  statement and block at-rules, adversarial strings, varied trivia)
  parses and stringifies byte-identically.
- **Totality**:
  an arbitrary string either parses (and then must round-trip byte-exactly)
  or throws `CssParseError`; no other failure mode exists.
- **Structural sharing**:
  a keep-everything transform returns the identical root reference.
- **postcss differential oracle**:
  postcss accepts every generated document css-edit accepts,
  and reproduces the same bytes from its own CST.

## Running

```bash
# Cheap default budget (200 runs per property), as part of the unit suite
mise run //package/module/css-edit.fuzz:test:unit

# Longer campaign
mise run //package/module/css-edit.fuzz:fuzz -- --runs 20000
```

Property files import css-edit source through its `/ts` subpath,
so no build step is needed.

A deterministic coverage-reachability gate
(mirroring `jsonc-edit.fuzz`'s `fuzz:coverage`)
is deliberately deferred;
see `doc/handover/css-edit.md`.
