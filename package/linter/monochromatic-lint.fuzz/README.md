# monochromatic-lint-fuzz

Coverage-guided checks for the unified linter's native boundaries.
Targets cover JSONC configuration validation,
ordered merging,
and the Rust anonymous-function rule.

The merge target reuses the repository's structured JSONC generator.
The configuration target combines raw syntax mutation with always-valid generated rule settings.
The Rust-style target combines arbitrary valid UTF-8 with bounded generated Rust syntax
whose closure count is known independently of the rule.
Its controls distinguish move/async/nested closures from named callbacks,
pipe operators,
strings,
and async blocks.
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
