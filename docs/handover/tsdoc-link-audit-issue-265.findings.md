# Raw findings: TSDoc inline-link audit (issue #265)

Raw per-batch subagent output for `docs/handover/tsdoc-link-audit-issue-265.md`.
Working data only, not prose; deleted once the audit is compiled and posted
as a comment on issue #265 (`DL4`).

Format: `<path>:<line> | <downgraded-link|missing-reference> | current: "<snippet>" | target: <Name> (<location>)`

## Batch 01 (file-enforcer)

TOTAL FINDINGS: 294.

Systematic patterns: this package's error-handling layer almost never
links its own custom error classes in `@throws` tags (every custom error
class found -- `StalenessManifestPersistenceError`, `NoManagerError`,
`PackageNotFoundError`, `VerificationError`, `PlatformMatchError` -- is
thrown with the `@throws` line describing the condition in plain English
without naming the class). Dozens of pure-orchestration functions (call
2-6 sibling/imported helpers and nothing else) name none of their
collaborators in the doc summary, even when the collaborator is the
entire reason the function exists. The `pipeline/toml.ts`/`io/write-toml.ts`
pair downgrades essentially every reference to the external
`@monochromatic-dev/module-toml-edit` API to backtick or bare prose,
never `{@link}` -- the clearest direct evidence of the linter-bug-driven
downgrade the issue describes. A few files (`io/staleness-guards.ts`,
`package/manager-defs.ts`, `pipeline/exec.ts`'s `execCommand`/
`isNestedPlatformCommands`, `lazy-once.ts`) show the intended style with
correct `{@link}` usage throughout, confirming the gap is inconsistency,
not an unsupported pattern. Full per-line listing (294 entries) kept in
the agent transcript only; representative subset below covers every
distinct file and the clearest `@throws`/external-API cases.

```
packages/dev-script/file-enforcer/data/packages.overrides.ts:23 | missing-reference | current: not mentioned | target: p (packages/dev-script/file-enforcer/src/package/p.ts)
packages/dev-script/file-enforcer/data/packages.ts:19 | missing-reference | current: not mentioned | target: mergeOverrides (packages/dev-script/file-enforcer/src/package/merge.ts)
packages/dev-script/file-enforcer/src/io/cache.ts:12 | downgraded-link | current: "`readCached()`" | target: readCached (same file)
packages/dev-script/file-enforcer/src/io/cat.ts:72 | downgraded-link | current: "`overwriteEach()`" | target: overwriteEach (packages/dev-script/file-enforcer/src/io/write.ts)
packages/dev-script/file-enforcer/src/io/staleness-manifest-parse.ts:69 | missing-reference | current: not mentioned | target: StalenessManifestPersistenceError (packages/dev-script/file-enforcer/src/io/staleness-manifest-error.ts), readManifestContent, parseManifestJson (same file), isStalenessManifest (packages/dev-script/file-enforcer/src/io/staleness-guards.ts)
packages/dev-script/file-enforcer/src/io/staleness-manifest-lock.ts:121 | missing-reference | current: not mentioned | target: StalenessManifestPersistenceError (packages/dev-script/file-enforcer/src/io/staleness-manifest-error.ts), recoverStaleManifestLock (packages/dev-script/file-enforcer/src/io/staleness-manifest-lock-recovery.ts), lockReleaseHandle (same file)
packages/dev-script/file-enforcer/src/io/write-lazy.ts:16 | downgraded-link | current: "`overwrite()`" | target: overwrite (packages/dev-script/file-enforcer/src/io/write.ts)
packages/dev-script/file-enforcer/src/io/write-toml.ts:14 | downgraded-link | current: "`parseTomlEdit`, `tomlSet`, `tomlStringify`, `emptyTomlEdit`" | target: parseTomlEdit, tomlSet, tomlStringify, emptyTomlEdit (external: @monochromatic-dev/module-toml-edit)
packages/dev-script/file-enforcer/src/io/write.ts:223 | missing-reference | current: not mentioned | target: writeFileIfAbsentAtomically (packages/dev-script/file-enforcer/src/io/write-if-absent-atomic.ts), FILE_ALREADY_EXISTS (same file)
packages/dev-script/file-enforcer/src/jetbrains/lsp4ij-apply.ts:356 | missing-reference | current: not mentioned | target: replaceOrInsertXmlEntry (packages/dev-script/file-enforcer/src/pipeline/xml.ts), buildUserDefinedEntry (packages/dev-script/file-enforcer/src/jetbrains/lsp4ij-entries.ts)
packages/dev-script/file-enforcer/src/jetbrains/lsp4ij.ts:60 | missing-reference | current: not mentioned | target: latestJetbrainsOptionsDirectory (packages/dev-script/file-enforcer/src/jetbrains/options-dir.ts), findBaseServerEntry/updatedLanguageSettingsXml/updatedUserDefinedXml (packages/dev-script/file-enforcer/src/jetbrains/lsp4ij-apply.ts), overwrite (packages/dev-script/file-enforcer/src/io/write.ts)
packages/dev-script/file-enforcer/src/package/ensure-package.ts:117 | missing-reference | current: not mentioned | target: NoManagerError, PackageNotFoundError, VerificationError (same file), installPackage/detectManager/binaryExists (packages/dev-script/file-enforcer/src/package/manager.ts)
packages/dev-script/file-enforcer/src/pipeline/exec.ts:120 | missing-reference | current: not mentioned | target: PlatformMatchError, execCommand (same file), evaluatePredicate (packages/dev-script/file-enforcer/src/platform/evaluate-predicate.ts)
packages/dev-script/file-enforcer/src/pipeline/toml.ts:62 | downgraded-link | current: "TomlTypeError when value type mismatches", "TomlImmutableNodeError when path-create would violate" | target: TomlTypeError, TomlImmutableNodeError, parseTomlEdit, tomlSet, tomlStringify (external: @monochromatic-dev/module-toml-edit)
packages/dev-script/file-enforcer/src/tracker.ts:59 | downgraded-link | current: "`classifyEvent`" | target: classifyEvent (packages/dev-script/file-enforcer/src/watch/watch-filter.ts)
packages/dev-script/file-enforcer/src/types.ts:1 | downgraded-link | current: "`TomlPath`" | target: TomlPath (external: @monochromatic-dev/module-toml-edit)
packages/dev-script/file-enforcer/src/watch/watch-dir-helpers.ts:94 | downgraded-link | current: "classifyEvent and existing watchDirectory callers" | target: classifyEvent (packages/dev-script/file-enforcer/src/watch/watch-filter.ts), watchDirectory (packages/dev-script/file-enforcer/src/watch/watch-dir.ts)
packages/dev-script/file-enforcer/src/watch/watch-supervisor.ts:196 | missing-reference | current: not mentioned | target: watcherRestartLimitError (same file), watchDirectory (packages/dev-script/file-enforcer/src/watch/watch-dir.ts)
packages/dev-script/file-enforcer/src/watch/watch.ts:26 | missing-reference | current: not mentioned | target: createWatchModeLifecycle, createWatchRerunQueue, watchDirs, watchDirectoryWithRestarts, notifyWriteProtection (siblings across watch/ and io/)
```

(remaining files with findings, counts only, see agent transcript for full
line-level detail: `context.ts` 5, `fuzz-budget.ts` 3, `glob-expand.ts` 4,
`glob-mirror.ts` 2, `glob-split.ts` 1, `staleness-destination-match.ts` 4,
`staleness-destinations.ts` 3, `staleness-freshness.ts` 7,
`staleness-guards.ts` 1, `staleness-hash.ts` 1,
`staleness-manifest-lock-owner.ts` 7, `staleness-manifest-lock-recovery.ts` 4,
`staleness-manifest-persist.ts` 6, `staleness-manifest.ts` 6,
`staleness-root.ts` 2, `staleness-run.ts` 4, `staleness-stamps.ts` 9,
`staleness-types.ts` 1, `staleness.ts` 8, `write-atomic.ts` 3,
`write-each-destinations.ts` 3, `write-if-absent-atomic.ts` 3,
`write-staleness.ts` 4, `jetbrains/lsp4ij-entries.ts` 7,
`jetbrains/options-dir.ts` 5, `package/manager.ts` 6, `package/merge.ts` 1,
`package/mise.generate-index.ts` 3, `package/p.ts` 4,
`package/registry-parse.ts` 1, `pipeline/json.ts` 4,
`pipeline/transform.ts` 1, `pipeline/xml-coding.ts` 3, `pipeline/xml.ts` 8,
`platform/evaluate-predicate.ts` 1, `staleness-lock-regression-fixture.ts` 1,
`tracker-capture.ts` 1, `tracker.ts` 3, `watch/notify.ts` 3,
`watch/watch-dir.ts` 5, `watch/watch-filter.ts` 6,
`watch/watch-lifecycle.ts` 2, `watch/watch-path.ts` 3,
`watch/watch-rerun-queue.ts` 2)

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

TOTAL FINDINGS: 153. `pi/linkup` (11 files) and `module/throws` produced
almost no findings (one in `throws/index.ts`): linkup has no custom error
classes (every throw is bare `Error`) and its terse one-liner style never
had prose to downgrade in the first place.

Systematic pattern: in `module/toml-edit/src`, every `@module` doc
restates the file's own primary export name in backticks instead of
`{@link}` (`` `tomlSet` ``, `` `tomlDelete` ``, `` `tomlGetRaw` ``), and
every `@throws` tag for the package's five custom error classes
(`TomlEditError`, `TomlPathNotFoundError`, `TomlSpliceUnavailableError`,
`TomlTypeError`, `TomlImmutableNodeError`) names the class as plain text
rather than `{@link}` -- essentially universal across the package's ~30
`@throws` tags, and the exact downgrade the issue describes. A rarer but
real pattern: private helpers (`tableChildKeys`, `encodeValue`,
`walkTable`, `findKeyValueByPrefix`, `emitInlineTable`, `doTableReplace`)
throw a custom error with no `@throws` tag at all. A handful of files
(`fuzz-budget.ts`, `fuzz/equality.ts`, `fuzz/escape.ts`, `toml-get.ts`)
already use `{@link}` correctly, proving the team knows the syntax and
this is regression/oversight, not a stylistic choice.

```
packages/module/toml-edit/src/canonical.ts:2,10,11,37,60 | downgraded-link | current: backtick mentions of canonicalEmit/emptyTomlEdit/tomlSet | target: canonicalEmit, emptyTomlEdit (packages/module/toml-edit/src/empty-toml-edit.ts), tomlSet (packages/module/toml-edit/src/toml-set.ts)
packages/module/toml-edit/src/collision.ts:16,30,144,200 | downgraded-link/missing-reference | current: "Both checks run in `tomlSet`..."; assertNoSiblingTableCollision/assertNoInlineTableCollision throw TomlImmutableNodeError with no @throws | target: tomlSet (toml-set.ts), TomlImmutableNodeError (errors.ts), formatPath (path.ts)
packages/module/toml-edit/src/conformance/decode-to-tagged.ts:25,30,42,272 | downgraded-link/missing-reference | current: backtick TaggedTree mentions; contentToTagged delegates to leafToTagged unnamed | target: TaggedTree (conformance/tagged-types.ts), leafToTagged (conformance/decode-leaf.ts)
packages/module/toml-edit/src/conformance/decode.ts:93 | missing-reference | current: not mentioned | target: parseTomlEdit (parse-toml-edit.ts), documentToTagged (conformance/decode-to-tagged.ts)
packages/module/toml-edit/src/conformance/encode-from-tagged.ts:2,5,103,161,165 | downgraded-link | current: backtick `tomlSet` mentions throughout | target: tomlSet (toml-set.ts)
packages/module/toml-edit/src/conformance/encode.ts:6,7,42,49 | downgraded-link/missing-reference | current: backtick tomlSet/emptyTomlEdit; buildToml doc names neither taggedToInput nor tomlStringify; @throws TomlTypeError plain text | target: tomlSet, emptyTomlEdit, taggedToInput (conformance/encode-from-tagged.ts), tomlStringify (toml-stringify.ts), TomlTypeError (errors.ts)
packages/module/toml-edit/src/conformance/tagged-types.ts:96 | downgraded-link | current: "threads the right grammar into `parseTomlEdit`" | target: parseTomlEdit (parse-toml-edit.ts)
packages/module/toml-edit/src/effective-helpers.ts:45,55,59 | downgraded-link | current: backtick asStringPath/PATH_HAS_NUMERIC sentinel mentions | target: asStringPath, PATH_HAS_NUMERIC (same file)
packages/module/toml-edit/src/effective-value.ts:11,41,42,57,73,142,160,162,255,257,269,319,368 | downgraded-link | current: backtick resolveByPath/tomlDelete/tomlSet/EffectiveResult/ResolveResult/NO_PROJECTION/SUBTREE_ABSENT mentions throughout | target: resolveByPath (resolve.ts), tomlDelete (toml-delete.ts), tomlSet (toml-set.ts), EffectiveResult/NO_PROJECTION/SUBTREE_ABSENT (same file), ResolveResult (resolve.ts)
packages/module/toml-edit/src/emit-value.ts:116,118,172,174,182,271,320,353 | downgraded-link/missing-reference | current: backtick tomlDelete/emitArray mentions; @throws TomlImmutableNodeError plain text; emitInlineTable/emitInlineTableWithExtra throw it with no @throws | target: tomlDelete (toml-delete.ts), emitArray/emitArrayWithoutIndex (same file), TomlImmutableNodeError (errors.ts)
packages/module/toml-edit/src/empty-toml-edit.ts:2,13,14,18,20,22 | downgraded-link/missing-reference | current: module doc backtick `emptyTomlEdit`; body's only call to parseTomlEdit unnamed; TomlEditState/CanonicalOptions backticked | target: emptyTomlEdit (self), parseTomlEdit (parse-toml-edit.ts), TomlEditState/CanonicalOptions (types.ts)
packages/module/toml-edit/src/errors.ts:72 | downgraded-link | current: "a function that requires splice mode (e.g. `tomlGetRaw`)" | target: tomlGetRaw (toml-get-raw.ts)
packages/module/toml-edit/src/fuzz/coverage-harness.ts:9,72,75,98,102 | downgraded-link | current: backtick TomlEditError mentions, including two @throws tags | target: TomlEditError (errors.ts)
packages/module/toml-edit/src/parse-toml-edit.ts:2,36,42,56,69,96,135,147,150,157,159 | downgraded-link/missing-reference | current: module doc + @throws TomlEditError plain text repeatedly; normalizeNewlines' doc never names assertNoBareCarriageReturn | target: parseTomlEdit (self), TomlEditError (errors.ts), assertNoBareCarriageReturn (self), TomlEditState/CanonicalOptions (types.ts), tomlStringify (toml-stringify.ts)
packages/module/toml-edit/src/path-create.ts:2,49,52,137,145,242,314 | downgraded-link/missing-reference | current: backtick tomlSet/resolveByPath; doPathCreate throws TomlImmutableNodeError twice with no @throws; doTopLevelDottedKeyInsert never names assertNoSiblingTableCollision | target: tomlSet (toml-set.ts), resolveByPath (resolve.ts), TomlImmutableNodeError (errors.ts), assertNoSiblingTableCollision (collision.ts), TomlEditState (types.ts)
packages/module/toml-edit/src/resolve.ts:2,25,54,61 | downgraded-link/missing-reference | current: backtick TomlPath/resolveByPath; resolveByPath's only real delegate (walk) never named | target: TomlPath (types.ts), resolveByPath/ResolveResult (self), walk (walk.ts)
packages/module/toml-edit/src/splice.ts:2,181,237,336,436 | downgraded-link | current: backtick spliceEmit/Edit/computeDeletionRange/AnchorKind/tomlSet mentions | target: spliceEmit, Edit, computeDeletionRange, AnchorKind (self), tomlSet (toml-set.ts)
packages/module/toml-edit/src/state.ts:2,22,62 | downgraded-link | current: backtick TomlEditState/tomlSet mentions | target: TomlEditState (types.ts), tomlSet (toml-set.ts)
packages/module/toml-edit/src/toml-delete.ts:2,3,54,56,116,139,170,173,273,336 | downgraded-link/missing-reference | current: module doc + @throws TomlImmutableNodeError plain text (twice); removeJsAtPath throws it with no @throws | target: tomlDelete (self), TomlEditState (types.ts), TomlImmutableNodeError (errors.ts), tomlGetValue (toml-get-value.ts)
packages/module/toml-edit/src/toml-get-comment-after.ts:2,19,28 | downgraded-link/missing-reference | current: module doc; sole delegate trailingInlineCommentFor never named; @throws TomlPathNotFoundError plain text | target: tomlGetCommentAfter (self), trailingInlineCommentFor (comments.ts), TomlPathNotFoundError (errors.ts)
packages/module/toml-edit/src/toml-get-comments-before.ts:2,19,26 | downgraded-link/missing-reference | current: same pattern, sole delegate attachedCommentsFor never named | target: tomlGetCommentsBefore (self), attachedCommentsFor (comments.ts), TomlPathNotFoundError (errors.ts)
packages/module/toml-edit/src/toml-get-comments.ts:2,16 | downgraded-link | current: backtick tomlInsertCommentBefore/After mentions | target: tomlInsertCommentBefore, tomlInsertCommentAfter (siblings)
packages/module/toml-edit/src/toml-get-node.ts:2,20,21,24,26,27,32 | downgraded-link | current: backtick resolveByPath/tomlSet/tomlGetValue/TomlPathNotFoundError/tomlStringify mentions, plus @throws plain text | target: resolveByPath (resolve.ts), tomlSet (toml-set.ts), tomlGetValue (toml-get-value.ts), TomlPathNotFoundError (errors.ts), tomlStringify (toml-stringify.ts)
packages/module/toml-edit/src/toml-get-raw.ts:2,25,26,32,35,36,37 | downgraded-link | current: backtick resolveByPath/tomlSet/tomlStringify mentions, @throws TomlSpliceUnavailableError/TomlPathNotFoundError plain text | target: resolveByPath, tomlSet, TomlSpliceUnavailableError, TomlPathNotFoundError, tomlStringify
packages/module/toml-edit/src/toml-get-value.ts:2,17,19 | downgraded-link | current: backtick tomlDelete/effectiveAt/tomlSet mentions | target: tomlDelete (toml-delete.ts), effectiveAt (effective-value.ts), tomlSet (toml-set.ts)
packages/module/toml-edit/src/toml-has.ts:2,13 | downgraded-link/missing-reference | current: module doc; tomlHas' only call to effectiveAt never named | target: tomlHas (self), effectiveAt (effective-value.ts)
packages/module/toml-edit/src/toml-insert-comment-after.ts:2,21,22,25,27 | downgraded-link | current: backtick Insertion/tomlStringify/TomlEditState mentions, @throws TomlPathNotFoundError plain text | target: Insertion/TomlEditState (types.ts), tomlStringify (toml-stringify.ts), TomlPathNotFoundError (errors.ts)
packages/module/toml-edit/src/toml-insert-comment-before.ts:2,21,22,25,27 | downgraded-link | current: same pattern, plus backtick tomlGetComments mention | target: same as above, plus tomlGetComments (toml-get-comments.ts)
packages/module/toml-edit/src/toml-keys.ts:2,18,128 | downgraded-link/missing-reference | current: module doc; core dependency effectiveAt never named; tableChildKeys throws TomlImmutableNodeError with no @throws | target: tomlKeys (self), effectiveAt (effective-value.ts), TomlImmutableNodeError (errors.ts)
packages/module/toml-edit/src/toml-set-aot.ts:2,65,67,70 | downgraded-link | current: backtick tomlSet mention, @throws TomlImmutableNodeError/TomlTypeError plain text | target: tomlSet (toml-set.ts), TomlEditState (types.ts), TomlImmutableNodeError, TomlTypeError (errors.ts)
packages/module/toml-edit/src/toml-set-header-comment.ts:2,18,20 | downgraded-link | current: module doc + backtick tomlStringify/TomlEditState mentions | target: tomlSetHeaderComment (self), tomlStringify (toml-stringify.ts), TomlEditState (types.ts)
packages/module/toml-edit/src/toml-set.ts:2,9,40,50,55,62,64,66,70,182,186,226,273 | downgraded-link/missing-reference | current: module doc + @throws TomlTypeError/TomlImmutableNodeError plain text repeatedly; doTableReplace throws TomlTypeError with no @throws | target: tomlSet (self), resolveByPath (resolve.ts), TomlEditState/Insertion/AnchorKind (types.ts), TomlTypeError, TomlImmutableNodeError (errors.ts)
packages/module/toml-edit/src/toml-stringify.ts:2,11 | downgraded-link/missing-reference | current: module doc; tomlStringify never names either function it dispatches to | target: tomlStringify (self), spliceEmit (splice.ts), canonicalEmit (canonical.ts)
packages/module/toml-edit/src/types.ts:35,84,88,103,113,126,132,148,174,186,217,228 | downgraded-link | current: backtick CanonicalOptions/DEFAULT_CANONICAL_OPTIONS/parseTomlEdit/emptyTomlEdit/valueRangeOf/tomlGetValue/Insertion/tomlSet mentions throughout | target: various siblings, see column above
packages/module/toml-edit/src/value-encoders.ts:5,17 | downgraded-link | current: backtick encodeValue/tomlInteger/tomlFloat mentions | target: encodeValue (values.ts), tomlInteger/tomlFloat (wrappers.ts)
packages/module/toml-edit/src/values.ts:47,80 | downgraded-link/missing-reference | current: @throws TomlTypeError plain text; private encodeValue throws it twice with no @throws | target: TomlTypeError (errors.ts)
packages/module/toml-edit/src/walk.ts:2,6,33,69,127,130,314,317 | downgraded-link/missing-reference | current: backtick resolveByPath/ResolveResult mentions; walkTable and findKeyValueByPrefix throw TomlImmutableNodeError with no @throws | target: resolveByPath, ResolveResult (resolve.ts), TomlImmutableNodeError (errors.ts), KEYVALUE_NOT_FOUND (self)
packages/module/toml-edit/src/wrappers.ts:2,14,19,34,39,58,77,96 | downgraded-link | current: 8 occurrences of "Tagged wrapper that `tomlSet` recognises..." | target: tomlSet (toml-set.ts)
packages/module/throws/src/index.ts:4 | downgraded-link | current: "Use `throws(error,)` when JavaScript syntax requires" | target: throws (packages/module/throws/src/throws.ts)
```

## Batch 04 (no-restricted-syntax, git, numeric-format, correction-reminder)

TOTAL FINDINGS: 485 (oxlint-plugins/no-restricted-syntax rules: 330;
cli/git: 135; numeric-format: 20). Largest single batch by far. Full
per-line listing kept in the agent transcript only; condensed below.

Systematic pattern: dominant failure mode is `missing-reference`, not
`downgraded-link` -- comments that never named a real dependency, far
more often than comments that had a link stripped. Two shapes recur
constantly: (1) "sentinel-of-absence" union return types
(`NOT_NODE_SYNC_CALLEE`, `NO_STATIC_SOURCE`, `NO_VARIABLE`,
`NOT_ERROR_DETECTION`, `NO_INIT_INFO`, `GIT_QUERY_FAILED`, etc.)
documented in `@returns` only as generic prose instead of `{@link}`-ing
the actual constant; (2) helper functions that call several
sibling/cross-file functions but document only externally observable
behavior, never naming the called helpers -- heaviest in the
`no-sync.*` and `prefer-error-is-error.*` rule families in
oxlint-plugins, and the `branch-create-*`/`commit-*` parser family in
cli/git, where dozens of functions share common helpers
(`expandAbbreviations`, `hasShortOption`/`matchesLongOption`,
`parseGlobalOptions`) never linked at any call site. Genuine
`downgraded-link` cases cluster around named string/numeric constants
standing in for literal values in code (`ERROR_OBJECT_TAG_SUFFIX`,
`ALL_CAPS_SNAKE`, `ERROR_IS_ERROR_CALLEE`) and cross-rule references
between sibling oxlint rules mentioning each other by name in prose
(`no-nullish-union` <-> `no-optional-escape`, `makeCommitOnly` in
cli/git's commit-sequencer checks) -- these read most like the issue's
described linter-bug-driven downgrades. A minor pattern unique to
`numeric-format`: documentation narrating a calculation's value ("below
10ms") instead of the name of the constant defining that threshold.

```
packages/oxlint-plugins/no-restricted-syntax/src/rules/_ban-disable-factory.ts:13,32 | missing-reference | current: not mentioned | target: DISABLE_DIRECTIVE_PREFIX, hasOxlintDisableDirective (same file)
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-disable-*.ts (15 files: max-lines, no-arrow-function, no-enum, no-for-in, no-hasownproperty, no-misused-promises, no-non-null-assertion, no-promise-catch, no-promise-finally, no-rest-params, no-switch, no-trim-left-right, no-try-finally, no-useless-return, no-variable-function-expression, prefer-regexp-exec, require-destructured-params, require-returns, require-tsdoc) | missing-reference (15 instances) | current: not mentioned in each file | target: banDisableRule (packages/oxlint-plugins/no-restricted-syntax/src/rules/_ban-disable-factory.ts), the factory each file's only call uses
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-class.ts:51,86,197 | downgraded-link/missing-reference | current: backtick DEFAULT_SUFFIXES mention; isFirstOption/readSuffixes/matchesSuffix not named | target: DEFAULT_SUFFIXES, isFirstOption, readSuffixes, matchesSuffix (same file)
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-immediate-mutation.syntax.ts | missing-reference, 23 instances | current: sentinel constants and sibling helpers never named | target: NO_INIT_INFO, NO_STATEMENT_LIST, NO_STATIC_MEMBER_NAME, NO_PREVIOUS_STATEMENT, isIdentifierNamed, unwrapExpression, findVariable, collectionNeedsSpreadTemp, initializerKind, initInfoFromDeclaration, initInfoFromAssignment (same file)
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-low-information-symbol-description/*.ts (ast.ts, classify.ts, index.ts, markers.ts, repetition.ts, tokenize.ts, types.ts) | missing-reference/downgraded-link, ~50 instances | current: classifier delegates to 9 helpers never named at classify.ts:43; index.ts:92 never names classifySymbolDescription/isSymbolCall/isSymbolForCall/staticDescription; constants (DIGIT_CHARACTERS, VOWEL_CHARACTERS, MAX_INSIGNIFICANT_WORD_LENGTH, BECAUSE_CONNECTIVE, NAMESPACE_DELIMITERS) and helpers (charKind, charKindAt, isWordBoundary, wordHasLetter, meaningfulWords) repeatedly unnamed | target: see file-local constants.ts, markers.ts, repetition.ts, tokenize.ts
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-module-root-let.ts:21, no-nullish-union.ts:26,93,104, no-optional-escape.ts:13,174,331,353 | downgraded-link | current: backtick "memoize()", "no-low-information-symbol-description", "nonNullishOrThrow", cross-references between "no-nullish-union" and "no-optional-escape" by rule name in prose | target: memoize (module/memoize), noLowInformationSymbolDescription, nonNullishOrThrow (module/or-throw), noNullishUnion/noOptionalEscape (siblings) -- clearest linter-bug-style downgrades in this batch
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-regex.ts:31,61,125,147,164,203,229 | downgraded-link/missing-reference, 11 instances | current: backtick "no-restricted-syntax/no-nullish-union"; isRegExpLiteral/isRegExpConstructorExpression/getStaticMethodName/isRegexAcceptingStringMethod never named | target: noNullishUnion (sibling), local AST helpers (same file)
packages/oxlint-plugins/no-restricted-syntax/src/rules/no-sync.*.ts (constants, node-builtin-source, node-sync-binding, node-sync-member, provenance, syntax, no-sync.ts itself) | missing-reference, ~85 instances total | current: recurring sentinel constants (NOT_NODE_SYNC_CALLEE, NO_STATIC_SOURCE, NO_VARIABLE, SYNC_SUFFIX) and helper-chain functions (getMemberName, getStaticPropertyName, getImportDeclaration, getVariableDeclarator, findVariable, isNodeBuiltinSource*) never named across this entire rule family's 7 files | target: see no-sync.constants.ts and no-sync.syntax.ts for the shared definitions
packages/oxlint-plugins/no-restricted-syntax/src/rules/prefer-describe-function-ref-name.ts:33,79,178,183,315,323,330,388 | downgraded-link/missing-reference | current: sourceTextByPath/readSourceTextOrEmpty/classifyExportedName/isCallableBinding not named; ALL_CAPS_SNAKE backticked 3x | target: same file's own sentinel/helpers
packages/oxlint-plugins/no-restricted-syntax/src/rules/prefer-error-is-error.*.ts (constants, detectors, globals, node-util, object-tag, syntax, prefer-error-is-error.ts itself) | downgraded-link/missing-reference, ~75 instances | current: recurring NOT_ERROR_DETECTION sentinel and constant-name backticks (ERROR_IS_ERROR_CALLEE, CONSTRUCTOR_PROPERTY_NAME, OBJECT_TAG_TYPE_PREFIX_LENGTH) plus cross-file detector functions never named | target: see prefer-error-is-error.constants.ts for shared definitions
packages/oxlint-plugins/no-restricted-syntax/src/rules/require-destructured-params.ts:25, require-queryselector-generic.ts:32 | missing-reference | current: not mentioned | target: simpleBanRule (_simple-ban-rule.ts), getStaticCallMemberName/SELECTOR_METHODS (ast-shared.ts/same file)
packages/cli/git/src/allowed-worktree-dirs.ts:98,244, auto-push.ts:171,231, effective-target.ts:159,228, escape-hatch.ts:66, index.ts:96, parse-global-options.ts:85, resolve-git.ts:109, parsers/add.ts:274 | missing-reference, ~16 instances | current: not mentioned | target: resolveUvCacheDir/safeRealpath/isPathUnder (same file), SubprocessError (nano-spawn), gitQuerySucceeds/filterPushOutput (same file), isExecFileExitError (same file), resolveGit/readGitWorktreeMetadata/isAllowedWorktreeDir, requireRoot/linkedWorktreeOnly (rules/), applyChdir, isShimForSelf, scanBulkTokens/optionRegion/pathspecRegion
packages/cli/git/src/parsers/branch-create-*.ts (7 files: branch-options, checkout-options, dispatch, shared, strip, switch-options, branch-create.ts itself) | missing-reference, ~38 instances | current: hasShortOption/matchesLongOption/isExactShortOption (branch-create-shared.ts) never named at dozens of call sites across the family; branch-create.ts:99 alone omits 10 sibling predicate functions | target: branch-create-shared.ts, branch-create-{branch,checkout,switch}-options.ts
packages/cli/git/src/parsers/clean-option-order.ts, clean-options.ts, clean.ts, commit-flag-aliases.ts, commit-normalise.ts, commit.ts, reset.ts, stash.ts | missing-reference, ~26 instances | current: expandAbbreviations (abbrev.ts) never named at 11 separate call sites; optionRegion, PATHSPEC_SEPARATOR, scanCleanOptionOrder, normaliseCommitArgs/hasCommitPathspec similarly unnamed | target: abbrev.ts, escape-hatch.ts, same-file siblings
packages/cli/git/src/rules/add-explicit.ts:62, atomic-push.ts:47, branch-worktree-messages.ts:37, branch-worktree-only.ts:80, branch-worktree-remote-guess.ts:49,83,116,149, commit-index-check.ts:39,63, commit-only.ts:193, commit-sequencer-check.ts:41,108, linked-worktree-only.ts:132,211, require-root.ts:67, status-hints-off.ts:55,102 | downgraded-link/missing-reference, ~25 instances | current: backtick "makeCommitOnly" cross-references (clearest linter-bug-style downgrade in cli/git); large rule-orchestrator functions (e.g. linked-worktree-only.ts:211, 11 dependencies) never name their delegates | target: makeCommitOnly (commit-only.ts), parseGlobalOptions (parse-global-options.ts), and other rules/ + parsers/ siblings
packages/module/numeric-format/src/byte.ts:22 | missing-reference | current: not mentioned | target: BYTES_PER_GIB, BYTES_PER_MIB, BYTES_PER_KIB (module/const/src/byte.ts)
packages/module/numeric-format/src/duration.ts:42,95,99,156,160,168,172,176,180,184,188,192,196,200,246,255 | missing-reference/downgraded-link, 17 instances | current: thresholds narrated by value ("below 10ms", "1000ms and above") instead of naming the constant; formatTrackedDuration's step variables divide/mod by SECONDS_PER_* constants never named; nonNullishOrThrow uncalled-out at two more @throws-less sites | target: DECIMAL_BELOW_MS (same file), MS_PER_SECOND/DAYS_PER_YEAR/SECONDS_PER_{YEAR,MONTH,WEEK,DAY,HOUR,MINUTE} (module/const/src/time.ts), nonNullishOrThrow (module/or-throw)
```

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

TOTAL FINDINGS: 81 (70 distinct doc locations; 7 recur at additional
un-listed lines within the same block, contributing 11 more instances).
No findings in `islands-black` or `async-iter`.

Systematic pattern: `markdown-lint` is mostly very well-disciplined,
following a strict "Parameters for {@link X}" / "Result of {@link X}"
convention almost everywhere, so its few violations (cli.ts's three
`@throws CliUsageError` mentions) stand out as the one file that
predates or escaped the convention. `aquati.cat` is much less
consistent: files repeatedly name a sentinel/branded-type/sibling
function by exact identifier in backticks (`CORES_UNDETECTED`,
`CSS_ABSENT`, `NO_CACHE`, `CACHE_MISS`, `ABSENT`, `NO_LANGUAGE`,
`SafeHtml`, `PhysicalCores`/`WorkerCount`) without ever wrapping them in
`{@link}`, heaviest in `jsx-to-html.ts`, `content.ts`, and
`git-dates.ts`. Smaller pattern: genuinely missing references on terse
one-line docs over `Record`/object-map constants, or tight 1:1 delegate
wrappers whose docs describe the effect but never name the function
doing the work.

```
packages/cli/markdown-lint/src/cli.ts:72 | downgraded-link | current: "@throws CliUsageError when the value is not a known reporter" | target: CliUsageError (packages/cli/markdown-lint/src/cli.ts:38)
packages/cli/markdown-lint/src/cli.ts:89 | downgraded-link | current: "@throws CliUsageError when a --format= value is not a known reporter" | target: CliUsageError (packages/cli/markdown-lint/src/cli.ts:38)
packages/cli/markdown-lint/src/cli.ts:137 | downgraded-link | current: "@throws CliUsageError on an unknown option" | target: CliUsageError (packages/cli/markdown-lint/src/cli.ts:38)
packages/cli/markdown-lint/src/html-table-cell-text.ts:150 | missing-reference | current: not mentioned | target: escapeHtmlText, normalizeMarkdownEscapes (packages/cli/markdown-lint/src/html-table-cell-text.ts:136,51)
packages/cli/markdown-lint/src/reporters.ts:81 | missing-reference | current: not mentioned | target: pretty, json (packages/cli/markdown-lint/src/reporters.ts:37,61)
packages/ssg/aquati.cat/src/build/compress-lib.ts:48 | downgraded-link | current: "Sentinel returned by `physicalCoreCount` when..." | target: physicalCoreCount (packages/ssg/aquati.cat/src/build/compress-lib.ts:193)
packages/ssg/aquati.cat/src/build/compress-lib.ts:129 | downgraded-link | current: "Brands a caller-validated integer as a `PhysicalCores` count." | target: PhysicalCores (packages/ssg/aquati.cat/src/build/compress-lib.ts:30)
packages/ssg/aquati.cat/src/build/compress-lib.ts:151 | downgraded-link | current: "Brands a caller-validated integer as a `WorkerCount`." | target: WorkerCount (packages/ssg/aquati.cat/src/build/compress-lib.ts:37)
packages/ssg/aquati.cat/src/build/compress-lib.ts:182 | downgraded-link | current: "Returns the CORES_UNDETECTED sentinel off Linux..." (also lines 186, 291) | target: CORES_UNDETECTED (packages/ssg/aquati.cat/src/build/compress-lib.ts:54)
packages/ssg/aquati.cat/src/build/compress-lib.ts:248 | downgraded-link | current: "Both paths are capped by `availableParallelism()`" (also lines 249, 251) | target: availableParallelism (node:os, external)
packages/ssg/aquati.cat/src/build/compress.ts:88 | downgraded-link | current: "exactly one `Tally` for a message event" | target: Tally (packages/ssg/aquati.cat/src/build/compress-lib.ts:42)
packages/ssg/aquati.cat/src/build/postprocess.ts:91 | downgraded-link | current: "Sentinel returned by `fingerprintCss` when no styles.css exists" | target: fingerprintCss (packages/ssg/aquati.cat/src/build/postprocess.ts:184)
packages/ssg/aquati.cat/src/build/postprocess.ts:134 | downgraded-link | current: "Hashed basename produced by `insertHash`." (also line 260) | target: insertHash (packages/ssg/aquati.cat/src/build/fingerprint-naming.ts:47)
packages/ssg/aquati.cat/src/build/postprocess.ts:177 | downgraded-link | current: "or CSS_ABSENT when the file is absent" | target: CSS_ABSENT (packages/ssg/aquati.cat/src/build/postprocess.ts:95), plus identical mentions at lines 205, 207, 230, 525
packages/ssg/aquati.cat/src/build/postprocess.ts:505 | downgraded-link | current: "awaited in a Promise.all with `runPagefind`" | target: runPagefind (packages/ssg/aquati.cat/src/build/postprocess.ts:421)
packages/ssg/aquati.cat/src/build/subset-fonts.ts:119 | downgraded-link | current: "via the `icon(name)` helper (src/lib/icons/icon.ts)" | target: icon (packages/ssg/aquati.cat/src/lib/icons/icon.ts)
packages/ssg/aquati.cat/src/build/subset-fonts.ts:146 | downgraded-link | current: "every code point found in every source file under SOURCE_GLOB" | target: SOURCE_GLOB (packages/ssg/aquati.cat/src/build/subset-fonts.ts:95)
packages/ssg/aquati.cat/src/build/subset-fonts.ts:286 | missing-reference | current: not mentioned | target: collectBodyCharset, collectIconCodepoints (packages/ssg/aquati.cat/src/build/subset-fonts.ts:167,221)
packages/ssg/aquati.cat/src/client/index.ts:244 | missing-reference | current: not mentioned | target: HIGHLIGHT_GROUPS (packages/ssg/aquati.cat/src/client/highlight-groups.ts:14)
packages/ssg/aquati.cat/src/client/search.ts:22 | downgraded-link | current: "Pagefind search result metadata returned by result.data()" | target: PagefindResult.data (packages/ssg/aquati.cat/src/client/search.ts:42)
packages/ssg/aquati.cat/src/client/search.ts:35 | downgraded-link | current: "Single result entry from pagefind.search()" | target: PagefindApi.search (packages/ssg/aquati.cat/src/client/search.ts:60)
packages/ssg/aquati.cat/src/client/search.ts:155 | downgraded-link | current: "Uses Pagefind's debouncedSearch to coalesce rapid keystrokes" | target: PagefindApi.debouncedSearch (packages/ssg/aquati.cat/src/client/search.ts:61)
packages/ssg/aquati.cat/src/client/search.ts:202 | downgraded-link | current: "over-large result sets get truncated to MAX_RESULTS" | target: MAX_RESULTS (packages/ssg/aquati.cat/src/client/search.ts:76)
packages/ssg/aquati.cat/src/client/shuffle-children.ts:5 | downgraded-link | current: "The ShuffleChildren component sets display: flex on..." | target: ShuffleChildren (packages/ssg/aquati.cat/src/components/shuffle-children.ts:56)
packages/ssg/aquati.cat/src/images/convert.ts:111 | missing-reference | current: not mentioned | target: fileExists, convertToAvif (packages/ssg/aquati.cat/src/images/convert.ts:53,94)
packages/ssg/aquati.cat/src/lib/cache.ts:87 | downgraded-link | current: "Sentinel returned by readCache when no manifest file exists" | target: readCache (packages/ssg/aquati.cat/src/lib/cache.ts:125)
packages/ssg/aquati.cat/src/lib/cache.ts:94 | downgraded-link | current: "Sentinel returned by getCachedEntry when the manifest has no matching..." | target: getCachedEntry (packages/ssg/aquati.cat/src/lib/cache.ts:206)
packages/ssg/aquati.cat/src/lib/cache.ts:112 | downgraded-link | current: "Returns NO_CACHE when the cache file does not exist." (also line 118) | target: NO_CACHE (packages/ssg/aquati.cat/src/lib/cache.ts:91)
packages/ssg/aquati.cat/src/lib/cache.ts:199 | downgraded-link | current: "@returns cached entry if the content hash matches, otherwise CACHE_MISS" | target: CACHE_MISS (packages/ssg/aquati.cat/src/lib/cache.ts:98)
packages/ssg/aquati.cat/src/lib/content.ts:139 | downgraded-link | current: "YAML body... fed to parseYaml" | target: parseYaml (aliased import of `parse` from yaml, packages/ssg/aquati.cat/src/lib/content.ts:22)
packages/ssg/aquati.cat/src/lib/content.ts:212 | downgraded-link | current: "The coerceDateSchema accepts both native Date objects..." | target: coerceDateSchema (packages/ssg/aquati.cat/src/lib/content.ts:195)
packages/ssg/aquati.cat/src/lib/content.ts:258 | downgraded-link | current: "Returned by loadContent... fully-resolved Post objects built by attachDates" | target: loadContent, Post, attachDates (packages/ssg/aquati.cat/src/lib/content.ts:349,299,458)
packages/ssg/aquati.cat/src/lib/content.ts:394 | downgraded-link | current: "before narrowing to the Locales type" | target: Locales (packages/ssg/aquati.cat/src/i18n/i18n-types.ts)
packages/ssg/aquati.cat/src/lib/content.ts:439 | downgraded-link | current: "by calling getPostDates for files missing from the cache" | target: getPostDates (packages/ssg/aquati.cat/src/lib/git-dates.ts:453)
packages/ssg/aquati.cat/src/lib/date-divergence.ts:21 | downgraded-link | current: "Logger subset needed for divergence diagnostics." | target: Logger (packages/ssg/aquati.cat/src/lib/types.ts:4)
packages/ssg/aquati.cat/src/lib/frontmatter-dates.ts:99 | missing-reference | current: not mentioned (says "a sentinel" generically) | target: NO_AUTHORED_DATE (packages/ssg/aquati.cat/src/lib/frontmatter-dates.ts:11)
packages/ssg/aquati.cat/src/lib/git-dates.ts:144 | downgraded-link | current: "When shallow, getPostDates falls back to the GitHub REST API" | target: getPostDates (packages/ssg/aquati.cat/src/lib/git-dates.ts:453)
packages/ssg/aquati.cat/src/lib/git-dates.ts:433 | downgraded-link | current: "@param isShallow - pre-computed shallow-clone flag (from detectShallow)" | target: detectShallow (packages/ssg/aquati.cat/src/lib/git-dates.ts:154)
packages/ssg/aquati.cat/src/lib/git-dates.ts:471 | downgraded-link | current: "...ABSENT when the file has no git history" | target: ABSENT (packages/ssg/aquati.cat/src/lib/git-dates.ts:33), plus identical mentions at lines 498, 561
packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:5 | downgraded-link | current: "needs a JSX runtime (jsx, jsxs, Fragment)" | target: jsx, jsxs, Fragment (packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:249,268,175)
packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:15 | downgraded-link | current: "Each jsx call directly returns a SafeHtml wrapper" (also lines 18,20,53,57,82,168,198) | target: SafeHtml (packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:36)
packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:23 | downgraded-link | current: "Reuses escapeHtml and VOID_ELEMENTS from..." | target: escapeHtml, VOID_ELEMENTS (@monochromatic-dev/module-hyperscript, external)
packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:136 | downgraded-link | current: "PROP_TO_ATTR rewrites JSX-isms like className to class" | target: PROP_TO_ATTR (packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:47)
packages/ssg/aquati.cat/src/lib/markdown.ts:58 | downgraded-link | current: "Default-exported MDX component returned by evaluate is the JSX entry point" | target: evaluate (@mdx-js/mdx, packages/ssg/aquati.cat/src/lib/markdown.ts:14)
packages/ssg/aquati.cat/src/lib/markdown.ts:93 | downgraded-link | current: "produces the SafeHtml payload consumed by callers" | target: SafeHtml (packages/ssg/aquati.cat/src/lib/jsx-to-html.ts:36)
packages/ssg/aquati.cat/src/lib/rehype-highlight.ts:159 | missing-reference | current: not mentioned | target: ssgHighlighter (packages/ssg/aquati.cat/src/client/tags.ts:35), HIGHLIGHT_GROUPS (packages/ssg/aquati.cat/src/client/highlight-groups.ts:14)
packages/ssg/aquati.cat/src/lib/rehype-highlight.ts:251 | downgraded-link | current: "Language detected from the code class list, or NO_LANGUAGE to skip" | target: NO_LANGUAGE (packages/ssg/aquati.cat/src/lib/rehype-highlight.ts:99)
packages/ssg/aquati.cat/src/lib/rehype-highlight.ts:288 | missing-reference | current: not mentioned | target: visitNode (packages/ssg/aquati.cat/src/lib/rehype-highlight.ts:231)
```

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

TOTAL FINDINGS: 150.

Systematic pattern: orchestrator-style functions (page handlers in
`server/pages/*.ts`, API route handlers in `server/api/*.ts`, the
task-depends/task-oxlint/task-tsc pipeline stages in
`dev-script/task-util`, and the MCP dispatch chain) describe what they
do in prose but almost never name the sibling/imported function they
delegate to, even when that call is the single line of substance in the
body -- looks like a doc-writing convention, not file-specific neglect.
A sharper pattern directly matches the issue's premise:
`@throws`/summary lines describe a sentinel or custom-error class in
plain prose instead of linking it (`server-api-routes.ts` `HTTPError`,
`lib/db/tasks.ts` `createTask`'s `@throws`, `mcp/stdio` `NO_RESPONSE`),
and several comments still carry the literal identifier in backticks
(`requireParam`, `DEFAULT_PORT`, `createTaskCard`, `renderPage`) as if a
link were stripped to plain code-span. By contrast,
`oxlint-suppress.ts`, `oxlint-fix-loop.ts`, and `mcp/stdio/server-types.ts`
already consistently use `{@link}`, so the gap is uneven, not universal.
CSS-mixin composition calls and internal SQL/validation-Set constants
were deliberately excluded as low-signal volume.

```
packages/webapp-productivity/done/src/client/components/task-detail-pills.ts:23 | missing-reference | current: not mentioned | target: formatRunningTrackedTime (packages/webapp-productivity/done/src/client/lib/task-card.ts)
packages/webapp-productivity/done/src/client/components/task-detail.ts:60,154,187 | missing-reference | current: not mentioned | target: createAutofillController, buildPillElements (siblings), buildTaskDetailTree/TASK_DETAIL_STYLES (task-detail-render.ts, task-detail-styles.ts)
packages/webapp-productivity/done/src/client/components/task-detail-types.ts:88 | downgraded-link | current: "passed to `TaskDetail.configure()`" | target: TaskDetail.configure (task-detail.ts)
packages/webapp-productivity/done/src/client/components/toast-message.ts:96 | downgraded-link | current: "schedules auto-removal after `DISMISS_MS`" | target: DISMISS_MS (same file)
packages/webapp-productivity/done/src/client/inbox-builders.ts:51, inbox-suggested.ts:27 | missing-reference | current: not mentioned | target: createTaskCard (lib/task-card.ts), buildTaskList (inbox-builders.ts)
packages/webapp-productivity/done/src/client/in-progress.ts:49, inbox.ts:67, search.ts:69 | missing-reference | current: "via the API" / "complete-task API call", api not named | target: api (client/lib/api.ts)
packages/webapp-productivity/done/src/client/lib/api.ts:46 | missing-reference | current: not mentioned | target: showToast (components/toast-message.ts)
packages/webapp-productivity/done/src/lib/db.ts:44,46 | downgraded-link/missing-reference | current: backtick DEFAULT_DATABASE_PATH; getArgumentValue/ARGUMENT_ABSENT not named | target: DEFAULT_DATABASE_PATH (same file), getArgumentValue/ARGUMENT_ABSENT (lib/args.ts)
packages/webapp-productivity/done/src/lib/ai/client.ts:146 | missing-reference | current: not mentioned | target: isRateLimited, recordRequest (same file)
packages/webapp-productivity/done/src/client/lib/task-card-helpers.ts:90, task-card.ts:25,88,223 | downgraded-link/missing-reference | current: backtick createTaskCard mention; formatTrackedTime/buildChipTexts not named | target: formatTrackedTime, buildChipTexts (task-card-helpers.ts), createTaskCard (self)
packages/webapp-productivity/done/src/lib/types.ts:114,129 | downgraded-link | current: "Payload accepted by `createTask()`"; "accepted by `updateTask()`" | target: createTask, updateTask (lib/db/tasks.ts)
packages/webapp-productivity/done/src/lib/db/tasks-helpers.ts:109,200,212 | downgraded-link/missing-reference | current: backtick completeTask/TaskRow/Task mentions; parseStringArray not named | target: completeTask (tasks-timer.ts), TaskRow (same file), Task (lib/types.ts), parseStringArray (same file)
packages/webapp-productivity/done/src/lib/db/tasks-queries.ts:38,56,79,106,131,181 | missing-reference, 6 instances | current: not mentioned | target: mapTask, getTaskRowById (tasks-helpers.ts) -- same omission repeated across listInboxUnblockedTasks/listBlockedInboxTasks/listInProgressTasks/listTasksForBlockerPicker/searchTasks
packages/webapp-productivity/done/src/lib/db/tasks-timer.ts:35,62,117 | missing-reference | current: not mentioned | target: getTaskById, nowIso (tasks-queries.ts/tasks-helpers.ts), stopTaskTimer (same file)
packages/webapp-productivity/done/src/lib/db/tasks.ts:43,50,111 | missing-reference | current: "@throws When the read-back fails" unnamed; nowIso/normalizeStringArray/getTaskById not named | target: getTaskById, TASK_NOT_FOUND (tasks-queries.ts, lib/types.ts), nowIso/normalizeStringArray (tasks-helpers.ts)
packages/webapp-productivity/done/src/client/lib/page-data.ts:3 | downgraded-link | current: "embed... that `renderPage()` embed" | target: renderPage (server/pages/layout.ts)
packages/webapp-productivity/done/src/server-api-routes.ts:37,89,106,120,134,148 | downgraded-link | current: "@throws HTTPError 400 when parameter is missing"; "thrown as 400 by `requireParam`" x5 | target: HTTPError (external/h3), requireParam (same file)
packages/webapp-productivity/done/src/server.ts:111,115 | downgraded-link/missing-reference | current: backtick DEFAULT_PORT; getArgumentValue/ARGUMENT_ABSENT not named | target: DEFAULT_PORT (same file), lib/args.ts
packages/webapp-productivity/done/src/server/api/ai-autofill.ts:210 | missing-reference | current: not mentioned | target: listAllTags/listAllLocations (lib/db/tasks-queries.ts), buildAutofillMessages (lib/ai/prompts.ts), chatCompletion (lib/ai/client.ts), parseAutofillResponse (same file)
packages/webapp-productivity/done/src/server/api/tasks-parse-update.ts:48,51,64 | downgraded-link/missing-reference | current: backtick TaskUpdateInput/updateTask mentions; parse helpers not named | target: TaskUpdateInput (lib/types.ts), updateTask (lib/db/tasks.ts), parseStringArray/parseEnumValue/parseStatus/isRecord (tasks-parse.ts)
packages/webapp-productivity/done/src/server/api/tasks.ts:76,79,180,189,239 | downgraded-link/missing-reference | current: backtick isRecord/parseTaskUpdateInput mentions; createTask/updateTask/deleteTask not named | target: isRecord, parseTaskUpdateInput (tasks-parse{,-update}.ts), createTask/updateTask/deleteTask (lib/db/tasks.ts)
packages/webapp-productivity/done/src/server/api/timer.ts:62,89,116 | missing-reference | current: not mentioned | target: startTaskTimer/stopTaskTimer/completeTask (lib/db/tasks.ts)
packages/webapp-productivity/done/src/server/pages/in-progress.ts:20, inbox.ts:24, search.ts:29, settings.ts:19, task-details.ts:30 | missing-reference | current: not mentioned | target: listInProgressTasks/listInboxUnblockedTasks/listBlockedInboxTasks/searchTasks/listAllTags/getTaskById/listTasksForBlockerPicker (lib/db/tasks-queries.ts), renderPage/serializePageData (layout.ts)
packages/webapp-productivity/done/src/server/pages/layout.ts:35,74 | downgraded-link/missing-reference | current: backtick renderPage mention; serializePageData not named | target: renderPage, serializePageData (same file)
packages/dev-script/task-util/src/depends-exec.ts:84, depends-resolve-glob.ts:63, depends-resolve.ts:83,166,282, depends-staleness-aggregate.ts:204, depends-staleness.ts:99, depends-strategy.ts:131, depends.ts:189 | missing-reference, ~9 instances | current: not mentioned | target: dumpAndHandleError/firstGlobMetaIndex (same files), resolveGlobFiles (depends-resolve-glob.ts), UNPARSEABLE_TIMESTAMP/parseTimestamp (depends-parse.ts), resolveShellCommand/resolveGlob (same file), builtinStrategies/runStrategyCommand (depends-strategy.ts), resolveItems/aggregateTimestamps, computeMean/computeMedian, BUILTIN_STRATEGIES
packages/dev-script/task-util/src/oxlint-augment.ts:210,404,494,603 | missing-reference, 4 instances | current: not mentioned | target: ansiEscapeLength, skipWhitespace/skipRuleNameChars/allNonWhitespaceBetween, matchHeaderAt, resolveDiagnosticGuidance/extractRuleName (oxlint-guidance.ts, same file)
packages/dev-script/task-util/src/oxlint-fix-loop.ts:160,287 | missing-reference | current: not mentioned | target: stripAnsi (oxlint-augment.ts), hasDiagnostics/normalizeForConvergence (same file)
packages/dev-script/task-util/src/oxlint-suppress.ts:140,210,315,394 | missing-reference, 4 instances | current: not mentioned | target: extractRuleName/stripAnsi (oxlint-augment.ts), isSummaryLine/pluralize/rewriteSummary/classifyHeader/blockEndIndex/blockIsSuppressed (same file)
packages/dev-script/task-util/src/oxlint-wrapper.ts:200, pnpm-filter.ts:66, pnpm-output-filter.ts:128 | missing-reference | current: "augments the survivors" unnamed; not mentioned | target: augmentOxlintOutput (oxlint-augment.ts), filterPnpmOutput (pnpm-output-filter.ts), isAllowedCycleWarning (same file)
packages/dev-script/task-util/src/tsc-filter.ts:147,304,363,436 | missing-reference, 4 instances | current: not mentioned | target: endOfDigitRun, isNodeModulesDiagnostic/isI18nGeneratedDiagnostic, isDiagnosticLine/isSuppressedDiagnostic/isContinuationLine, removeStaleBuildInfo/filterTscOutput (same file)
packages/mcp/stdio/src/json-rpc.ts:160 | missing-reference | current: not mentioned | target: JsonRpcInbound (same file)
packages/mcp/stdio/src/server-response.ts:89 | downgraded-link | current: "@returns NO_RESPONSE sentinel since notifications produce no reply" | target: NO_RESPONSE (server-types.ts)
packages/mcp/stdio/src/server-tool-call.ts:36 | missing-reference | current: not mentioned | target: respondError, respondSuccess (server-response.ts)
packages/mcp/stdio/src/server.ts:135,193,195 | downgraded-link/missing-reference | current: backtick handleToolCall/NO_RESPONSE mentions; handleNotification not named | target: handleToolCall (server-tool-call.ts), NO_RESPONSE (server-types.ts), handleNotification (server-response.ts)
packages/mcp/stdio/src/transport.ts:80 | missing-reference | current: not mentioned | target: writeMessage (same file), readLines (line-reader.ts), isJsonRpcMessage (json-rpc.ts)
```

## Batch 10 (morph-compact, advisor, module/test, image-diff, test-support)

(pending)

## Batch 11 (doodle-widget, claude-code-plugins/source, catalog-tighten)

(pending)

## Batch 12 (deps-cube, git-clone-size, current-time-context, oxlint-plugins/shared)

TOTAL FINDINGS: 50 (counting each individual target name; several listed
lines cover multiple targets). No findings in `oxlint-plugins/shared`.

Systematic pattern: every `catch` block that formats its warning via
`caughtErrorMessage(error)` (7 instances across `cache.ts`,
`probe-fields.ts` x3, `probe-transitive.ts`, `filter.ts`, `state.ts`)
never names that helper in the enclosing function's TSDoc, despite being
a real, directly-called sibling import. A much larger pattern is
specific to `AppState`: referenced in backtick prose (never `{@link}`)
in eight separate spots across `deck-accessors.ts`, `deck-config.ts`,
`controller.ts`, and especially `state.ts` (five occurrences in one
file), while sibling types like `CatalogEntry` and `Cache` are
consistently `{@link}`-wrapped elsewhere in the same package, suggesting
`AppState` was never updated when the package's linking convention was
established. `git-clone-size` shows the textbook case the issue
describes: both `@throws CloneSizeError` tags use plain text instead of
`{@link CloneSizeError}`, while every other `@throws` (generic `Error`)
is fine as-is.

```
packages/cli/git-clone-size/src/assemble.ts:127 | missing-reference | current: not mentioned | target: churnEstimate, deepenEstimate, hostProxyEstimate, localExactEstimate, priorAbsentEstimate, priorEstimate (packages/cli/git-clone-size/src/estimators.ts), buildEstimates calls all six but names none
packages/cli/git-clone-size/src/combine.ts:245 | downgraded-link | current: "@throws CloneSizeError when called with no estimators" | target: CloneSizeError (packages/cli/git-clone-size/src/errors.ts)
packages/cli/git-clone-size/src/measure.ts:8 | downgraded-link | current: "`NO_DEEPEN`, `NO_TREE0`, and `NO_CHURN`" | target: NO_DEEPEN (packages/cli/git-clone-size/src/probe-deepen.ts), NO_TREE0/NO_CHURN (packages/cli/git-clone-size/src/probe-partial.ts)
packages/cli/git-clone-size/src/pack-bytes.ts:30 | downgraded-link | current: "@throws CloneSizeError when either git process exits non-zero" | target: CloneSizeError (packages/cli/git-clone-size/src/errors.ts)
packages/dev-script/deps-cube/src/cache.ts:205 | missing-reference | current: not mentioned | target: caughtErrorMessage (packages/dev-script/deps-cube/src/error-format.ts)
packages/dev-script/deps-cube/src/catalog.ts:133 | missing-reference | current: not mentioned | target: decodeAlias (same file)
packages/dev-script/deps-cube/src/catalog.ts:186 | missing-reference | current: not mentioned | target: entriesFromBlock (same file, called twice)
packages/dev-script/deps-cube/src/deck-accessors.ts:4 | downgraded-link | current: "the current `AppState`" | target: AppState (packages/dev-script/deps-cube/src/scripts/state.ts)
packages/dev-script/deps-cube/src/deck-config.ts:212 | downgraded-link | current: "@param state - Current `AppState`." | target: AppState (packages/dev-script/deps-cube/src/scripts/state.ts)
packages/dev-script/deps-cube/src/deck-geometries.ts:48,249 | downgraded-link | current: "matches `SPHERE_NLAT`"; "x `SQRT_3_INV`" | target: SPHERE_NLAT, SQRT_3_INV (same file)
packages/dev-script/deps-cube/src/deck-layers-ticks.ts:6,63 | downgraded-link/missing-reference | current: "`PathDatum` accessor from deck-layers.ts"; computeAxisGeometry not named | target: PathDatum, computeAxisGeometry (packages/dev-script/deps-cube/src/deck-layers.ts)
packages/dev-script/deps-cube/src/deck-textures.ts:290,344 | downgraded-link | current: backtick MIN_FONT_SIZE_PX/FONT_SIZE_PX/SPHERE_SLOT_FILL_FRACTION/SPHERE_REPETITIONS mentions | target: same names (same file)
packages/dev-script/deps-cube/src/probe-field-types.ts:41 | downgraded-link | current: "yields `REPO_UNPARSEABLE` rather than a nullish union" | target: REPO_UNPARSEABLE (packages/dev-script/deps-cube/src/probe-field-parsers.ts)
packages/dev-script/deps-cube/src/probe-fields.ts:79,149,196,276,356 | downgraded-link/missing-reference | current: backtick HTTP_TIMEOUT_MS/CACHE_MISS mentions (TTL_MS right beside is already a proper {@link}); caughtErrorMessage not named at 3 sites | target: HTTP_TIMEOUT_MS (same file), CACHE_MISS (packages/dev-script/deps-cube/src/cache.ts), caughtErrorMessage (packages/dev-script/deps-cube/src/error-format.ts)
packages/dev-script/deps-cube/src/probe-transitive.ts:69 | missing-reference | current: not mentioned | target: caughtErrorMessage (packages/dev-script/deps-cube/src/error-format.ts)
packages/dev-script/deps-cube/src/render-controls.ts:361 | downgraded-link | current: "String form of `RANGE_STEP`" | target: RANGE_STEP (same file)
packages/dev-script/deps-cube/src/scripts/controller-range-events.ts:131 | downgraded-link | current: "Narrowed `DataDimKey` matching raw" | target: DataDimKey (packages/dev-script/deps-cube/src/scripts/filter.ts)
packages/dev-script/deps-cube/src/scripts/controller.ts:297,310 | downgraded-link | current: "Builds the initial `Session`..."; "Initial `AppState`..." | target: Session (same file), AppState (packages/dev-script/deps-cube/src/scripts/state.ts)
packages/dev-script/deps-cube/src/scripts/filter.ts:11,418,467 | downgraded-link/missing-reference | current: backtick PackageProbe/ChannelKey mentions; caughtErrorMessage not named | target: PackageProbe (packages/dev-script/deps-cube/src/probe.ts), ChannelKey (same file), caughtErrorMessage (packages/dev-script/deps-cube/src/error-format.ts)
packages/dev-script/deps-cube/src/scripts/state.ts:260,266,294,339,345,368,386 | downgraded-link/missing-reference | current: backtick DEFAULT_TOGGLES/AppState mentions (5x AppState in this file alone); caughtErrorMessage not named | target: DEFAULT_TOGGLES, AppState (same file), caughtErrorMessage (packages/dev-script/deps-cube/src/error-format.ts)
packages/pi/current-time-context/src/format-time-context.ts:29 | missing-reference | current: "delegating to the shared formatter" (unnamed) | target: formatTimeContext (packages/module/current-time-context/src)
packages/pi/current-time-context/src/mise.verify-extension.ts:63 | missing-reference | current: not mentioned | target: fakePiApi, createBeforeAgentStartEvent, createExtensionContext, getBeforeAgentStartHandler (packages/pi/current-time-context/src/pi-test-harness.ts), isTimeContextContent (packages/pi/current-time-context/src/time-context-shape.ts)
```

## Batch 13 (page-weight, logger, hall-monitor, android-exempt-unused, build-tool/css, pipe, matrix, tofu, typeface/aquaticat, import-attributes, config/tsdown, rgffplay, prompt-time)

(pending)

## Batch 14 (terminal-exec, hyperscript, rss, config/oxlint, kv-store, fs-path, hook-types, or-throw, session-start-housekeeping)

(pending)

## Batch 15 (vmsync, spawn, figma kiwi, figma penpot, pi/statusline, llm-types)

(pending)

## Batch 16 (terminal-title, vm-builder, catalog-tighten.matrix, forbidden-strings, dom, claude-code-plugins/statusline, thinking-defaults, mcp/mvm, syllable-break-demo, const, memoize, token-count, observable, runtime-error/bun, function-arity, pi/current-time-context, guardrail, root config files)

(pending)
