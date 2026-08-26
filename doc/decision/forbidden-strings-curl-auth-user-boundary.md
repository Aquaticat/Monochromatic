# Bound curl authentication options to shell tokens

## Status

Accepted,
2026-08-26.

## Context

The Betterleaks `curl-auth-user` rule searches for curl basic-authentication options
across a continuation window.
The line-oriented forbidden-strings port cannot retain that cross-line context.
Its cutover reshape therefore kept only the `-u` or `--user` credential shape,
which preserved continuation-line detection but also matched `-u` inside larger words and paths.
For example,
`ask-user-question:build` was interpreted as a short option followed by a username-password pair.

The cutover review accepted non-curl matches from this broadening.
That acceptance did not distinguish a separate shell option from an option-like substring inside another token.

## Decision

Keep the upstream `curl-auth-user` rule identity and its curl-oriented description.
Require `-u` or `--user` to begin at line start or follow horizontal whitespace.
Continue accepting a separately tokenized credential option without `curl` on the same line,
so indented continuation lines remain detectable.

This partially supersedes the acceptance recorded in
`doc/planning/forbidden-strings-cutover-differential.md`:
standalone option over-matching remains accepted,
but embedded-word and embedded-path over-matching does not.

## Alternatives considered

Requiring `curl` on the same line was rejected because it loses continuation-line detection.
Adding contextual multiline scanning was rejected for this change because the accepted token boundary
fixes the demonstrated false-positive class without changing the scanner's line-oriented candidate model.
Renaming the rule was rejected because its identity records upstream provenance and remains stable in diagnostics.
