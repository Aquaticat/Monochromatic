# Lint sweep handover

Resume point for the workspace-wide lint sweep. A fresh agent should be able to continue from here with no prior conversation context.

## Goal

Fix all lint issues across active packages so `mise run lint` exits 0.
`denyWarnings` is on, so warnings count as failures.
`module/es` is EXCLUDED from this sweep (it is being split in a later session); leave its violations alone.

## What is already done (committed)

- Formatting: `chain-per-line` autofix and `mise run format` converged (style commits).
- Two new custom oxlint rules in `packages/config/oxlint-no-restricted-syntax`, both enabled at `error` in `packages/config/oxlint/src/rules/restriction.ts`:
    - `no-nullish-union`: bans `T | undefined` and `T | null` (commit 5954a771).
    - `no-optional-escape`: bans `| void`, `| never`, `| unknown`/`| any`, `| {}`, falsy literals (`| ""`, `` | `` ``, `| 0`, `| -1`, `| false`, gated on a non-literal union member), empty/optional/named-optional/rest-only tuples, `Partial<T>`, `Record<K, never>`, `Pick<T, never>`, optionality-adding mapped types (commit e2741a08).
- AGENTS.md rule forbidding preemptive cli-git bypass (commit 17f79a17). CLAUDE.md is gitignored and regenerated from AGENTS.md via `mise run sync:files`.
- Research doc `docs/research/optionality-enforcement.md` (commit 039ec6db).
- GitHub issue #213 filed for future improvement of the two rules (the syntax-only rules miss runtime/binding-resolution escapes; those are tractable with more effort, not unbannable).
- All 12 shared `module/*` packages re-fixed under the final rules with proper patterns: kv-store (b76ec75f), toml-edit (a7e908d8), logger (60325d59), fs-path (c039ca94), hyperscript (843a9745), image-diff (2631fb84), dom (3826946b), or-throw (70888390), test (097c10c7), observable (49e30157), i18n-compose (58dab75a).
- Leaves wave L1: deps-cube (0764b13c), done-postcss (926ef363), messages-demo (b1d3be9a), auto-mode (e8c5ba80), inference-canary (ea4f2041).

## In progress: webapp-productivity/done (UNCOMMITTED) + oxlint investigation lead

Status: ~100 of 102 oxlint violations fixed across 38 edited source files (all uncommitted, on disk). The tsgo build is clean (0 TS errors as of `/tmp/done-lint3.txt`). Two `prefer-readonly-parameter-types` warnings remain, and BOTH are suspected tsgolint/oxc bugs, not real violations. Do NOT commit: the package is not green, and the two remaining items must be diagnosed first.

The lint-clean sibling `packages/webapp-productivity/done-postcss` is the same app, already fixed (commit 926ef363); it is the gold blueprint for every pattern below.

Patterns applied (mirroring done-postcss):

- Domain `Task`/`TaskCreateInput`/`TaskUpdateInput` in `src/lib/types.ts`: `T | null` fields became `readonly foo?: T` (`?:` optionality), all fields `readonly`, arrays `readonly T[]`.
- `TaskRow` (raw DB row, `src/lib/db/tasks-helpers.ts`): kept `T | null` wrapped in a block `oxlint-disable no-restricted-syntax/no-nullish-union` justified as the `@tursodatabase/database` `.get()/.all()` boundary (SQLite NULL -> JS null). `mapTask` converts null -> absent via a mutable accumulator (`{ -readonly [K in keyof Task]: Task[K] }`) assigning nullable columns only when present.
- Symbol sentinels replace `| null`/`| undefined` returns and "unset" states: `TASK_NOT_FOUND` (types.ts; getTaskById/getTaskRowById/updateTask/startTaskTimer/stopTaskTimer/completeTask), `SETTING_ABSENT` (db/settings.ts getSetting), `INVALID` (server/api/tasks-parse.ts; parseStringArray/parseEnumValue/parseStatus/parseTaskUpdateInput), `ARGUMENT_ABSENT` (lib/args.ts getArgumentValue; consumers server.ts + lib/db.ts), `METADATA_UNSET` (task-detail-types.ts MetadataState priority/complexity), `NO_TIMER`/`NO_ABORT` (task-detail-autofill.ts, toast-message.ts, search-bar uses optional `{handle?}`), `CHIP_NOT_FOUND` (lib/task-card.ts getChipElement).
- `AutofillManager` class -> `createAutofillController` factory (fixes `no-class`): callback-based (`getState`/`setState`/`updateDisplay`) so it never mutates a borrowed object; task-detail.ts reassigns its `#metadata` wholesale via the setState callback.
- `parseEnumValue` de-generified (fixes `no-unnecessary-type-parameters`); `page-data.ts readPageData<TData>` kept its return-only generic under a justified block `oxlint-disable no-unnecessary-type-parameters` (inlining would push casts to 5 call sites; mirrors done-postcss verbatim).
- `consistent-function-scoping`: hoisted `handleStop`/`handleSearch`/`handleComplete` to module scope (in-progress.ts, search.ts); hoisted `readStaticContents`/`getStaticMetadata` in server.ts and typed meta via `Awaited<ReturnType<ServeStaticOptions['getMeta']>>` to avoid a literal `Stats | undefined`.
- `no-misused-promises`/`strict-void-return`: task-card.ts checkbox `click` handler made non-async, `void options.onToggleComplete(...)`.
- `prefer-readonly-parameter-types`: added `readonly` to many param-object types; `client/lib/api.ts` introduced a readonly `ApiRequestOptions` (method/body/headers) replacing `RequestInit`; ai/client.ts `ChatMessage`/`ChatCompletionOptions` deep-readonly; ai/prompts.ts param objects readonly + summary fields `?:`; layout.ts `LayoutOptions` readonly; inbox-builders.ts added `BlockedTasksByBlocker = Readonly<Record<string, readonly BlockedTaskLink[]>>` (dropped a redundant `| undefined` value union; `noUncheckedIndexedAccess` supplies it at access).

The two REMAINING `prefer-readonly-parameter-types` warnings (the investigation, HIGHER priority than finishing the lint per the user):

1. `src/client/mixins.ts:253` `focusOutline({ readonly offset?: CssValue } = {})`. `CssValue` is `string & { readonly __cssValue: unique symbol }` (branded readonly string, `@monochromatic-dev/module-hyperscript` `src/css/values.ts:26`). The property is readonly and the brand is readonly, so it should pass, yet it is flagged. Not in the allow-list. `focusOutline` is called both `focusOutline()` and `focusOutline({ offset: cssRem(FOCUS_OFFSET) })` (8 style files), so the param must stay.
2. `src/server-api-routes.ts:74` `registerApiRoutes(app: H3)`. `H3` IS already in the package allow-list (`packages/config/oxlint/src/rules/prefer-readonly-parameter-types.allow-pkg.ts`, `{ from:'package', package:'h3', name:['H3','H3Event',...] }`), yet `app: H3` is still flagged. done-postcss sidesteps this by registering routes inline on a module-const `app` (no `app: H3` param) - but that is correlation, NOT a diagnosed fix; do not assume inlining is correct until the allow-list mismatch is understood.

Investigation plan (do this BEFORE editing mixins.ts or the routes further): shallow-clone oxc (and `oxc-project/tsgolint`, which implements the type-aware `prefer-readonly-parameter-types` + its `allow`/`ignoreInferredTypes` options) to `/tmp` via `gh repo clone`. Build two minimal repros (a tiny TS file + `.oxlintrc.json` enabling the rule with the h3-style `allow` entry, run with the installed type-aware oxlint): (a) an allow-listed class-typed param still flagged; (b) a branded-readonly-string param flagged. Read tsgolint's `isTypeReadonly` and the `allow`/specifier-matching code paths to find the cause. If confirmed an oxc/tsgolint bug, write `docs/troubleshooting/<topic>.md` via the `troubleshooting-doc` skill (it gates the 5-constraint upstream-filing check); oxc/tsgolint bugs are NOT upstream-exempt. Only after diagnosis decide the source fix (e.g. number-param for focusOutline, inline routes for H3, or a corrected allow-list entry).

Edited files (uncommitted) under `packages/webapp-productivity/done/src/`: lib/types.ts, lib/args.ts, lib/db.ts, lib/db/{settings,tasks,tasks-helpers,tasks-queries,tasks-timer}.ts, lib/ai/{client,prompts}.ts, server.ts, server-api-routes.ts, server/api/{ai-autofill,tasks,tasks-parse,tasks-parse-update,timer}.ts, server/pages/{layout,task-details}.ts, client/{in-progress,inbox-builders,inbox-suggested,new-task-dialog,search,mixins}.ts, client/lib/{api,page-data,task-card,task-card-helpers}.ts, client/components/{search-bar,side-drawer,side-drawer-helpers,task-detail,task-detail-autofill,task-detail-pills,task-detail-render,task-detail-types,toast-message}.ts. The `/tmp/lint-rules.txt` child prompt for this package still applies.

## Critical context: the optionality discipline

Agents repeatedly tried to dodge the bans by swapping one escape hatch for another (`| undefined` to `| null` to tuple-as-Maybe to `''` sentinels). Do not do this.

Forbidden ways to model optional or absent, even though some are not lint-detectable:

- `T | undefined`, `T | null`, `T | void` (and `| never`/`| unknown`/`| any`/`| {}`).
- tuple or array as Maybe: `[]`, `[T] | []`, `[T?]`, returning `[value]`/`[]`, or a plain `T[]` whose length encodes presence.
- disguised-empty sentinels: `''`, `0`, `-1`, `NaN`, empty array or object used to mean absent. An empty string is NOT a sentinel.
- `Partial<T>` used to dodge required-ness.
- adding an `oxlint-disable` to turn the rule off, except for a genuine external-library boundary (for example mirroring `Map.get` or DOM `querySelector`) with a justification naming the external API.

Allowed ways (use these):

- `?:` optional property or field or param (under `exactOptionalPropertyTypes`, `foo?: T` already means absent or T).
- an `if`-guard, early return, or narrowing so the value is always present where it is typed.
- throw at the boundary with `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw`.
- a real sentinel: a unique `Symbol` (for example `const ABSENT = Symbol('absent')`, narrowed by identity) or a distinct, meaningful, non-empty domain value.

kv-store contract note: `module/kv-store` exports `ABSENT` (a `unique symbol`) and `get()` returns `T | typeof ABSENT`. Consumers import `ABSENT` and narrow by `=== ABSENT`.

## Remaining work

Dispatch each leaf package to a `spawn-claude` child that fixes it to `mise run //packages/<PATH>:lint` exit 0. Counts are warnings/errors as of the last enumeration (`/tmp/lint-all4.log`), so treat them as approximate; the child should re-check its own package.

Leaf packages still to fix:

- `webapp-productivity/done`: IN PROGRESS, uncommitted; ~100/102 fixed, 2 suspected-tool-bug `prefer-readonly` warnings left. See the dedicated "In progress: webapp-productivity/done" section above before resuming.
- `pi/morph-compact` (33w 33e)
- `dev-script/watch-restart` (22w 44e)
- `pi/advisor` (33e)
- `config/oxlint-tsdoc` (28w 37e)
- `webapp-productivity/doodle-widget` (45w 16e)
- `dev-script/page-weight` (20w 12e)
- `pi/terminal-title` (23w 3e)
- `typeface/aquaticat` (18w 1e)
- `pi/thinking-defaults` (15w 5e)
- `webapp-productivity/rss` (19w 2e)
- `pi/current-time-context` (6w 4e)
- `cli/mvm` (14e), `cli/terminal-exec` (13e), `cli/vmsync` (11e), `cli/git` (8e), `cli/fy` (3e)
- `mcp/stdio` (12w 6e), `mcp/mvm` (2w)
- `config/oxlint-stylistic` (12e), `config/oxlint-no-restricted-syntax` (5w, pre-existing require-unicode-regexp in prefer-describe-function-ref-name.ts)
- `dev-script/file-enforcer` (10e), `dev-script/task-util` (11w 6e), `dev-script/catalog-tighten` (4w 6e), `dev-script/vm-builder` (7w)
- `rolldown-plugins/import-attributes` (8e), `build-tool/css` (4e)
- `desktop-daemon/hall-monitor` (7w 6e)
- `claude-code-plugins/hook-types` (3e), `claude-code-plugins/source` (3w 24e)
- `dev-script/inference-canary-viewer` (2e), `webapp-content/ssg-test` (4e)
- `module/memoize` (2e): import `ABSENT` from kv-store and narrow by identity; it broke when kv-store stopped returning `undefined`.

Open behavioral decision discovered during the sweep (NOT a lint issue):

- `module/memoize` lint is green (commit 1665ed5a), but the kv-store -> `ABSENT` migration (commit b76ec75f) changed runtime behavior: a memoized function returning `undefined` now round-trips through kv-store and gets cached, instead of being treated as a miss and recomputed. This breaks 4 unit tests (`memoize.unit.test.ts:180,207,244`, `memoize-async.unit.test.ts:195`) which assert the old "undefined is a miss" contract. Whether memoize should now cache `undefined` (arguably more correct) or keep treating it as a miss is a product decision for the user, so the tests are left untouched. Resolve the semantics, then update the 4 tests accordingly.

Manual rework that no lint rule catches (the type annotation is honest):

- `webapp-content/ssg-test` and `dev-script/inference-canary-viewer` used `''` as an absence sentinel in earlier passes. The user ruled that `''` is not a valid sentinel. Hunt these by reading the files (grep for `''` defaults and returns in slots that mean absent) and convert to `?:`, an `if`-guard, or a real Symbol or domain sentinel.

After all leaves: rebuild (`mise run build`), then run the full `mise run lint` and confirm exit 0 across active packages (excluding `module/es`).

## How to resume (mechanics)

- Spawn children with `spawn-claude --cwd /var/home/user/Monochromatic "<prompt>"`. It prints `{"spawnId":"<uuid>"}`. Results are forwarded back automatically; poll `~/.claude/spawn-results/spawns/<id>.json` for `status`, or watch `git log` for the child's commit.
- The child prompt template is at `/tmp/lint-rules.txt`. If that file is gone, reconstruct it from the forbidden/allowed lists above plus: each child fixes ONE package (or a small named batch) to lint-zero, commits with a SCOPED pathspec (`git add packages/<PATH>` then `git commit packages/<PATH> -m ...`), uses NO `--no-enforce-bulk-add` or `--no-enforce-only` flags, and reports tersely.
- NEVER run a `config/oxlint*` package (`oxlint`, `oxlint-tsdoc`, `oxlint-stylistic`, `oxlint-no-restricted-syntax`) concurrently with any leaf child. Those packages DEFINE the rules every other child lints against; editing them mid-flight shifts the ground under every running child and produces unstable, non-reproducible results. Fix the config packages in their own isolated wave, one at a time, only when zero leaf children are running.
- Order: polish the `config/oxlint*` packages EARLY, before launching further leaf waves, so later leaves lint against settled rules. The user prefers the oxlint config stable first. (The in-flight leaves already running on the current ground are allowed to finish first; the rule is "no NEW leaf wave until the config packages are done.") Config packages are an early isolated serial phase, not the final one.
- Use a Monitor (background/until-loop) to wait on child completion, not a foreground polling loop in the main session: repeated poll output pollutes the parent context. Watch a condition (new `fix(`/`test(` commits, or `pgrep ghostty` dropping to baseline) and only surface the result.
- Concurrency is NOT capped at a small number by resources. This machine has 16 cores (`os.availableParallelism()` == 16) and runs 16 sessions fine. Scale child concurrency toward `os.availableParallelism()`, not a guessed ceiling; check it rather than assuming.
- There was one incident where new `ghostty -e claude` sessions hung at startup (Claude exited before initializing; the terminal became an empty husk) with around 12 lingering terminals. Do NOT treat this as a reproducible resource limit: it happened once and did not recur. It is debuggable in principle (Claude Code is closed-source but its compiled JS can be extracted and read), just not worth that effort for a non-recurring one-off. If new children stop producing live sessions, that single failure mode is a candidate, and the user must close stale terminal windows (killing them needs explicit user authorization; the auto-mode classifier blocks mass-kills), but it is an unexplained one-off, not a cap to design around.
- Do NOT trust the `status` field in `~/.claude/spawn-results/spawns/<id>.json` to find live children: it does not reset to `stopped`/`reported` on abrupt termination, so hundreds of stale files read `"running"`. For an actual live count use `find ~/.claude/spawn-results/spawns/ -name '*.json' -mmin -30` plus `pgrep -af ghostty`, not the JSON status.
- `cli/git` implements the cli-git enforcement guard itself. Fix it LAST (or, right after its commit lands, confirm the guard still rejects `git add -A` in a throwaway `git init` repo before launching more children); a regression there breaks every later child's scoped commit and stalls the sweep.
- Do NOT fix shared oxlint config packages concurrently with anything else. `config/oxlint-tsdoc`, `config/oxlint-stylistic`, `config/oxlint-no-restricted-syntax`, and `config/oxlint` define the rules every other package lints against; editing them mid-flight shifts the lint baseline under every concurrent child (they end up working on unstable ground). Fix these SERIALLY, after all consumer packages are green, one at a time, re-running a full fanout lint between each. Treat them like `cli/git`: a final, isolated, single-child phase.
- Other recurring lint categories and their fixes: `prefer-readonly-parameter-types` (mark params readonly, find the structural root in shared types; if `TS2540` "cannot assign to read-only property" appears, use a mutable internal type with a readonly public view rather than widening); `require-unicode-regexp` (add `u` to the existing guarded regex); `max-lines` (split the file into siblings, never raise the limit); `no-class` (prefer factory closures); `consistent-function-scoping` (hoist non-capturing inner functions).
- `claude-code-plugins/*/dist/*.mjs` showing as modified is harmless build-artifact churn from rebuilds. Leave it uncommitted for the user; do not commit hook infrastructure during the autonomous sweep.

## References

- Optionality rules: `packages/config/oxlint-no-restricted-syntax/src/rules/no-nullish-union.ts`, `no-optional-escape.ts`.
- Research: `docs/research/optionality-enforcement.md`.
- Future rule work: GitHub issue #213.
- The development guidelines in AGENTS.md govern everything (commit eagerly per logical unit, scoped commits, no rule loosening, log extensively, comprehensive TSDoc).
