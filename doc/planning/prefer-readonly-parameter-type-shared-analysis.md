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

## Open question for the owner

Whether to prototype this design in a scratch worktree,
with the verification mode,
and bring back the measured cold time and mismatch count before any change lands.
