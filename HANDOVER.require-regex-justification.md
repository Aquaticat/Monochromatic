# HANDOVER.require-regex-justification

State of the lint-failure refactor triggered by the oxlint rule
`no-restricted-syntax/require-regex-justification`. Resume from here after
compaction.

## Status: in progress

Original task: "Fix /tmp/pi-bash-25cddcf1ce4714e4.log" (114 errors across 4
packages). All 114 of those are resolved. After the first pass cleared the
original failure set, `mise //:lint` surfaced more packages that hit the
same rule. The user said "Continue, fix all lint issues." so the scope
expanded; that work is mostly done but two task-util sites remain and
watch-restart has not been started.

## Original task: done

All 114 errors from `/tmp/pi-bash-25cddcf1ce4714e4.log` plus 18 additional
out-of-scope errors in `config/stylelint` + `config/tsdown` are resolved.
Tests pass for every package that has a `test:unit` task.

## Newly-surfaced packages (after the original failure set cleared)

### Cleared

- `//packages/dev-script/catalog-tighten:lint` — 3 errors, refactored.
  YAML catalog parser rewritten; `>=` range matcher rewritten.
- `//packages/desktop-daemon/hall-monitor:lint` — 3 errors, refactored.
- `//packages/desktop-daemon/editord:lint` — 8 errors, refactored.
- `//packages/config/oxlint-tsdoc:lint` — 10 errors, refactored.
- `//packages/config/oxlint-stylistic:lint` — 12 errors, refactored.
- `//packages/dev-script/file-enforcer:lint` — 3 errors, refactored.
- `//packages/dev-script/page-weight:lint` — 4 errors, refactored.
- `//packages/dev-script/deps-cube:lint` — 10 errors, refactored.
  Includes the user-typed `/regex/` search in `scripts/filter.ts` which
  keeps regex with a justification disable + 256-char length cap.
- `//packages/dev-script/inference-canary-viewer:lint` — 5 errors, refactored.
- `//packages/dev-script/inference-canary:lint` — 16 errors, refactored.
  Passes lint (0 errors) but carries 44 warnings introduced by the refactor
  (magic numbers, prefer-template, consistent-function-scoping, multiline-
  blocks, tsdoc-code-span-empty/missing-delimiter/unnecessary-backslash);
  see "Pending" below.
- `//packages/dev-script/task-util:lint` — 5 errors → **2 left** (see Pending).

### Pending

- `//packages/dev-script/task-util:lint` — **2 errors** in
  `src/oxlint-augment.ts`:
  - Line 30: `ANSI_PATTERN = /\[\d+(?:;\d+)*m/g` — strip ANSI escape
    sequences.
  - Line 94: `DIAGNOSTIC_HEADER_PATTERN = /[x!]\s+\S+\(([\w-]+)\)\s*:/` —
    extract oxlint rule name from diagnostic header line.

  **Important**: previous attempts to Edit these failed because the file
  contains a literal `` 6-character JS escape sequence and the Edit
  tool's JSON unescape pipeline normalised it to the ESC byte, causing the
  search not to match. Workaround: read the file with awk/od to confirm
  the literal bytes, then use the Write tool to overwrite the entire
  file. Refactor approach for line 30 already designed (see prior session
  transcript): walker that finds ESC bytes via `text.indexOf(ESC_CHAR)`,
  validates `[` + `<digits>(;<digits>)*m` body. Line 94 is similar:
  predicate that walks the line for `x` or `!`, then whitespace, then a
  `plugin-name(rule-name): ` shape; returns the captured rule name.

- `//packages/dev-script/watch-restart:lint` — **18 errors**, not yet
  inspected. Run the per-package lint to see the regex sites.

- **`//packages/dev-script/inference-canary:lint` warnings** (44 total),
  all introduced by my refactor in this session:
  - linter-artifacts-timestamp.ts: magic numbers `4`, `5`, `7` need named
    constants (`YEAR_DIGITS = 4`, `MIN_SLUG_LENGTH = 5`, etc.). Plus a
    `no-mixed-operators` warning at line 250 needing extra parens.
    `consistent-function-scoping` on `looksLikeTimestamp` (defined inside
    `parseArtifactDir`; move to module scope).
  - css-mixin-verify.ts: two `prefer-template` (string concat → template
    literal).
  - extract-code.ts: TSDoc warnings on the helper function comments
    (`tsdoc-code-span-empty`, `tsdoc-code-fence-opening-indent`,
    `tsdoc-unnecessary-backslash`) — rewrite docs to avoid embedded
    backticks + nested code-spans.
  - sudoku-grid.ts:75: `consistent-function-scoping` on `isBlankLine`
    (move to module scope).
  - sudoku-output.ts:48: `consistent-function-scoping` on `isDashLine`
    (move to module scope).
  - task-scheduler.ts:78: `tsdoc(multiline-blocks)` on single-line TSDoc
    that contains a tag inside backticks. Same as
    task-scheduler.ts:77 `consistent-function-scoping` on `extractAtDigits`.
  - stak-simulation.ts:164: `prefer-template`.

  None of these block the lint (warnings only) but the user said "fix
  all lint issues", so they should be addressed before declaring done.

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
```

## Critical conventions captured during this session

(Carries forward from earlier handovers; the new entries are at the
bottom.)

- **Block-disable syntax** (unused but verified):
  `/* oxlint-disable rule -- justification */ ... /* oxlint-enable rule */`
  with `--` justification. We refactored throughout instead.
- **`no-non-null-assertion` is enforced workspace-wide**: avoid `s[idx]!`;
  use `s.charAt(idx)` (returns `''` for out-of-bounds) or `s.at(-1) ?? ''`.
- **`prefer-at` rule fires for `s.charAt(s.length - 1)`** but NOT for
  `s.charAt(idx)` with a non-end index.
- **`typescript-eslint(no-misused-spread)`** fires on `[...str]` even for
  ASCII scans. Use a `for...of` loop over the string (the loop var is
  `const`, so the function-root-let rule does not fire) or a recursive
  walker.
- **`stylistic(no-mixed-operators)`** wants `(a !== b) || (!fn(x))`-style
  parens around BOTH operands when `||` mixes with comparison and `!`.
- **TSDoc destructure docs**: do not use `@param parent.field` form; the
  rule reads it as `@param ""`. Use individual `@param fieldName` lines
  instead (see `text-scan.ts:splitWhitespace`).
- **TSDoc backtick-in-backticks** (`` Mirrors `text.replaceAll(/`...`/g, '')` ``)
  trips `tsdoc-code-span-missing-delimiter`. Reword the doc instead.
- **TSDoc `*/` in code-example regex** literally ends the doc comment,
  breaking the file. Escape as `*\/` inside TSDoc blocks. This fires
  whenever a regex literal containing `*/` (e.g. `[gimsuy]*/`) appears in
  a backtick-wrapped doc example.
- **TSDoc single-line with `@` symbol in backticks**: the parser still
  reads the `@` as a tag, even when wrapped in backticks. Triggers
  `tsdoc(multiline-blocks)`. Either rephrase to drop the `@` (e.g. "at-
  sign" or "leading at sign") or split to multiline form.
- **TSDoc helper-stacking trap**: when inserting a new helper function
  above an existing one, ensure the existing function's TSDoc comment
  stays directly before its declaration. Don't insert new TSDoc-bearing
  helpers between an existing TSDoc and the function it documents — the
  TSDoc will bind to your new helper and the original function will be
  reported as missing TSDoc.
- **stylelint accepts regex-shaped strings** (`'/^max-/'`, etc.). Use
  ``String.raw`/.../`  `` to preserve regex escapes through the JS string
  layer.
- **tsdown accepts strings in `alwaysBundle`**: non-`/`-fenced strings go
  through `picomatch` (`'@scope/**'`) or exact-match (`'jspdf'`).
  Verified in `node_modules/tsdown/dist/general-D3muxt2f.mjs:14-30`.
- **dprint workspace format** is what enforces destructure-per-line and
  type-property-per-line. Run `mise run //:format`. Note: `//:format`
  runs across the whole workspace.
- **Cannot run `dprint`/`pnpm exec dprint` directly** — auto-mode
  classifier denies it. Use `mise run //:format`.
- **`cli-git` pre-commit hook requires explicit pathspecs**:
  `git commit -m '...' <files>`, not bare `git commit -m '...'`.
- **`mise run //:lint` runs the full workspace**: surfacing unrelated
  failures (other packages still using regex) was the trigger for the
  scope expansion in this session.
- **User-typed `/regex/` search** is the canonical legitimate case for
  a `require-regex-justification` disable. The justification should
  (a) name why regex is the right tool, (b) name the input bounds
  (e.g. length cap), (c) name the backtracking-safety story. Example
  in `packages/dev-script/deps-cube/src/scripts/filter.ts`.
- **`array-element-per-line`** fires on multi-element arrays even when
  using `[...acc, token]`. Restructure to per-line:
  ```ts
  return walk({
    idx: idx + 1,
    acc: token === '' ? acc : [
      ...acc,
      token,
    ],
  },);
  ```
- **`prefer-spread` vs `array-element-per-line` conflict**: avoid
  `acc.slice()` and `acc.concat(token)` (prefer-spread fires); use the
  per-line spread form above instead.
- **Edit tool's `` handling**: when the file source contains a
  literal `` 6-char JS escape sequence (rather than the actual ESC
  byte), the Edit tool's JSON unescape pipeline normalises the search
  pattern to the ESC byte, causing the match to fail. Workaround: use
  Write to overwrite the whole file with the new content. Affects
  `packages/dev-script/task-util/src/oxlint-augment.ts` line 30.

## Working-tree state at handover

Out-of-scope modifications already in the working tree (NOT touched by
this task; carry-over from prior sessions and from running
`mise run //:format`):

- `.pnpmfile.mjs`
- `AGENTS.md`
- `packages/claude-code-plugins/session-start-housekeeping/dist/final/node/index.mjs`
- `packages/cli/forbidden-strings/README.md`
- `packages/cli/forbidden-strings/fuzz/Cargo.toml`
- `packages/cli/forbidden-strings/fuzz/dictionaries/forbidden-strings.dict`
- `packages/figma-parsers/penpot/src/index.ts`
- `packages/pi/advisor/src/commands.ts`
- `packages/pi/advisor/src/context.unit.test.ts`
- `packages/pi/advisor/src/model-cost.ts`
- `packages/pi/advisor/src/rendering-summary.ts`
- `packages/pi/advisor/src/tool.ts`
- `pnpm-lock.yaml`

Every file I changed for this task is committed; leave the above alone
unless the user asks otherwise.

## If you need to resume / extend

### Immediate next steps (in order)

1. **Finish task-util**: overwrite `oxlint-augment.ts` via Write to
   replace the two remaining regex literals. The replacement approach
   for both is described in "Pending" above. Use Write (not Edit)
   because of the `` issue.

2. **Refactor watch-restart**: 18 errors. Run
   `mise run //packages/dev-script/watch-restart:lint 2>&1 | grep -A 4 require-regex`
   to enumerate.

3. **Clean up inference-canary warnings**: 44 warnings introduced by
   this session's refactor; see the bulleted list in "Pending".

4. **Final workspace lint**: `mise run //:lint` should hit 0 across the
   board. Capture the output and compare against `/tmp/lint-final3.log`
   to confirm nothing else regressed.

5. **Commit per logical unit**: one commit per package per AGENTS.md.
   Use the commit-message shape that already landed (e.g. the
   inference-canary commit).

6. **Optional**: per-package `:test:unit` for the packages that have
   one. The packages I touched that have `test:unit`:
   - vmsync (passed in earlier sessions)
   - source (passed)
   - deps-cube (catalog.unit.test.ts and render-html.unit.test.ts were
     edited; run `mise run //packages/dev-script/deps-cube:test:unit`)
   - oxlint-stylistic (oxlint-stylistic.unit.test.ts edited; run
     `mise run //packages/config/oxlint-stylistic:test:unit`)

### If a downstream test fails

- `UncertaintyMatch.pattern` field was dropped in an earlier commit.
  Only consumer outside `uncertainty*.ts` is `stop-reminders/index.ts`,
  which reads `.phrase`. No other readers exist.
- `linter-artifacts-timestamp.ts` exports changed from
  `ARTIFACT_DIR_PATTERN` / `FAILURE_DIR_PATTERN` (RegExp) to
  `parseArtifactDir` / `parseFailureDir` (functions returning parsed
  parts). Only consumer is `linter-artifacts-recent.ts`, which was
  updated in the same commit.
- `watch-filesystem-filter.ts` (editord) export changed from
  `EDITORD_TEMP_PATTERN` (RegExp) to `isEditordTempFile` (predicate).
  Only consumer was `watch-filesystem.ts`, updated in the same commit.

### Closing out

When all pending items are done, delete this `HANDOVER.*` file (the
user reviews and decides whether to keep it).
