# forbidden-strings

Linear-time deny-list scanner for Git repos, designed for the case where the rules themselves are sensitive.

Most secret-scanning tools (gitleaks, trufflehog, secretlint, betterleaks) ship rules in committed config files.
That breaks down when the forbidden literals would themselves leak if committed:
a customer name, a partner identifier, an internal codename, a pre-disclosure project name.
`forbidden-strings` keeps the rule file out of the repo entirely,
accepts it via env var or `--rules`,
and never prints the matched substring in failure output.
It is also ~20x faster per byte than betterleaks on a same-content scan,
with sub-10 ms startup that fits inside a pre-commit budget.

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
- **Pre-commit-budget startup**. ~9 ms cold start (Rust LTO + `panic = "abort"` + stripped
  binary, no Node startup, no WASM init, no per-invocation TOML parse). On clean files the
  dual Aho-Corasick gate short-circuits before the regex engine runs at all. Betterleaks
  starts in ~174 ms, which exceeds typical pre-commit budgets on its own. See Performance.

## When to pick something else

`forbidden-strings` deliberately omits features other scanners ship as core capabilities:

- **CEL-based post-match filtering** (entropy thresholds, BPE token efficiency, git-author
  predicates, file-path globs, string allowlists). Helps cut false positives when the rule
  corpus is broad. No equivalent here.
- **Async HTTP validation**. No way to call a provider API to confirm a detected secret is
  live. The scanner reports literal matches; staleness review is on you.
- **Git history scanning**. The walker enumerates working-tree files only. No equivalent of
  `gitleaks git` or `betterleaks git` that scans every diff in every commit.
- **SARIF / JSON / CSV output**. Hits go to stderr as plain text. No machine-readable
  format for GitHub code-scanning upload or CI dashboards.
- **Per-rule path scoping**. Every rule runs against every (non-skipped) file. The scanner
  cannot apply rule X only to YAML files.
- **Per-rule allowlists**. No way to say "rule X but skip when it matches in path Y."

If you need any of those, betterleaks or gitleaks is the right tool. Otherwise
`forbidden-strings` is faster and more expressive (set-algebra, out-of-band rules,
redacted output, native binary startup).

## Prerequisites

- **Rust toolchain**. Install via mise: `mise install rust`.
- **mise** itself, since build commands are `mise run` tasks.
- **For local git hooks**: `hk` (the hook runner) and `pkl` (its config language). Both
  are available via mise / aqua: `mise install 'aqua:jdx/hk' 'aqua:apple/pkl'`.

## Build

```sh
mise run //packages/cli/forbidden-strings:build
```

The release binary lands at `packages/cli/forbidden-strings/target/release/forbidden-strings`.
`hk.pkl` invokes that path directly; nothing needs to be on `$PATH`.

## Usage

First-run setup: copy the committed example deny-list to the conventional local filename
so the scanner finds rules without further configuration:

```sh
cp forbidden-strings.local.example.txt forbidden-strings.local.txt
```

Then:

```sh
# scan a specific file list (uses ./forbidden-strings.local.txt by default)
forbidden-strings path/to/file other/file

# scan every git-tracked file (respects .gitignore)
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

## Rule file format

One rule per line. Two shapes:

- A bare line is a case-sensitive literal. Match semantics depend on length:
  - **Length below 7 bytes**: conditional word-boundary check (`grep -w` semantics).
    A boundary is required at any end whose edge byte is a word character (`[A-Za-z0-9_]`);
    the file context on that side must be either start/end of file or a non-word byte.
    A short alpha-only acronym matches a standalone occurrence in normal prose but
    does **not** match coincidentally as a substring of a longer identifier or inside
    random base64 noise. Path-shaped literals like `/etc/passwd` still match inside
    `cat /etc/passwd` because the leading `/` is non-word so no left-side boundary
    is enforced.
  - **Length 7 bytes or more**: pure case-sensitive substring match, no boundary check.
    A long literal matches anywhere it appears, including glued mid-identifier.
    Distinctiveness from sheer length makes coincidental substring match negligible.
    If a phrase exists in two written forms (with and without internal whitespace),
    add both as separate rules so each matches its respective form.
- A line of the shape `/PATTERN/FLAGS` is a regex. The first `/` and last `/` delimit the
  pattern; `FLAGS` is zero or more lowercase letters and is rewritten to a resharp
  inline-flag prefix (e.g. `/foo/i` becomes `(?i)foo`). Use this form to opt into
  substring-anywhere semantics for short literals (write the literal between the slashes),
  or to ban literals matching `^/.+/[a-z]*$` (escape the slashes, e.g. ban the literal
  `/etc/passwd` as `/\/etc\/passwd/`).

Empty lines are ignored. Lines starting with `#` are comments.

The 7-byte threshold has a coincidence-rate justification; see Architecture below
for the derivation and `SUBSTRING_THRESHOLD` in `src/rules/types.rs` for the constant.

**One known regression** under these semantics: a short literal rule will not match a
plural or suffixed form (a 3-letter acronym does not match the same acronym followed
immediately by `s`, because the trailing `s` is a word char and the boundary fails). If
plural matching is needed, express the rule as a regex with an optional trailing class:
`/ACRONYMs?/`.

### Set-algebra operators

Resharp extends standard regex with two top-level set operators that pure-PCRE engines lack:

- `A&B`: intersection. Matches strings matched by both `A` and `B`.
- `~(A)`: complement. Matches strings that do NOT match `A`.

Combined, these express "match X but not Y" without lookaround. Example: ban any
five-digit key except the all-zeros placeholder:

```text
/key_[0-9]{5}&~(key_0{5})/
```

This flags `key_12345` and `key_99999` but lets `key_00000` through. Class-level forms
`[A&&B]` (intersection) and `[A~~B]` (symmetric difference) are also available inside
character classes.

Underscore is a resharp meta character. Unescaped `_` is the top pattern, which matches
any single codepoint. Escape a literal underscore as `\_`, including inside algebra
operands such as `ghp\_...&~(ghp\_0{36})`.

The scanner extracts required literal bytes from regex rules and folds them into a
shared Aho-Corasick gate so the regex engine only runs on files that contain a required
substring. For set-algebra rules, intersection `&` is a transparent separator and
complement `~(...)` bodies never contribute gates because they describe excluded strings,
not required bytes. A pattern that starts with literal bytes (`key_[0-9]{5}&~(...)`
extracts `key_`) stays on the fast path. A pattern that starts with `~(...)` or another
metacharacter falls into a smaller residual gate, still correct, just slower per file.
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

```text
forbidden-strings: rule on line 42 (resharp): complement body contains \b;
resharp 0.5.x rewrites it to an internal lookaround which the reverse pass
refuses. Replace with \W ... See TROUBLESHOOTING.resharp.md for workarounds.
```

The doc at `TROUBLESHOOTING.resharp.md` in the repository root has the full
trace, more workarounds, and the upstream-issue draft.

### Perl-class shorthand semantics

The scanner compiles rules in byte mode for speed (`regex::bytes` with
`unicode(false)`), which would normally make every Perl-class shorthand
ASCII-only. Two semantics survive that mode:

- **`\s`: Unicode-aware.** Matches every Unicode whitespace code point's
  UTF-8 bytes: ASCII whitespace (`\t \n \v \f \r ` ), NBSP (U+00A0),
  ogham space (U+1680), Mongolian vowel separator (U+180E), en-quad
  through hair space (U+2000..U+200A), line/paragraph separator
  (U+2028..U+2029), narrow NBSP (U+202F), medium math space (U+205F),
  ideographic space (U+3000), zero-width NBSP (U+FEFF). Realised by
  expanding the rule source so each `\s` becomes a non-capturing
  alternation of ASCII whitespace and the multi-byte UTF-8 sequences.
  A rule like `(?i)adafruit[\s]+=` correctly matches
  `adafruit<NBSP>=` in JS/TS files.
- **`\S`, `\w`, `\W`, `\d`, `\D`, `\b`, `\B`: byte-level (ASCII).**
  Match the PCRE default (ASCII subset). For secret patterns these
  semantics match author intent: `\d{16}` for a credit card means
  ASCII digits, `\b(pat_...)` boundaries against literal prefixes
  fire on ASCII context, `[\w.-]{0,N}` optional prefixes never
  block a match. Authors who need genuinely Unicode-aware behaviour
  for these atoms can opt in with the `(?u)` flag, which routes the
  rule to the slower full-Unicode compile path.

The asymmetry between `\s` and the rest is pragmatic: `\s` has a
real bug repro (NBSP in JS/TS files) with a tractable byte-alternation
expansion, while `\W`/`\D`/`\B` have zero uses in the betterleaks
corpus and `\S`/`\w`/`\d`/`\b` are all used in shapes where
byte-level semantics produce no silent miss. See PERF.md for the
per-atom analysis.

### Supported regex flags

The flag string accepts these lowercase letters, applied via resharp's inline-flag group:

- `i`: case-insensitive.
- `m`: multiline (`^`/`$` match at line boundaries).
- `s`: dot-matches-newline.
- `u`: toggle Unicode `\w`/`\d` semantics.
- `x`: ignore whitespace and `#` comments inside the pattern.

Resharp's parser also recognises `U` (swap greed) and `R` (CRLF line terminators),
but the validator deliberately rejects uppercase flags. Both are useless in this scanner:
`U` only affects match span length (not whether something matched), and the rare pattern
that needs CRLF-aware anchors can write `\r?$` directly. If you ever need them locally
inside one pattern, use the inline form: `(?U)foo` or `(?R)bar`.

## Integration

### Local (hk)

`hk` replaces husky for this repo. Wire git hooks once per machine:

```sh
hk install --global   # recommended; needs Git 2.54+
# or, per-repo:
hk install
```

`hk.pkl` registers `forbidden-strings` for the `pre-commit`, `pre-push`, and `check`
hooks, so every commit, every push, and every explicit `hk check` runs the scanner
against the relevant files.

### GitHub Actions

Materialize the rule file from a repository secret at job-start;
the workflow YAML never echoes the secret value:

```yaml
- name: Materialize rule file
  env:
    RULES: ${{ secrets.FORBIDDEN_STRINGS_LIST }}
  run: |
    cp forbidden-strings.local.example.txt forbidden-strings.local.txt
    if [ -n "$RULES" ]; then
      printenv RULES >> forbidden-strings.local.txt
    fi

- name: Build scanner
  run: mise run //packages/cli/forbidden-strings:build

- name: Scan (PR / merge_group)
  if: github.event_name != 'push'
  run: mise exec -- hk check --from-ref origin/main

- name: Scan (push to main)
  if: github.event_name == 'push'
  run: |
    packages/cli/forbidden-strings/target/release/forbidden-strings \
      --rules forbidden-strings.local.txt --all
```

Pipe via `printenv > file` rather than interpolating the secret into a `run:` block;
shell expansion in the latter can leak the value to the log even with GitHub's masking.
The full workflow lives at `.github/workflows/forbidden-strings.yml`; PR / merge_group
events run `hk check` against changed files, push-to-main additionally runs `--all`.

## Output

For each violation:

```text
PATH:LINE:COL_START..COL_END rule=N
```

Columns are 1-based byte offsets within the matched line.
**The matched substring is never printed.** Only the path, line number, column range,
and the opaque rule index appear in failure output; otherwise a failing CI log
becomes a leak surface. A contributor wanting to know which rule fired looks up the
index against their local rule file.

Exit codes:

- `0`: no violations.
- `1`: one or more violations.
- `2`: usage error or rules-file error.

## Performance

Measured on an AMD Ryzen 7 8700F (16 threads). Full bench methodology and per-version
regression history are in `PERF.md`.

### This repo (Monochromatic)

3,471 git-tracked files, 57 MiB total. 30 runs, hyperfine 1.20.0:

```text
startup-only      8.8 ms ± 0.5 ms
--all            58.6 ms ± 3.4 ms    (~973 MiB/s wall, 6.3x parallelism)
```

### Linux kernel scale

Fresh shallow clone of `torvalds/linux`. 93,696 git-tracked files, 2.0 GiB. 15 runs:

```text
startup-only      9.8 ms ± 0.4 ms
--all            1.901 s ± 0.190 s   (~1.05 GiB/s wall, 12.2x parallelism)
```

The 2026-05-16 audit closed 11 soundness bugs, then a perf-fix pass
restored `--all` wall to within 7 ms of the pre-audit baseline by
replacing the `git ls-files` subprocess with an in-process `gix-index`
read and bounding per-file binary-scan cost at 8 KiB (see
`PERF.md` "post-perf-fix" block for the bench tables). The
remaining soundness work (`\s` expansion, force-added gitignored
files, NUL-bearing text files with secrets in the first 8 KiB,
read errors as hits) is preserved end-to-end.

### vs betterleaks v1.1.2

Betterleaks is the upstream source for the bundled rule corpus
(`data/betterleaks-default-config.toml`), making it the most relevant baseline.
Same-content scan, `--all` (forbidden-strings) vs `dir` (betterleaks) on identical file sets:

```text
                    forbidden-strings   betterleaks   ratio
startup              7.3 ms              174 ms        ~24x
Mono same-content    28 ms               557 ms        ~20x
Linux kernel         1.6 s               5.3 s         ~3.3x
per-byte (kernel)    ~1.0 GB/s           ~0.3 GB/s     ~3.3x
```

Real-world Monochromatic (`forbidden-strings` respects `.gitignore`; `betterleaks dir`
walks the full tree including `node_modules/`, `target/`, vendored content):

```text
forbidden-strings --all   43 ms    (21 MiB scanned)
betterleaks dir           86.5 s   (4.28 GB scanned)
```

The 2000x wall-clock ratio is data-volume-dominated, but the data-volume difference is
real and user-observable: any workflow that scans the working tree has to choose between
walking the whole filesystem or honouring `.gitignore`, and `forbidden-strings` makes the
latter choice by default.

Three architectural choices account for most of the per-byte gap:

1. **Dual Aho-Corasick gate with lazy regex dispatch.** On clean files, both AC passes
   short-circuit before any regex engine runs. RE2 (betterleaks' engine) also
   keyword-prefilters, but its hit path verifies against the full DFA;
   `forbidden-strings` only queues `find_all` when an AC prefix is seen.
2. **Hybrid engine dispatch.** 257 of 259 ported rules compile via the `regex` crate,
   which applies memchr / Teddy literal-prefix acceleration per-rule. RE2 compiles all
   rules into a shared DFA that cannot apply per-rule fast paths.
3. **Native binary startup.** Rust LTO + `panic = "abort"` + stripped binary starts in
   ~9 ms. Go binary starts in ~174 ms (GC init, goroutine scheduler, config parse). For
   pre-commit hooks with sub-100 ms budgets, the startup gap alone disqualifies
   betterleaks.

The speed gap is not free; see "When to pick something else" for the capabilities
betterleaks ships that `forbidden-strings` deliberately omits.

## Fuzzing

Coverage-guided fuzzing for the scanner's regex routing, AC-gate extractor,
walker helpers, residual-shard partitioner, and hit formatter lives in
[`fuzz/`](./fuzz/). Targets are exercised locally and on demand only;
CI integration is deferred. See [FUZZING.md](./FUZZING.md) for prerequisites,
the seven-target invariant list, mise commands, the bounded-container
wrapper, corpus and artifact policy, crash reproduction guidance, and
the soundness-by-revert validation step.

## Architecture

- **Two-phase pipeline.** Rule loading (regex compile + AC build) and file walking
  (gitignore-aware enumeration) run concurrently via `rayon::join` since they share no
  state. After both complete, files fan out across the rayon thread pool for parallel
  scan.
- **Aho-Corasick literal gate.** Every literal rule and every regex rule's extracted
  literal prefix joins a single AC automaton. Per file, the AC pass either finds zero
  hits (regex engine skipped entirely) or queues a follow-up regex evaluation for each
  prefix hit.
- **Residual-shard regex fallback.** Regex rules without an extractable literal prefix
  (those starting with `~(...)`, a metacharacter, or a class) fall into a smaller
  residual gate that runs unconditionally. Slower per file than the AC path but still
  linear-time.
- **Self-skip for own rule files.** `--all` walks skip a small set of paths
  unconditionally so rule bodies that match their own literal text do not
  self-flag: the materialized rules file plus the canonical generated-source
  paths (`forbidden-strings.local.example.txt`,
  `data/betterleaks-default-config.toml`, `port-betterleaks-relaxations.ts`).
  Skip is path-anchored via `std::fs::canonicalize`, not basename-anchored,
  so an unrelated file named `forbidden-strings.local.txt` in a subdirectory
  is still scanned. Explicit positional arguments bypass the skip entirely.
  See `build_skip_set` / `is_walker_skipped` in `src/main.rs`.
- **`ignore` crate walker + git ls-files union.** `--all` uses
  `ignore::WalkBuilder` (which honours `.gitignore`, `.git/info/exclude`, and
  global excludes) and then unions the result with `git ls-files --cached
  --ignored --exclude-standard` so files that were force-added past
  `.gitignore` (`git add -f`) are still discovered. See `src/walk.rs`.
- **Bundled `data/betterleaks-default-config.toml`.** Upstream-vendored provenance for
  the betterleaks port. The committed `forbidden-strings.local.example.txt` is derived
  from it; `port-betterleaks-relaxations.ts` records the lossy translations applied during
  the port.
- **The 7-byte coincidence-rate threshold.** A length-L literal in a case-sensitive
  alphabet of size A scanned over N random bytes has expected coincidence count
  ~= N * A^(-L). At L = 7, in 1 GB of dense base64 (A = 64) or random alphanumeric
  (A = 62) noise, the expected coincidence per rule is ~2.3e-4 and ~3.0e-4 respectively,
  comfortably under 1 across realistic repo sizes and noise types. At L = 6 the same
  calculation gives ~0.015 / ~0.019, which becomes borderline once a repo has multiple
  GB of dense content or 100+ deny-list rules. The constant `SUBSTRING_THRESHOLD` lives
  in `src/rules/types.rs`.
