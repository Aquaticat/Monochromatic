# markdownlint-cli2 0.22.1: bare `.` plus a second arg bypasses the dot-only remap and OOMs reading non-markdown files

## Symptom

A mise task whose `run` field hard-codes `markdownlint-cli2 .` works when invoked
with no extra arguments, but OOMs after roughly 30 to 50 seconds when invoked with
positional arguments via `mise run lint:markdownlint -- <path>`:

```text
$ mise run lint:markdownlint -- packages/config/oxlint-stylistic/README.md
[//:lint:markdownlint] $ markdownlint-cli2 . packages/config/oxlint-stylistic/R...
markdownlint-cli2 v0.22.1 (markdownlint v0.40.0)
Finding: . packages/config/oxlint-stylistic/README.md !node_modules/** !dist/** !.dist/** !bak/**
<--- Last few GCs --->
[927285:0x285b2000]    26112 ms: Mark-Compact 4016.7 (4124.1) -> 3992.6 (4127.6) MB, ...
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

Reproducible with the binary directly, no mise involvement needed:

```sh
markdownlint-cli2 . packages/config/oxlint-stylistic/README.md  # OOMs
markdownlint-cli2 . README.md                                   # OOMs
markdownlint-cli2 . .                                           # OOMs
markdownlint-cli2 .                                             # works
markdownlint-cli2 packages/config/oxlint-stylistic/README.md    # works
```

The failure shape is "any time `.` appears alongside another positional argument".

## Root cause

Two upstream behaviours combine.

### 1. The dot-only remap is gated on `globPatterns.length === 1`

`markdownlint-cli2.mjs:28` defines the substitute pattern, and
`markdownlint-cli2.mjs:219` gates the remap on the patterns array having
exactly one element:

```js
const dotOnlySubstitute = '*.{md,markdown}';
// ...
if ((globPatterns.length === 1) && (globPatterns[0] === '.')) {
  // Substitute a more reasonable pattern
  globPatterns[0] = dotOnlySubstitute;
}
```

The `--help` output documents this case:

```text
Dot-only glob:
- The command "markdownlint-cli2 ." would lint every file in the current
  directory tree which is probably not intended
- Instead, it is mapped to "markdownlint-cli2 *.{md,markdown}" which lints
  all Markdown files in the current directory
- To lint every file in the current directory tree, the command
  "markdownlint-cli2 **" can be used instead
```

When mise's `run = "markdownlint-cli2 ."` is invoked with `--`-forwarded args,
mise appends them, producing `markdownlint-cli2 . <path>`. Now `length === 2`,
the guard fails, and `.` is passed verbatim to globby. globby then walks every
file in the working tree, not just markdown files (the substitute pattern was
the only thing limiting the match to `*.{md,markdown}`).

### 2. globby's gitignore default is off

`markdownlint-cli2.mjs:981` only enables gitignore when the user opts in via
configuration:

```js
const gitignore = baseMarkdownlintOptions.gitignore === true;
```

`.markdownlint-cli2.jsonc` does not set `gitignore`, so the walk in step 1
respects only the four config-level negative globs (`node_modules/**`,
`dist/**`, `.dist/**`, `bak/**`). Everything else in the tree, including
gitignored artefacts, is matched.

### 3. Matched files are read into memory and parsed as markdown

`markdownlint-cli2.mjs:478-481` collects all matches into a single in-memory
array, and each file is later read fully into a string for parsing:

```js
const files = [
  ...await globby(filteredGlobPatterns, globbyOptions,),
  ...filteredLiteralFiles,
];
```

In this repo the walk pulls in a 3.97 GB qcow2 VM disk image at
`packages/dev-script/vm-builder/output/qcow2/disk.qcow2` plus several other
multi-megabyte binaries (Rust debug binaries, git pack files). Reading the
qcow2 into a string allocates roughly 4 GB on the V8 heap, which hits Node's
default 4 GB limit before the file is fully loaded. The mark-compact loops in
the OOM trace are V8 trying to reclaim space inside that single string
allocation.

## Verification

Tested against:

- `markdownlint-cli2@0.22.1` (commit `996abf6` in this repo's clone of
  `DavidAnson/markdownlint-cli2`)
- `markdownlint@0.40.0` (the bundled engine version)
- Node 22.x via mise-managed toolchain

Patterns that work cleanly:

- `markdownlint-cli2 .` (lone argument, remap applies)
- `markdownlint-cli2 packages/config/oxlint-stylistic/README.md`
- `markdownlint-cli2 README.md AGENTS.md`
- `markdownlint-cli2 '**/*.md'` on small trees

Patterns that fail with OOM in this repo:

- `markdownlint-cli2 . <any-other-arg>` (remap bypassed, full walk)
- `markdownlint-cli2 . .` (same, the second `.` does not collapse)
- `markdownlint-cli2 packages` (directory arg, full sub-walk)
- `markdownlint-cli2 '**/*.md' README.md` (hangs at 15+ seconds in this repo,
  appears to be a separate corpus/negation-globbing slowdown, not OOM)

The OOM is environment-dependent: a tree without multi-gigabyte files would
still get the wrong file set (binaries, lockfiles, etc. linted as markdown)
but would not necessarily crash the process. The trigger is the same; only
the heap pressure differs.

## Verified workarounds

### A. Make the mise task argument-aware (the fix this repo took)

`mise.toml`:

```toml
[tasks."lint:markdownlint"]
hide = true
description = "Lint Markdown with markdownlint-cli2, optionally restricted to specific files"
usage = 'arg "[args]" var=#true help="Markdown file paths (when provided, only those files are linted)"'
run = """
let args = ($env.usage_args? | default '' | str trim | split row ' ' | where {|p| $p != '' })
if ($args | is-empty) {
  markdownlint-cli2 .
} else {
  markdownlint-cli2 ...$args
}
"""
```

Tradeoffs:

- File paths with spaces break because the split is on the literal space
  character. Source-tree markdown paths in this repo do not contain spaces;
  if that changes, switch to the `nu -c $"echo ($args)"` evaluation pattern
  used by the `test` task at `mise.toml:268-269` to round-trip through
  shell-quoting.
- The `.` fallback still walks the full tree when no args are provided. That
  path goes through the remap and lints only `*.{md,markdown}` at top level,
  so it does not OOM, but it also does not recurse into subdirectories.
  Whole-repo recursive linting requires `markdownlint-cli2 '**/*.md'` or
  expanding the config `globs` array.

### B. Set `"gitignore": true` in `.markdownlint-cli2.jsonc`

Adds gitignore filtering to globby so the 3.97 GB qcow2 (and other gitignored
artefacts) are excluded even when the dot-only remap is bypassed. Does not
fix the underlying argv pattern; the next user who passes `. <file>` still
gets a full tree walk, just over a smaller file set.

Tradeoffs:

- Does not catch non-gitignored binaries (a checked-in PDF, for example,
  would still be read).
- Independent of workaround A; can be combined for defense in depth.

This repo did not apply B because A removes the failure mode entirely and B
on its own leaves the door open for future heavy files.

### C. Use `--no-globs` and pass explicit files only

For task definitions that need to accept arbitrary file lists,
`markdownlint-cli2 --no-globs <file> [<file>...]` disables the config-level
`globs` array and lints only the explicit arguments.

Tradeoffs:

- Loses any positive globs the project has configured in
  `.markdownlint-cli2.jsonc` (this repo has none, so loss is zero).
- Still does not protect against the `. <file>` shape; the `.` is still a
  positional argument and still expanded by globby.

## What does not work

- Adding `!packages/dev-script/vm-builder/output/**` and `!**/*.qcow2` to the
  config `ignores`: tested, still OOMs. Other large binaries in the tree
  (Rust debug binaries at 43-94 MB each, the git pack at 37 MB) keep the
  heap pressure high enough to crash even without the qcow2.
- Expecting `markdownlint-cli2` to filter to text files by extension before
  reading: it does not. globby's match is filename-pattern only; files that
  match positive globs and miss negative globs are opened regardless of
  content type.

## Why we do not file this upstream

Walking the five constraints:

1. **Is it really upstream's fault?** Partly. The
   `globPatterns.length === 1` guard is intentional (commit message and
   `--help` both document it). The OOM when reading multi-gigabyte files as
   markdown is a separate concern but is also "your config did not exclude
   binaries"; markdownlint-cli2 is not in the business of detecting binary
   files. The combination feels surprising but each half is defensible
   in isolation.
2. **Can upstream fix it?** Only by changing documented behaviour. Either
   the remap fires whenever `.` appears in the patterns (breaking change for
   anyone relying on `. <file>` to mean "this file plus the tree") or
   markdownlint-cli2 starts size-limiting or extension-filtering reads
   (architectural change in what "lint a glob" means).
3. **Are they supporting this use case?** No. The `--help` text added in an
   earlier release explicitly warns "would lint every file in the current
   directory tree which is probably not intended" and points users to `**`.
   The pattern `markdownlint-cli2 . <file>` is not in any documented example.
4. **Will they likely fix it?** Unlikely. The maintainer has already chosen
   to add the warning rather than change the behaviour. No commits in
   `markdownlint-cli2.mjs` history mention revisiting the remap (`git log`
   shows only the addition).
5. **Have we prototyped a minimal fix compatible with their architecture?**
   No. The clean upstream fix would either (a) tighten the remap to fire
   even with extra args (likely rejected as a breaking change) or (b) add a
   default `nodir: true` plus size guard to globby walks (much bigger
   change). We have not built either; the consumer-side fix above solves
   the user-facing problem.

All five fail. The workaround belongs at our boundary and is already applied.

## Draft upstream issue (do not file as-is)

Kept for audit. If upstream signals change on constraints 3 or 4, re-evaluate
before filing.

````md
**Title:** Document or guard against `.` plus another arg bypassing the dot-only remap

**Labels:** documentation, enhancement

**Body:**

The dot-only remap in `markdownlint-cli2.mjs:219` only fires when
`globPatterns.length === 1`. When `.` is paired with another positional
argument (for example via a shell alias or build-system task that hard-codes
`markdownlint-cli2 .` and forwards user args), the remap is bypassed and `.`
is passed verbatim to globby, walking every file in the tree.

The `--help` text already warns about the dot-only case being "probably not
intended". Two improvements would make the trap less sharp:

1. Extend the warning in `--help` to mention that the remap is gated on
   `length === 1`, so users who hard-code `.` in a wrapper understand why
   passing extra args silently changes the semantics.
2. Optionally, treat `.` as the substitute pattern whenever it appears
   alone among positional arguments (still allowing `'**'` for true
   recursion). This would tighten the trap at the cost of one documented
   breaking case.

**Reproduction:**

In a directory with a deeply nested tree containing any large binary file
(simulated below with a sparse 4 GB file):

```sh
mkdir tmp && cd tmp
echo '# test' > a.md
truncate -s 4G big.bin
markdownlint-cli2 . a.md
# FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed
```

**Suggested fix:**

In `markdownlint-cli2.mjs`, near line 219:

```js
// Substitute the dot whenever it appears as a positional argument, not only
// when it is the sole one.
for (let i = 0; i < globPatterns.length; i++) {
  if (globPatterns[i] === '.')
    globPatterns[i] = dotOnlySubstitute;
}
```

Tradeoff: any caller relying on `markdownlint-cli2 . <file>` to mean "lint
the tree and also this file" would need to switch to `**` (already the
documented recommendation). Tests in `test/` would need a new case covering
the multi-arg dot scenario.
````
