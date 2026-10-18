# Proposal: share one file's effect analysis across TypeScript projects

## Purpose

The `prefer-readonly-parameter-type` lint plugin analyses every source file once per TypeScript project that reaches it.
After the translation-repair split (`doc/planning/translation-repair-package-split.md`),
each of 36 packages is its own project,
and a package's project reaches the source of every family package it imports,
so a fresh worktree lints the family in about 311 s against 72.6 s for the pre-split package.
Every gate runs in a fresh worktree.
Raising the cache bounds (owner's choice of 2026-10-18) fixes warm lints only.

The owner asked on 2026-10-18 for an investigation of whether projects can share the analysis,
with a proposal before any plugin change.
This document is that proposal.
Nothing here is decided.

## What was measured

All measurements are in the keyless scratch worktree `w165` at `8d09e8e092`,
with the cache bounds raised (uncommitted) so that no entry was evicted,
after linting every family package once;
scripts and outputs are under `/var/home/user/temp/agent/tr-fan/s245/split/lint/`.

- The cache held 8269 entries.
  992 source files were cached under more than one project,
  up to 34 projects each,
  in 7666 entries (`cache-surfaces.txt`).
  So the family's cold lint computes 1595 distinct analyses 8269 times.
- For all 992 files,
  the analysis result stored in the entry (`payload`)
  and the deliberately omitted callables were the same in every project.
- For all 992 files,
  the dependency closure (`dependencyDigests`, compared as sorted entries)
  was the same in every project,
  as were the augmentation surface and the lockfile digest,
  and no closure was unresolved.
- What differed for all 992 files are three whole-program inputs:
  the project's file list (`fileListDigest`),
  the digest of every declaration file in the program (`declarationSurfaceDigest`),
  and the compiler options (`compilerOptionsDigest`).
- The resolved options of `corpus-pass` and `probe` (`tsc --showConfig`) differ only in `paths`,
  whose `@/*` and `@_/*` aliases point into the linting package;
  no family source names either alias
  (searched with a pattern that matches one file elsewhere in `package/`).

Each entry is addressed by its project key (`effect-summary-persistent-cache.ts`, `cacheIdentity`)
and validated against all five surface digests (`effect-cache-envelope.ts`, `surfacesMatch`),
so no entry written under one project is ever read under another.
The TSDoc of `projectSourceText` in `effect-project-fingerprint.ts` says entries
"are keyed by path and shared across projects";
the code does not do that,
and the comment should be corrected whatever is decided here.

## Why the three inputs are in the key today

- The file list binds project membership:
  a file joining the program can change what an import resolves to.
- The declaration surface binds every `.d.ts` file in the program,
  because the closure walk "stays inside indexed sources:
  declaration and external files are excluded because whole-scope surface digests already bind them"
  (`effect-dependency-closure.ts`, `createDependencyClosureResolver`).
- The compiler options bind checking semantics
  (`strict`, `exactOptionalPropertyTypes`, `lib`, `target`)
  and module resolution (`paths`, `baseUrl`, `rootDirs`, `moduleResolution`).

All three are whole-program because the closure records only workspace sources.
Two projects whose programs differ anywhere,
even in files a given source can never reach,
cannot share that source's entry.

## Proposed design

Key and validate an entry by what can change its analysis,
so that two projects that agree on all of it share one entry:

1.  Extend the closure to record every file a module reference resolves to,
    declaration and external files included,
    with each file's content digest.
    A changed resolution then changes the closure,
    so the file list and the resolution-only options
    (`paths`, `baseUrl`, `rootDirs`)
    no longer need to be in the key.
2.  Keep a narrow ambient surface in the key:
    declaration files that apply without an import
    (global scripts, the `types` entries, `lib` files)
    and the augmentation surface the key already has.
3.  Keep in the key the compiler options that change checking,
    named by an explicit list,
    and refuse to share (keep today's per-project key) when an option outside both lists is set,
    so a new TypeScript option cannot be shared by accident.
4.  Address entries by file and key digest instead of by project,
    so the second package to reach a file reads the first one's entry within the same cold run.

## Risks and what would prove it safe

- Soundness rests on step 1 seeing every resolution the checker made,
  including type-only imports,
  `import()` types,
  triple-slash references and the declaration files an external package's types pull in.
  A file whose closure cannot be proven complete must fall back to today's per-project key,
  as unresolved closures already fall back to the whole scope.
- Before relying on it,
  a verification mode should analyse each shared hit afresh and compare,
  over the whole family and over the rest of the repository,
  and report every mismatch;
  the measured agreement of 992 of 992 payloads is evidence for the family as it stands,
  not proof for other projects.
- The plugin's existing cache tests (`effect-summary-invalidation.unit.test.ts` and siblings)
  must keep passing,
  plus new cases where two projects differ only in an unreachable file (share),
  in a reachable declaration file (do not share),
  in a checking option (do not share)
  and in `paths` that change one resolution (do not share).

## What it would buy

Measured only as counts:
the family's cold lint would compute 1595 analyses instead of 8269.
How much wall time that saves is not measured;
building each package's program and walking it remains per project.
A prototype in a scratch worktree would measure it before any merge.

## Owner's answer

On 2026-10-18 the owner chose to prototype this design in a scratch worktree,
with the verification mode,
and to see the measured cold time and mismatch count before any change lands.

Shown the results recorded in "Prototype results",
the owner chose on 2026-10-18 to harden the prototype and then land it.
The hardening owed before landing:
bump `EFFECT_CACHE_SCHEMA`;
correct the `projectSourceText` TSDoc;
show each fallback's test failing with its guard removed;
add fixtures for `export ... from`, `import =` and an added `/// <reference types>` global;
and compare lint output over every repository package against the baseline bundle.
The hardening is done on `w177`'s detached head (`6cab24de4c` to `6899ef69af`, notes `w177-notes/harden/`):
the schema is 9;
the TSDoc says each project pays the fingerprint once and shares only the source analysis;
every fallback's test fails with its guard removed (`guards.md`),
including a newly found third layer (whole-scope snapshots) that had masked the unresolved-specifier case;
the `export ... from`, `import =` and `/// <reference types>` fixtures do not share when their targets differ;
`readonly-declaration-ownership.ts` now names a workspace path `workspace` whatever the library flag says;
the README documents the sharing.
A cold family lint with verification on gave the prototype's exact totals:
6856 hits verified, 0 mismatches, 110 unresolved-specifier fallbacks.
The comparison over every repository package against the baseline bundle runs in `w177-notes/fullrepo/`.
The owner also chose to profile the remaining cold time
(about 131 s against 11.5 s without the plugin)
after landing, not before.

## Prototype results

The prototype is on the detached head of the keyless scratch worktree `w177`
(`0f2f380e59` to `1b0cdd8653`, on top of `da4c8dcab9`, unmerged);
scripts and per-package logs are under `/var/home/user/temp/agent/tr-fan/w177-notes/`.
I re-totalled the timings and lint results from its `out/<round>/results.json` files
(`s245/split/lint/proto-totals.ts`)
and the verification counters from its per-process files (`w177-notes/sum-verify.ts`).

### What it builds

- The key is a digest of the analyzer digest, file name, source digest,
  the closure of every file reached through module references
  (walked through declaration and external files, each with its content digest),
  an ambient surface,
  the augmentation surface,
  the lockfile digest,
  the compiler options by value,
  and the analysis root.
- The ambient surface holds every program file that applies without an import:
  scripts (including `lib` files),
  files with module or global augmentations or ambient module names,
  and declaration files with `export as namespace`.
- Left out of the key:
  the project's file list,
  its unreachable declaration files,
  and the resolution-only options
  (`paths`, `baseUrl`, `rootDirs`, `rootDir`, `outDir`, `declarationDir`, `tsBuildInfoFile`, `typeRoots`,
  `mapRoot`, `sourceRoot`, `project`, `configFilePath`, `pathsBasePath`).
- An option on neither list sends the whole project back to per-project entries.
  So does a source that is a global script,
  reaches a `.tsx`, `.jsx`, `.astro`, `.mdx`, `.vue` or `.svelte` file (implicit JSX import),
  names a specifier that does not resolve,
  or has an unresolved existing closure.
- Shared entries live at `shared/<hash(file)>/<keyDigest>.json` under the cache root;
  a read tries the shared entry first, then the per-project one.
- `PRPT_VERIFY_SHARED=1` analyses every shared hit afresh and compares callable summaries,
  omitted callables and omission reasons.

### Family lint times

Each round linted all 36 family packages in a fresh `systemd-run` unit,
cold (cache emptied) then warm.

- Baseline (`da4c8dcab9`): cold 325.6, 323.9 and 318.2 s; warm 71.0, 74.0 and 70.8 s.
- Prototype (`ce6354e62f`, verification off): cold 130.5 and 131.9 s; warm 73.3 and 73.2 s.
  Warm is inside the baseline's spread.
- Prototype with verification on: cold 410.5 s and more,
  so the mode is a probe, not a gate setting.
- The slowest packages cold went from 30 to 33 s to 15 s (`corpus-pass`),
  24 s to 7 s (`probe`) and 21 s to 10 s (`bench`).

The family computed 1611 analyses instead of 8467.
The remaining 131 s cold is not attributed;
without the plugin the family lints in 11.5 s,
so per-project program load and walks are the next thing to measure.

### Outside the family

48 other packages
(Astro, DOM, CLI, config, plugin and harness packages; lists in `w177-notes/extra-list.txt` and `group2-list.txt`)
showed no speedup claim: cold 56.2 against 57.7 s and 124.2 against 111.6 s in single paired runs.
Sharing there is thin:
166 shared hits, 123 across projects.
`pi-plugin/auto-mode` takes about 356 s cold and 374 s warm in both baseline and prototype,
so the cache does not help that package at all; this is not investigated.

### Equality

- Verification over the family, cold:
  8467 keys, 1611 shared writes, 6856 shared hits (6628 across projects),
  6856 verified, 0 mismatches, 0 invalid entries;
  110 fallbacks, all unresolved specifiers
  (`node:*` names in `nano-spawn`'s JavaScript, one `undici-types` path).
- Outside the family: 166 hits verified, 0 mismatches, 241 unresolved-specifier fallbacks.
- Positive control for the verification mode (`w177-notes/control/`):
  `shared-contract` linted on an empty cache,
  then one summary in its shared entry for `src/chunk-placement.ts` was changed
  (`mutated` from `[]` to `[0]`, envelope and digests untouched),
  then `artifact` linted with verification on:
  38 shared hits, 1 mismatch naming that summary.
  With the entry restored and the cache emptied, the same two lints gave 38 hits and 0 mismatches.
  Only a payload change was tried, not omitted callables or omission reasons.
- Lint output (exit code, summary line, sorted diagnostic headers) was identical to baseline in every package run:
  144 family runs per comparison, all with no diagnostics,
  and 96 outside-family runs, 74 of them with diagnostics and 6 with this rule's (10 diagnostics, cold and warm).
  This is thin evidence for the rule's output where sharing is heavy:
  the family has no diagnostics to lose.
- The plugin's unit suite passes (27 suites), including the existing invalidation suite
  and 11 new sharing cases.

### Not proven

- The non-literal `import()` type case is the only fallback shown to fail with its guard removed.
- No fixture covers `export ... from` or `import =` specifiers,
  a `/// <reference types>` global added to one project,
  or the implicit JSX import refusal (never hit).
- The option lists beyond TypeScript's option interface rest on one probe.
- Program file order and call edges that are not module references are not in the key;
  the existing workspace-only dependency check is the only guard for the latter.
- Verification compares only hits; it cannot see a source that should have shared and did not.
- `EFFECT_CACHE_SCHEMA` is not bumped;
  `readonly-declaration-ownership.ts` still classifies a symlink-reached workspace file as external;
  the `projectSourceText` TSDoc is still wrong.

The prototype agent's summary said "6751 cross-project shared hits";
its own counter files total 6628, and its detailed section said so.
