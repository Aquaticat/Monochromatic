# monochromatic-lint

Rust replacement for the repository's Rust and Markdown/MDX linters.
Implementation is in progress;
the existing tools remain active until consumer verification and cutover.

The first implementation slice is the handwritten merge for ordered JSONC rule settings.
Records merge by decoded key,
arrays concatenate,
and a kind mismatch anywhere in an input group selects the final value.
Inputs are not modified.
This is not a generic JavaScript deepmerge port.

The crate's Rust visibility supports its executable and verification drivers.
There is no supported public linter library interface.

Design:
`doc/planning/unified-linter.md`.
Execution:
`doc/handover/cli-git-rust-implementation.md`.

## Anonymous Rust functions

The new `rust/no-anonymous-functions` rule rejects parsed closure expressions,
including closures assigned to named variables,
nested closures,
and `move`,
`async`,
and `const` closures.
Named functions,
methods,
function pointers,
and async blocks are not closures and remain allowed.

The rule emits no automatic fix:
extracting a closure with captured state can require changing its caller.
The syntax frontend does not expand macros;
closures hidden inside macro token trees are outside this check's current coverage.

Select the rule explicitly in the ordered JSONC configuration:

```jsonc
// monochromatic-lint.config.jsonc
[
  {
    "files": ["**/*.rs"],
    "rules": {
      "rust/no-anonymous-functions": { "severity": "error" }
    }
  }
]
```

The rule implementation and schema entry exist;
the new executable and production cutover remain unfinished.
`mise run //package/linter/monochromatic-lint:test:rust-style` verifies this slice
without claiming that unfinished Markdown adapters have passed.

## Verification

Package tasks cover type checking,
unit tests,
and mount-free container tests.
The remaining CLI,
rule,
processor,
mutation,
and fuzz gates are tracked in the execution document;
their absence is not a completion claim.

## License

LGPL-3.0-or-later.
License texts are in `LICENSES/`.
