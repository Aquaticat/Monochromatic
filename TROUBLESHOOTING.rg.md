# ripgrep (rg) troubleshooting

## `--glob` finds files but `-l` with a content pattern does not

### Problem

Searching for test files with rg returns far fewer results than expected,
appearing to skip files in directories with spaces:

```bash
# Returns 3 files -- all in paths without spaces
rg --glob '*.test.ts' -l '\.test\.' packages/

# Returns 81 files -- including paths with spaces
rg --files --glob '*.test.ts' packages/
```

The missing files seem correlated with spaces in paths,
but spaces are a red herring.

### Root cause

`--glob` and `-l` serve different purposes:

- `--glob '*.test.ts'` filters **which files to search** (by file name)
- `-l '\.test\.'` searches **file contents** for the regex `\.test\.`

The 3 files that matched happen to contain the literal string `.test.`
somewhere in their source code (e.g. in an import path or comment).
The other 78 test files contain `test` (from `bun:test`, `test(...)`)
but never `.test.` surrounded by dots.

The spaces in directory names had no effect --
rg handles spaces in paths correctly.

### Fix

Use `--files` with `--glob` to list files by name pattern,
not `-l` with a content regex:

```bash
# List files whose NAME matches *.test.ts (no content search)
rg --files --glob '*.test.ts' packages/

# Search file CONTENTS for "test" in files named *.test.ts
rg --glob '*.test.ts' -l 'test' packages/

# These are different operations -- don't confuse them
```

### How this confusion arises

When debugging "rg can't find my files," the first instinct is to suspect
path handling (spaces, special characters, symlinks).
The actual cause -- a content pattern that doesn't match -- is invisible
because you never see which files rg searched and rejected.
Adding `--debug` or switching to `--files --glob` immediately reveals
whether the issue is file discovery or content matching.
