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

## Implemented transport

The cli-git materializer retains synthetic private `candidate-N` content files.
For each file operand the adapter supplies one `--name-path` with its validated real repository-relative name.
The scanner emits `PATH:name:SEGMENT rule=TOKEN input=N` for name hits and
`PATH:LINE rule=TOKEN input=N` for content hits in this mode.
The operand index preserves candidate identity when multiple names mask to the same display path.
The parser compares every displayed segment against the indexed original name and
rejects an unmasked offending segment without repeating scanner-supplied text.
It emits the redacted path to the policy host rather than the original `CandidateFile.path`.

Colons in unmasked segments are encoded as `\\x3a`,
so filename text cannot impersonate a `:name:` marker.
Embedded CR/LF names fail closed rather than alter the engine's single-line anchor semantics.
A link's selected name is preserved by lexical repository-relative path handling,
not replaced by its resolved target name.

Recreating real candidate directory trees under the temporary root was rejected:
several historical states can share a path but differ in bytes,
and physical path grammar would weaken the existing synthetic-file isolation.
The scanner's paired logical-name option preserves both identities separately.

## Verification still needed

Run the rebuilt scanner, adapter, and host-policy boundary tests.
Review the final outputs for token leakage and keep unrelated worktree edits intact.
