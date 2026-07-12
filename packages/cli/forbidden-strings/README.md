# forbidden-strings

Linear-time deny-list scanner for Git repos.
 ~9 ms cold start,
 ~1 GiB/s wall throughput,
~20x faster per byte than betterleaks v1.1.2 on the same content.
 Sub-10 ms startup fits
inside a pre-commit budget;
 ~57 ms full `--all` on this repo (3,471 files,
 57 MiB) fits
inside a pre-push budget.

Rules split into a committed baseline (`forbidden-strings.local.example.txt`) and a
per-repo appendix (`forbidden-strings.append.local.txt`,
 gitignored) or CI-only secret
(`FORBIDDEN_STRINGS_LIST`).
 The runtime rules file is concatenated from those sources by
file-enforcer.
 Matched substrings,
 the surrounding line,
 and the rule pattern are never
printed in failure output,
 so a rule body that would itself leak if committed (a customer
name,
 an unreleased project codename,
 a pre-disclosure partner ID) can live as an appendix
or CI secret without exposure on public CI logs.

## What's different

- **Sub-10 ms startup,
   ~1 GiB/s wall.
  ** Single dated block (2026-05-16
  post-emit-hit-consolidation,
   hyperfine 1.20.0,
   AMD Ryzen 7 8700F,
   16 threads):
   9.4 ms cold
  start on this repo,
   9.8 ms on the Linux kernel corpus,
   56.6 ms full `--all` on this repo,
  1.989 s full `--all` on the kernel.
   Native Rust binary with `lto = true`,
  `codegen-units = 1`,
   `opt-level = 3`,
   `panic = "unwind"`,
   `overflow-checks = true`,
  `strip = true`;
   no Node startup,
   no WASM init,
   no per-invocation TOML parse.
   On clean
  files the dual Aho-Corasick gate short-circuits before the regex engine runs.
   Betterleaks
  starts in ~174 ms.
- **Linear-time matching.
  ** Resharp is derivative-based with no backtracking;
   Aho-Corasick
  gates the regex engine via extracted literal prefixes.
   A pathological rule combination
  cannot exhibit catastrophic-backtracking behaviour.
- **Resharp set-algebra rules.
  ** `A&B` (intersection) and `~(A)` (complement) are
  first-class.
   Express "match X but not Y" without lookaround.
   PCRE-family engines
  (gitleaks,
   trufflehog,
   secretlint,
   plain RE2) cannot do this;
   the workaround in those
  tools is per-rule allowlists,
   which scale badly.
- **Sensitive rules can live out-of-band.
  ** The committed baseline holds non-sensitive
  rules;
   the gitignored appendix and the CI-only `FORBIDDEN_STRINGS_LIST` secret hold
  sensitive rules.
   Failure output never prints the matched substring,
   the surrounding line,
  or the rule pattern,
   so a rule body itself can be a secret.

## When to pick something else

`forbidden-strings` deliberately omits features other scanners ship as core capabilities:

- **CEL-based post-match filtering** (entropy thresholds,
   BPE token efficiency,
   git-author
  predicates,
   file-path globs,
   string allowlists).
   Helps cut false positives when the rule
  corpus is broad.
   No equivalent here.
- **Async HTTP validation**.
   No way to call a provider API to confirm a detected secret is
  live.
   The scanner reports literal matches;
   staleness review is on you.
- **Git history scanning**.
   The walker enumerates working-tree files only.
   No equivalent of
  `gitleaks git` or `betterleaks git` that scans every diff in every commit.
- **SARIF / JSON / CSV output**.
   Hits go to stderr as plain text.
   No machine-readable
  format for GitHub code-scanning upload or CI dashboards.
- **Per-rule path scoping**.
   Every rule runs against every (non-skipped) file.
   The scanner
  cannot apply rule X only to YAML files.
- **Per-rule allowlists**.
   No way to say "rule X but skip when it matches in path Y.
  "
- **No streaming or stdin input.
  ** Files only.
   The walker enumerates from disk;
   there is
  no `--stdin` mode.

If you need any of those,
 betterleaks or gitleaks is the right tool.
 Otherwise
`forbidden-strings` is faster and more expressive (set-algebra,
 out-of-band rules,
redacted output,
 native binary startup).

## Prerequisites

- **Rust toolchain**.
   Install via mise:
   `mise install rust`.
- **mise** itself,
   since build commands are `mise run` tasks.

## Build

```sh
mise run //packages/cli/forbidden-strings:build
```

The release binary lands at `packages/cli/forbidden-strings/target/release/forbidden-strings`.
Root `cli-git.config.ts` gives that path to the bundled `security/forbidden-strings` policy;
nothing needs to be on `$PATH`.

## Setup

The scanner needs exactly one rules file at scan time.
 How you produce it is up to you.

### Without file-enforcer (most consumers)

Put one rule per line in a file named `forbidden-strings.local.txt` at the repo root,
 or
pass `--rules <PATH>` / set `FORBIDDEN_STRINGS_RULES=<PATH>` to point at any other path.
That is the whole setup.
 For a zero-file start,
 pass `--builtin-rules` to scan with the embedded betterleaks-ported baseline
 (see "Built-in baseline" below).
 Add the file to `.gitignore` if the rules themselves are
sensitive;
 otherwise commit it.
 The "Rule file format" section below describes the line
syntax.
 In CI,
 materialise the file from a secret (see "GitHub Actions" below) so the
rule bodies never enter version control.

### With file-enforcer (this monorepo's workflow)

Inside the Monochromatic monorepo,
 the runtime file is composed from two source files by
the `file-enforcer` task so the committed baseline and the gitignored sensitive appendix
stay separated on disk:

- `forbidden-strings.local.example.txt` — committed baseline (betterleaks port plus any
  non-sensitive rules).
   Regenerated by
  `packages/cli/forbidden-strings/src/mise.port-betterleaks.ts`;
   edit the generator,
   not
  the output.
- `forbidden-strings.append.local.txt` — per-repo additions.
   Gitignored,
   free-form,
   edited
  by hand.
   Place sensitive literals (codenames,
   customer names,
   partner IDs) here.
- `forbidden-strings.local.txt` — runtime file consumed by the scanner.
   Generated by
  file-enforcer concatenating the previous two.
   Do not edit directly.

Run `mise run file-enforcer` after editing either source to regenerate the runtime file.
The generator lives at `file-enforcer.config.ts:56-83`.
 If you fork this scanner into a
project that doesn't use file-enforcer,
 drop the example/append split and follow the
single-file workflow above.

## Usage

```sh
# scan a specific file list (uses ./forbidden-strings.local.txt by default)
forbidden-strings path/to/file other/file

# scan every working-tree file (.gitignore respected; .git/.jj skipped)
forbidden-strings --all
```

The rules path is resolved in this order:
 `--rules <PATH>` flag (highest),
 then
`FORBIDDEN_STRINGS_RULES` env var,
 then `./forbidden-strings.local.txt` in the current
working directory.

```sh
# explicit path
forbidden-strings --rules ./other-rules.txt --all

# via env var (CI-friendly: materialize from a secret, then run)
FORBIDDEN_STRINGS_RULES=./materialized.txt forbidden-strings --all

# print version and exit
forbidden-strings --version    # or -V
```

### Built-in baseline (`--builtin-rules`)

The binary embeds the betterleaks-ported baseline ruleset
(`data/builtin-rules.txt`,
 compiled in via `include_str!` and exported as the library constant
`forbidden_strings::BUILTIN_RULES`).
It is pure opt-in:
 without the flag the scanner never reads it,
 so existing invocations behave exactly as before the flag existed.

With `--builtin-rules`:

- The baseline is appended AFTER the resolved rules file,
  so `rule=N` numbers for your own rules do not shift.
- When no rules file resolves at all
  (no `--rules`,
   no env var,
   and no `./forbidden-strings.local.txt` in cwd),
  the baseline alone is the ruleset;
  passing the flag is itself the configuration.
- An explicitly named missing file
  (`--rules <path>` or the env var pointing at a path that does not exist)
  still exits 2:
  silently scanning without your rules would be a false-clean result.

```sh
# zero-file quick start: scan the tree with the embedded baseline only
forbidden-strings --builtin-rules --all

# your rules plus the baseline
forbidden-strings --builtin-rules --rules ./rules.txt --all
```

`--all` and positional files are mutually exclusive in practice:
 if both are passed,
 the
walker output silently overwrites the positional list.
 Use one or the other.

## Rule file format

One rule per line.
 Two shapes:

- A bare line is a case-sensitive literal.
   Match semantics depend on length:
  - **Length below 7 bytes**:
     conditional word-boundary check (`grep -w` semantics).
    A boundary is required at any end whose edge byte is a word character (`[A-Za-z0-9_]`);
    the file context on that side must be either start/end of file or a non-word byte.
    A short alpha-only acronym matches a standalone occurrence in normal prose but
    does **not** match coincidentally as a substring of a longer identifier or inside
    random base64 noise.
     Path-shaped literals like `/etc/passwd` still match inside
    `cat /etc/passwd` because the leading `/` is non-word so no left-side boundary
    is enforced.
  - **Length 7 bytes or more**:
     pure case-sensitive substring match,
     no boundary check.
    A long literal matches anywhere it appears,
     including glued mid-identifier.
    Distinctiveness from sheer length makes coincidental substring match negligible.
    If a phrase exists in two written forms (with and without internal whitespace),
    add both as separate rules so each matches its respective form.
- A line of the shape `/PATTERN/FLAGS` is a regex.
   The first `/` and last `/` delimit the
  pattern;
   `FLAGS` is zero or more lowercase letters and is rewritten to a resharp
  inline-flag prefix (e.g. `/foo/i` becomes `(?i)foo`).
   Use this form to opt into
  substring-anywhere semantics for short literals (write the literal between the slashes),
  or to ban literals matching `^/.+/[a-z]*$` (escape the slashes,
   e.g. ban the literal
  `/etc/passwd` as `/\/etc\/passwd/`).

Empty lines are ignored.
 Lines starting with `#` are comments.

The 7-byte threshold has a coincidence-rate justification;
 see Architecture below
for the derivation and `SUBSTRING_THRESHOLD` in `src/rules/types.rs` for the constant.

**One known regression** under these semantics:
 a short literal rule will not match a
plural or suffixed form (a 3-letter acronym does not match the same acronym followed
immediately by `s`,
 because the trailing `s` is a word char and the boundary fails).
 If
plural matching is needed,
 express the rule as a regex with an optional trailing class:
`/ACRONYMs?/`.

### Rule-file quirks

- **Whitespace and comments.
  ** Lines are `trim()`'d before parsing
  (`src/rules/parse.rs:64`).
   A line containing only whitespace is ignored.
   A line whose
  first non-whitespace byte is `#` is a comment (`:78`).
   A `#` mid-line is part of the
  rule.
- **No deduplication.
  ** Two identical rules both load and both fire;
   you see two hits with
  two different `rule=N` indices.
- **Uppercase-flag fallthrough (silent foot-gun).
  ** `/foo/i` is a regex with the `i` flag.
  `/foo/I` is a *literal rule* that matches the exact substring `/foo/I`.
   The classifier
  rejects flag strings containing any non-`[a-z]` character (`parse.rs:150`) and silently
  falls through to literal handling (`:209`).
   A rule author who writes `/PAT/I` thinking
  they got case-insensitive matching has not — they now have a literal scan for the
  seven-byte string `/PAT/I`.
   The same applies to any uppercase or non-`[a-z]` flag
  character.
   There is no error or warning at load time.
- **Empty regex.
  ** `//` parses as the regex `(?-flags:)`,
   which matches the empty string
  at every position.
   Foot-gun;
   do not write a bare `//` as a rule.
- **Missing or empty rules file.
  ** `--rules /no/such/file` exits 2 with a read error.
   An
  empty rules file (or one that is all comments) exits 2 with `no rules loaded`.
- **UTF-8 BOM.
  ** Not stripped.
   If a rules file begins with a BOM,
   the first rule line
  begins with `\u{FEFF}` and the rule body contains those bytes.

### Set-algebra operators

Resharp extends standard regex with two top-level set operators that pure-PCRE engines lack:

- `A&B`:
   intersection.
   Matches strings matched by both `A` and `B`.
- `~(A)`:
   complement.
   Matches strings that do NOT match `A`.

Combined,
 these express "match X but not Y" without lookaround.
 Example:
 ban any
five-digit key except the all-zeros placeholder:

```text
/key_[0-9]{5}&~(key_0{5})/
```

This flags `key_12345` and `key_99999` but lets `key_00000` through.
 Class-level forms
`[A&&B]` (intersection) and `[A~~B]` (symmetric difference) are also available inside
character classes.

Underscore is a resharp meta character.
 Unescaped `_` is the top pattern,
 which matches
any single codepoint.
 Escape a literal underscore as `\_`,
 including inside algebra
operands such as `ghp\_...&~(ghp\_0{36})`.

The scanner extracts required literal bytes from regex rules and folds them into a
shared Aho-Corasick gate so the regex engine only runs on files that contain a required
substring.
 For set-algebra rules,
 intersection `&` is a transparent separator and
complement `~(...)` bodies never contribute gates because they describe excluded strings,
not required bytes.
 A pattern that starts with literal bytes (`key_[0-9]{5}&~(...)`
extracts `key_`) stays on the fast path.
 A pattern that starts with `~(...)` or another
metacharacter falls into a smaller residual gate,
 still correct,
 just slower per file.
Extracted prefixes preserve the regex source's original UTF-8 bytes verbatim,
 so a rule
whose leading literal contains non-ASCII characters (em-dash `—`,
 smart quotes,
 ellipsis,
emoji) gates correctly against file content holding the same bytes;
 a walker that
mojibake'd those bytes during extraction would silently disable the rule by registering
a pattern AC could never match.

#### Complement-body limitations (resharp 0.5.x through 0.6.x)

Resharp 0.5.
x through 0.6.
x cannot reverse a complement whose body contains a
lookaround.
 The parser rewrites several surface atoms to internal lookarounds,
so the following shapes fail at compile time:

- `\b` inside a `~(...)` body.
   Rewritten to negative-lookahead /
  negative-lookbehind by the parser,
   then refused.
   Workaround:
   replace `\b` with
  `\W` (consumes a character on each side) or with literal whitespace,
   or move
  the boundary check outside the complement.
- `\B` inside a `~(...)` body.
   Refused at parse time when the neighbours are
  unclassifiable.
   No in-place rewrite;
   restructure the rule.
- Unescaped `^` or `$` inside a `~(...)` body.
   Rewritten to lookbehind /
  lookahead in default-multiline mode and then refused.
   Workaround:
   use `\A` /
  `\z` for whole-content anchors,
   or move the anchor outside the complement.
  Inline `(?-m)` and group-scoped `(?-m:^foo$)` do NOT propagate into the
  complement body,
   so neither works as a workaround.
- User-explicit lookarounds (`(?=`,
   `(?!`,
   `(?<=`,
   `(?<!`) inside a `~(...)`
  body.
   Refused for the same reason as the rewritten cases.
   Lift the lookaround
  outside the complement.

`forbidden-strings` detects every shape above at rule load time and reports the
specific trigger:

```text
forbidden-strings: rule on line 42 (resharp): complement body contains \b;
resharp 0.5.x through 0.6.x rewrites it to an internal lookaround which the
reverse pass refuses. Replace with \W ... See TROUBLESHOOTING.resharp.md
for workarounds.
```

The doc at `TROUBLESHOOTING.resharp.md` in the repository root has the full
trace,
 more workarounds,
 and the upstream-issue draft.

#### Additional pre-validators (May 2026)

A handful of resharp shapes provoke compile-time blowups or release-build
soundness bugs rather than clean parser refusals.
 The scanner rejects each one
at rule load with an explicit error naming the source line and the upstream
issue:

- **Nested complements `~(~(...))`.
  ** Rejected pre-compile;
   the reverse pass
  cannot reverse-engineer two nested complements without exponential blowup.
- **Stacked quantifiers `(a+)+`,
   `(a*)*`,
   etc.** Rejected pre-compile.
- **Algebra hang shapes.
  ** Intersection of a quantifier and a complement
  (`a+&~(...)`) and alt-lookaround sibling shapes (`(a|b(?=c))`) are rejected
  with explicit error messages naming the source line and the resharp issue.
- **Nested-lookahead overflow.
  ** Specific shape `(?=...(?=...(?=...)))` rejected;
  resharp's reverse pass overflows past three nesting levels.
- **Intersection plus lookbehind.
  ** Rejected by `intersection_with_lookbehind` in
  `src/rules/engine.rs`.
   The underlying resharp shape silently returns wrong
  matches in release builds (the debug-asserted bound is OFF in release),
   so
  the pre-validator is load-bearing for correctness,
   not just performance.

Even when a pre-validator misses a new known-bad shape,
 `compile_rule_src`
catches the resharp panic via `std::panic::catch_unwind` and emits
`PATH: rule=N engine error` to stderr instead of aborting;
 the file still scans
against every other rule.
 This is what the `panic = "unwind"` and
`overflow-checks = true` release-profile settings buy.
 See `Cargo.toml:49-97`
for the full rationale.

### Perl-class shorthand semantics

The scanner compiles rules in byte mode for speed (`regex::bytes` with
`unicode(false)`),
 which would normally make every Perl-class shorthand
ASCII-only.
 Two semantics survive that mode:

- **`\s`:
   Unicode-aware.
  ** Matches every Unicode whitespace code point's
  UTF-8 bytes:
   ASCII whitespace (`\t \n \v \f \r` ),
   NBSP (U+00A0),
  ogham space (U+1680),
   Mongolian vowel separator (U+180E),
   en-quad
  through hair space (U+2000..U+200A),
   line/paragraph separator
  (U+2028..U+2029),
   narrow NBSP (U+202F),
   medium math space (U+205F),
  ideographic space (U+3000),
   zero-width NBSP (U+FEFF).
   Realised by
  expanding the rule source so each `\s` becomes a non-capturing
  alternation of ASCII whitespace and the multi-byte UTF-8 sequences.
  A rule like `(?i)adafruit[\s]+=` correctly matches
  `adafruit<NBSP>=` in JS/TS files.
- **`\S`,
   `\w`,
   `\W`,
   `\d`,
   `\D`,
   `\b`,
   `\B`:
   byte-level (ASCII).
  **
  Match the PCRE default (ASCII subset).
   For secret patterns these
  semantics match author intent:
   `\d{16}` for a credit card means
  ASCII digits,
   `\b(pat_...)` boundaries against literal prefixes
  fire on ASCII context,
   `[\w.-]{0,N}` optional prefixes never
  block a match.
   Authors who need genuinely Unicode-aware behaviour
  for these atoms can opt in with the `(?u)` flag,
   which routes the
  rule to the slower full-Unicode compile path.

The asymmetry between `\s` and the rest is pragmatic:
 `\s` has a
real bug repro (NBSP in JS/TS files) with a tractable byte-alternation
expansion,
 while `\W`/`\D`/`\B` have zero uses in the betterleaks
corpus and `\S`/`\w`/`\d`/`\b` are all used in shapes where
byte-level semantics produce no silent miss.
 See PERF.
md for the
per-atom analysis.

### Supported regex flags

The flag string accepts these lowercase letters,
 applied via resharp's inline-flag group:

- `i`:
   case-insensitive.
- `m`:
   multiline (`^`/`$` match at line boundaries).
- `s`:
   dot-matches-newline.
- `u`:
   toggle Unicode `\w`/`\d` semantics.
- `x`:
   ignore whitespace and `#` comments inside the pattern.

Resharp's parser also recognises `U` (swap greed) and `R` (CRLF line terminators),
but the validator deliberately rejects uppercase flags.
 Both are useless in this scanner:
`U` only affects match span length (not whether something matched),
 and the rare pattern
that needs CRLF-aware anchors can write `\r?$` directly.
 If you ever need them locally
inside one pattern,
 use the inline form:
 `(?U)foo` or `(?R)bar`.

## Integration

### Local cli-git policy

Root `cli-git.config.ts` enables `security/forbidden-strings` at error severity.
The PATH-shadowed cli-git wrapper evaluates selected would-be-committed bytes before commit,
landed commit bytes before automatic push,
and Git-native outgoing ranges before manual push.
Native `--no-verify` skips Git hooks but does not skip this policy.

Run an explicit read-only check through the built shim with:

```sh
git cli-git check --policy security/forbidden-strings --all
```

The policy invokes the repository-built scanner directly.
Scanner infrastructure failures remain distinct exit-2 engine failures;
findings exit `1`.

### GitHub Actions

`.github/workflows/forbidden-strings.yml` remains independent of cli-git trust and local wrapper state.
It downloads the release matching the scanner crate version,
verifies the archive's GitHub build-provenance attestation,
materializes the committed baseline plus shared appendix and optional repository secret,
then invokes the scanner binary directly.
Pull-request and merge-queue jobs scan changed files relative to `origin/main`;
pushes to `main` scan the complete tracked tree.

Pipe secrets through `printenv` rather than interpolating them into a workflow command;
shell expansion can leak values even when log masking is enabled.
The same precedence applies locally and in CI:
`--rules` > `FORBIDDEN_STRINGS_RULES` > `./forbidden-strings.local.txt`.

## Output

For each violation:

```text
PATH:LINE:COL_START..COL_END rule=N
```

Columns are 1-based byte offsets within the matched line.
**The matched substring is never printed.
** Only the path,
 line number,
 column range,
and the opaque rule index appear in failure output;
 otherwise a failing CI log
becomes a leak surface.
 A contributor wanting to know which rule fired looks up the
index against their local rule file.

- **Hits go to stderr,
   not stdout.
  ** Redirecting `2>/dev/null` silently loses the report.
- **Read errors are synthetic hits.
  ** A file that cannot be opened (broken symlink,
  permission denied,
   deleted during scan) produces a single line
  `PATH: read error: <reason>` on stderr and contributes to the exit-1 count
  (`src/lib.rs:907-910`).
- **Engine errors are synthetic hits.
  ** A rule that panics inside resharp at scan time
  produces `PATH: rule=N engine error` on stderr and contributes to the exit-1 count.
  Three emission points,
   one per phase:
   AC-prefix-matched par_iter,
   residual Single shard,
  residual Combined par_iter (`src/scan.rs:332`,
   `:383`,
   `:424`).
- **Ordering.
  ** Within a file,
   hits are emitted in match order.
   Across files,
   ordering is
  rayon-scheduler-determined and stable on a given input but not alphabetic.
  Callers that need deterministic cross-file reports should pipe the diagnostic output
  into `sort` in their own wrapper instead of expecting a tool-level sorted-output mode.

Exit codes:

- `0`:
   no violations.
- `1`:
   one or more violations (real hits,
   read errors,
   or engine errors).
- `2`:
   usage error or rules-file error.

## Walker behaviour

- **`--all` semantics.
  ** Walks the working tree via `ignore::WalkBuilder`
  (`src/walk.rs:217-220`):
   `.hidden(false)` (dotfiles like `.github/`,
   `.npmrc` ARE
  scanned),
   `.ignore(false)` (the `.ignore` file is NOT consulted).
   The `.gitignore` file
  remains enabled — `ignore(false)` only disables the `.ignore` source;
   `git_ignore` is a
  separate setting.
   Files force-added past `.gitignore` (`git add -f`) are recovered via an
  in-process `gix-index` read of `.git/index` (`walk.rs:394-518`);
   no git subprocess.
- **`.git/` and `.jj/` skipped.
  ** Internal VCS state is never scanned (filter at
  `walk.rs:220`).
- **Symlinks NOT followed.
  ** `WalkBuilder`'s default `follow_links` is false and the
  project does not override it.
   Symlinked directories are not descended;
   symlinked files
  are visited but,
   on a broken target,
   surface as a read-error synthetic hit.
- **Non-UTF-8 paths silently dropped.
  ** Index entries that are not valid UTF-8 are
  excluded from the walk (`walk.rs:518`);
   no error or warning.
- **Per-entry walker errors silently skipped.
  ** A directory the walker cannot enter does
  not surface;
   only file-read errors after the walker hands off the path get reported via
  the read-error synthetic-hit path.
- **Binary-file 8 KiB tail cap.
  ** Files whose first 8 KiB contains a NUL byte are scanned
  only in the first 8 KiB.
   The leading window always runs;
   secrets there fire.
   The tail
  past 8 KiB is skipped (recovers binary-scan cost from BUG 5's full-scan fix while
  preserving leading-window soundness).
   Constant `BIN_PROBE_SIZE = 8192` at
  `src/lib.rs:291`;
   logic at `:332-352`.
- **Read errors as hits.
  ** As above (cross-reference).
- **Self-skip set.
  ** During `--all`,
   four canonical paths are auto-skipped so rule bodies
  do not self-match:
  - the materialised rules file (whatever `--rules` / env var / default resolves to)
  - `packages/cli/forbidden-strings/data/betterleaks-default-config.toml`
  - `packages/cli/forbidden-strings/src/port-betterleaks-relaxations.ts`
  - `packages/cli/forbidden-strings/forbidden-strings.local.example.txt`

  The three generated-source paths are package-anchored (NOT root-anchored).
   Skip is via
  `std::fs::canonicalize`;
   paths that fail to canonicalize from the current cwd are
  silently dropped from the set.
   Explicit positional arguments bypass the skip entirely —
  though note that passing `--all` overwrites positional arguments,
   so the bypass only
  applies to the no-`--all` invocation.

  The root `forbidden-strings.local.example.txt` is NOT in the package-anchored list.
   It
  is normally also the materialised rules-file source path in the CI workflow (the `cp`
  step),
   so it ends up scanned-or-not depending on whether it canonicalises to the
  materialised file.

## Performance

Measured on an AMD Ryzen 7 8700F (16 threads).
 Full bench methodology and per-version
regression history are in `PERF.md`.
 If you change these,
 change `PERF.md` too.

Post-emit-hit-consolidation,
 2026-05-16,
 hyperfine 1.20.0.

### Cold startup

```text
this repo (3,471 files, 57 MiB)         9.4 ms ± 0.8 ms
Linux kernel (93,696 files, 2.0 GiB)    9.8 ms ± 0.4 ms
```

### Full `--all`

```text
this repo                               56.6 ms ± 3.1 ms   (~6.3x parallelism)
Linux kernel                            1.989 s ± 0.246 s  (~12.2x parallelism, ~1.05 GiB/s wall)
```

### vs betterleaks v1.1.2 (same content, `--all` vs `dir`; 2026-05-03)

```text
startup ratio                           ~24x
this repo, same content                 ~20x (28 ms vs 557 ms)
Linux kernel                            ~3.3x (1.6 s vs 5.3 s)
```

### vs betterleaks v1.1.2 (full tree, default modes; 2026-05-03)

```text
this repo                               ~2000x (43 ms vs 86.5 s)
                                        dominated by .gitignore respect:
                                        21 MiB scanned vs 4.28 GB scanned
```

Three architectural choices account for most of the per-byte gap:

1. **Dual Aho-Corasick gate with lazy regex dispatch.
   ** On clean files,
    both AC passes
   short-circuit before any regex engine runs.
    RE2 (betterleaks' engine) also
   keyword-prefilters,
    but its hit path verifies against the full DFA;
   `forbidden-strings` only queues `find_all` when an AC prefix is seen.
2. **Hybrid engine dispatch.
   ** 257 of 259 ported rules compile via the `regex` crate,
   which applies memchr / Teddy literal-prefix acceleration per-rule.
    RE2 compiles all
   rules into a shared DFA that cannot apply per-rule fast paths.
3. **Native binary startup.
   ** Rust LTO + `codegen-units = 1` + `opt-level = 3` +
   `panic = "unwind"` + `overflow-checks = true` + `strip = true`.
    Binary starts in
   ~9 ms. Go binary starts in ~174 ms (GC init,
    goroutine scheduler,
    config parse).
    For
   pre-commit hooks with sub-100 ms budgets,
    the startup gap alone disqualifies
   betterleaks.
    The unwind + overflow-checks pair is required for the resharp-panic
   safety wrapper to fail closed on engine corruption (Rust default release profile uses
   `panic = "abort"` and disables overflow checks;
    either flip leaves the scanner with a
   silent fail-open against a corrupt rule).
    See `Cargo.toml:49-97`.

The speed gap is not free;
 see "When to pick something else" for the capabilities
betterleaks ships that `forbidden-strings` deliberately omits.

## Debug

Three env vars print phase / bucket diagnostics to stderr;
 none affect output correctness,
so they are safe to enable in CI when investigating slow scans.

- `FORBIDDEN_STRINGS_DEBUG_TIMING=1`
  Per-phase wall time:
   `read_rules_file`,
   `classify+regex_compile`,
  `extract_gating_substrings`,
   `ac_build`,
   `residual_shards`.
- `FORBIDDEN_STRINGS_DEBUG_BUCKETS=1`
  Counts of literal rules,
   case-sensitive regex prefixes,
   case-insensitive regex
  prefixes,
   and residual rules (rules without an extractable literal prefix).
   Useful
  when tuning rule patterns to land more rules on the AC fast path.
- `FORBIDDEN_STRINGS_DEBUG_RESIDUAL_LIST=1`
  Implies `BUCKETS`.
   Adds the line number of every residual rule so you can look up
  which rules are paying the slower per-file scan.

## Fuzzing

Coverage-guided fuzzing for the scanner's regex routing,
 AC-gate extractor,
walker helpers,
 residual-shard partitioner,
 and hit formatter lives in its own
package,
 [`packages/fuzz/forbidden-strings`](../../fuzz/forbidden-strings/),
 so a
scoped nightly toolchain does not force this published crate onto nightly.
Targets are exercised locally and on demand only;
 CI integration is deferred.
See that package's [README](../../fuzz/forbidden-strings/README.md) for
prerequisites,
 the seven-target invariant list,
 mise commands,
 the
bounded-container wrapper,
 corpus and artifact policy,
 crash reproduction
guidance,
 and the soundness-by-revert validation step.

## Architecture

- **Two-phase pipeline.
  ** Rule loading (regex compile + AC build) and file walking
  (gitignore-aware enumeration) run concurrently via `rayon::join` since they share no
  state.
   After both complete,
   files fan out across the rayon thread pool for parallel
  scan.
- **Aho-Corasick literal gate.
  ** Every literal rule and every regex rule's extracted
  literal prefix joins a single AC automaton.
   Per file,
   the AC pass either finds zero
  hits (regex engine skipped entirely) or queues a follow-up regex evaluation for each
  prefix hit.
- **Residual-shard regex fallback.
  ** Regex rules without an extractable literal prefix
  (those starting with `~(...)`,
   a metacharacter,
   or a class) fall into a smaller
  residual gate that runs unconditionally.
   Slower per file than the AC path but still
  linear-time.
- **Self-skip for own rule files.
  ** `--all` walks skip a small set of paths
  unconditionally so rule bodies that match their own literal text do not
  self-flag:
   the materialized rules file plus four canonical
  self-match paths
  (`packages/cli/forbidden-strings/data/betterleaks-default-config.toml`,
  `packages/cli/forbidden-strings/src/port-betterleaks-relaxations.ts`,
  `forbidden-strings.local.example.txt` at repo root,
  and the rules-engine test-fixture file
  `packages/cli/forbidden-strings/src/rules/algebra_tests.rs` which
  documents an example match for the bundled set-algebra demo rule).
  Skip is path-anchored via `std::fs::canonicalize`,
   not basename-anchored,
  so an unrelated file named `forbidden-strings.local.txt` in a subdirectory
  is still scanned.
   Explicit positional arguments bypass the skip entirely.
  See `build_skip_set` / `is_walker_skipped` in `src/lib.rs`.
- **`ignore` crate walker + in-process gix-index union.
  ** `--all` uses
  `ignore::WalkBuilder` (which honours `.gitignore`,
   `.git/info/exclude`,
   and
  global excludes) and then unions the result with an in-process
  `gix_index::File` read of `.git/index` (no git subprocess) so files that
  were force-added past `.gitignore` (`git add -f`) are still discovered.
  See `src/walk.rs:394-518`.
- **Bundled `data/betterleaks-default-config.toml`.
  ** Upstream-vendored provenance for
  the betterleaks port.
   The committed `forbidden-strings.local.example.txt` is derived
  from it;
   `port-betterleaks-relaxations.ts` records the lossy translations applied during
  the port.
- **The 7-byte coincidence-rate threshold.
  ** A length-L literal in a case-sensitive
  alphabet of size A scanned over N random bytes has expected coincidence count
  ~= N * A^(-L).
   At L = 7,
   in 1 GB of dense base64 (A = 64) or random alphanumeric
  (A = 62) noise,
   the expected coincidence per rule is ~2.3e-4 and ~3.0e-4 respectively,
  comfortably under 1 across realistic repo sizes and noise types.
   At L = 6 the same
  calculation gives ~0.015 / ~0.019,
   which becomes borderline once a repo has multiple
  GB of dense content or 100+ deny-list rules.
   The constant `SUBSTRING_THRESHOLD` lives
  in `src/rules/types.rs`.
