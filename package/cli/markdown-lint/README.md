# @monochromatic-dev/cli-markdown-lint

A purpose-built Markdown and MDX linter with localized autofixes,
replacing `markdownlint-cli2`.
It parses Markdown and MDX with Sätteri (a Rust engine) to mdast (the Markdown abstract syntax tree)
and writes every rule against that one tree.
Fixes are localized source edits at known offsets,
never a parse-then-stringify round trip,
so untouched spans stay byte-for-byte identical.

It runs under Node and executes its own TypeScript source directly,
so there is no build-before-lint step.
Sätteri ships a prebuilt native binary (per platform,
 with a WASI fallback),
so the linter now carries that one native dependency.
Sätteri reports node offsets as code points;
they are corrected to UTF-16 code units before the offset-based fixer runs,
so edits land correctly on documents with emoji or other astral characters
(see `doc/troubleshooting/satteri-offsets.md`).

## Why it exists

- `markdownlint-cli2` is easy to misuse (the `.`-plus-argument case walks the whole tree
  and reads multi-gigabyte binaries as Markdown until it OOMs) and is slow on this tree.
- MDX was unlinted:
   the old config globbed `**/*.md` only,
  so every `.mdx` file got zero coverage.
- The replacement must not re-introduce a large rule-package galaxy,
  the reason `remark-lint` was dropped earlier.

## Usage

```sh
# Lint the current directory (walks .md/.mdx, honouring .gitignore)
markdown-lint

# Lint specific files or directories
markdown-lint doc/ README.md

# Apply fixes in place; report only what stays unfixed
markdown-lint --fix

# Machine-readable output for CI
markdown-lint --format=json
```

During development,
 run it from source through the package task:

```sh
mise run //package/cli/markdown-lint:run -- --fix doc/
```

Exit codes:
 `0` when clean,
 `1` when unfixed violations remain,
 `2` on a usage error.
The report is written to stdout;
 status lines and usage errors go to stderr,
so `--format=json` pipes cleanly.

## Rules

Every rule runs on `.md` and `.mdx` alike.
MDX-specific nodes (`mdxjsEsm`,
 `mdxFlowExpression`,
 `mdxTextExpression`,
 `mdxJsxFlowElement`,
`mdxJsxTextElement`) and their subtrees are skipped,
while the surrounding Markdown is linted identically to the `.md` case.

- `MD001` heading-increment:
   heading levels increment by at most one.
   Report-only.
- `MD014` commands-show-output:
   a fenced shell block of only `$ ` prompts shows no output.
  Fixable:
   strips the prompts.
- `MD024` no-duplicate-heading:
   sibling headings under the same parent must be distinct
  (`siblings_only`).
   Report-only.
- `MD025` single-h1:
   at most one level-1 heading per document.
   Report-only.
- `MD026` no-trailing-punctuation:
   headings must not end with `.` or `:`.
  Fixable:
   strips the trailing run.
- `MD034` no-bare-urls:
   a bare URL or email should be an autolink.
  Fixable:
   wraps it in angle brackets.
- `MD036` no-emphasis-as-heading:
   a paragraph that is only emphasized text
  (and does not end in sentence punctuation) reads as a heading substitute.
   Report-only.
- `MD040` fenced-code-language:
   fenced code blocks must declare a language.
   Report-only.
- `MD053` link-image-reference-definitions:
   reference definitions must be used and unique.
  Fixable:
   removes unused and duplicate definitions.
- `MD054` link-image-style:
   shortcut reference style is disallowed.
  Fixable:
   converts a shortcut reference to the collapsed style.
- `no-pipe-tables`:
   Markdown pipe tables force each row onto one line.
  Fixable:
   converts a top-level table to an HTML `<table>`.
- `semantic-line-breaks`:
   enforce a line break after each prose break-point character
  (`,` `.` `;` `:` `?` `!`).
  Fixable,
   add-only:
   inserts a newline plus the block's continuation prefix,
  converging in a single pass.

## Rule-behaviour notes

These rules are not a parity port of markdownlint;
each rule's behaviour is defined and frozen by its own unit tests.

- `MD034` flags only wrappable bare URLs:
   a known scheme (`http`,
   `https`,
   `ftp`)
  or an email autolink.
  A scheme-less `www.` literal is left alone,
   because wrapping it would not produce a link.
- `MD054` flags only the shortcut style,
   the one form the repo config disallows;
  every other style (autolink,
   inline,
   full,
   collapsed,
   url-inline) is allowed.
- `semantic-line-breaks` operates on prose `text` inside paragraphs,
   list items,
   and blockquotes.
  It skips headings,
   code,
   link and image URLs,
   HTML,
   table cells,
   definitions,
   and MDX nodes,
  and breaks only where a written word ends,
   so the character after the break-point character has to be a space,
   a tab,
   a newline,
   or the end of the prose.
  That is what keeps a decimal,
   a version,
   a time,
   a dotted filename and a qualified name whole:
   each writes a digit or a letter straight after the punctuation.
  Abbreviations and the last dot of an ellipsis get their own guards,
   since a space does follow those.
  A run of closing quotes or brackets moves the break past itself rather than suppressing it,
   because the sentence has not finished being written until they are.
  The fix is add-only:
   it inserts a break after the punctuation and never removes a byte,
  which is why a continuation line may keep the author's original space.
  It reads and writes the document's own line ending,
   and never leaves two spaces at a line's end,
   which CommonMark would render as a `<br>`.

## Deferred work

- `MD052` reference-links-images (a reference with no matching definition) is not implemented.
  mdast degrades an undefined reference to literal text,
  so there is no node to flag without re-scanning the raw source,
  which the single-engine architecture avoids.
  The inverse,
   `MD053`,
   is implemented and catches the related definition mistakes.
- Clause-aware semantic line breaks (grammar-aware reflow) are out of scope.
  The mechanical,
   punctuation-based rule ships instead.
- MDX-specific rules (JSX attributes,
   expression contents,
   import hygiene) are deferred;
  the mdast architecture makes them cheap to add later.
- Maximum line length is not enforced.

## Development

```sh
# Run the unit tests
mise run //package/cli/markdown-lint:test:unit

# Type-check and lint the package
mise run //package/cli/markdown-lint:lint:types
mise run //package/cli/markdown-lint:lint:oxlint
```

Rule logic ported from markdownlint is recorded under the repository `LICENSES/` directory.
