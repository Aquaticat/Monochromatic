# forbidden-strings

Rust scanner that blocks an enumerable list of forbidden literals and regexes from landing in committed files.
The deny-list itself is sensitive and never committed -- contributors maintain a local file,
CI materializes it from a repository secret.

See `TODO.forbidden-strings.md` at the repo root for the full design doc, threat model,
performance budget, and the rationale for choosing resharp over alternatives.

## Build

```sh
mise run //packages/dev-script/forbidden-strings:build
```

The release binary lands at `packages/dev-script/forbidden-strings/target/release/forbidden-strings`.
`hk.pkl` invokes that path directly; nothing needs to be on `$PATH`.

## Local hook setup

`hk` replaces husky for this repo. Wire git hooks once per machine:

```sh
hk install --global   # recommended; needs Git 2.54+
# or, per-repo:
hk install
```

Then `git commit` runs the `pre-commit` hook defined in `hk.pkl`,
which in turn runs this scanner against the staged files.

## Usage

```sh
# scan a specific file list
forbidden-strings --rules ./forbidden-strings.local.txt path/to/file other/file

# scan every git-tracked file (respects .gitignore via git ls-files)
forbidden-strings --rules ./forbidden-strings.local.txt --all
```

The rules path can also be set via `FORBIDDEN_STRINGS_RULES`:

```sh
FORBIDDEN_STRINGS_RULES=./forbidden-strings.local.txt forbidden-strings --all
```

## Rule file format

One rule per line. Two shapes:

- A bare line is a case-sensitive literal substring.
- A line of the shape `/PATTERN/FLAGS` is a regex. The first `/` and last `/` delimit the pattern;
  `FLAGS` is zero or more lowercase letters and is rewritten to a resharp inline-flag prefix
  (e.g. `/foo/i` becomes `(?i)foo`).

Empty lines are ignored. Lines starting with `#` are comments.
A literal that itself matches `^/.+/[a-z]*$` must be expressed as a regex
(escape the slashes, e.g. ban the literal `/etc/passwd` as `/\/etc\/passwd/`).

## Output

For each violation:

```
PATH:LINE:COL_START..COL_END rule=N
```

Columns are 1-based byte offsets within the matched line.
**The matched substring is never printed.** Only the path, line number, column range,
and the opaque rule index appear in failure output -- otherwise a failing CI log
becomes a leak surface.

Exit codes:

- `0` -- no violations
- `1` -- one or more violations
- `2` -- usage error or rules-file error
