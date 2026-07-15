# HANDOVER.no-regex

State of the lint-failure refactor triggered by the oxlint rule
`no-restricted-syntax/no-regex`.
 Resume from here after compaction.

## Status: sweep complete; 3 packages paused

Full-workspace `mise run //:lint` cross-check is now green for every
non-paused package.
 Final pass landed these fixes in this resume turn:
doodle-widget,
 webapp-productivity/rss,
 typeface/aquaticat,
ssg/aquati.
cat (with helper extraction to
`postprocess-excludes.ts` to stay under the max-lines limit).

Three packages are paused at the user's direction;
 each has a
"Status:
 development paused" section in its README pointing back here:

- `packages/webapp-edu/paper2vn` -- 5 sites
- `packages/webapp-content/messages-demo` -- 13 sites
- `packages/webapp-forge/server` -- 13 sites

To resume any of those,
 apply the patterns documented below (the
"Patterns established this session for common refactors" section
covers every refactor shape used in this sweep) and remove the
paused-status block from the README.

## Original task: done

All 114 errors from `/tmp/pi-bash-25cddcf1ce4714e4.log` plus the
follow-on packages surfaced by repeated `mise //:lint` runs are
addressed (modulo the 3 paused packages above).
 Tests pass for every
package that has a `test:unit` task and was directly touched.

## All commits landed (in order)

```text
21b9acfd feat(claude-code-plugins/source): add text-scan helper module
041221a3 docs(handover): require-regex-justification refactor state pre-compact
f0f7aeb0 refactor(mvm): replace regex with inline string-API parsers
98dec9b1 refactor(terminal-exec): replace regex with char-walker + recursive trim
069f377f refactor(vmsync): replace regex with parsers, predicates, picomatch globs
00c9d73d refactor(source): replace simple regex call-sites with text-scan helpers
c217d580 refactor(source): replace correction-reminder regex with phrase list
874feab2 refactor(source): replace bash-output-filter validation regex with predicates
d7455d80 refactor(source): replace bash-output-filter pattern regex with predicates
a457ddcb refactor(source): split uncertainty.ts into regex-free sibling modules
67b3be43 feat(source): add uncertainty-phrases/citations/strip helper modules
3cdc45a9 refactor(source): replace formatter-utils command-noise regex with walker
c11c4d16 refactor(config): replace tsdown/stylelint regex with strings + globs
e8cabda2 docs(handover): require-regex-justification refactor state (pre-compact v2)
2b91e748 refactor(hall-monitor): replace regex with verdict parser and helpers
17cfa839 refactor(editord): replace regex with string-API walkers across 6 files
093468ba refactor(oxlint-tsdoc): replace lint-hotpath regex with linear scanners
8d67db52 refactor(oxlint-stylistic): replace lint-hotpath regex with predicates
ddeab52b refactor(catalog-tighten): replace YAML and semver regex with parsers
728c134a refactor(file-enforcer): replace regex with predicates
3d93c1e8 refactor(page-weight): replace URI-scheme regex with linear scanner
cc9ee7f8 refactor(deps-cube): replace regex with parsers; gate user regex
79064823 refactor(inference-canary-viewer): replace SVG regex with parsers
bbf6f892 refactor(inference-canary): replace regex with linear parsers
0b983f79 refactor(task-util): replace 3/5 regex sites with parsers
cbc2fa74 docs(handover): pre-compact handover update
bfdf63b9 refactor(task-util): replace last 2 regex sites with linear scanners
a81c3032 refactor(watch-restart): replace regex with walker, helpers, string matchers
9eafee1a fix(task-util): silence prefer-string-raw on i18n path separators
b659f414 fix(inference-canary): clear 44 warnings introduced by regex refactor
500dfd39 refactor(module): replace regex with parsers across 4 packages
bb012d4f refactor(workspace): clear require-regex-justification across 7 packages
db8a7293 refactor(plugins,terminal-title): clear final require-regex sites
```

## Per-package lint state (verified individually this session)

All pass with 0 warnings,
 0 errors:

- `//packages/dev-script/task-util`
- `//packages/dev-script/watch-restart`
- `//packages/dev-script/inference-canary`
- `//packages/module/dom`
- `//packages/module/hyperscript`
- `//packages/module/image-diff`
- `//packages/module/matrix`
- `//packages/module/es`
- `//packages/module/or-throw`
- `//packages/module/test`
- `//packages/module/toml-edit`
- `//packages/module/zip-writer`
- `//packages/pi-plugin/auto-mode`
- `//packages/pi-plugin/morph-compact`
- `//packages/pi-plugin/terminal-title`
- `//packages/rolldown-plugin/import-attributes`

Plus everything previously cleared (listed in earlier handover sections
above;
 see git log for chronology).

## Critical conventions captured during this session

(Carries forward from earlier handovers;
 new entries are at the bottom.
)

- **Block-disable syntax**:
  `/* oxlint-disable rule -- justification */ ... /* oxlint-enable rule */`
  with `--` justification.
- **`oxlint-disable-next-line` strict semantics**:
   applies to the literal
  NEXT line of source,
   not the next NON-COMMENT line.
   Stacking two
  `oxlint-disable-next-line` comments back-to-back results in the first
  suppressing the second comment line (wasted),
   with only the second
  suppressing the actual code.
   When stacking is needed,
   combine all rule
  names in one comment (`// oxlint-disable-next-line ruleA ruleB -- ...`)
  or use the block-disable form.
- **`oxlint-disable-next-line` with multi-line expressions**:
   the
  directive targets only the line literally after it.
   For:
  ```ts
  const x = /regex/;
  ```
  the disable must sit on the line containing `/regex/`,
   NOT on the line
  with `const x =`.
- **`no-non-null-assertion` is enforced workspace-wide**:
   avoid `s[idx]!`;
  use `s.charAt(idx)` (returns `''` for out-of-bounds) or `s.at(-1) ?? ''`.
- **`prefer-at` rule fires for `s.charAt(s.length - 1)`** but NOT for
  `s.charAt(idx)` with a non-end index.
- **`typescript-eslint(no-misused-spread)`** fires on `[...str]` even for
  ASCII scans.
   Use a `for...of` loop over the string (the loop var is
  `const`,
   so the function-root-let rule does not fire) or a recursive
  walker.
- **`stylistic(no-mixed-operators)`** wants `(a !== b) || (!fn(x))`-style
  parens around BOTH operands when `||` mixes with comparison and `!`.
- **TSDoc destructure docs**:
   do not use `@param parent.field` form;
   the
  rule reads it as `@param ""`.
   Use individual `@param fieldName` lines
  instead (see `text-scan.ts:splitWhitespace`).
- **TSDoc backtick-in-backticks** (`` Mirrors `text.replaceAll(/`...`/g, '')` ``)
  trips `tsdoc-code-span-missing-delimiter`.
   Reword the doc instead.
- **TSDoc `*/` in code-example regex** literally ends the doc comment,
  breaking the file.
   Escape as `*\/` inside TSDoc blocks.
   This fires
  whenever a regex literal containing `*/` (e.g. `[gimsuy]*/`) appears in
  a backtick-wrapped doc example.
- **TSDoc single-line with `@` symbol in backticks**:
   the parser still
  reads the `@` as a tag,
   even when wrapped in backticks.
   Triggers
  `tsdoc(multiline-blocks)`.
   Either rephrase to drop the `@` (e.g. "at-
  sign" or "leading at sign") or split to multiline form.
- **TSDoc `@` inside fenced code blocks**:
   `tsdoc(check-tag-names)` still
  parses `@<word>` inside ``ts ``` blocks as a tag and rejects
  unknown tags.
   Escape as `\@` (e.g. `extractAtDigits('DONE A \@100')`).
- **TSDoc helper-stacking trap**:
   when inserting a new helper function
  above an existing one,
   ensure the existing function's TSDoc comment
  stays directly before its declaration.
   Don't insert new TSDoc-bearing
  helpers between an existing TSDoc and the function it documents — the
  TSDoc will bind to your new helper and the original function will be
  reported as missing TSDoc.
   (Hit again this session in
  `rolldown-plugin/import-attributes/transform-helpers.ts`.
  )
- **stylelint accepts regex-shaped strings** (`'/^max-/'`,
   etc.).
   Use
  `` String.raw`/.../` `` to preserve regex escapes through the JS string
  layer.
- **tsdown accepts strings in `alwaysBundle`**:
   non-`/`-fenced strings go
  through `picomatch` (`'@scope/**'`) or exact-match (`'jspdf'`).
  Verified in `node_modules/tsdown/dist/general-D3muxt2f.mjs:14-30`.
- **dprint workspace format** is what enforces destructure-per-line and
  type-property-per-line.
   Run `mise run //:format`.
   Note:
   `//:format`
  runs across the whole workspace.
- **Cannot run `dprint`/`pnpm exec dprint` directly** — auto-mode
  classifier denies it.
   Use `mise run //:format`.
- **`cli-git` pre-commit hook requires explicit pathspecs**:
  `git commit -m '...' <files>`,
   not bare `git commit -m '...'`.
- **`cli-git` rejects `git add -A` and `git add .`**:
   pass explicit
  paths instead.
- **`mise run //:lint` runs the full workspace**:
   surfacing unrelated
  failures (other packages still using regex) was the trigger for the
  scope expansion in this session.
- **User-typed `/regex/` search** is the canonical legitimate case for
  a `no-regex` disable.
   The justification should
  (a) name why regex is the right tool,
   (b) name the input bounds
  (e.g. length cap),
   (c) name the backtracking-safety story.
   Example
  in `packages/dev-script/deps-cube/src/scripts/filter.ts` and
  `packages/dev-script/watch-restart/src/cli-helpers.ts`.
- **`array-element-per-line`** fires on multi-element arrays even when
  using `[...acc, token]`.
   Restructure to per-line:
  ```ts
  return walk({
    idx: idx + 1,
    acc: token === '' ? acc : [
      ...acc,
      token,
    ],
  },);
  ```
- **`prefer-spread` vs `array-element-per-line` conflict**:
   avoid
  `acc.slice()` and `acc.concat(token)` (prefer-spread fires);
   use the
  per-line spread form above instead.
- **Write tool & Unicode-escape source**:
   literal `''` in tool-call
  content normalises to a 1-byte ESC byte when written through the
  Write tool,
   because the JSON pipeline interprets `` as a
  Unicode escape.
   Use `'\x1B'` (preserves as 4-char source because
  JSON does not interpret `\x`),
   or `String.fromCodePoint(0x1B,)`
  (avoids the literal escape entirely).
   `'\x1B'` then trips
  `eslint-plugin-unicorn(no-hex-escape)` so the `String.fromCodePoint`
  form with a named code-point constant is the cleanest.
- **`String.raw\`...\``** template literals **cannot end with a single
  backslash**: the closing backtick is consumed as an escape target,
  producing "Invalid Unicode escape sequence" at parse time. For path
  separators like`\\i18n\\`, the plain`'\\i18n\\'`form is the only
  option; add a scoped`eslint-plugin-unicorn/prefer-string-raw`
  disable with the reason.
- **`chai`'s `.to.throw(string)` does substring matching** (verified in
  `packages/module/test/src/expect.unit.test.ts:99-105`).
   So
  `.toThrow(/foo/,)` swaps cleanly to `.toThrow('foo',)`.
   Similarly
  `.toMatch(/foo/,)` swaps to `.toContain('foo',)` when the regex was
  a pure substring check.
   For anchor checks (`/^foo/`),
   use
  `expect(s.startsWith('foo')).toBe(true)`.
- **The `toMatch` matcher constructor itself trips the rule**:
   when
  callers pass a string,
   chai's `a.to.match` requires a RegExp,
   so the
  matcher's body wraps `expected` in `new RegExp(expected)`.
   This
  needs a scoped disable in `expect-matchers.ts` (already added).

## Working-tree state at handover

Out-of-scope modifications already in the working tree (NOT touched by
this task;
 carry-over from prior sessions and from running
`mise run //:format`):

- `.pnpmfile.mjs`
- `AGENTS.md`
- `packages/claude-code-plugins/session-start-housekeeping/dist/final/node/index.mjs`
- `packages/cli/forbidden-strings/README.md`
- `packages/cli/forbidden-strings/fuzz/Cargo.toml`
- `packages/cli/forbidden-strings/fuzz/dictionaries/forbidden-strings.dict`
- `packages/figma/to-penpot/src/index.ts`
- `pnpm-lock.yaml`

Every file I changed for this task is committed;
 leave the above alone
unless the user asks otherwise.

## If you need to resume / extend

### Immediate next steps (in order)

1. **Full workspace lint sanity check**:
    `mise run //:lint > /tmp/full-lint-final.log 2>&1; tail -5 /tmp/full-lint-final.log; grep -E 'ERROR task failed' /tmp/full-lint-final.log`.
   If clean,
    the no-regex sweep is done.
    If new packages surface,
   they'll need the same treatment (refactor where feasible,
    scoped
   disable with the four-part justification — why regex,
    input bounds,
   backtracking safety,
    why no string-API alternative — otherwise).

2. **Closing out**:
    when `mise run //:lint` is fully clean,
    delete this
   `HANDOVER.*` file (the user reviews and decides whether to keep it).

### Justification template for new disables

```text
// oxlint-disable-next-line no-restricted-syntax/no-regex -- <why regex is the right tool for THIS site>; <what bounds the pattern/input>; <why matching stays safe (no nested quantifiers, no backtracking)>.
```

### Patterns established this session for common refactors

- Whitespace-and-newline grammar:
   dedicated `isWhitespaceChar`/
  `lastNonWhitespaceIndex` walker (see `module/dom/test-setup.ts`,
  `module/toml-edit/comments.ts`).
- Data URI / "literal prefix + body" parsing:
   `startsWith` +
  `indexOf` + `slice` (see `module/image-diff/encoding.ts`).
- Bare-key / identifier validation:
   per-char predicate walker
  (`isBareKey` in `module/toml-edit/keys.ts`).
- camelCase → kebab-case:
   recursive walker emitting `-<lower>` on
  uppercase letters (see `module/hyperscript/html/index.ts`).
- Test `.toThrow(/.../,)` substring matchers:
   swap to `.toThrow('...',)`
  (chai substring match).
   For anchors:
   `startsWith` + `.toBe(true)`.
- Test fixtures that MUST be regex literals (testing regex APIs):
  block-level disable wrapping the whole file (see
  `module/es/.../regexp/t global/.unit.test.ts`,
  `module/or-throw/regexp-or-throw.unit.test.ts`).

### Files where source-of-truth IS regex (kept with disables)

- `packages/dev-script/deps-cube/src/scripts/filter.ts` (user-typed
  regex search;
   bounded to 256 chars).
- `packages/dev-script/watch-restart/src/cli-helpers.ts:compileRegex`
  (user-typed CLI regex source).
- `packages/module/es/src/types/t object/t regexp/...` (entire
  regex-tooling subtree).
- `packages/pi-plugin/auto-mode/src/constants.ts` (secret-detection patterns;
  block disable around the content-signal region).
- `packages/pi-plugin/auto-mode/src/budget-model-version.ts` (model-id
  tokeniser;
   block disable).
- `packages/pi-plugin/auto-mode/src/config.ts:compilePatterns` (user-supplied
  config patterns).
- `packages/pi-plugin/terminal-title/src/formatter-utils.ts:COMMAND_NOISE_RE`
  (negative lookahead disambiguating `--foo=bar` from `FOO=bar`).
- `packages/dev-script/inference-canary-viewer` (the `\p{Upper}`/
  `\p{Lower}` Unicode property classes have no string-API equivalent).
- `packages/module/test/src/expect-matchers.ts:toMatch` (the matcher's
  contract is RegExp).

### If a downstream test fails

- `UncertaintyMatch.pattern` field was dropped earlier in this overall
  task.
   Only consumer outside `uncertainty*.ts` is
  `stop-reminders/index.ts`,
   which reads `.phrase`.
   No other readers.
- `linter-artifacts-timestamp.ts` exports changed from
  `ARTIFACT_DIR_PATTERN` / `FAILURE_DIR_PATTERN` (RegExp) to
  `parseArtifactDir` / `parseFailureDir` (functions returning parsed
  parts).
   Only consumer is `linter-artifacts-recent.ts`,
   updated in the
  same commit.
- `watch-filesystem-filter.ts` (editord) export changed from
  `EDITORD_TEMP_PATTERN` (RegExp) to `isEditordTempFile` (predicate).
  Only consumer was `watch-filesystem.ts`,
   updated in the same commit.
- `module/dom/test-setup.ts`:
   `parseTrailingExportClause` replaces the
  inline regex;
   same throw on missing trailing `export { ... }`.
- `module/image-diff/encoding.ts:parseDataUri`:
   same throw on missing
  scheme/separator/payload;
   behaviour preserved.
- `module/toml-edit/keys.ts:encodeKey`:
   same behaviour for bare-key and
  quoted-key paths.
- `module/toml-edit/comments.ts`:
   `isAttachedGap` replaces
  `ATTACHED_GAP_PATTERN.test`;
   same single-newline semantics.
