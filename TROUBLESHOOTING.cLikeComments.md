# Block comment nesting limits the JSONC parser's `*/` handling

## Problem

The JSONC comment-preserving parser in `packages/module/es` terminates
block comments at the **first** `*/` encountered, even when that `*/`
appears inside a line comment (`//`) on the same line.

This means the parser cannot correctly handle:

```jsonc
/*
  some config
  // this line has */ in it
  more config
*/
{"key": "value"}
```

The parser stops at the `*/` inside the `//` comment on line 3,
leaving `in it\nmore config\n*/{"key": "value"}` as unparsed content.

## Root cause

Block comments (`/* */`) cannot nest in C-like languages.
The closing `*/` is always the **first** `*/` after the opening `/*`,
regardless of surrounding context (quotes, line comments, other block comments).

This is not a bug in our parser; it matches the behavior of every
C-family language (JavaScript, TypeScript, C, C++, Java, Rust, Go, CSS).
From `customParsers.startsWithComment.ts` line 40:

```text
// Because in all languages, */ upon first found after starting a block comment,
// auto becomes end marker of block comment.
```

The parser's `findBlockEndPosition` function
(`customParsers.startsWithComment.ts:20-74`)
does attempt to skip `*/` on lines containing `//`,
but this heuristic is incomplete; it can't distinguish between
`// text */ more text` (where `*/` is inside a line comment)
and `code */ // trailing comment` (where `*/` is real).

## Impact on the parser

Two test cases are skipped because of this limitation:

- `customParsers.startsWithComment.unit.test.ts:396-410`:
  block comment containing a line comment with `*/`
- `customParsers.startsWithComment.unit.test.ts:413-428`:
  block comment with multiple line comments containing `*/`

A third test confirms the intentional behavior:

- `customParsers.startsWithComment.unit.test.ts:529-538`:
  `*/` inside quoted strings also terminates the block comment,
  because quotes have no special meaning inside comments

## Why we accepted this

The subset of comment patterns that hit this edge case,
a `*/` appearing literally inside a `//` comment that itself is inside
a `/* */` block, is vanishingly rare in real JSONC configuration files.

Supporting it would require a full character-by-character state machine
that tracks "inside line comment" state within block comments,
adding complexity for a case that doesn't occur in practice.
The current regex-based approach handles all real-world JSONC patterns
we've encountered.

## Workaround

If a block comment must contain `*/`, use multiple line comments instead:

```jsonc
// some config
// this line has */ in it
// more config
{ "key": "value" }
```

Line comments (`//`) have no nesting limitations and can contain
any characters including `*/` and `/*` without ambiguity.

## Related

- `TROUBLESHOOTING.toml.md` -- why we wrote a JSONC parser instead of using TOML
- `customParsers.startsWithComment.ts:20-74` -- `findBlockEndPosition` implementation
- `customParsers.startsWithComment.ts:95-144` -- inline comment handling (no nesting issues)
