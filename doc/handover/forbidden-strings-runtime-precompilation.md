# Handover: forbidden-strings runtime rule precompilation

## Status

GitHub issue [#456][] is open and no implementation has started.
The current activity is a user-directed design grill.
The user asked for comprehensive questions that assume they have forgotten how
`forbidden-strings` works.

Update this handover immediately after every user answer.
Continue the design tree until every dependent decision is settled.
Do not implement until the user confirms shared understanding.
The user explicitly said no `AGENTS.md` edit is needed for the communication correction.

[#456]: https://github.com/Aquaticat/Monochromatic/issues/456

## User goal

Resolve issue #456 completely:

- Make runtime rule precompilation a supported capability of the published scanner.
- Wire it automatically into this monorepo.
- Preserve text rules as the sole policy authority.
- Keep repeated commit scans within the scanner's documented pre-commit budget.
- Preserve redaction,
   rule identity,
   and fail-closed behavior.
- Commit the implementation with `Closes #456` in the commit body.

## Refresher

`forbidden-strings` is a Rust deny-list scanner under
`package/cli/forbidden-strings`.
It reads literal and restricted-regular-expression rules,
compiles them into a `forbidden_regex::RegexSet`,
and scans candidate files line by line.
Findings identify only path,
 line,
 and an opaque rule token.
Rule text,
 matching content,
 and surrounding source text stay out of findings.

Two rule sources participate in this repository:

- The built-in baseline lives in
  `package/cli/forbidden-strings/data/builtin-rules.txt`.
  `package/cli/forbidden-strings/build.rs` compiles and serializes it during the Rust build.
  Runtime loading uses `load_precompiled` and does not recompile it.
- Runtime appendices live in `forbidden-strings.append.txt` and
  `forbidden-strings.append.local.txt`.
  `generateForbiddenStringsRules` in `file-enforcer.config.ts` concatenates them into
  `.cache/forbidden-strings.rules.txt`.
  `FORBIDDEN_STRINGS_RULES` in generated `mise.toml` points the scanner at that text.
  `package/cli/forbidden-strings/src/frx_load.rs` compiles it on every invocation.

The local cli-git policy in `cli-git.config.ts` spawns the release scanner.
The canonical adapter is
`package/git-policy/forbidden-strings/src/scan-candidates.ts`.
It inherits scanner environment variables and parses scanner stderr strictly through
`package/git-policy/forbidden-strings/src/scanner-output.ts`.
Every nonempty unrecognized stderr line currently fails the policy as malformed output.

## Issue evidence

Issue #456 reports that runtime compilation dominates large-list scans.
Its corrected measurement used the same 10,206-rule file and the same two targets twice:

```text
run 1   139.81s
run 2   139.26s
```

The issue also reports a positive control:
a planted literal was detected while a neighboring clean file produced no finding.
The performance problem is repeated compilation,
not failure to enforce the rules.

These numbers come from the issue author.
They have not yet been reproduced in this work session.
Before making final performance claims,
measure an unchanged-build run-to-run band and use a positive control.

## Repository facts already verified

- `RegexSet::to_bytes` and `RegexSet::from_bytes` use raw bincode serialization in
  `package/rust-module/forbidden-regex/src/regex.rs`.
- Raw engine bytes carry no explicit artifact or engine format version.
- `RegexSet::from_bytes` validates decoded structures and rebuilds runtime prefilters.
- Runtime tail-format rules carry section names outside `RegexSet` in `CompiledRules.names`.
- A runtime artifact containing only raw engine bytes would lose named finding identities.
- File-enforcer's `overwrite` path compares content and skips unchanged files.
- File-enforcer writes changed text through a durable same-directory temporary file and atomic rename.
- Root preparation can run `node file-enforcer.config.ts` before Rust package builds.
  The scanner binary may therefore be absent during fresh setup.
- The release workflow builds Linux GNU,
   Linux musl,
   macOS,
   and Windows binaries.
- `.cache/` and `forbidden-strings.append.local.txt` are gitignored.
- At the time of inspection,
  `forbidden-strings.append.local.txt` and `.cache/forbidden-strings.rules.txt`
  both had Unix mode `0644`.
- The XDG Base Directory Specification 0.8 assigns nonessential user cache data to
  `$XDG_CACHE_HOME`,
   requires absolute XDG paths,
   and defaults Unix cache storage to
  `$HOME/.cache` when the variable is absent or empty.

## Settled decisions

### Product contract

The user selected all recommended options in grill round 1.

- **Q1,
   public scope**:
  add a supported scanner capability and wire it automatically in this monorepo.
  Q13 later established that external consumers receive read-write caching by default.
- **Q2,
   authority**:
  text is always authoritative.
  Compiled data is disposable and may be used only after proving it corresponds to current text.
- **Q3,
   cost placement**:
  eager compilation belongs at rule-generation time rather than on an ordinary commit scan.
- **Q4,
   confidentiality**:
  treat compiled artifacts as sensitive as their source.
  Binary encoding is not a confidentiality boundary.
- **Q5,
   completion evidence**:
  require semantic parity and measured large-list cached performance against the documented
  sub-100 ms pre-commit objective.

### Cache mechanics

- **Q6,
   cache location**:
  derive a per-user cache location rather than accepting a separate artifact path or using a
  repository-adjacent sibling convention.
- **Q7,
   artifact shape**:
  use one self-validating envelope containing a magic marker,
  schema and compatibility data,
  source-content SHA-256,
  rule identities,
  and serialized `RegexSet` bytes.
- **Q8,
   invalid artifact**:
  emit a redacted warning,
  compile authoritative text,
  and continue with a correct scan.
  An unusable cache must never produce a false-clean scan.
- **Q9,
   compilation interface**:
  add a dedicated subcommand:

  ```text
  forbidden-strings compile-rules --rules <PATH>
  ```

  The command derives the user-cache destination.
  It does not scan files or add the built-in baseline.
- **Q10,
   eager plus recovery**:
  file-enforcer invokes `compile-rules` eagerly when it generates this repository's runtime text.
  Scan mode also writes a repaired cache after compiling a missing or invalid artifact.
- **Q11,
   permissions**:
  enforce owner-only permissions for sensitive local representations where the platform supports them.
  The intended Unix modes are `0600` for
  `forbidden-strings.append.local.txt`,
  `.cache/forbidden-strings.rules.txt`,
  and the compiled artifact.
  The committed shared appendix remains `0644`.
- **Q12,
   concurrent writers**:
  use source recheck plus same-directory temporary-file creation,
  flush,
  and atomic replacement.
  Do not add a persistent artifact lock.
  Concurrent writers may duplicate compilation,
  but readers must see only complete self-validating artifacts.
- **Q13,
   cache activation**:
  read-write caching is the default and has no opt-out.
  Every runtime-rules scan checks the derived cache and attempts repair after a miss or rejection.
  `compile-rules` remains the eager explicit operation.
- **Q14,
   cross-platform cache root**:
  use an absolute `FORBIDDEN_STRINGS_CACHE_DIR` override when present.
  Otherwise use XDG cache resolution on Linux and other XDG-oriented Unix,
  `$HOME/Library/Caches` on macOS,
  and `%LOCALAPPDATA%` on Windows.
- **Q15,
   source slot identity**:
  key the artifact slot by SHA-256 of the exact current rules content.
  Identical content may share one artifact across repositories within the same version and platform partition.
  Every source edit selects a different slot.
- **Q16,
   warning protocol**:
  emit JSON cache-warning records on stderr alongside plain-text findings.
  Cli-git must parse the exact warning schema and continue rejecting unknown stderr records.
- **Q17,
   compatibility partition**:
  partition cache storage by exact scanner version and operating-system/architecture family.
  Repeat compatibility data inside the envelope before decoding raw engine bytes.

## Current proposed behavior

### Eager generation

The monorepo integration is one-way:
file-enforcer calls the public scanner command,
while the published scanner has no dependency on file-enforcer.

```text
forbidden-strings.append.txt
            +
forbidden-strings.append.local.txt
            |
            v
file-enforcer writes authoritative runtime text
            |
            v
forbidden-strings compile-rules --rules <runtime-text>
            |
            v
versioned artifact under the per-user cache root
```

A missing scanner during fresh setup must not destroy or invalidate authoritative text.
File-enforcer cannot eagerly compile in that state,
but the first later scan uses the default read-write recovery path.
The exact file-enforcer notice and retry behavior remains open.

### Scan behavior

```text
resolve authoritative runtime rules path
            |
            v
read and hash authoritative rules bytes
            |
            v
derive versioned platform partition and content-digest slot
            |
            +--> valid compatible artifact: load matcher and names
            |
            +--> cache miss or rejection:
                    emit redacted JSON warning
                    compile authoritative text in memory
                    scan correctly
                    attempt atomic cache repair
```

The scan must never trust modification time as source identity.
It must never run an artifact whose embedded source digest disagrees with current text.

### Compilation behavior

`compile-rules` should:

- Require an explicit `--rules` path.
- Read and hash one source snapshot.
- Derive the cache slot from the exact source-content digest.
- Reuse an already valid compatible artifact without recompiling.
- Compile through the same `compile_rules` path used by scanning.
- Preserve every optional rule name in order.
- Re-read and re-hash the source before publishing.
- Discard its result if the source changed during compilation.
- Write a complete artifact through a same-directory temporary file.
- Flush the temporary file before atomic replacement.
- Apply owner-only file permissions where supported.
- Keep all diagnostics free of rule text and matched content.

## Settled grill round 3 consequences

The selected path shape is provisionally:

```text
<platform-cache-root>/forbidden-strings/
  <exact-scanner-version>/
    <operating-system>-<architecture>/
      <source-content-sha256>/
        rules.bin
```

The exact component spelling remains open.
The envelope repeats the scanner version,
platform family,
source digest,
rule identities,
and artifact schema before its engine bytes.

Default read-write behavior intentionally changes every runtime-rules scan from read-only to potentially state-mutating.
There is no cache-mode flag or environment opt-out to design.
An unavailable cache root or failed artifact write must therefore degrade to a correct in-memory text compilation.
The exact diagnostic and retry contract is part of the next grill frontier.

Content-addressed slots make old artifacts unreachable after every rules edit.
They also permit identical rules content to share one compiled artifact across source paths.
Cleanup and retention are now required design decisions rather than optional housekeeping.

JSON warning records become part of the scanner-to-cli-git protocol.
Their schema must be closed,
redacted,
and distinguishable from plain-text findings without treating arbitrary JSON as trusted output.

## Open dependent decisions after round 3

- Scan-time cache-root and artifact-write failure behavior.
- Fresh-setup behavior when file-enforcer cannot start the scanner.
- CI behavior for one-shot secret-backed scans under mandatory read-write caching.
- Whether warnings appear on an expected first miss or only on invalid or failed cache operations.
- Exact JSON warning schema and parser strictness.
- Content-addressed cache cleanup and old-version retention.
- Exact artifact field encoding and bounds.
- Exact cache-directory and artifact filenames.
- Whether the compilation command prints the derived artifact path.
- Version bump and release compatibility expectations.

## Candidate implementation scope

No file in this list has been edited yet.
The final design may change the list.

Likely scanner changes:

- `package/cli/forbidden-strings/src/cli.rs`
- `package/cli/forbidden-strings/src/lib.rs`
- `package/cli/forbidden-strings/src/frx_load.rs`
- New focused Rust modules for cache-root resolution,
  artifact encoding,
  and atomic publication.
- `package/cli/forbidden-strings/tests/integration.rs`
- Focused Rust unit-test sidecars.
- `package/cli/forbidden-strings/README.md`
- `package/cli/forbidden-strings/PERF.md`
- Possibly `package/cli/forbidden-strings/Cargo.toml`,
  through the repository's Cargo-manifest enforcement source if dependencies change.

Likely monorepo integration changes:

- `file-enforcer.config.ts`
- Generated `mise.toml`
- `package/git-policy/forbidden-strings/src/scanner-output.ts`
- Its generated mirror under
  `package/git-policy/cli/src/optional/forbidden-strings/scanner-output.ts`
- Canonical and integration tests for warning parsing.

## Required verification

### Artifact correctness

Cover every path separately:

- Named tail-format rules round-trip with names unchanged.
- Unnamed legacy rules round-trip with numeric identity unchanged.
- Valid artifact produces findings identical to text compilation.
- Source-content change selects a new content-addressed slot and cannot reuse the old artifact.
- Scanner-version or platform mismatch rejects old artifact.
- Bad magic,
  truncated fields,
  oversized lengths,
  count mismatch,
  malformed names,
  and invalid engine bytes all fall back safely.
- No cache diagnostic contains seeded sensitive rule text.
- A source change during compilation prevents stale publication.
- Concurrent writers publish only complete artifacts.

### Integration behavior

- `compile-rules` creates or reuses the derived artifact.
- Scan-time recovery creates a valid artifact when authorized.
- A cache-write failure still runs a correct text-compiled scan.
- Cli-git accepts only the settled JSON cache-warning schema and still maps plain-text findings.
- Cli-git rejects unknown scanner stderr.
- File-enforcer generates text before invoking compilation.
- Fresh setup remains usable when the scanner binary is absent.
- Unix permission checks prove owner-only sensitive files.
- Linux,
  macOS,
  and Windows cache-root resolution use injected disposable environments.

### Performance evidence

Use a disposable fixture and release binary.
Do not mutate real rules or cache state for verification.

- Establish run-to-run timing variation on one unchanged build.
- Run a positive-control rules change that must invalidate the cache.
- Measure first compile,
  valid cached load,
  and repeated cached scans separately.
- Use a rule count representative of issue #456 rather than only the current repository appendix.
- Verify matching output while timing;
  a fast null result without a known match is not sufficient.
- Exercise the final CLI boundary,
  not only library functions.

Run package tasks through `mise run`.
Read root and package `mise.toml` before selecting the exact task set.
Rust changes require package build,
test,
Clippy,
Rust linter,
and end-user CLI execution.
TypeScript changes require the package `lint:types` task in addition to tests and lint.

## Risks to keep visible

- A serialized matcher can retain sensitive structure.
  Keep cache data private and disposable.
- Cache correctness is security correctness.
  A stale artifact must cause text compilation,
  never a clean result.
- Warning output is part of the cli-git protocol.
  Broadly ignoring stderr would weaken fail-closed behavior.
- Raw bincode compatibility is not a public stable format.
  The envelope and cache partition must reject unsupported producers before decoding.
- Scan-time repair introduces default state mutation with no opt-out.
  Write failures must preserve a correct scan and follow the still-open JSON diagnostic contract.
- Content-addressed slots retain one artifact per observed rules content and scanner/platform partition.
  Automatic retention remains open.
- A content digest is a stable fingerprint of sensitive source.
  Treat cache paths and artifacts as sensitive even when rule text is absent.
- File-enforcer is only this monorepo's eager integration point.
  Do not make the published scanner depend on it.
- The repository supports Windows and macOS releases.
  Unix-only cache and permission assumptions are incomplete.

## Next action

Derive and ask grill round 4 from the open dependent decisions after round 3.
Update this handover immediately after the user's next answer.
