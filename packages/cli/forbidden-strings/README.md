# forbidden-strings

A linear-time deny-list scanner for Git repos, designed for the case where the rules themselves are sensitive.

Most secret-scanning tools (gitleaks, trufflehog, secretlint) ship rules in committed config files and rely on `keywords` prefilters.
That breaks down when the forbidden literals would themselves leak if committed:
a customer name, a partner identifier, an internal codename, a pre-disclosure project name.
`forbidden-strings` keeps the rule file out of the repo entirely,
accepts it via env var or `--rules`,
and never prints the matched substring in failure output.

## What's different

- **Resharp set-algebra rules**. `A&B` (intersection) and `~(A)` (complement) are first-class.
  Express "match X but not Y" without lookaround. PCRE-family engines (gitleaks, trufflehog,
  secretlint, plain RE2) cannot do this; the workaround in those tools is per-rule allowlists,
  which scale badly.
- **Out-of-band rules**. `--rules <path>` or `FORBIDDEN_STRINGS_RULES`.
  CI materializes the rule file from a repository secret;
  contributors keep a gitignored copy locally. No rule ever lives in a committed file.
- **Redacted output**. Only `path:line:cols rule=N` is printed.
  The matched substring, surrounding line, and rule pattern never appear in the failure log,
  so a public CI log is not itself a leak surface.
- **Linear-time matching**. Resharp is derivative-based with no backtracking;
  Aho-Corasick gates the regex engine via extracted literal prefixes.
  A pathological rule combination cannot exhibit catastrophic-backtracking behavior.
- **Native Rust binary, no startup tax**. Full-repo scan over 2,700 files in ~16 ms;
  1,000-rule synthetic in ~27 ms; pre-commit hot path well under 5 ms.
  No Node startup, no WASM init, no per-invocation TOML parse.

## When to pick something else

If the rule set can ship in the repo and set-algebra is unnecessary, gitleaks or betterleaks
is probably a better fit: larger ecosystem, SARIF output, GitHub-native code-scanning upload,
allowlist files keyed on path globs.
The niche `forbidden-strings` fills is "rules that cannot be committed AND the rule grammar
needs operators PCRE doesn't have"; pick it when one of those two is the binding constraint.

## Build

```sh
mise run //packages/dev-script/forbidden-strings:build
```

The release binary lands at `packages/dev-script/forbidden-strings/target/release/forbidden-strings`.
`hk.pkl` invokes that path directly; nothing needs to be on `$PATH`.

## Usage

```sh
# scan a specific file list (uses ./forbidden-strings.local.txt by default)
forbidden-strings path/to/file other/file

# scan every git-tracked file (respects .gitignore via git ls-files)
forbidden-strings --all
```

The rules path is resolved in this order: `--rules <PATH>` flag, then
`FORBIDDEN_STRINGS_RULES` env var, then `./forbidden-strings.local.txt`
in the current working directory.

```sh
# explicit path
forbidden-strings --rules ./other-rules.txt --all

# via env var (CI-friendly: materialize from a secret, then run)
FORBIDDEN_STRINGS_RULES=./materialized.txt forbidden-strings --all
```

## Local hook setup

`hk` replaces husky for this repo. Wire git hooks once per machine:

```sh
hk install --global   # recommended; needs Git 2.54+
# or, per-repo:
hk install
```

Then `git commit` runs the `pre-commit` hook defined in `hk.pkl`,
which in turn runs this scanner against the staged files.

## CI integration (GitHub Actions)

Materialize the rule file from a repository secret at job-start;
the workflow YAML never echoes the secret value:

```yaml
- name: Materialize rule file
  env:
    RULES: ${{ secrets.FORBIDDEN_STRINGS_LIST }}
  run: printenv RULES > forbidden-strings.local.txt

- name: Build scanner
  run: mise run //packages/dev-script/forbidden-strings:build

- name: Scan
  run: hk check --from-ref origin/main
```

Pipe via `printenv > file` rather than interpolating the secret into a `run:` block;
shell expansion in the latter can leak the value to the log even with GitHub's masking.

## Rule file format

One rule per line. Two shapes:

- A bare line is a case-sensitive literal. Match semantics depend on length:
  - **Length below 7 bytes**: conditional word-boundary check (`grep -w` semantics).
    A boundary is required at any end whose edge byte is a word character (`[A-Za-z0-9_]`);
    the file context on that side must be either start/end of file or a non-word byte.
    So a short alpha-only acronym matches a standalone occurrence in normal prose but
    does **not** match coincidentally as a substring of a longer identifier or inside
    random base64 noise. Path-shaped literals like `/etc/passwd` still match inside
    `cat /etc/passwd` because the leading `/` is non-word so no left-side boundary
    is enforced.
  - **Length 7 bytes or more**: pure case-sensitive substring match, no boundary check.
    A long literal matches anywhere it appears, including glued mid-identifier.
    Distinctiveness from sheer length makes coincidental substring match negligible.
    If a phrase exists in two written forms (with and without internal whitespace),
    add both as separate rules so each matches its respective form.
- A line of the shape `/PATTERN/FLAGS` is a regex. The first `/` and last `/` delimit the pattern;
  `FLAGS` is zero or more lowercase letters and is rewritten to a resharp inline-flag prefix
  (e.g. `/foo/i` becomes `(?i)foo`). Use this form to opt into substring-anywhere semantics
  for short literals (write the literal between the slashes), or to ban literals matching
  `^/.+/[a-z]*$` (escape the slashes, e.g. ban the literal `/etc/passwd` as `/\/etc\/passwd/`).

Empty lines are ignored. Lines starting with `#` are comments.

The 7-byte threshold for word-bounded vs substring-anywhere comes from a coincidence-rate
calculation: a length-L literal in a case-sensitive alphabet of size A scanned over N random
bytes has expected coincidence count ~= N * A^(-L). At L = 7, in 1 GB of dense base64 (A = 64)
or random alphanumeric (A = 62) noise, the expected coincidence per rule is ~2.3e-4 and
~3.0e-4 respectively, comfortably under 1 across realistic repo sizes and noise types.
At L = 6 the same calculation gives ~0.015 / ~0.019, which becomes borderline once a repo
has multiple GB of dense content or 100+ deny-list rules. See `SUBSTRING_THRESHOLD` in
`src/rules.rs` for the threshold constant and derivation.

**One known regression** under the new semantics: a short literal rule will not match a
plural or suffixed form (e.g. a 3-letter acronym does not match the same acronym followed
immediately by `s`, because the trailing `s` is a word char and the boundary fails). If
plural matching is needed, express the rule as a regex with an optional trailing class:
`/ACRONYMs?/`.

### Set-algebra operators

Resharp extends standard regex with two top-level set operators that pure-PCRE engines lack:

- `A&B` -- intersection: matches strings matched by both `A` and `B`
- `~(A)` -- complement: matches strings that do NOT match `A`

Combined, these express "match X but not Y" without lookaround. Example: ban any
five-digit key except the all-zeros placeholder:

```
/key_[0-9]{5}&~(key_0{5})/
```

This flags `key_12345` and `key_99999` but lets `key_00000` through. Class-level forms
`[A&&B]` (intersection) and `[A~~B]` (symmetric difference) are also available inside
character classes.

The scanner extracts a leading literal prefix from each regex rule and folds it into a
shared Aho-Corasick gate so the regex engine only runs on files that contain the prefix.
A pattern that starts with literal bytes (`key_[0-9]{5}&~(...)` extracts `key_`) stays on
the fast path. A pattern that starts with `~(...)` or another metacharacter falls into a
smaller residual gate, still correct, just slower per file.
Extracted prefixes preserve the regex source's original UTF-8 bytes verbatim, so a rule
whose leading literal contains non-ASCII characters (em-dash `—`, smart quotes, ellipsis,
emoji) gates correctly against file content holding the same bytes; a walker that
mojibake'd those bytes during extraction would silently disable the rule by registering
a pattern AC could never match.

#### Complement-body limitations (resharp 0.5.x)

Resharp 0.5.x cannot reverse a complement whose body contains a lookaround. The
parser rewrites several surface atoms to internal lookarounds, so the following
shapes fail at compile time:

- `\b` inside a `~(...)` body. Rewritten to negative-lookahead /
  negative-lookbehind by the parser, then refused. Workaround: replace `\b` with
  `\W` (consumes a character on each side) or with literal whitespace, or move
  the boundary check outside the complement.
- `\B` inside a `~(...)` body. Refused at parse time when the neighbours are
  unclassifiable. No in-place rewrite; restructure the rule.
- Unescaped `^` or `$` inside a `~(...)` body. Rewritten to lookbehind /
  lookahead in default-multiline mode and then refused. Workaround: use `\A` /
  `\z` for whole-content anchors, or move the anchor outside the complement.
  Inline `(?-m)` and group-scoped `(?-m:^foo$)` do NOT propagate into the
  complement body, so neither works as a workaround in resharp 0.5.x.
- User-explicit lookarounds (`(?=`, `(?!`, `(?<=`, `(?<!`) inside a `~(...)`
  body. Refused for the same reason as the rewritten cases. Lift the lookaround
  outside the complement.

`forbidden-strings` detects every shape above at rule load time and reports the
specific trigger:

```
forbidden-strings: rule on line 42 (resharp): complement body contains \b;
resharp 0.5.x rewrites it to an internal lookaround which the reverse pass
refuses. Replace with \W ... See TROUBLESHOOTING.resharp.md for workarounds.
```

The doc at `TROUBLESHOOTING.resharp.md` in the repository root has the full
trace, more workarounds, and the upstream-issue draft.

### Supported regex flags

The flag string accepts these lowercase letters, applied via resharp's inline-flag group:

- `i` -- case-insensitive
- `m` -- multiline (`^`/`$` match at line boundaries)
- `s` -- dot-matches-newline
- `u` -- toggle Unicode `\w`/`\d` semantics
- `x` -- ignore whitespace and `#` comments inside the pattern

Resharp's parser also recognises `U` (swap greed) and `R` (CRLF line terminators),
but the validator deliberately rejects uppercase flags. Both are useless in this scanner:
`U` only affects match span length (not whether something matched), and the rare pattern
that needs CRLF-aware anchors can write `\r?$` directly. If you ever need them locally
inside one pattern, use the inline form: `(?U)foo` or `(?R)bar`.

## Output

For each violation:

```
PATH:LINE:COL_START..COL_END rule=N
```

Columns are 1-based byte offsets within the matched line.
**The matched substring is never printed.** Only the path, line number, column range,
and the opaque rule index appear in failure output; otherwise a failing CI log
becomes a leak surface. A contributor wanting to know which rule fired looks up the
index against their local rule file.

Exit codes:

- `0` -- no violations
- `1` -- one or more violations
- `2` -- usage error or rules-file error

## Performance

Measured against this repo (2,700 files, 21 MiB) on an AMD Ryzen 7 8700F:

- Realistic ruleset (17 rules), startup-only: **1.2 ms**
- Realistic ruleset, full-repo `--all`: **15.5 ms** (~1.4 GiB/s end-to-end)
- Synthetic 1,000-rule (500 literals + 500 prefixed regex), full-repo `--all`: **27 ms**
- Pathological case: 1,000,000 hits in a single 43 MB file: **1.5 s wall**

Detailed benchmarks, methodology, and the rationale for rejected optimizations
(mmap, extension pre-filtering, concat-and-scan) live in `PERF.md`.
