# monochromatic-lint-fuzz

Coverage-guided checks for the unified linter's native boundaries.
The initial targets cover JSONC configuration validation and ordered merging.

The merge target reuses the repository's structured JSONC generator.
The configuration target combines raw syntax mutation with always-valid generated rule settings.
Generator unit tests verify that successful validation and merging are actually reached.

Run campaigns through the bounded container tasks.
Retain and replay minimized failures.
A clean initial campaign does not cover the unfinished parsers,
processors,
file walker,
or cli-git transaction implementation.
