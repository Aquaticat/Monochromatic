# Markdown-lint Sätteri binding build investigation

## User requirements

- Work in a fresh worktree.
- Explain how to prevent a successful markdown-lint build from implying that Sätteri's native binding is usable.
- Read GitHub issue 447 and incorporate its consumer-bundling failure.
- Investigate and recommend;
   do not implement an accepted design without a user decision.
- Keep this handover current during the investigation.

## Worktree and versions

The disposable worktree is
`/var/home/user/temp/agent/markdown-lint-satteri.TSb8L5IW`
at Monochromatic commit `35d90771ce4bc1e74bddf7ccafb3d1cdc6e50c89`.

The install uses pnpm `11.21.0`,
 Node `26.7.0`,
 Rolldown `1.2.3`,
 and Sätteri `0.9.5`.
A fresh `mise run prepare:pnpm:install` installed the Linux x64 GNU binding normally.
The missing-binding state was then made deterministically by moving only Sätteri's
`@bruits/satteri-linux-x64-gnu` dependency link out of its virtual-store `node_modules`.

The matching upstream Sätteri source is cloned at
`/var/home/user/temp/agent/satteri-source.L3WiJZ6z`,
origin `https://github.com/bruits/satteri.git`,
commit `92d01ec4eee3a7284608f5a4974dca6d4aec836e`,
tag `satteri-v0.9.5`.

## Reproduction evidence

With the binding present,
 this command built the package and ran the built CLI successfully:

```console
$ mise run //package/cli/markdown-lint:build
✔ rolldown v1.2.3 Finished
$ node package/cli/markdown-lint/dist/final/node/cli.mjs --format=json \
    /var/home/user/temp/agent/satteri-repro-clean.md
[]
```

With Sätteri's Linux binding link absent,
 the same build succeeded twice.
Loading the resulting CLI then failed twice with:

```text
Error: Cannot find native binding. npm has a bug related to optional dependencies
...
[cause]: Error: Cannot find module '@bruits/satteri-linux-x64-gnu'
```

`mise run //package/cli/markdown-lint:test:unit` also fails in this state,
because its test files import the parser.
The existing `buildAndTest` task therefore catches the condition even though `build` does not.

## Direct markdown-lint root cause

`package/cli/markdown-lint/package.json` declares `satteri` as a dependency.
`package/config/rolldown/src/package-externals.ts:189-238` externalizes dependencies from the consuming manifest.
`package/config/rolldown/src/index.node.ts:82-90` installs that external list in the shared Node config.
The generated `dist/final/node/{index,cli}.mjs` files consequently retain
`import ... from "satteri"` rather than traversing or evaluating Sätteri during the build.

Sätteri loads the binding at module evaluation time.
Upstream `packages/satteri/index.js:287-299` tries the local binary and then
`@bruits/satteri-linux-x64-gnu`.
`packages/satteri/index.js:530-584` calls `requireNative()`,
 tries WASI and WebContainer fallbacks,
and throws the quoted error when none resolves.
The build and runtime are therefore checking different boundaries.

A build cache is not involved:
 output timestamps changed on each fresh Rolldown run.
Sätteri does not defer the check until parsing:
 importing its module reaches the loader.

## Issue 447

The branch carrying issue 447's consumer is checked out in a second fresh disposable worktree,
`/var/home/user/temp/agent/issue-447-satteri.Tpkzokt6`,
at `translation-repair-rebased` commit `3311e7bd9c8f7f037a7322e01b909870d2029400`.

Issue 447 reports a second and more important shape.
`@monochromatic-dev/module-translation-repair` imports markdown-lint rule functionality.
The shared Node config always bundles `@monochromatic-dev/**`.
If translation-repair does not declare `satteri`,
 Rolldown follows the inlined markdown-lint source and also copies
Sätteri's loader into translation-repair's bundle.
The copied loader resolves from `dist/final/node`,
 not from Sätteri's own package directory,
so pnpm's binding link under Sätteri is invisible.

The current workaround declares `satteri` directly in translation-repair.
That makes Sätteri external at the consumer boundary and keeps its loader in its package directory.
A fresh build retained one `from"satteri"` import,
 contained no loader error string,
and imported `dist/final/node/index.mjs` successfully.

Removing only that manifest declaration reproduced the issue exactly:
Rolldown still succeeded,
the bundle retained no external Sätteri import,
one generated file contained the loader error string and fifty-three binding-package references,
and importing `index.mjs` threw from the generated `repair-translation-*.mjs` chunk.
The actual Linux binding file remained installed,
and markdown-lint's own built CLI still parsed a clean fixture successfully.

Issue 447 rejects the declaration as a durable design because every source-level consumer must know about a transitive native dependency.

Issue 447 asks first for a troubleshooting document and then for a proper migration.
Its ranking is:

1. Split a parser-free markdown-lint core from the Sätteri-backed CLI.
2. Detect and externalize napi packages automatically in the Rolldown config.
3. Special-case markdown-lint in the bundling policy.
4. Keep and document the direct declaration workaround.

## Validated candidate for the direct build signal

A disposable edit changed markdown-lint's `build` task to depend on `build:js` and then run:

```console
node dist/final/node/cli.mjs --help
```

With the binding absent,
 bundling still finished but the overall build task failed at the smoke step.
After restoring the binding link,
 the same task printed CLI help and exited successfully.
This crosses the built-artifact consumer boundary and catches both import-time native-loader failure and an unusable CLI entry point.
The edit is only a prototype and must be removed before finalizing the investigation.

## Worktree tooling correction

The first commit attempt could not start the ignored
`package/cli/forbidden-strings/target/release/forbidden-strings` gate executable.
Building that Rust package in the disposable worktree was unnecessary.
The user directed copying the existing binary from the main worktree instead.
The copied source and destination binaries have the same SHA-256 digest,
`3b3ed2a93c458ae26b97533814493232e6b6d7b235e9217564b495df47ce1da2`.
GitHub issue 448 now records the placement decision for this reusable-worktree-artifact guidance.

## Option evaluation

### Parser-free core

Translation-repair already has `parseMarkdownBody`,
 a remark-parse plus GFM parser returning `mdast.Root`.
A parser-free core can accept a synchronous parser callback and keep the fixpoint loop,
rule dispatch,
fix application,
rules,
and types behind one package interface.
The Sätteri adapter keeps astral-offset correction in the CLI package;
the remark adapter stays private to translation-repair.

A scratch parser-free fix loop imported only the existing semantic rule and translation-repair parser.
Its output matched the current Sätteri-backed `fixSource` on thirteen measured fixtures:
run-on prose,
blockquote,
list,
heading,
bold,
astral text,
already-wrapped prose,
inline code,
raw HTML,
braces,
less-than prose,
autolink,
and frontmatter-shaped text.
After removing Sätteri's native binding link,
a direct Sätteri import failed while the parser-free probe still produced the expected fixed text.
This validates the seam,
not the complete package migration or corpus parity.

### Generic napi externalization

A prototype added `satteri` to the shared Node config's always-external list.
With translation-repair's direct Sätteri declaration and stale node_modules link absent,
the build emitted one external Sätteri import and no copied loader.
Importing the bundle then failed with `ERR_MODULE_NOT_FOUND` because strict pnpm isolation had no
`translation-repair/node_modules/satteri` link.
Generic detection moves the failure unless it also manufactures an honest runtime dependency,
so issue 447's candidate C is not a complete fix as stated.

### Special-case markdown-lint externalization

A prototype always externalized `@monochromatic-dev/cli-markdown-lint`.
Without translation-repair declaring Sätteri,
the bundle retained one markdown-lint import,
contained no copied loader,
and imported successfully in the workspace.
It preserves the unnecessary native runtime dependency,
violates the self-contained workspace-bundle policy,
and would expose a runtime dependency on the currently private CLI package.
It works locally but is not a sound package design.

### Direct declaration and build smoke

The current direct `satteri` declaration is a verified short-term workaround.
A built-artifact smoke step is complementary:
it makes a package build fail when the emitted artifact cannot load,
but it does not remove the dependency trap.
For markdown-lint,
the permanent smoke should call the built parser on a clean source rather than rely only on `--help`,
so a future lazy loader remains covered.

Current ranking:
parser-free core plus built-artifact smoke > direct declaration plus smoke > special-case markdown-lint externalization >
generic napi externalization as currently proposed.
The core ranks first because it removes the native dependency from translation-repair.
The declaration ranks above the special case because its manifest honestly names the emitted runtime dependency.
The special case ranks above generic napi externalization because it resolves through a declared direct package,
while the generic prototype produced an unresolvable bare import.

## Open design questions

- A built-CLI smoke step fixes the misleading direct `build` result but does not remove issue 447's transitive-consumer trap.
- The options are complementary:
   split the core for consumers,
   and retain a built-parser smoke step for the native CLI artifact.
- The core parser callback must guarantee a root for the exact source with JavaScript UTF-16 offsets.
- Complete semantic-wrap and corpus parity remain migration gates;
   the thirteen-fixture probe is not exhaustive.

## Troubleshooting document

`doc/troubleshooting/satteri-loader-bundled-out-of-package.md` now exists in the issue 447 worktree.
Commit `e3394463b` adds the full source trace,
reproduction,
workarounds,
rejected paths,
recommended module seam,
and upstream-filing audit.
Commit `e1e4d4b89` resolves its Markdown diagnostics.
`mise run lint:markdown -- doc/troubleshooting/satteri-loader-bundled-out-of-package.md` passes.
The root dprint task does not select Markdown files and reports `No files found` for this path;
that result does not validate or invalidate the document.

## Next action

Obtain an independent review of the recommendation and troubleshooting evidence.
Then present the ranked recommendation and exact parser-core interface without landing the migration before user acceptance.
