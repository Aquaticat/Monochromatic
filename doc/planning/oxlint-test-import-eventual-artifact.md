# Oxlint rule: tests must import the eventual artifact

Proposal for `@monochromatic-dev/oxlint-plugin-test-import`,
whose single rule `require-eventual-artifact` bans test files from importing their own package's source
instead of the built artifact that package ships.

Status: design agreed through a grilling interview, awaiting final confirmation before implementation.
Nothing has been built yet.

## Problem

`.claude/skills/testing-practices/SKILL.md` states that unit tests import package behavior from built `dist`,
never from sibling source files,
so that tests exercise the artifact users consume and catch export-map, build, and bundling errors.
No automated check enforces this.

Measured against active `package/**` (paused and deprecated trees are already out of lint scope
per `package/config/oxlint/src/config-base.ts`):

- 557 test files matching `**/*.{test,bench}.ts`
- 174 already compliant
- 383 violating, spread across 63 packages

Violating files reach their own package's code through 721 resolvable import sites.

## Definition of an eventual artifact

An import target is eventual when either condition holds.

-   The path, resolved and normalized, lies under `<package-root>/dist/final`.
    Substring matching on `dist/final` is not sufficient:
    it would accept `src/dist/final/fake.ts` as an artifact.
-   The path lies inside a directory that the owning package declares as a shipping entry,
    via `exports` (excluding the `./ts` and `./ts/*` keys), `main`, or `bin`,
    with any target under `src/` discarded,
    and with the bare `dist` root never counted as such a directory.

The bare-root exclusion matters because `package/typeface/aquaticat` declares `./dist/Aquaticat-Regular.otf`.
Taking its containing directory literally would make all of `dist/**` eventual for that package,
including `dist/temp/**`, which is the intermediate output this rule exists to reject.

Discarding `src/` targets is required because 30 packages currently declare entries pointing into source.
Without that clause the rule would bless exactly the imports it exists to ban.
The repo position is that `/ts` is the sanctioned source channel per ST3,
so a package's `main`, `bin`, or default `exports` entry should never point at `src/`.

Directory granularity, rather than exact-file matching, is what admits the Electron packages:
`package/desktop-app/file-manager-electron` declares `main: dist/app/main.mjs`,
so `dist/app/**` is eventual and its tests may import `../dist/app/strip.js`.

## Rule behavior

Applies to files matching `**/*.{test,bench}.ts`,
the same glob the existing test override already uses at `package/config/oxlint/src/overrides.ts`.

For each static `import` declaration, including `import type`:

-   Relative specifier resolving inside an eventual directory: allowed.
-   Relative specifier resolving anywhere else: violation, unless the target matches the fixture allowlist.
-   Bare specifier equal to the owning package's own name: allowed,
    because it resolves through the exports map to an eventual entry.
-   Bare specifier of the owning package's own `/ts` subpath: violation.
-   Bare specifier of any other workspace package: ignored, including its `/ts` subpath, because ST3 mandates that form.

The own-package versus cross-package distinction is the reason this is a custom rule rather than configuration.
Native `no-restricted-imports` matches specifier strings only,
so banning `@monochromatic-dev/*/ts` would also hit the 83 legitimate cross-package sites
and the 537 `@monochromatic-dev/module-test/ts` harness imports.

### Fixture allowlist

A configurable rule option holds globs for test-only helpers that are not package behavior.
Default list, derived from conventions actually in use:

```text
**/fixture.*
**/*-fixture*.ts
**/test-support.ts
**/test-setup.ts
**/test-fixtures.ts
**/*-helpers.ts
**/*-harness.ts
```

This covers the 38 helper import sites found across 11 inconsistent naming conventions.

The three literal `test-` names are listed individually rather than as a `**/test-*.ts` prefix glob.
A prefix glob would also match `package/cli/mutation-test/src/container/test-run.ts`,
which is real package behavior imported by `mutant-loop.ts` and `main.ts`,
and would silently exempt it.

Allowlisted helper modules are themselves subject to the same source-import restriction.
Without that, a test can import a permitted helper that re-exports directly from source,
bypassing the rule without any change to the test's own import.
Matching runs against canonical resolved target paths, never raw specifier text.

### Packages that build nothing

A package defining no build task in its `mise.toml` is exempt entirely.
Such a package produces no artifact, so the rule is vacuous there rather than merely inconvenient,
and the exemption self-heals:
adding a build task re-arms the rule automatically.

This covers 35 test files across 14 packages,
mostly satellites whose purpose is exercising another package
(`css-edit.bench`, `css-edit.fuzz`, `jsonc-edit.conformance`, `test-fixture/*`),
plus `config/rolldown`, which ships source through `/ts` by design,
and `claude-code-plugin/source`, whose `exports` and `bin` point entirely at `./src/**`.

The criterion is deliberately "defines no build task" rather than "has no `src/index.ts`".
The latter keys on an accident of file layout;
the former keys on whether the package ships anything at all.

### Forms not checked

Dynamic `import()`, `require()`, and `export ... from` are out of scope by decision.
Consequence to accept knowingly:
`await import('./toml-set.ts')` remains a legal bypass,
and 3 such sites exist today in `package/module/toml-edit/src/toml-get-raw.unit.test.ts`,
`package/module/toml-edit/src/toml-get-node.unit.test.ts`,
and `package/pi-plugin/thinking-default/src/index.unit.test.ts`.
Adding the dynamic form later is a small change.

## Migration

Final scope after the fixture allowlist and the buildless-package exemption:

-   557 test files total
-   178 already clean
-   35 exempt because their package builds nothing
-   344 violating, across 54 packages, at 662 import sites

Stage one, before any exemption, found 721 sites in three exhaustive categories:

-   259 target a module already reachable from the package's public entry, so the fix is a path rewrite.
-   411 target an internal module, so the fix is exporting that symbol, which XPT permits, or restructuring the test.
-   51 sit in packages having no `src/index.ts`, so no public entry exists to measure reachability against.

Stage two applies the fixture allowlist and the buildless-package exemption,
removing 59 sites to reach the 662 figure.
The clean-file count moves from 174 to 178 across the same two stages,
the difference being files whose only violations were fixture or helper imports.

The 411 group is the dominant cost and the reason this is not a mechanical migration.
`package/git-policy/cli` alone accounts for 88 of those sites.

The build bundles rather than preserving module structure,
verified as one emitted `.mjs` from 75 source files in `package/module/toml-edit`
and one from 209 in `package/git-policy/cli`.
Consequently no internal module exists as a separate file under `dist/final`,
and exporting the symbol from the bundle entry is the only route to it.

Agreed sequence: land the rule at `error` first, then migrate,
using the rule's own output as the worklist.
No allowlist and no `warn` stage;
a `warn` parking lot would conflict with LN8.

Consequence to accept knowingly:
from the moment the rule registers until migration completes,
`mise run lint` at repo root fails,
which affects anyone running the standard verification loop.

Type imports resolve declarations alongside the artifact for relative specifiers,
with no `exports` `types` condition required.
Measured across every package having a build task: 80 emit both code and declarations, 5 emit code only.
Those 5 are `kwin/key-helper`, `ssg/aquati.cat`, `webapp-productivity/done`,
`webapp-productivity/done-postcss`, and `webapp-productivity/wc`.
Only 4 type-import sites are actually at risk, all in `ssg/aquati.cat`;
they have no compliant form until that package emits declarations.

Relative artifact imports prove that an emitted file is importable by path.
They do not prove that the export map is correct or that consumers can reach the module.
Only the bare self-reference form exercises the export map,
so claims about catching export-map errors apply to that form alone.

## Naming

Package `package/oxlint-plugin/test-import`, published as `@monochromatic-dev/oxlint-plugin-test-import`.
Rule `require-eventual-artifact`, so diagnostics render as `test-import/require-eventual-artifact`.

Both segments are clear of `forbidden-strings.append.txt` and `forbidden-strings.append.local.txt`,
and unused elsewhere in the repo.
No ecosystem rule enforces this concept,
so there is no established name to inherit;
the closest precedents are `eslint-plugin-ava`'s `no-import-test-files`
and `eslint-plugin-ember`'s `no-test-import-export`.

Noted at decision time:
"eventual" carries an eventual-consistency first reading,
accepted because it is the established local term for the artifact a package eventually ships.

## Rejected alternatives

-   Native `no-restricted-imports` configuration, hand-written.
    Verified working for the bulk case on throwaway fixtures,
    but cannot express the own-package `/ts` distinction at all,
    and its eventual-directory list would be hand-maintained and drift from `package.json`.
-   Generated per-package `no-restricted-imports` overrides.
    Achieves full fidelity without custom rule code,
    but oxlint overrides are last-match-wins with option replacement,
    so the generated block is position sensitive and any broad override added later silently disables it.
-   Export-graph reachability as the exemption mechanism.
    Most faithful to the wording "not part of package behavior",
    but needs per-file whole-package graph walking,
    and the uniform-law decision removed the need for it.
-   Exempting packages whose declared entries point at `src/`.
    Would permanently exempt 43 or more test files
    and make coverage depend on manifest style.
-   Exempting packages with no `src/index.ts`.
    Rejected because the criterion keys on file layout rather than on whether the package ships an artifact.
    The buildless-package exemption replaces it on a sounder criterion.
-   Per-file or per-package allowlist of currently-failing paths.
    Rejected in favour of landing at `error` and using the rule's own output as the migration worklist.
-   Repointing the 30 `src/`-declaring manifests at `dist`.
    Correct in spirit but couples this rule's delivery to a manifest migration,
    and several of those packages ship source deliberately.

## Side findings, out of scope here

-   `package/config/oxlint/src/overrides.ts` documents its array as ordered "from most specific to least specific",
    but oxlint resolves overrides last-match-wins with rule options replaced, not merged.
    Verified on throwaway fixtures with oxlint 1.75.0.
    Under last-wins, listing most-specific first means the least specific entry wins.
    Worth a separate audit of whether any existing override pair is affected.
-   30 packages declare `exports`, `main`, or `bin` entries pointing into `src/`.
    By the stated principle that no package should ship `src/*`, these are misconfigurations.
    Separate cleanup.

## Next action

Await confirmation, then scaffold the package per AP1 to AP4,
implement the rule, unit test every branch per TCV, and register it in `@monochromatic-dev/config-oxlint`.
