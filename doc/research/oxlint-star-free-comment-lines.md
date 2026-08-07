# Oxlint 1.75.0 custom rules can reject leading asterisks on block-comment continuation lines

## Symptom

The desired block-comment style keeps the delimiter stars but omits the decorative leading star from each continuation
line:

```typescript
/**
 Description without a continuation-line asterisk.

 @returns value
*/
```

The rule should reject the conventional form:

```typescript
/**
 * Description with a continuation-line asterisk.
 *
 * @returns value
 */
```

The opening `/**` and closing `*/` necessarily retain stars because they are comment delimiters.
"Without stars on every line" therefore means without decorative stars on continuation lines.

This is straightforward to enforce with an Oxlint JavaScript plugin.
A measured diagnostic-only prototype contained 34 lines in its rule object and correctly reported the 4 starred
continuation lines in its fixture.
The difficult part is repository adoption, not comment access.
A text scan found 153,356 candidate starred content lines across 2,950 non-test TypeScript files in this repository.
Within `package/oxlint-plugin/tsdoc/src`, it found 1,783 candidate lines across 31 files.
These are lexical migration candidates, not an AST-derived violation count.

## Root cause

Verified against Oxlint tag `oxlint_v1.75.0`, commit
`83abe3b49c0913b1a984a7eec5e433a59fd76eae`, and the installed `@oxlint/plugins` 1.75.0 package.

Oxlint exposes every source comment directly to JavaScript rules.
`apps/oxlint/src-js/plugins/comments_methods.ts:30-38` at the verified tag says:

```typescript
/**
 * Retrieve an array containing all comments in the source code.
 * @returns Array of `Comment`s in order they appear in source.
 */
export function getAllComments(): Comment[] {
  if (comments === null) initComments();
  debugAssertIsNonNull(comments);
  return comments;
}
```

`SourceCode` publishes that function to rule contexts.
`apps/oxlint/src-js/plugins/source_code.ts:318-323` says:

```typescript
// Comment methods
getAllComments: commentMethods.getAllComments,
getCommentsBefore: commentMethods.getCommentsBefore,
getCommentsAfter: commentMethods.getCommentsAfter,
getCommentsInside: commentMethods.getCommentsInside,
commentsExistBetween: commentMethods.commentsExistBetween,
```

Each comment carries its kind and body text.
`apps/oxlint/src-js/plugins/comments.ts:22-28` says:

```typescript
/**
 * Comment.
 */
interface CommentType extends Span {
  type: "Line" | "Block" | "Shebang";
  value: string;
}
```

Oxlint strips the opening and closing delimiters before exposing `comment.value`.
`apps/oxlint/src-js/plugins/comments.ts:349-354` says:

```typescript
comment.type = isBlock ? "Block" : "Line";
// Line comments: `// text` -> slice `start + 2..end`
// Block comments: `/* text */` -> slice `start + 2..end - 2`
comment.value = sourceText!.slice(start + 2, end - (+isBlock << 1));
comment.range[0] = comment.start = start;
comment.range[1] = comment.end = end;
```

For a TSDoc opener, the first character of that body is the second star in `/**`.
A rule must therefore split `comment.value` into lines and skip body line zero.
It can then reject continuation lines whose `trimStart()` begins with `*`.
No AST ownership analysis or TypeScript type information is needed.

The repository already has the required infrastructure.
`package/oxlint-plugin/tsdoc/src/comment-text.ts:90-108` splits comment bodies and treats a leading star as optional:

```typescript
export function stripCommentLineMarker(s: string,): string {
  return s.startsWith('*',) ? s.slice(1,) : s;
}

export function getCommentLines(comment: ReadonlyDeep<Comment>,): readonly string[] {
  return comment.value
    .split('\n',);
}
```

That optional stripping means the in-house TSDoc scanner accepts both starred and star-free continuation lines.
The probe against the complete TSDoc fixture configuration produced no diagnostics for a documented type alias using
star-free lines.

One existing rule must change with the new convention.
`package/oxlint-plugin/tsdoc/src/rule/structural.ts:169-181` currently makes the `multiline-blocks` fixer introduce
stars:

```typescript
if (contentLines.length === 0)
  return `/**\n${indent} *\n${indent} */`;

const body = contentLines
  .map(function renderContentLine(line,): string {
    return `${indent} * ${line}`;
  },)
  .join('\n',);

return `/**\n${body}\n${indent} */`;
```

Leaving that fixer unchanged would make one enabled TSDoc rule generate text rejected by the new rule.

## Verification

### Versions

- Oxlint 1.75.0, reported by `oxlint --version`.
- `@oxlint/plugins` 1.75.0, resolved in `pnpm-lock.yaml:4897-4898`.
- Oxc tag `oxlint_v1.75.0`, commit `83abe3b49c0913b1a984a7eec5e433a59fd76eae`.

### Runnable harness

The disposable probe used this plugin:

```javascript
// plugin.mjs
const noLineAsterisksRule = {
  meta: {
    type: "layout",
    messages: {
      unexpected: "Remove leading asterisk from block-comment line.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== "Block") continue;

          const lines = comment.value.split("\n");
          for (let lineOffset = 1; lineOffset < lines.length; lineOffset += 1) {
            const line = lines[lineOffset];
            const column = line.length - line.trimStart().length;
            if (!line.trimStart().startsWith("*")) continue;

            context.report({
              loc: {
                start: {
                  line: comment.loc.start.line + lineOffset,
                  column,
                },
              },
              messageId: "unexpected",
            });
          }
        }
      },
    };
  },
};

export default {
  meta: { name: "comment-style" },
  rules: { "no-line-asterisks": noLineAsterisksRule },
};
```

The probe config was:

```jsonc
// .oxlintrc.json
{
  "jsPlugins": ["./plugin.mjs"],
  "rules": {
    "comment-style/no-line-asterisks": "error"
  }
}
```

The input catalog was:

```typescript
// input.ts
/**
 * Flagged TSDoc line.
 *
 * @returns flagged tag line.
 */
function flagged(): number {
  return 1;
}

/**
 Clean TSDoc line.

 @returns clean tag line.
*/
function clean(): number {
  return 2;
}

/*
 * Flagged ordinary block comment.
 */
const value = true;

// Ignored line comment.
const other = false;
```

A scratch `mise.toml` invoked the repository-installed Oxlint binary:

```toml
[tasks.lint]
run = "node_modules/.bin/oxlint --config .oxlintrc.json --format json input.ts"
```

After linking the repository's `node_modules` into the disposable directory, the verification command was:

```sh
mise run lint
```

Filtering the JSON output to `comment-style(no-line-asterisks)` produced:

```json
{
  "customDiagnosticCount": 4,
  "lines": [2, 3, 4, 20]
}
```

### Patterns that passed

- TSDoc content lines without leading stars.
- Empty TSDoc separator lines without leading stars.
- TSDoc tag lines without leading stars.
- Line comments.
- The `/**` opener itself, because body line zero was skipped.

The repository's complete TSDoc fixture configuration also accepted this input with no diagnostics:

```typescript
/**
 Numeric alias documented without continuation-line asterisks.
*/
export type NumberAlias = number;
```

### Patterns that failed

- Starred TSDoc prose at line 2.
- A starred blank TSDoc line at line 3.
- A starred TSDoc tag at line 4.
- A starred ordinary block-comment line at line 20.

The probe intentionally reported each physical line separately so editor diagnostics point at the exact star.

## Verified workarounds

### Enforce all multiline block comments

Use a `Program` visitor, call `context.sourceCode.getAllComments()`, retain `Block` comments, skip body line zero, and
report continuation lines beginning with `*` after indentation.

Tradeoff:
this also governs ordinary block comments, license headers, ASCII diagrams, and generated-looking comment blocks.
Those forms may need explicit exclusions if the convention is intended only for TSDoc.

### Enforce only TSDoc comments

Add `comment.value.startsWith('*')` to the `Block` filter.
The first body star comes from the `/**` opener even when continuation lines are star-free.

Tradeoff:
ordinary `/* ... */` comments remain unconstrained and can keep decorative stars.

### Reuse the local TSDoc scanner

Place the rule in `package/oxlint-plugin/tsdoc` and reuse `getCommentLines`, `commentLineReportLoc`, and the existing
ignored-file policy.

Tradeoff:
using `createTsdocVisitor` checks only TSDoc attached to documentable declarations.
A `Program` plus `getAllComments()` implementation covers unattached TSDoc blocks too, matching the stronger meaning
of "every comment".

## What does not work

### Reuse `no-multi-asterisks` unchanged

`package/oxlint-plugin/tsdoc/src/rule/asterisk-validation.ts:76-77` checks `trimmed.startsWith('**')`.
It rejects doubled stars but accepts the conventional single-star prefix that this policy wants to ban.

### Scan body line zero

For `/**`, Oxlint exposes the opener's second star as the first character of `comment.value`.
Checking every split line without skipping line zero reports every TSDoc opener incorrectly.

### Visit only declarations when the requirement covers every block

Comments can be unattached, nested inside expressions, or placed before unsupported node kinds.
A declaration visitor does not provide whole-file coverage.
`Program` plus `getAllComments()` does.

### Keep the current `multiline-blocks` fixer

The current fixer writes ` * ` before every rendered content line.
The new rule would reject that generated output.
The fixer and its tests must adopt the same star-free rendering in the same change.

### Enable the rule before planning migration

The repository text scan found 153,356 candidate content lines in non-test TypeScript files.
Enabling an error immediately would create a repository-wide backlog even though the rule implementation itself is
small.
The scan deliberately does not claim every candidate is a parsed comment line.

## Effort assessment

The diagnostics-only rule is low implementation complexity:

- Oxlint already exposes comment type, body, range, and locations.
- The local plugin already has line splitting, diagnostic-location helpers, ignore handling, fixtures, and config wiring.
- The measured standalone rule core was 34 lines and produced the expected 4 diagnostics.
- No parser change, type-aware service, or upstream Oxlint change is required.

A repository-quality implementation has more surface than the core loop:

- add or rename the plugin rule and export;
- update shared rule configuration;
- add passing, failing, location, and ignored-file tests;
- decide whether ordinary block comments, licenses, and diagrams are in scope;
- update `multiline-blocks` output and autofix expectations;
- update plugin documentation;
- migrate existing comments or stage enforcement.

An autofix is additional work because it must remove exactly the decorative star and optional following space while
preserving indentation, blank lines, code fences, and literal leading stars in comment content.
That fix was not prototyped in this investigation, so its correctness and diff size remain unverified.

The practical ranking is:

1.  **TSDoc-only diagnostics**, easiest because existing helpers and ignore policy already define the scope.
2.  **All-block diagnostics**, nearly the same code but requires policy decisions for licenses and diagrams.
3.  **Autofix plus repository-wide rollout**, most work because migration and formatter-rule convergence dominate the
    rule loop.

## Upstream filing decision

The repository's `.out-of-scope/` directory was checked.
`.out-of-scope/low-impact-typescript-formatting.md` discourages implementation of low-impact formatting rules without
concrete review pain, but it does not identify an upstream Oxlint filing exemption.
This investigation only assesses feasibility and does not decide whether the convention clears that local priority
bar.

Tracker searches for `getAllComments custom rule block comment asterisk`, `comment line asterisk JS plugin`, and
`comments-related APIs` found closed issue [oxc-project/oxc#14564][comment-api-issue] and its implementing pull
requests.
The full issue body and all comments were read.
The thread confirms that all discussed comment APIs are complete.

The filing constraints resolve as follows:

1.  **Upstream fault:** no.
    Oxlint 1.75.0 exposes the data required for this consumer policy.
2.  **Upstream can fix it:** not applicable.
    No upstream defect requires a fix.
3.  **Supported use case:** yes.
    [Current Oxlint documentation][writing-js-plugins] explicitly supports custom JavaScript rules and `SourceCode`
    APIs.
4.  **Contribution welcome:** not evaluated further because no upstream change is needed.
5.  **Likely upstream action:** not applicable.
    The relevant API work is already complete.
6.  **Compatible minimal fix prototyped:** yes at the consumer boundary.
    The 34-line rule core produced the expected diagnostics, but it is not an upstream patch.

Nothing should be filed upstream.
There is no additive issue comment to post and no issue draft to retain.

[comment-api-issue]: https://github.com/oxc-project/oxc/issues/14564
[writing-js-plugins]: https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html
