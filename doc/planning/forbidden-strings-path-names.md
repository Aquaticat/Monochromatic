# Forbidden-strings path-name scanning

Issue #363 adds always-on name scanning for each file already selected by the scanner.
The `forbidden-regex` migration prerequisite has landed.
The scanner currently emits columnless content findings and the engine identifies matching rules,
not match spans.

## Confirmed behavior

- Match each directory name and filename separately with the active ruleset.
  No rule may match across a path separator.
- For repository files, use repository-relative segments.
  For an explicit file outside the repository or an invocation without a repository,
  inspect every supplied pathname segment, not merely the basename.
- Preserve the existing file selection, exclusions, content scanning, and exit codes.
  Path-name scanning is always on.
- Name findings distinguish their segment position from content line findings,
  with no column ranges.
  Emit one finding per matching segment and rule, as content scanning does per line and rule.
- Replace the entire offending segment in every emitted path,
  including content findings, errors, and cli-git policy output.
  The offending substring must never be printed.
- The cli-git adapter must match real candidate names while reading the exact candidate bytes,
  even when those bytes belong to an earlier revision or staged state.

## Superseded issue wording

The original issue requested a column range and in-place masking of only the matched bytes.
The user clarified that findings do not have column ranges and chose whole-segment masking.
No match-span API is needed for the updated behavior.

## Evidence and next action

- `package/cli/forbidden-strings/src/frx_scan.rs` uses rule-ID-only line matches.
- `package/git-policy/forbidden-strings/src/materialize-candidates.ts` uses synthetic filenames.
- `package/git-policy/forbidden-strings/src/scanner-output.ts` currently relays original candidate paths.

Implement the scanner path-name contract, then the adapter and consumer verification.
Keep unrelated worktree edits intact.
