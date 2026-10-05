# monochromatic-lint-fuzz

Coverage-guided checks for the unified linter's native boundaries.
Targets cover JSONC configuration validation,
ordered merging,
the Rust anonymous-function rule,
semantic explicit-type checking,
and the implemented Markdown/MDX rules.

The merge target reuses the repository's structured JSONC generator.
The configuration target combines raw syntax mutation with always-valid generated rule settings.
The Rust-style target combines arbitrary valid UTF-8 with bounded generated Rust syntax
whose closure count is known independently of the rule.
Its controls distinguish move/async/nested closures from named callbacks,
pipe operators,
strings,
and async blocks.
The semantic target initializes a fixed in-memory Rust crate,
submits generated/raw source only through the production session's source-overlay API,
and checks independent violation counts plus restoration after changed input.
Arbitrary bytes never enter the fixture metadata interpreter.
The Markdown target runs independently counted source fragments with LF,
CRLF,
and bare CR in both Markdown and MDX modes,
then checks arbitrary UTF-8.
It checks original-byte diagnostic/edit boundaries and reparses accepted fixed output.
The counted catalog now includes pipe-table conversion and semantic prose breaks.
Container campaigns run both generator controls and sidecar Clippy before instrumented compilation.
The existing nonempty-to-empty rewrite refusal remains an explicit allowed error.
The raw parser path may reject malformed input with a typed processing failure.
Fuzz-only process deadlines do not add a production parser timeout.

Generator unit tests verify that successful validation,
merging,
and real closure checks are actually reached.

The `fuzz_target!` input looks like a closure signature but is macro input grammar.
In libfuzzer-sys 0.4.13,
`src/lib.rs:247-295` expands the byte-input form into the named `__libfuzzer_sys_run` function.

Run campaigns through the bounded container tasks.
Retain and replay minimized failures.
A clean initial campaign does not cover the unfinished parsers,
processors,
file walker,
or cli-git transaction implementation.
