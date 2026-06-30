# Raw findings: TSDoc inline-link audit (issue #265)

Raw per-batch subagent output for `docs/handover/tsdoc-link-audit-issue-265.md`.
Working data only, not prose; deleted once the audit is compiled and posted
as a comment on issue #265 (`DL4`).

Format: `<path>:<line> | <downgraded-link|missing-reference> | current: "<snippet>" | target: <Name> (<location>)`

## Batch 01 (file-enforcer)

(pending)

## Batch 02 (mvm, mutation-test, async-time, claude-spawn)

TOTAL FINDINGS: 44. No findings in `claude-code-plugins/claude-spawn`.

Systematic pattern: in `packages/cli/mvm`, functions dispatching to two
OS-specific or branch-specific sibling implementations (`ensureTemplate`
-> `ensureLinuxTemplate`/`ensureWindowsTemplate`,
`templateRuncmd`/`vmAutologin` -> systemd/OpenRC variants, `domainXml` ->
its builder helpers, `generateAutounattend` ->
`windowsPeSection`/`virtioInstallCommand`/`createIso`) consistently
describe each branch's behavior in prose ("For Linux: ...", "For
Windows: ...") without ever naming the delegate function that implements
it, even though it's directly imported and called; these read as
narrative from the start, not link-bug casualties. Smaller pattern:
sentinel/constant values (`NO_SEED_ISO`, `VMS_DIR`, `NOT_A_DATA_ROW`,
`HetznerApiError`) named correctly in prose at point of use but
consistently lose the `{@link}` wrapper, plausibly real casualties of the
linter bug. Only one custom error class exists in the batch
(`HetznerApiError`); everything else throws bare `Error`, correctly out
of scope.

```
packages/cli/mvm/src/autounattend-winpe.ts:12 | missing-reference | current: not mentioned | target: pnpDriverPaths (packages/cli/mvm/src/autounattend-virtio.ts)
packages/cli/mvm/src/autounattend.ts:22 | missing-reference | current: not mentioned | target: windowsPeSection (packages/cli/mvm/src/autounattend-winpe.ts), virtioInstallCommand (packages/cli/mvm/src/autounattend-virtio.ts)
packages/cli/mvm/src/autounattend.ts:129 | missing-reference | current: not mentioned | target: createIso (packages/cli/mvm/src/iso9660.ts), generateAutounattend (sibling, same file)
packages/cli/mvm/src/backends/hetzner/api-resources.ts:44 | downgraded-link | current: "HetznerApiError with code" (plain text) | target: HetznerApiError (packages/cli/mvm/src/backends/hetzner/api.ts)
packages/cli/mvm/src/backends/hetzner/api.ts:174 | downgraded-link | current: "HetznerApiError when the response" (plain text) | target: HetznerApiError (sibling, same file, defined line 66)
packages/cli/mvm/src/backends/hetzner/exec.ts:6 | downgraded-link | current: "`hetznerRun`" | target: hetznerRun (sibling, same file, defined line 186)
packages/cli/mvm/src/backends/hetzner/lifecycle.ts:126 | missing-reference | current: not mentioned (@throws only says generic Error) | target: HetznerApiError (packages/cli/mvm/src/backends/hetzner/api.ts), function checks `error instanceof HetznerApiError` directly
packages/cli/mvm/src/backends/hetzner/lifecycle.ts:450 | downgraded-link | current: "provisionFromSnapshot" (plain text) | target: provisionFromSnapshot (sibling, same file, defined line 344)
packages/cli/mvm/src/backends/libvirt/index.ts:30 | downgraded-link | current: "`create`" | target: create (packages/cli/mvm/src/create.ts)
packages/cli/mvm/src/backends/types.ts:35 | downgraded-link | current: "`create`" | target: create (packages/cli/mvm/src/create.ts)
packages/cli/mvm/src/clone.ts:125 | downgraded-link | current: "`VMS_DIR`" | target: VMS_DIR (packages/cli/mvm/src/config.ts)
packages/cli/mvm/src/clone.ts:177 | downgraded-link | current: "NO_SEED_ISO for Windows" (plain text) | target: NO_SEED_ISO (packages/cli/mvm/src/cloud-init.ts)
packages/cli/mvm/src/cloud-init-init-systems.ts:113 | missing-reference | current: not mentioned (dispatches to the correct template runcmd generator) | target: templateRuncmdOpenrc, templateRuncmdSystemd (sibling, same file)
packages/cli/mvm/src/cloud-init-init-systems.ts:131 | missing-reference | current: not mentioned (dispatches to the correct autologin generator) | target: vmAutologinOpenrc, vmAutologinSystemd (sibling, same file)
packages/cli/mvm/src/create.ts:131 | downgraded-link | current: "`VMS_DIR`" | target: VMS_DIR (packages/cli/mvm/src/config.ts)
packages/cli/mvm/src/create.ts:206 | downgraded-link | current: "NO_SEED_ISO for Windows" (plain text) | target: NO_SEED_ISO (packages/cli/mvm/src/cloud-init.ts)
packages/cli/mvm/src/destroy.ts:100 | downgraded-link | current: "`destroy`" | target: destroy (enclosing function, same file)
packages/cli/mvm/src/destroy.ts:124 | downgraded-link | current: "`destroyAll`" | target: destroyAll (enclosing function, same file)
packages/cli/mvm/src/domain-xml.ts:41 | missing-reference | current: not mentioned (describes Hyper-V/clock/CDROM behavior generically) | target: hypervFeatures, clockElement, ideCdromDevices, commonDevices (packages/cli/mvm/src/domain-xml-builders.ts)
packages/cli/mvm/src/download-progress.ts:102 | missing-reference | current: not mentioned | target: pollProgress (sibling, same file)
packages/cli/mvm/src/file-transfer.ts:48 | downgraded-link | current: "`{GUEST_MOUNT_POINT}/{filename}`" | target: GUEST_MOUNT_POINT (packages/cli/mvm/src/config.ts)
packages/cli/mvm/src/file-transfer.ts:49 | downgraded-link | current: "`{WINDOWS_GUEST_MOUNT_POINT}\{filename}`" | target: WINDOWS_GUEST_MOUNT_POINT (packages/cli/mvm/src/config.ts)
packages/cli/mvm/src/file-transfer.ts:90 | downgraded-link | current: "`pushFile`" | target: pushFile (enclosing function, same file)
packages/cli/mvm/src/file-transfer.ts:191 | downgraded-link | current: "`pullFile`" | target: pullFile (enclosing function, same file)
packages/cli/mvm/src/image.ts:87 | downgraded-link | current: "`writeWithProgress`" | target: writeWithProgress (packages/cli/mvm/src/download-progress.ts)
packages/cli/mvm/src/index-parsers-cmds.ts:32 | downgraded-link | current: "Subcommand parser producing MvmArgs" (plain text) | target: MvmArgs (packages/cli/mvm/src/index-parsers.ts)
packages/cli/mvm/src/index.ts:4 | downgraded-link | current: "create, clone, destroy, list, update" (plain text, parenthetical) | target: create/clone/destroy/destroyAll/list/update (sibling re-exports, same package)
packages/cli/mvm/src/index.ts:5 | downgraded-link | current: "(exec, run), ... (pushFile, pullFile)" (plain text, parenthetical) | target: exec/run/pushFile/pullFile (sibling re-exports, same package)
packages/cli/mvm/src/index.ts:6 | downgraded-link | current: "`selectBackend`, `resolveBackendKind`, `BACKENDS`" | target: selectBackend, resolveBackendKind, BACKENDS (packages/cli/mvm/src/backends/registry.ts)
packages/cli/mvm/src/list.ts:227 | downgraded-link | current: "NOT_A_DATA_ROW for header/separator" (plain text) | target: NOT_A_DATA_ROW (sibling, same file, defined line 28)
packages/cli/mvm/src/meta.ts:176 | downgraded-link | current: "`VmMeta`" | target: VmMeta (sibling, same file, defined line 39)
packages/cli/mvm/src/meta.ts:232 | downgraded-link | current: "`VmMeta`" | target: VmMeta (sibling, same file, defined line 39)
packages/cli/mvm/src/template-linux.ts:137 | downgraded-link | current: "NO_SEED_ISO for Windows" (plain text) | target: NO_SEED_ISO (packages/cli/mvm/src/cloud-init.ts)
packages/cli/mvm/src/template-windows.ts:233 | downgraded-link | current: "`exec()`" | target: exec (packages/cli/mvm/src/exec.ts)
packages/cli/mvm/src/template-windows.ts:342 | downgraded-link | current: "`defineVm`" | target: defineVm (packages/cli/mvm/src/virsh.ts)
packages/cli/mvm/src/template.ts:25 | missing-reference | current: not mentioned (Linux/Windows bullets describe behavior generically) | target: ensureLinuxTemplate (packages/cli/mvm/src/template-linux.ts), ensureWindowsTemplate (packages/cli/mvm/src/template-windows.ts)
packages/cli/mvm/src/update.ts:23 | missing-reference | current: not mentioned (mirrors template.ts wording) | target: ensureTemplate (packages/cli/mvm/src/template.ts)
packages/cli/mvm/src/virsh-wait.ts:77 | downgraded-link | current: "`virsh`" | target: virsh (packages/cli/mvm/src/virsh.ts)
packages/cli/mvm/src/virsh-wait.ts:154 | downgraded-link | current: "`virsh`" | target: virsh (packages/cli/mvm/src/virsh.ts)
packages/dev-script/mutation-test/src/index.ts:116 | missing-reference | current: not mentioned | target: runCli (packages/dev-script/mutation-test/src/host-runner.ts)
packages/module/async-time/src/index.ts:4 | downgraded-link | current: "`wait(ms)`" | target: wait (packages/module/async-time/src/wait.ts)
packages/module/async-time/src/index.ts:5 | downgraded-link | current: "`withTimeout({ promise, ms, label })`" | target: withTimeout (packages/module/async-time/src/with-timeout.ts)
```

## Batch 03 (toml-edit, linkup, throws)

(pending)

## Batch 04 (no-restricted-syntax, git, numeric-format, correction-reminder)

(pending)

## Batch 05 (done-postcss, i18n-compose, fy, backup-path)

TOTAL FINDINGS: 68. No findings in `packages/cli/fy/*` or
`packages/dev-script/backup-path/*` (both already consistently use
`{@link Name}` for sentinels and cross-file references).

Systematic patterns: (1) `done-postcss` has a deliberate `{@link SENTINEL}`
convention for absent-value sentinels (`TASK_NOT_FOUND`,
`ARGUMENT_ABSENT`, `SETTING_ABSENT`, `INVALID`, `NOT_FOUND`) applied
correctly in most `@returns` tags, but the same sentinel re-mentioned
later in a local-variable doc inside the function body uses a bare
backtick instead, as if the link was added once at the top-level doc and
never propagated to repeated body-level mentions. (2) Type docs
describing "the payload accepted by `someFunction()`" consistently name
the producer/consumer function in backticks rather than linking it
(`TaskCreateInput`/`createTask`, `TaskUpdateInput`/`updateTask`,
`NewTaskDialog`/`createNewTaskDialog`,
`AutofillController`/`createAutofillController`,
`LocaleSpec`/`createI18n`, the three `defineXLocale` functions).
(3) `i18n-compose`'s `@module`-tagged file-overview comments are the
richest source of unlinked cross-file references. (4) Several CSS
component files define a `*_Z_INDEX` sibling constant interpolated into
the styles string but never mentioned in the doc at all (true
missing-reference).

```
packages/webapp-productivity/done-postcss/src/client/components/fab-button.ts:10 | missing-reference | current: not mentioned | target: FAB_Z_INDEX (same file, line 7)
packages/webapp-productivity/done-postcss/src/client/components/focus-dropdown-styles.ts:12 | missing-reference | current: not mentioned | target: MENU_Z_INDEX (same file, line 9)
packages/webapp-productivity/done-postcss/src/client/components/toast-message.ts:10 | missing-reference | current: not mentioned | target: TOAST_Z_INDEX (same file, line 7)
packages/webapp-productivity/done-postcss/src/client/components/side-drawer-panel-styles.ts:14 | missing-reference | current: not mentioned | target: PANEL_Z_INDEX (same file, line 11)
packages/webapp-productivity/done-postcss/src/server.ts:95 | downgraded-link | current: "@throws HTTPError 400 when parameter is missing" | target: HTTPError (external: h3 package)
packages/webapp-productivity/done-postcss/src/server.ts:77 | downgraded-link | current: "`NaN` falls back to `DEFAULT_PORT`" | target: DEFAULT_PORT (same file, line 46)
packages/webapp-productivity/done-postcss/src/client/components/task-detail.ts:54 | downgraded-link | current: "Mutable priority state; `METADATA_UNSET` until a value is selected" | target: METADATA_UNSET (src/client/components/task-detail-types.ts)
packages/webapp-productivity/done-postcss/src/client/components/task-detail.ts:59 | downgraded-link | current: "Mutable complexity state; `METADATA_UNSET` until a value is selected" | target: METADATA_UNSET (src/client/components/task-detail-types.ts)
packages/webapp-productivity/done-postcss/src/client/components/task-detail.ts:190 | downgraded-link | current: "updates are skipped until `configure()` has run" | target: configure (TaskDetail.configure, same file line 135)
packages/webapp-productivity/done-postcss/src/client/components/toast-message.ts:49 | downgraded-link | current: "Handle for the auto-dismiss timer; `NO_TIMER` when not scheduled" | target: NO_TIMER (same file, line 36)
packages/webapp-productivity/done-postcss/src/client/components/toast-message.ts:62 | downgraded-link | current: "Renders content and schedules auto-removal after `DISMISS_MS`" | target: DISMISS_MS (same file, line 31)
packages/webapp-productivity/done-postcss/src/client/lib/task-card.ts:18 | downgraded-link | current: "Sentinel returned by `getChipElement` when no chip matches" | target: getChipElement (TaskCard.getChipElement, same file)
packages/webapp-productivity/done-postcss/src/client/lib/task-card.ts:70 | downgraded-link | current: "Matching chip element, or `CHIP_NOT_FOUND` when none matches" | target: CHIP_NOT_FOUND (same file, line 20)
packages/webapp-productivity/done-postcss/src/client/lib/task-card.ts:117 | downgraded-link | current: "@returns Configured TaskCard element" | target: TaskCard (same file)
packages/webapp-productivity/done-postcss/src/lib/ai/client.ts:214 | downgraded-link | current: "Parsed completion payload; shape matches `ChatCompletionResponse`" | target: ChatCompletionResponse (packages/module/llm-types/src/completion.ts)
packages/webapp-productivity/done-postcss/src/lib/db.ts:45 | downgraded-link | current: "`DB_PATH` env var > `DEFAULT_DATABASE_PATH`" | target: DEFAULT_DATABASE_PATH (same file, line 27)
packages/webapp-productivity/done-postcss/src/lib/db/task-mapping.ts:81 | downgraded-link | current: "Converts a raw SQLite `TaskRow` to the application-level `Task` shape" | target: TaskRow (src/lib/db/task-sql.ts)
packages/webapp-productivity/done-postcss/src/lib/db/task-mapping.ts:81 | downgraded-link | current: "to the application-level `Task` shape" | target: Task (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/lib/db/task-sql.ts:17 | downgraded-link | current: "Raw SQLite row shape before mapping to the application-level `Task` type" | target: Task (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/lib/db/task-queries.ts:217 | downgraded-link | current: "FTS-matched rows joined with the blocked flag; mapped to `SearchTask` below" | target: SearchTask (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/lib/db/task-timer.ts:38 | downgraded-link | current: "Outcome of a `completeTask()` call: carries blockers when completion is refused" | target: completeTask (same file)
packages/webapp-productivity/done-postcss/src/lib/db/task-timer.ts:95 | downgraded-link | current: "Existing task; absent task short-circuits with `TASK_NOT_FOUND`" | target: TASK_NOT_FOUND (src/lib/types.ts), inconsistent with same file's own @returns at line 86 which already uses {@link TASK_NOT_FOUND}
packages/webapp-productivity/done-postcss/src/server/api/tasks.ts:185 | downgraded-link | current: "Updated task; `TASK_NOT_FOUND` triggers a 404 when the row was removed concurrently" | target: TASK_NOT_FOUND (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/server/api/timer.ts:35 | downgraded-link | current: "Updated task with the freshly set `timerStartedAt`; `TASK_NOT_FOUND` triggers a 404" | target: TASK_NOT_FOUND (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/server/api/timer.ts:61 | downgraded-link | current: "Updated task with accumulated tracked time; `TASK_NOT_FOUND` triggers a 404" | target: TASK_NOT_FOUND (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/server/api/task-validation-update.ts:47 | downgraded-link | current: "Validates and extracts a `TaskUpdateInput` from an untrusted request body" | target: TaskUpdateInput (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/server/api/task-validation-update.ts:67 | downgraded-link | current: "Mutable mirror of the readonly `TaskUpdateInput`" | target: TaskUpdateInput (src/lib/types.ts)
packages/webapp-productivity/done-postcss/src/server/api/task-validation-update.ts:85 | downgraded-link | current: "Parsed `tags` array; `INVALID` aborts the parse" | target: INVALID (src/server/api/task-validation.ts), plus 6 more identical cases at lines 94, 103, 112, 122, 136, 156
packages/webapp-productivity/done-postcss/src/lib/types.ts:125 | downgraded-link | current: "Payload accepted by `createTask()`: only `title` is required" | target: createTask (src/lib/db/tasks.ts)
packages/webapp-productivity/done-postcss/src/lib/types.ts:140 | downgraded-link | current: "Partial update payload accepted by `updateTask()`" | target: updateTask (src/lib/db/tasks.ts)
packages/webapp-productivity/done-postcss/src/client/components/task-detail-types.ts:66 | downgraded-link | current: "Configuration payload passed to `TaskDetail.configure()`" | target: TaskDetail (src/client/components/task-detail.ts)
packages/webapp-productivity/done-postcss/src/client/components/task-detail-autofill.ts:62 | downgraded-link | current: "Public surface returned by `createAutofillController`" | target: createAutofillController (same file)
packages/webapp-productivity/done-postcss/src/client/components/task-detail-autofill.ts:146 | missing-reference | current: not mentioned | target: AutofillResult (src/client/components/task-detail-types.ts), body casts response.json() directly to AutofillResult
packages/webapp-productivity/done-postcss/src/client/new-task-dialog.ts:38 | downgraded-link | current: "Return value of `createNewTaskDialog`" | target: createNewTaskDialog (same file)
packages/webapp-productivity/done-postcss/src/client/lib/page-data.ts:4 | downgraded-link | current: "element that `renderPage()` (or the inline HTML shells) embed in every page" | target: renderPage (src/server/pages/layout.ts)

packages/module/i18n-compose/src/locale-spec.ts:2 | downgraded-link | current: "`LocaleSpec` is the uniform output produced by every locale builder" | target: LocaleSpec (self, same file)
packages/module/i18n-compose/src/locale-spec.ts:5 | downgraded-link | current: "vocabulary entry shapes (e.g. `EnglishVerbEntry`)" | target: EnglishVerbEntry (src/locales/en/types.ts)
packages/module/i18n-compose/src/locale-spec.ts:6 | downgraded-link | current: "emit this single shape so `createI18n` can dispatch render calls" | target: createI18n (src/create-i18n.ts)
packages/module/i18n-compose/src/locale-spec.ts:21 | downgraded-link | current: "stored under a loose `AnyLocaleSpec` constraint" | target: AnyLocaleSpec (src/create-i18n.ts, line 31; not exported, a literal link may not resolve cross-file)
packages/module/i18n-compose/src/locale-spec.ts:22 | downgraded-link | current: "constraint inside `createI18n`" | target: createI18n (src/create-i18n.ts)
packages/module/i18n-compose/src/locale-spec.ts:26 | downgraded-link | current: "instead of repeating methods on the public `LocaleSpec` shape" | target: LocaleSpec (self, same file)
packages/module/i18n-compose/src/create-i18n.ts:2 | downgraded-link | current: "`createI18n` builds the explicit-locale render surface" | target: createI18n (self, same file)
packages/module/i18n-compose/src/create-i18n.ts:169 | downgraded-link | current: "Locale used by `assertLocale` when an invalid value is rejected" | target: assertLocale (same file, local function inside createI18n)
packages/module/i18n-compose/src/create-i18n.ts:236 | downgraded-link | current: "@throws Error from `assertLocale` when the supplied value is not in `locales`" | target: assertLocale (same file)
packages/module/i18n-compose/src/create-i18n.ts:271 | downgraded-link | current: "Locale lookup set for `isLocale`" | target: isLocale (same file, local function inside createI18n)
packages/module/i18n-compose/src/create-i18n.ts:310 | downgraded-link | current: "@returns same value, narrowed to `Locale`" | target: Locale (same file, local type alias, line 268)
packages/module/i18n-compose/src/grammar-primitives.ts:12 | downgraded-link | current: "from a `SubjectEntry` keyed by the consumer's subject identifier" | target: SubjectEntry (src/entries.ts)
packages/module/i18n-compose/src/locales/custom.ts:2 | downgraded-link | current: "escape hatch for locales not covered by `defineEnglishLocale`" | target: defineEnglishLocale (src/locales/en/index.ts)
packages/module/i18n-compose/src/locales/custom.ts:3 | downgraded-link | current: "`defineChineseLocale`, or `defineCatalanLocale`" | target: defineChineseLocale (src/locales/zh/index.ts), defineCatalanLocale (src/locales/ca/index.ts)
packages/module/i18n-compose/src/locales/ca/index.ts:25 | downgraded-link | current: "@returns spec ready to plug into `createI18n`" | target: createI18n (src/create-i18n.ts)
packages/module/i18n-compose/src/locales/en/index.ts:24 | downgraded-link | current: "@returns spec ready to plug into `createI18n`" | target: createI18n (src/create-i18n.ts)
packages/module/i18n-compose/src/locales/zh/index.ts:25 | downgraded-link | current: "@returns spec ready to plug into `createI18n`" | target: createI18n (src/create-i18n.ts)
packages/module/i18n-compose/src/locales/ca/types.ts:41 | downgraded-link | current: "Input shape accepted by `defineCatalanLocale`" | target: defineCatalanLocale (src/locales/ca/index.ts)
packages/module/i18n-compose/src/locales/en/types.ts:59 | downgraded-link | current: "Input passed to `defineEnglishLocale`" | target: defineEnglishLocale (src/locales/en/index.ts)
packages/module/i18n-compose/src/locales/zh/types.ts:39 | downgraded-link | current: "Input shape accepted by `defineChineseLocale`" | target: defineChineseLocale (src/locales/zh/index.ts)
packages/module/i18n-compose/src/locales/ca/render-sentence-helpers.ts:36 | downgraded-link | current: "call boundary as `undefined`; `joinTokens` drops the empty-string result" | target: joinTokens (src/render-helpers.ts)
packages/module/i18n-compose/src/locales/ca/render-sentence-helpers.ts:69 | downgraded-link | current: "call boundary as `undefined`; `joinTokens` drops the empty-string result" | target: joinTokens (src/render-helpers.ts)
packages/module/i18n-compose/src/locales/en/render-sentence-helpers.ts:37 | downgraded-link | current: "call boundary as `undefined`; `joinTokens` drops the empty-string result" | target: joinTokens (src/render-helpers.ts)
packages/module/i18n-compose/src/locales/en/render-sentence-helpers.ts:70 | downgraded-link | current: "call boundary as `undefined`; `joinTokens` drops the empty-string result" | target: joinTokens (src/render-helpers.ts)
packages/module/i18n-compose/src/locales/zh/render-sentence.ts:37 | downgraded-link | current: "call boundary as `undefined`; `joinTokens` drops the empty-string result" | target: joinTokens (src/render-helpers.ts)
packages/module/i18n-compose/src/locales/zh/render-sentence.ts:64 | downgraded-link | current: "call boundary as `undefined`; `joinTokens` drops the empty-string result" | target: joinTokens (src/render-helpers.ts)
```

## Batch 06 (aquati.cat, markdown-lint, islands-black, async-iter)

(pending)

## Batch 07 (stylistic, model-selection, watch-restart, zip-writer, stop-reminders, terminal-title)

TOTAL FINDINGS: 82.

Systematic patterns: highest-confidence cluster is `pi-shared/model-selection`'s
`NoBudgetModelError` class (`budget-report.ts`) — every `@throws` mention
across `budget-override.ts`/`budget-selection.ts` is plain text, and two
functions that throw it (`findSameProvider`, `findAnyProvider`) have no
`@throws` tag at all; matches the issue's described bug exactly. Broader
pattern in `oxlint-plugins/stylistic`: correctly links sibling "Parameters
for X" types but leaves local sentinel constants (`LEAF`, `STOP`,
`ATTACHED`) backtick-only, and rule visitors whose prose explicitly
describes delegating to a shared helper never name it at all. Minor
"self-correction drift" pattern in `pi-shared`/`watch-restart`: a doc
block correctly `{@link}`s a name on first mention, then reverts to a
plain backtick for the same name two lines later in the same comment.

```
packages/oxlint-plugins/stylistic/src/rules/argument-per-line.ts:59 | missing-reference | current: "delegates to the shared per-line checker" (not named) | target: checkItemsPerLine (packages/oxlint-plugins/stylistic/src/utility/item-per-line.ts)
packages/oxlint-plugins/stylistic/src/rules/comma-dangle.ts:53 | missing-reference | current: not mentioned | target: checkTrailingComma / lastFieldNode (packages/oxlint-plugins/stylistic/src/utility/comma-dangle.ts), plus 10 more identical cases in this file's per-node-type handlers at lines 70, 87, 104, 120, 141, 165, 181, 195, 208, 224 (true total 11)
packages/oxlint-plugins/stylistic/src/rules/chain-per-line.ts:35 | downgraded-link | current: "`Context` rather than its `sourceCode` directly because oxlint's `SourceCode`" | target: Context (@oxlint/plugins, imported same file)
packages/oxlint-plugins/stylistic/src/rules/invocation-depth-per-line.ts:34 | downgraded-link | current: "Multi-argument calls belong to `argument-per-line`" | target: argumentPerLine (packages/oxlint-plugins/stylistic/src/rules/argument-per-line.ts)
packages/oxlint-plugins/stylistic/src/rules/invocation-depth-per-line.ts:35 | downgraded-link | current: "and callee chains to `chain-per-line`" | target: chainPerLine (packages/oxlint-plugins/stylistic/src/rules/chain-per-line.ts)
packages/oxlint-plugins/stylistic/src/rules/invocation-depth-per-line.ts:75 | missing-reference | current: not mentioned | target: isSpineRoot, collectSpine (packages/oxlint-plugins/stylistic/src/utility/invocation-spine.ts), buildSplitFix (packages/oxlint-plugins/stylistic/src/utility/invocation-depth-fix.ts)
packages/oxlint-plugins/stylistic/src/rules/param-per-line.ts:33 | downgraded-link | current: "delegates to `checkItemsPerLine` with those" | target: checkItemsPerLine (packages/oxlint-plugins/stylistic/src/utility/item-per-line.ts)
packages/oxlint-plugins/stylistic/src/rules/export-per-line.ts:17 | downgraded-link | current: "Typed `unknown` rather than `Span` because oxlint sets" | target: Span (@oxlint/plugins, imported same file)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:175 | downgraded-link | current: "@returns receiver to descend into, or `LEAF` when the node is the leaf" | target: LEAF (same file, line 25)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:228 | downgraded-link | current: "The leaf supplies the head `ATTACHED`" | target: ATTACHED (same file, line 17)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:256 | downgraded-link | current: "Receiver to descend into; `LEAF` when the cursor is the chain leaf." | target: LEAF (same file, line 25)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:243 | missing-reference | current: not mentioned | target: descentChild (same file, line 177), trailingStep (same file, line 198), parenIsolated (packages/oxlint-plugins/stylistic/src/utility/chain.ts)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:331 | missing-reference | current: "@throws when an operator node lacks an operand, which is unreachable for a" | target: nonNullishOrThrow (packages/module/or-throw/src/non-nullish-or-throw.ts)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:408 | missing-reference | current: not mentioned | target: collectOperatorChain (same file, line 334), selectBreakOffsets (packages/oxlint-plugins/stylistic/src/utility/chain-render.ts)
packages/oxlint-plugins/stylistic/src/utility/chain-flatten.ts:485 | missing-reference | current: not mentioned | target: operatorChainBreakOffsets (same file, line 408), chainSegments (same file, line 243)
packages/oxlint-plugins/stylistic/src/utility/chain.ts:62 | downgraded-link | current: "Threads the rule `Context` rather than its `sourceCode` directly" (also line 64) | target: Context (@oxlint/plugins, imported same file)
packages/oxlint-plugins/stylistic/src/utility/invocation-spine.ts:128 | downgraded-link | current: "@returns inner expression, or `STOP` when the wrapper has no operand" | target: STOP (same file, line 64), plus 11 more identical backtick mentions of the same sentinel at lines 132, 136, 151, 155, 162, 172, 182, 246, 250, 255, 259 (true total 12)
packages/oxlint-plugins/stylistic/src/utility/item-per-line.ts:100 | missing-reference | current: not mentioned | target: needsPerLineFix (packages/oxlint-plugins/stylistic/src/utility/needs-fix.ts), buildPerLineFix (packages/oxlint-plugins/stylistic/src/utility/item-per-line-fix.ts)
packages/oxlint-plugins/stylistic/src/utility/range.ts:6 | downgraded-link | current: "The installed oxlint plugin API exposes `range` on `Span`" | target: Span (@oxlint/plugins, imported same file)
packages/pi-shared/model-selection/src/budget-override.ts:82 | downgraded-link | current: "@throws NoBudgetModelError when override is malformed, missing, or lacks auth" | target: NoBudgetModelError (packages/pi-shared/model-selection/src/budget-report.ts)
packages/pi-shared/model-selection/src/budget-selection.ts:26 | downgraded-link | current: "Exported because `findFastestCandidate` is public." | target: findFastestCandidate (same file, line 104; already correctly {@link}'d two lines above)
packages/pi-shared/model-selection/src/budget-selection.ts:52 | downgraded-link | current: "@throws NoBudgetModelError when no suitable model is found" | target: NoBudgetModelError (packages/pi-shared/model-selection/src/budget-report.ts)
packages/pi-shared/model-selection/src/budget-selection.ts:198 | missing-reference | current: not mentioned (no @throws tag at all) | target: NoBudgetModelError (findSameProvider throws it 4 times, lines 242/258/269/296)
packages/pi-shared/model-selection/src/budget-selection.ts:320 | missing-reference | current: not mentioned (no @throws tag at all) | target: NoBudgetModelError (findAnyProvider throws it at line 370)
packages/pi-shared/model-selection/src/exact-match.ts:12 | downgraded-link | current: "(and internal `matchProviderModelReference`) when no unambiguous exact" | target: matchProviderModelReference (same file, line 105)
packages/pi-shared/model-selection/src/pattern-match.ts:19 | downgraded-link | current: "Sentinel returned by internal `tryMatchModel` when no exact or fuzzy model" | target: tryMatchModel (same file, line 342)
packages/pi-shared/model-selection/src/scope-resolver.ts:22 | downgraded-link | current: "Sentinel returned by internal `readLiveScope` when the runtime exposes no" | target: readLiveScope (same file, line 211)
packages/pi-shared/model-selection/src/settings-scope.ts:12 | downgraded-link | current: "Sentinel returned by internal `loadSettingsFile` when a settings file is" | target: loadSettingsFile (same file, line 198)
packages/pi-shared/model-selection/src/types.ts:312 | downgraded-link | current: "(and by `ResolveBudgetOverrideAuth`) when no usable auth exists for a model." | target: ResolveBudgetOverrideAuth (packages/pi-shared/model-selection/src/budget-override.ts)
packages/pi-shared/model-selection/src/types.ts:316 | downgraded-link | current: "`maybe.ts` was removed, so `ResolveBudgetAuth` can reference both" | target: ResolveBudgetAuth (same file, line 324; already correctly {@link}'d earlier in the same block)
packages/pi-shared/model-selection/src/types.ts:317 | downgraded-link | current: "`typeof NO_AUTH` and `BudgetModelAuth` without a module cycle." | target: BudgetModelAuth (same file, line 234)
packages/pi-shared/model-selection/src/version.ts:121 | downgraded-link | current: "Version vector for `b`, compared positionally against `leftVersions`." | target: leftVersions (local const, same function compareVersions, line 119)
packages/dev-script/watch-restart/src/child.ts:85 | downgraded-link | current: "`waitForExit` / `tagExited` reuse it instead of re-spelling it." | target: waitForExit (same file, line 400), tagExited (same file, line 426)
packages/dev-script/watch-restart/src/child.ts:266 | downgraded-link | current: "Parent logger; the child composes a `Child` tag on top." | target: Child (same file, line 470)
packages/dev-script/watch-restart/src/child.ts:362 | downgraded-link | current: "constant so the `defaultWriteClear` body stays free of raw escape-sequence" | target: defaultWriteClear (same file, line 378)
packages/dev-script/watch-restart/src/child.ts:506 | downgraded-link | current: "defaults to the detached-aware wrapper produced by a local `makeDefaultSpawn` factory." | target: makeDefaultSpawn (same file, line 293)
packages/dev-script/watch-restart/src/cli.ts:13 | downgraded-link | current: "so unit tests can import `parseArgs` / `argsToOptions` without launching a real watch loop." | target: parseArgs (same file, line 162), argsToOptions (same file, line 218)
packages/dev-script/watch-restart/src/cli-types.ts:3 | downgraded-link | current: "Shape produced by `parseArgs`." | target: parseArgs (packages/dev-script/watch-restart/src/cli.ts, line 162)
packages/dev-script/watch-restart/src/filters/content-hash.ts:21 | downgraded-link | current: "File exceeds `hashCache.maxHashSize` (`hashFile` returns `null`):" | target: HashCache.hashFile (packages/dev-script/watch-restart/src/hash-cache.ts)
packages/dev-script/watch-restart/src/filters/content-hash.ts:28 | downgraded-link | current: "The cache is owned by `startWatchRestart` and lives on {@link WatchCtx};" | target: startWatchRestart (packages/dev-script/watch-restart/src/start.ts)
packages/dev-script/watch-restart/src/filters/ext.ts:42 | downgraded-link | current: "this lets the CLI flag-to-filter compiler skip an `extFilter`" | target: extFilter (same file, line 57)
packages/dev-script/watch-restart/src/start.ts:69 | downgraded-link | current: "Watch roots; at least one is expected by `Watcher`." | target: Watcher (packages/dev-script/watch-restart/src/watcher.ts)
packages/dev-script/watch-restart/src/start.ts:179 | downgraded-link | current: "Parent logger; the orchestrator composes a `startWatchRestart` tag on top." | target: startWatchRestart (same file, line 407)
packages/dev-script/watch-restart/src/start.ts:424 | downgraded-link | current: "Shared content-hash cache; pre-populated by the Watcher, read by `contentHashFilter`." | target: contentHashFilter (packages/dev-script/watch-restart/src/filters/content-hash.ts), Watcher (packages/dev-script/watch-restart/src/watcher.ts)
packages/dev-script/watch-restart/src/start.ts:483 | downgraded-link | current: "keeping the timer addressable from `scheduleRestart` and `stop`." | target: scheduleRestart (same file, line 495)
packages/dev-script/watch-restart/src/watcher.ts:43 | downgraded-link | current: "chokidar 5 adapter that owns one `FSWatcher`, pre-populates a {@link HashCache}" | target: FSWatcher (chokidar package, imported same file)
packages/dev-script/watch-restart/src/watcher-types.ts:52 | downgraded-link | current: "Default `awaitWriteFinish` block applied by `Watcher` when the caller" | target: Watcher (packages/dev-script/watch-restart/src/watcher.ts), plus 3 more identical unlinked mentions at lines 62, 72, 116 (true total 4)
```

## Batch 08 (auto-mode, oxlint-plugins/tsdoc, bash-output-filter)

TOTAL FINDINGS: 281 (some `unbash-command-info-*` repeats folded into one
summary line representing ~35 of the 281).

Systematic pattern noted by the agent: `packages/oxlint-plugins/tsdoc/src/`
is generally disciplined about linking sentinels and shared types, but
consistently fails to link the one detector helper a rule delegates to,
even when declared immediately above with its own TSDoc (clearest,
highest-confidence fixable gaps). `packages/pi/auto-mode/src/` (especially
the `unbash-command-info-*.ts` family and orchestrator functions) almost
never names sibling functions or `constants.ts` lookup tables it delegates
to, despite correctly using `{@link}` for sentinel symbols elsewhere, so
the gap is cross-function behavioral delegation, not `{@link}` syntax
unfamiliarity. Clearest literal matches to the original bug
(`@throws ErrorClass` as plain text) concentrated in `budget-model.ts` and
`judge-stream.ts`.

```
packages/pi/auto-mode/src/ask-user.ts:50 | missing-reference | current: "block decision with guidance, or an allow decision" | target: GuardDecision (packages/pi/auto-mode/src/types.ts)
packages/pi/auto-mode/src/ask-user.ts:47 | missing-reference | current: "fallback prompts keep the generic block guidance" | target: DEFAULT_DENY_GUIDANCE (packages/pi/auto-mode/src/system-prompt.ts)
packages/pi/auto-mode/src/ask-user.ts:47 | missing-reference | current: "Verdict-ask callers opt into reflecting the explanation when the user denies" | target: formatModelBlockReason (packages/pi/auto-mode/src/model-feedback.ts)

packages/pi/auto-mode/src/bash-helpers.ts:24 | missing-reference | current: not mentioned | target: MUTATING_COMMANDS (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/bash-helpers.ts:43 | missing-reference | current: not mentioned | target: LONG_FLAGS (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/bash-helpers.ts:128 | missing-reference | current: not mentioned | target: INTERPRETER_INLINE_FLAGS (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/bash-helpers.ts:162 | missing-reference | current: not mentioned | target: NETWORK_COMMANDS (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/bash-helpers.ts:188 | missing-reference | current: not mentioned | target: SECRET_VAR_PATTERN (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/bash-helpers.ts:214 | missing-reference | current: "Check if the analysis contains sensitive source files" | target: pathSignals (packages/pi/auto-mode/src/path-signals.ts)

packages/pi/auto-mode/src/budget-model.ts:83 | downgraded-link | current: "@throws NoBudgetModelError when value is not a pi model" | target: NoBudgetModelError (@monochromatic-dev/pi-shared-model-selection)
packages/pi/auto-mode/src/budget-model.ts:102 | downgraded-link | current: "@throws NoBudgetModelError when value is not a pi model list" | target: NoBudgetModelError (@monochromatic-dev/pi-shared-model-selection)
packages/pi/auto-mode/src/budget-model.ts:134 | downgraded-link | current: "@throws NoBudgetModelError if no suitable model is found" | target: NoBudgetModelError (@monochromatic-dev/pi-shared-model-selection)
packages/pi/auto-mode/src/budget-model.ts:123 | missing-reference | current: "Otherwise shared strategy selection walks candidate models fastest-first" | target: selectBudgetModel/resolveBudgetModelOverride (pi-shared-model-selection), findBudgetOverrideModel/resolveBudgetAuth/hasConfiguredBudgetAuth (./budget-model-auth.ts), assertModelApi/assertModelApiList (same file)

packages/pi/auto-mode/src/config.ts:51 | missing-reference | current: "Load and merge global + project config into a runtime config" | target: loadGlobalConfig, loadProjectConfig, compilePatterns (same file)

packages/pi/auto-mode/src/constants.ts:18 | downgraded-link | current: "referenced by `loadMergedConfig` (for the config-file fallback)" | target: loadMergedConfig (packages/pi/auto-mode/src/config.ts)
packages/pi/auto-mode/src/constants.ts:18 | downgraded-link | current: "by `GLOBAL_DEFAULTS` (for the global defaults)" | target: GLOBAL_DEFAULTS (packages/pi/auto-mode/src/config.ts)
packages/pi/auto-mode/src/constants.ts:18 | downgraded-link | current: "and by `findBudgetModel` (for the no-options call)" | target: findBudgetModel (packages/pi/auto-mode/src/budget-model.ts)

packages/pi/auto-mode/src/content-signals.ts:19 | missing-reference | current: "Detects private key headers and known token/key formats" | target: PRIVATE_KEY_PATTERN, SECRET_FORMAT_PATTERNS (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/content-signals.ts:48 | missing-reference | current: not mentioned | target: BUILTIN_TEXT_PATTERNS (packages/pi/auto-mode/src/constants.ts)

packages/pi/auto-mode/src/context.ts:100 | downgraded-link | current: "exact action description produced by `describeAction`" | target: describeAction (packages/pi/auto-mode/src/tool-helpers.ts)
packages/pi/auto-mode/src/context.ts:56 | missing-reference | current: not mentioned | target: isTrustEntry (packages/pi/auto-mode/src/types.ts)
packages/pi/auto-mode/src/context.ts:90 | missing-reference | current: not mentioned | target: isVerdictEntry (packages/pi/auto-mode/src/types.ts)
packages/pi/auto-mode/src/context.ts:186 | missing-reference | current: "Build a context summary for the LLM judge" | target: extractUserText, summarizeToolCall, bashDetail, selectContextActivityLines (same file)

packages/pi/auto-mode/src/evaluate.ts:57 | missing-reference | current: "Build model-facing block decision for a judge deny verdict" | target: formatModelBlockReason (packages/pi/auto-mode/src/model-feedback.ts), GuardDecision (packages/pi/auto-mode/src/types.ts)
packages/pi/auto-mode/src/evaluate.ts:87 | missing-reference | current: "Reuses a latest same-session approval... resolves a judge model, calls the judge, and processes the verdict" | target: getReusableApproval, buildContext, getTrustDirectives, resolveJudgeModel (same file), callJudge (packages/pi/auto-mode/src/judge.ts), askUser (packages/pi/auto-mode/src/ask-user.ts), decisionForDenyVerdict (same file)
packages/pi/auto-mode/src/evaluate.ts:330 | missing-reference | current: "Resolve a judge model from the budget model options" | target: findBudgetModel (packages/pi/auto-mode/src/budget-model.ts), toBudgetModelOptions (same file)

packages/pi/auto-mode/src/git-worktree-read-allowlist.ts:454 | downgraded-link | current: "Secret-looking paths still trip path signals because `pathSignals` checks them after allowlist containment" | target: pathSignals (packages/pi/auto-mode/src/path-signals.ts)
packages/pi/auto-mode/src/git-worktree-read-allowlist.ts:449 | missing-reference | current: "Returns linked worktree roots attached to current repository" | target: resolveRealGit, readGitStdout, extractWorktreePaths, isLinkedWorktreeRoot (same file)
packages/pi/auto-mode/src/git-worktree-read-allowlist.ts:265 | missing-reference | current: not mentioned | target: isCliGitShimForSelf (same file, called from resolveGitCandidate)

packages/pi/auto-mode/src/guard-command.ts:16 | missing-reference | current: "Register `/guard` trust-directive command" | target: TRUST_ENTRY_TYPE (packages/pi/auto-mode/src/types.ts), getTrustDirectives (packages/pi/auto-mode/src/context.ts)

packages/pi/auto-mode/src/index.ts:94 | missing-reference | current: "Subscribes to agent lifecycle events to implement the flagger-judge-user pipeline" | target: ~16 wired-up delegates never named (loadMergedConfig, buildSystemPrompt, registerGuardCommand, registerProposeTrust, findLatestBypassEnabled, updateBypassStatus, appendBypassToggleEntry, announceBypassToggle, describeAction, appendBypassAllowEntry, agentTempAllowlistedDirs, linkedWorktreeReadAllowlistedDirs, shouldFlag, isRelevantTool, buildApprovalFingerprint, evaluate, updateWidget)

packages/pi/auto-mode/src/judge-json.ts:9 | missing-reference | current: "Tries `JSON.parse(text)` first, then falls back to scanning for the first balanced `{...}` block" | target: findBalancedJsonObject (same file)

packages/pi/auto-mode/src/judge-messages.ts:123 | missing-reference | current: not mentioned | target: TOOL_CALL_TRANSPORT_INSTRUCTION (same file)

packages/pi/auto-mode/src/judge-stream.ts:132 | missing-reference | current: "Collect verdict arguments from the first tool-call stream, retrying with direct JSON..." | target: collectJudgeStream, collectJsonVerdict (same file), JudgeJsonNoTextError (same file, caught via instanceof at L181)
packages/pi/auto-mode/src/judge-stream.ts:258 | missing-reference | current: "@throws when the retry emits neither a `render_verdict` tool call nor text" | target: JudgeJsonNoTextError (same file, thrown at L277, not named even in plain text)
packages/pi/auto-mode/src/judge-stream.ts:251 | missing-reference | current: not mentioned | target: collectJudgeStream, extractJsonVerdict (packages/pi/auto-mode/src/judge-json.ts)
packages/pi/auto-mode/src/judge-stream.ts:283 | missing-reference | current: not mentioned | target: collectJudgeStream, extractJsonVerdict (packages/pi/auto-mode/src/judge-json.ts)

packages/pi/auto-mode/src/judge-tool.ts:33 | downgraded-link | current: "Shape matches `Tool` from pi-ai: `name`, `description`, `parameters`" | target: Tool (@earendil-works/pi-ai)

packages/pi/auto-mode/src/judge.ts:159 | missing-reference | current: not mentioned | target: JUDGE_API_STREAMS (same file)
packages/pi/auto-mode/src/judge.ts:202 | missing-reference | current: not mentioned | target: defaultJudgeStreamSimple (same file)
packages/pi/auto-mode/src/judge.ts:252 | missing-reference | current: "Uses forced `tool_choice` for the first attempt. If the response omits `render_verdict`, retries once..." | target: buildUserContent, disposableTimeout, toolChoiceForApi, streamJudgeSimple, buildJsonRetrySystemPrompt, buildJsonRetryUserContent, buildStreamOptions, collectJudgeVerdictArgs, parseVerdict, VERDICT_TOOL

packages/pi/auto-mode/src/model-feedback.ts:17 | missing-reference | current: "preserves safer next step when judge provided one" | target: DEFAULT_DENY_GUIDANCE (packages/pi/auto-mode/src/system-prompt.ts), MISSING_GUARDRAIL_REASON (same file)

packages/pi/auto-mode/src/path-signals.ts:42 | missing-reference | current: "Check if a file path should trigger flagging" | target: resolvePath, tryRealpath, isAllowlistedPath, isUnder, isHomeDotfile, hasSecretPathSignal, realpathOrLexical (same file)
packages/pi/auto-mode/src/path-signals.ts:150 | missing-reference | current: not mentioned | target: tryRealpath, isUnder (same file)
packages/pi/auto-mode/src/path-signals.ts:205 | missing-reference | current: not mentioned | target: SECRET_PATH_PATTERN (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/path-signals.ts:274 | missing-reference | current: not mentioned | target: tryRealpath (same file)
packages/pi/auto-mode/src/path-signals.ts:362 | missing-reference | current: not mentioned | target: isUnder (same file)

packages/pi/auto-mode/src/register-propose-trust.ts:87 | missing-reference | current: "Register the `propose_trust` tool on the extension API" | target: isActiveTrustRule, trustRuleAcceptedResult, buildTrustRulePrompt, trustRuleRejectedResult (same file), TRUST_ENTRY_TYPE (packages/pi/auto-mode/src/types.ts)
packages/pi/auto-mode/src/register-propose-trust.ts:188 | missing-reference | current: "Exact matching keeps auto-approval idempotent" | target: getTrustDirectives (packages/pi/auto-mode/src/context.ts)

packages/pi/auto-mode/src/shell-assignment.ts:29 | missing-reference | current: not mentioned | target: isShellIdentifier (same file)
packages/pi/auto-mode/src/shell-assignment.ts:68 | missing-reference | current: not mentioned | target: findShellIdentifierEnd, isShellIdentifierStartChar, isShellIdentifierChar (same file)
packages/pi/auto-mode/src/shell-assignment.ts:133 | missing-reference | current: not mentioned | target: isShellIdentifierStartChar, isShellIdentifierChar (same file)
packages/pi/auto-mode/src/shell-assignment.ts:162 | missing-reference | current: not mentioned | target: isShellIdentifierChar (same file)

packages/pi/auto-mode/src/signals.ts:79 | missing-reference | current: "Should this tool call be sent to the judge? Returns `true` if any signal fires" | target: analyzeBashCommand, bashSignals, textSignals, getFilePath, pathSignals, extractToolText, contentSignals
packages/pi/auto-mode/src/signals.ts:190 | missing-reference | current: "Check bash command analysis for dangerous patterns" | target: hasTrustedAgentTempCredentialHandoff, isMutatingCommand, hasFlag, hasRootTarget, hasInlineCode, looksLikePath, isTrustedAgentTempBashPathAllowed, hasNetworkCommand, hasSecretParamRefs, hasSensitiveSource, matchUserCommands, PRIVILEGE_COMMANDS, ENV_DUMP_COMMANDS, INTERPRETER_COMMANDS

packages/pi/auto-mode/src/system-prompt.ts:55 | missing-reference | current: not mentioned | target: BASE_SYSTEM_PROMPT (same file)

packages/pi/auto-mode/src/temp-read-allowlist.ts:59 | missing-reference | current: not mentioned | target: AGENT_TEMP_READ_DIR (packages/pi/auto-mode/src/constants.ts), isTrustedReadAllowlistDir (same file)
packages/pi/auto-mode/src/temp-read-allowlist.ts:75 | missing-reference | current: "Return agent temp root for structured read-tool bypass compatibility" | target: agentTempAllowlistedDirs (same file; this function's entire body is a passthrough call)

packages/pi/auto-mode/src/tool-helpers.ts:186 | missing-reference | current: not mentioned | target: buildApprovalFingerprintIdentity, stableSerialize (same file)

packages/pi/auto-mode/src/trusted-agent-temp-bash.ts:54 | missing-reference | current: not mentioned | target: isNonSecretTrustedAgentTempBashPath (packages/pi/auto-mode/src/trusted-agent-temp-glob-paths.ts), isProjectDotenvCredentialExtractionPath (packages/pi/auto-mode/src/trusted-agent-temp-paths.ts)
packages/pi/auto-mode/src/trusted-agent-temp-bash.ts:113 | missing-reference | current: not mentioned | target: commandContainsSecretAssignment, commandInvokesTrustedAgentTempHelper (same file)
packages/pi/auto-mode/src/trusted-agent-temp-bash.ts:171 | missing-reference | current: not mentioned | target: commandWords (same file), extractShellAssignmentNames (packages/pi/auto-mode/src/shell-assignment.ts), SECRET_VAR_PATTERN (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/trusted-agent-temp-bash.ts:227 | missing-reference | current: not mentioned | target: isExistingPathUnderTrustedAgentTemp (packages/pi/auto-mode/src/trusted-agent-temp-paths.ts), TRUSTED_AGENT_TEMP_SCRIPT_RUNNERS (same file)

packages/pi/auto-mode/src/trusted-agent-temp-glob-paths-helpers.ts:61 | missing-reference | current: not mentioned | target: firstSupportedGlobIndex (same file)
packages/pi/auto-mode/src/trusted-agent-temp-glob-paths-helpers.ts:130 | missing-reference | current: not mentioned | target: SECRET_PATH_PATTERN (packages/pi/auto-mode/src/constants.ts)
packages/pi/auto-mode/src/trusted-agent-temp-glob-paths-helpers.ts:184 | missing-reference | current: not mentioned | target: realpathOrUnavailable (same file), isUnder (packages/pi/auto-mode/src/path-signals.ts)

packages/pi/auto-mode/src/trusted-agent-temp-glob-paths.ts:25 | missing-reference | current: not mentioned | target: isExistingNonSecretTrustedAgentTempPath (packages/pi/auto-mode/src/trusted-agent-temp-paths.ts), isNonSecretTrustedAgentTempGlobPath (same file)
packages/pi/auto-mode/src/trusted-agent-temp-glob-paths.ts:74 | missing-reference | current: not mentioned | target: hasSupportedShellGlobSyntax, resolvePath, pathTextHasSecretMarker, realpathOrUnavailable, globParentDirectory, trustedDirContainsCanonicalPath

packages/pi/auto-mode/src/trusted-agent-temp-paths.ts:41 | missing-reference | current: not mentioned | target: isExistingPathUnderTrustedAgentTemp (same file), pathSignals (packages/pi/auto-mode/src/path-signals.ts)
packages/pi/auto-mode/src/trusted-agent-temp-paths.ts:83 | missing-reference | current: not mentioned | target: resolvePath, isUnder (packages/pi/auto-mode/src/path-signals.ts), realpathOrUnavailable (same file)
packages/pi/auto-mode/src/trusted-agent-temp-paths.ts:145 | missing-reference | current: not mentioned | target: SECRET_VAR_PATTERN (packages/pi/auto-mode/src/constants.ts), isExistingProjectDotenvPath (same file)
packages/pi/auto-mode/src/trusted-agent-temp-paths.ts:196 | missing-reference | current: not mentioned | target: resolvePath, isUnder (packages/pi/auto-mode/src/path-signals.ts), isDotenvBasename (same file)

packages/pi/auto-mode/src/types.ts:448 | downgraded-link | current: "Both `evaluate` and `askUser` resolve to this shape" | target: evaluate (packages/pi/auto-mode/src/evaluate.ts), askUser (packages/pi/auto-mode/src/ask-user.ts)
packages/pi/auto-mode/src/types.ts:448 | downgraded-link | current: "the entry-point handler maps it onto the host SDK's `ToolCallEventResult`" | target: ToolCallEventResult (@earendil-works/pi-coding-agent)
packages/pi/auto-mode/src/types.ts:355 | downgraded-link | current: "Produced by `analyzeBashCommand` in command-parser.ts" | target: analyzeBashCommand (packages/pi/auto-mode/src/command-parser.ts)
packages/pi/auto-mode/src/types.ts:402 | downgraded-link | current: "The same shape is used by `MergedConfig.judgeModel`, `BudgetModelOptions`..." | target: MergedConfig (packages/pi/auto-mode/src/signals.ts), BudgetModelOptions (same file)
packages/pi/auto-mode/src/types.ts:419 | downgraded-link | current: "Budget-model find options (shape used by `findBudgetModel`)" | target: findBudgetModel (packages/pi/auto-mode/src/budget-model.ts)
packages/pi/auto-mode/src/types.ts:135 | missing-reference | current: not mentioned | target: isVerdictData (same file)
packages/pi/auto-mode/src/types.ts:170 | missing-reference | current: not mentioned | target: isRecord, isVerdictValue, isUndefinedOrString, isUndefinedOrReusableVerdictSource (same file)

packages/pi/auto-mode/src/command-parser.ts:26 | missing-reference | current: "Parse a bash command and extract structured signals" | target: collectCommandInfoFromScript (packages/pi/auto-mode/src/unbash-command-info.ts), tryParseScript (same file)

packages/pi/auto-mode/src/unbash-command-info*.ts (9 files) | missing-reference (summarized, ~35 instances) | nearly every visitor/work-item builder calls 1-8 named sibling functions it never names in its own TSDoc; e.g. unbash-command-info-work.ts:27 (visitNode calls 8 uncredited siblings), unbash-command-info.ts:24 (collectCommandInfoFromScript calls 8 uncredited siblings)

packages/oxlint-plugins/tsdoc/src/ast-access.ts:76 | missing-reference | current: not mentioned | target: unwrapMethodDefinition (same file)

packages/oxlint-plugins/tsdoc/src/comment-text.ts:166 | missing-reference | current: "Strips inline code spans and backslash-escaped at signs" | target: stripInlineCodeSpans (same file)

packages/oxlint-plugins/tsdoc/src/rules/node-extraction.ts:99 | missing-reference | current: not mentioned | target: readNamedChild (same file, called 3x)
packages/oxlint-plugins/tsdoc/src/rules/node-extraction.ts:184 | missing-reference | current: not mentioned | target: NODE_KIND_LABELS (same file)
packages/oxlint-plugins/tsdoc/src/rules/node-extraction.ts:224 | missing-reference | current: "Reports a diagnostic when node lacks a TSDoc comment" | target: findTsdocComment, NO_TSDOC (packages/oxlint-plugins/tsdoc/src/tsdoc-utils.ts), extractNodeKind, extractNodeName (same file)

packages/oxlint-plugins/tsdoc/src/rules/params.ts:24 | missing-reference | current: "Allows @param tags that match property names from destructured parameters" | target: extractDestructuredParamNames (packages/oxlint-plugins/tsdoc/src/tsdoc-destructured.ts), extractParamNames/extractDocParamNames (packages/oxlint-plugins/tsdoc/src/tsdoc-params.ts)
packages/oxlint-plugins/tsdoc/src/rules/params.ts:128 | missing-reference | current: not mentioned | target: extractParamNames, extractDocParamNames (packages/oxlint-plugins/tsdoc/src/tsdoc-params.ts)

packages/oxlint-plugins/tsdoc/src/rules/require-example.ts:98 | missing-reference | current: "Targets both directly exported functions... and functions exported via specifier lists" | target: parseTsdocForNode (packages/oxlint-plugins/tsdoc/src/tsdoc-utils.ts), extractNodeName (packages/oxlint-plugins/tsdoc/src/rules/node-extraction.ts)

packages/oxlint-plugins/tsdoc/src/rules/require-tsdoc.ts:10 | missing-reference | current: "Requires TSDoc comments on every documentable declaration" | target: reportMissing (packages/oxlint-plugins/tsdoc/src/rules/node-extraction.ts), shouldSkipIgnoredFile (packages/oxlint-plugins/tsdoc/src/rules/tsdoc-visitors.ts)

packages/oxlint-plugins/tsdoc/src/rules/returns.ts:20 | missing-reference | current: "Skips void/never return types, constructors, and setters" | target: functionReturnsValue (packages/oxlint-plugins/tsdoc/src/tsdoc-params-returns.ts)
packages/oxlint-plugins/tsdoc/src/rules/returns.ts:72 | missing-reference | current: not mentioned | target: functionReturnsValue (packages/oxlint-plugins/tsdoc/src/tsdoc-params-returns.ts)

packages/oxlint-plugins/tsdoc/src/rules/structural-tags.ts:71 | missing-reference | current: "Requires a blank comment line before block tags (configurable)" | target: extractLeadingTag (same file, defined directly above with its own doc)

packages/oxlint-plugins/tsdoc/src/rules/structural.ts:265 | missing-reference | current: "Single-line comment is reported and auto-fixed to canonical multiline format" | target: multilineTsdocReplacement (same file), isTsdocBlock (packages/oxlint-plugins/tsdoc/src/tsdoc-comments.ts)

packages/oxlint-plugins/tsdoc/src/rules/tag-escaping.ts:65 | missing-reference | current: "Enforces that the comment-close sequence inside TSDoc content is escaped" | target: hasUnescapedCommentClose (same file, defined directly above with its own doc)

packages/oxlint-plugins/tsdoc/src/rules/tag-names.ts:76 | missing-reference | current: "Reports JSDoc-only tags and any other unrecognized tags" | target: JSDOC_TO_TSDOC_MAP (packages/oxlint-plugins/tsdoc/src/rules/jsdoc-map.ts)
packages/oxlint-plugins/tsdoc/src/rules/tag-names.ts:76 | missing-reference | current: "Skips tag scanning inside fenced code blocks and backtick-wrapped inline code" | target: isFenceLine, stripInlineCodeAndEscapes (packages/oxlint-plugins/tsdoc/src/comment-text.ts)

packages/oxlint-plugins/tsdoc/src/rules/tag-validation.ts:96 | missing-reference | current: "Reports conflicting access modifiers (e.g., public and internal together)" | target: containsBoundedAccessTag (same file, defined directly above with its own doc)

packages/oxlint-plugins/tsdoc/src/rules/tsdoc-visitors.ts:169 | missing-reference | current: "Creates a visitor over every documentable node type" | target: shouldSkipIgnoredFile (same file)
packages/oxlint-plugins/tsdoc/src/rules/tsdoc-visitors.ts:232 | missing-reference | current: "Creates a visitor that iterates over all documentable node types and calls the provided handler when a TSDoc comment is found" | target: findTsdocComment (packages/oxlint-plugins/tsdoc/src/tsdoc-utils.ts), createDocumentableVisitor (same file)

packages/oxlint-plugins/tsdoc/src/rules/type-annotations.ts:62 | missing-reference | current: not mentioned | target: isInlineTagOpener (same file)
packages/oxlint-plugins/tsdoc/src/rules/type-annotations.ts:158 | missing-reference | current: "Disallows type annotations in TSDoc tags" | target: findTypeAnnotations (same file, defined directly above with its own thorough doc)

packages/oxlint-plugins/tsdoc/src/rules/yields.ts:34 | missing-reference | current: not mentioned | target: isGeneratorFunction (packages/oxlint-plugins/tsdoc/src/tsdoc-params-returns.ts), hasYieldsTag (same file)
packages/oxlint-plugins/tsdoc/src/rules/yields.ts:83 | missing-reference | current: "Reports yield documentation on non-generator functions" | target: isGeneratorFunction (packages/oxlint-plugins/tsdoc/src/tsdoc-params-returns.ts), hasYieldsTag (same file)

packages/oxlint-plugins/tsdoc/src/tsdoc-blocks.ts:270 | missing-reference | current: "Scans a TSDoc comment into the minimal parsed model the rules consume" | target: buildSegments, collectPresence (same file)

packages/oxlint-plugins/tsdoc/src/tsdoc-comments.ts:94 | missing-reference | current: "The fallback only applies to declaration-level node types, not to FunctionExpression or ArrowFunctionExpression" | target: FALLBACK_ELIGIBLE_TYPES (same file)
packages/oxlint-plugins/tsdoc/src/tsdoc-comments.ts:191 | missing-reference | current: "Extracts and parses the TSDoc comment for a given AST node" | target: splitDocComment (packages/oxlint-plugins/tsdoc/src/tsdoc-blocks.ts), collectStructuralMessages (packages/oxlint-plugins/tsdoc/src/tsdoc-structural-messages.ts)

packages/oxlint-plugins/tsdoc/src/tsdoc-destructured.ts:19 | missing-reference | current: "Supports nested unwrapping through AssignmentPattern, RestElement, and TSParameterProperty" | target: unwrapBindingPattern (packages/oxlint-plugins/tsdoc/src/ast-access.ts)

packages/oxlint-plugins/tsdoc/src/tsdoc-params-returns.ts:18 | missing-reference | current: not mentioned | target: unwrapMethodDefinition (packages/oxlint-plugins/tsdoc/src/ast-access.ts)
packages/oxlint-plugins/tsdoc/src/tsdoc-params-returns.ts:119 | missing-reference | current: not mentioned | target: unwrapMethodDefinition (packages/oxlint-plugins/tsdoc/src/ast-access.ts)

packages/oxlint-plugins/tsdoc/src/tsdoc-params.ts:23 | missing-reference | current: "Handles FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, MethodDefinition, and TSMethodSignature nodes" | target: extractRawParams, extractBindingName (packages/oxlint-plugins/tsdoc/src/ast-access.ts)
packages/oxlint-plugins/tsdoc/src/tsdoc-params.ts:48 | missing-reference | current: not mentioned | target: unwrapBindingPattern (packages/oxlint-plugins/tsdoc/src/ast-access.ts)

packages/oxlint-plugins/tsdoc/src/tsdoc-structural-messages.ts:50 | missing-reference | current: "Reports a param/typeParam line whose description lacks the hyphen separator" | target: PARAM_MISSING_HYPHEN (same file, documented directly above)
packages/oxlint-plugins/tsdoc/src/tsdoc-structural-messages.ts:90 | missing-reference | current: "Reports inline-tag brace problems on a line: an unclosed opener or an empty tag with no target" | target: INLINE_TAG_MISSING_RIGHT_BRACE, LINK_TAG_EMPTY (same file, both documented directly above)
packages/oxlint-plugins/tsdoc/src/tsdoc-structural-messages.ts:148 | missing-reference | current: "Scans a TSDoc comment for best-effort structural problems" | target: missingHyphenMessages, inlineTagMessages (same file)

packages/oxlint-plugins/tsdoc/src/tsdoc-utils.ts:25 | missing-reference | current: not mentioned | target: IGNORED_EXTENSIONS (same file)

packages/claude-code-plugins/bash-output-filter/tsdown.node.config.ts:4 | missing-reference | current: "Build config for bash-output-filter" | target: perEntryNodeConfig (@monochromatic-dev/config-tsdown)
```

## Batch 09 (done, task-util, mcp/stdio)

(pending)

## Batch 10 (morph-compact, advisor, module/test, image-diff, test-support)

(pending)

## Batch 11 (doodle-widget, claude-code-plugins/source, catalog-tighten)

(pending)

## Batch 12 (deps-cube, git-clone-size, current-time-context, oxlint-plugins/shared)

(pending)

## Batch 13 (page-weight, logger, hall-monitor, android-exempt-unused, build-tool/css, pipe, matrix, tofu, typeface/aquaticat, import-attributes, config/tsdown, rgffplay, prompt-time)

(pending)

## Batch 14 (terminal-exec, hyperscript, rss, config/oxlint, kv-store, fs-path, hook-types, or-throw, session-start-housekeeping)

(pending)

## Batch 15 (vmsync, spawn, figma kiwi, figma penpot, pi/statusline, llm-types)

(pending)

## Batch 16 (terminal-title, vm-builder, catalog-tighten.matrix, forbidden-strings, dom, claude-code-plugins/statusline, thinking-defaults, mcp/mvm, syllable-break-demo, const, memoize, token-count, observable, runtime-error/bun, function-arity, pi/current-time-context, guardrail, root config files)

(pending)
