# `customParsers.startsWithComment.ts` JSONC parser stops at first `*/` even when it appears inside an inner `//` comment

## Symptom

The comment-preserving JSONC parser in `packages/module/es` terminates
a block comment at the **first** `*/` it encounters, regardless of
whether that `*/` is itself inside a `//` line comment on a line
that is part of the enclosing `/* */` block:

```jsonc
/*
  some config
  // this line has */ in it
  more config
*/
{"key": "value"}
```

The parser closes the block comment at the `*/` on line 3. Everything
from `in it` through the JSON object is left as unparsed content
(`in it\nmore config\n*/{"key": "value"}`), and the document fails to
parse as JSONC.

Affects two test cases in
`customParsers.startsWithComment.unit.test.ts`:

- `:396-410`: block comment containing a line comment with `*/`
- `:413-428`: block comment with multiple line comments each
  containing `*/`

Both are marked skipped because of this limitation.

## Root cause

Block comments cannot nest in any C-family language. The closing `*/`
is always the first `*/` after the opening `/*`, with no exception
for quotes, line comments, or other syntactic context. The comment is
shape `/* … */`, where `…` is "any characters up to (but not
including) the first `*/`".

The parser documents this directly in
`customParsers.startsWithComment.ts:40`:

```text
// Because in all languages, */ upon first found after starting a block comment,
// auto becomes end marker of block comment.
```

The implementation's helper
`findBlockEndPosition` in
`customParsers.startsWithComment.ts:20-74` attempts a heuristic to
skip `*/` that appears on the same line as a `//`, but the heuristic
is incomplete: it cannot distinguish

```text
// text */ more text   ← */ is inside the line comment
code */ // trailing    ← */ is real, // is the trailing comment
```

based on regex alone. A correct disambiguation would require a
character-by-character state machine tracking "currently inside a line
comment" within "currently inside a block comment", a second-order
state that the regex layer cannot express.

A third related test confirms the broader rule:

- `customParsers.startsWithComment.unit.test.ts:529-538`: `*/`
  inside a quoted string also terminates the block comment, because
  quotes have no special meaning inside comments.

## Verification

Version under test: `packages/module/es` `customParsers.startsWithComment.ts`
at workspace HEAD (commit ranges above).

Reproduce the failure:

```ts
import { parse } from '@monochromatic-dev/module-es';

const text = `/*
  some config
  // this line has */ in it
  more config
*/
{"key": "value"}
`;
parse(text);
// Throws or returns unparsed remainder containing "in it\nmore config\n*/..."
```

Reproduce the passing case:

```ts
const text = `// some config
// this line has */ in it
// more config
{"key": "value"}
`;
parse(text);
// Parses cleanly into the JSON object plus three leading line comments
```

## Verified workaround

If a block comment must contain `*/`, replace it with multiple line
comments:

```jsonc
// some config
// this line has */ in it
// more config
{ "key": "value" }
```

Tradeoff: prose-style multi-line block comments become a stack of
`//` prefixes, which is visually noisier on long comments. Acceptable
for the rare config file that needs to embed `*/` literally. JSONC
configuration files in this workspace overwhelmingly favour `//`
already, so the cost is small in practice.

## What does not work

- Escaping `*/` inside a block comment (`*\\/`, `*\/`, `* /`): the
  parser implements the standard C grammar; backslash and whitespace
  inside comments have no special meaning. The `*/` token is matched
  literally.
- Nesting block comments (`/* outer /* inner */ */`): C-family
  languages do not support nested block comments. The first `*/`
  closes the outer block; the trailing `*/` becomes a syntax error.
- Replacing the regex with a richer regex: any single regex still
  fails on adversarial inputs because the state machine the problem
  requires is non-regular. A full lexer would solve it; the cost
  outweighs the value for the encountered patterns.

## Why we do not file this upstream

There is no upstream beyond the workspace itself; the parser is
in-tree (`packages/module/es`). Walking the 5 constraints as if the
parser were the upstream:

1. **Is it really upstream's fault?** Borderline. The behaviour
   matches every C-family language; the limitation is intrinsic to the
   grammar. The "upstream" defect is the absence of the second-order
   state machine.
2. **Can upstream fix it?** Yes, by replacing the regex with a
   character-by-character tokenizer. The cost is moderate and the
   benefit is narrow (the test cases skipped above).
3. **Are they supporting this use case?** Yes; JSONC parsing with
   embedded comments is the parser's entire purpose.
4. **Will they likely fix it?** Not at this priority. The pattern is
   vanishingly rare in real JSONC configs, and the workaround is
   trivial. The skipped tests act as a permanent reminder.
5. **Have we prototyped a minimal fix?** No.

Decision: no upstream report (in this case the workspace decision is
"keep the limitation, document it"). Reopen if the skipped tests ever
correspond to a configuration we actually want to support.

## Related

- [`TROUBLESHOOTING.toml.md`](./TROUBLESHOOTING.toml.md): why we wrote
  a JSONC parser instead of using TOML.
- `customParsers.startsWithComment.ts:20-74`: `findBlockEndPosition`
  implementation (the heuristic that fails).
- `customParsers.startsWithComment.ts:95-144`: inline comment
  handling (no nesting issues, as line comments terminate at EOL).
