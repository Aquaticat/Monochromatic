# Planning: file-enforcer for per-package mise.toml management

Status:
 open,
 not yet complete/polished/approved.
 Investigation paused mid-decision.

## The problem

Many `packages/*/*/mise.toml` files are very similar (or could be),
 but each is
hand-maintained.
 Two consequences:

1. Some packages silently lack required tasks (e.g. `lint:types` missing on a
   package that builds TypeScript).
2. Even where files are byte-similar,
    they drift:
    mixed key quoting (`[tasks."lint:types"]`
   vs `[tasks.'lint:types']`),
    four packages with empty `mise.toml`,
    and the largest
   cluster of seven byte-identical files exists despite never being deduped.

Prior audit (`AUDIT.dry.md`) called this duplication "structural and unavoidable"
because each package opts into a different subset of root `task_templates`.
 That
verdict held for the duplication question alone,
 but it did not weigh the
missing-task failure mode now surfaced.

`AUDIT.dry.md` is internal;
 churn on that doc is acceptable.

## Mise constraints surfaced

Verified against
[`mise.jdx.dev/tasks/task-configuration.html`](https://mise.jdx.dev/tasks/task-configuration.html)
and [`mise.jdx.dev/tasks/monorepo.html`](https://mise.jdx.dev/tasks/monorepo.html):

- Mise has no automatic template inheritance.
   Each child config root must
  explicitly declare `[tasks.X] extends = "X"` to opt in.
- Remote git includes exist but still require explicit per-package declaration.
- `task_templates` at the root define the templates;
   "Projects can then extend
  these templates" is the documented pattern.

The boilerplate is structural to mise,
 not a configuration we can flip.

## file-enforcer capabilities surveyed

Current API (`packages/dev-script/file-enforcer/src/index.ts`):

- `cat`,
   `overwrite`,
   `overwriteEach`,
   `overwriteIfNotExists` -- byte-level I/O
- `dedup`,
   `getProperty`,
   `exec`,
   `inspect`,
   `evaluatePredicate` -- pipeline
- `ensurePackage`,
   `registerPackages` -- OS-level package install
- `addWatchedPaths`,
   `invalidatePaths`,
   `reset` -- watch utilities

Recently added (`src/pipeline/toml.ts`,
 `src/io/write-toml.ts`):

- `getTomlProperty({ path, content })` -- read a value at a structured path
- `editTomlKey({ content, path, value })` -- set one key,
   splice the rest byte-identically
- `overwriteTomlKey({ dest, path, value })` -- same but persisted via `overwrite`

Backed by `@monochromatic-dev/module-toml-edit`,
 which preserves comments and
unmutated whitespace byte-identically in splice mode and supports path-create,
inline-table extension,
 array-of-tables emit,
 and `tomlDelete`.

This changes the design space;
 the original investigation that predated TOML
support is superseded.

## Options considered

### A -- Validator only

`file-enforcer` probes filesystem signals per package,
 asserts the required-task
set is present,
 fails the build on drift.
 No generation.

Rejected by the user:
 "file-enforcer is not a validator.
" File-enforcer's
purpose is keeping derived files in sync (generation),
 not assertion.
 A separate
linter would be the right tool for pure validation.

### B -- Hybrid generator: kind block + `mise.custom.toml`

Generator emits the boilerplate `extends` block per kind;
 per-package custom
tasks live in `mise.custom.toml`;
 file-enforcer concatenates them.

Problem (pre-TOML-edit):
 TOML disallows duplicate keys.
 If kind emits `[tasks.X]`
and custom also declares `[tasks.X]`,
 concatenated output is invalid.
 Required
either a non-overlap rule (fragile) or a TOML merger (didn't exist at that
investigation point).

Largely superseded by D once TOML-edit primitives are available.

### C -- Full central generator with TS module for customs

Per-package `mise.tasks.ts` exports a typed task object;
 file-enforcer renders
mise.
toml from kind + this module.
 Sidesteps duplicate-key dragon by owning the
entire task set as data and rendering once.

Cons:
 developers can't `cat packages/X/Y/mise.toml` to see custom tasks;
 an
indirection layer (TS module) sits between developer and the file mise reads;
comments live in TS,
 not next to the task they describe.

Superseded by D once dragon 1 is gone.

### D -- Augment in place via `overwriteTomlKey` (current leading candidate)

`file-enforcer.config.ts` walks `packages/*/*`,
 probes filesystem signals
(`tsdown.browser.config.ts`,
 `Cargo.toml`,
 `bin` field,
 etc.) to classify each
package by kind,
 then for each task the kind requires calls

```ts
await overwriteTomlKey({
  dest: 'packages/X/Y/mise.toml',
  path: ['tasks', taskName,],
  value: { extends: taskName, },
},);
```

Splice mode keeps unmutated regions byte-identical,
 so:

- Comments survive (`editord/mise.toml`'s 6-line rationale,
   etc.).
- Custom tasks already in the file are untouched.
- Idempotent:
   re-running over an already-correct file is content-skipped by
  `overwrite`.

Single source of truth on disk is the mise.
toml the package developer reads.
No second file.
 No TS module indirection.

## Dragons remaining under D

### 5. Probe classification edge cases

Kind detection from filesystem signals is ambiguous in real cases:

- `packages/git-policy/cli` is both a CLI (custom `run` task on `src/index.ts`) and
  extends `build:js:node`,
   `lint`,
   `lint:types`,
   `lint:oxlint` from root.
  Kind `ts-cli` is not "no extends";
   it's "extends some + adds run.
  "
- `packages/cli/forbidden-strings` is Rust (cargo-based),
   extends nothing from
  root,
   has its own `build`/`lint`/`test` shapes.
- `packages/module/test` is `ts-library-browser` and defines a standalone `test`
  task with `depends = ["build"]`.
   The kind cannot emit `[tasks.test]` here
  because the package owns it.
- `packages/test-fixture/css-imported` and three siblings have empty mise.
  toml.
  Are they intentionally empty (fixture target for a test) or just unfinished?
  Probe must distinguish.

A workable kind set is roughly seven to nine:
 `ts-library`,
 `ts-library-node`,
`ts-library-browser`,
 `ts-library-client`,
 `ts-cli`,
 `ts-webapp`,
 `rust`,
`empty-fixture`,
 `special` (escape hatch for `file-enforcer` itself,
`forbidden-strings`,
 `module/test`).
 The escape hatch is unavoidable.

### 7. Quoting normalization is constrained by splice mode

`tomlSet` in splice mode preserves existing key quoting.
 Current mix
(`[tasks.'build:js']` in `module/es` vs `[tasks."build:js"]` in `module/dom`)
will not normalize via D's incremental edits.

Resolution:
 a separate one-time pass via `emptyTomlEdit + tomlSet` reparses each
mise.
toml and emits canonical output.
 After that one pass,
 splice mode keeps the
canonical form stable for subsequent edits.
 Document this as a setup step.

### 9. Managed-task tracking on kind shrinkage

If a kind later drops a task,
 the package's mise.
toml still has it.
 The
generator doesn't know whether a leftover task is "kind-owned but stale" or
"package-custom and intentional.
"

Two reasonable resolutions:

- Defer:
   never auto-remove.
   Document that kind shrinkage requires manual
  cleanup.
   The user's stated pain is missing tasks (additive);
   shrinkage is
  rare.
- Track:
   emit `# file-enforcer-managed = ["task1", "task2"]` as a header
  comment.
   On regeneration,
   any managed task absent from the current kind is
  deleted via `tomlDelete`.
   Mechanical but adds a sidecar declaration to each
  managed mise.
  toml.

### 10. Order stability for new task inserts

`tomlSet` on a missing path appends.
 New kind-required tasks land at end of file
on first generation.
 Cosmetic;
 no functional impact on mise.

### Mise reads `mise.local.toml` too

Generator must explicitly never touch `*/mise.local.toml`.
 Trivial to honor.

## Verified-but-not-superseded dragons from earlier rounds

- The four empty `mise.toml` files in `packages/test-fixture/css-*` are real and
  may or may not be intentional.
   Decide before classifying them.
- Node vs deno runtime is not assumed by any kind today;
   the existing
  per-task `run = "node src/foo.ts"` strings stay in place under D (custom or
  extended from root).
   Kind-driven generation does not impose a runtime.

## Open questions before approving D

1. **Kind metadata source:
    probe-only,
    or also explicit?
   ** Pure filesystem
   probes work for ~80% of cases.
    The escape hatch and hybrid kinds need a
   declaration somewhere.
    Three options:
   - probe-only with a special-cases list inside
     `file-enforcer.config.ts`
   - per-package `package.json` field
     (`"monochromatic": { "kind": "ts-cli", "extras": ["build:js:node"] }`)
   - sidecar `mise.kind.toml` per package (overkill?
     )
2. **Dragon 9:
    defer or track?
   ** Pick before v1 implementation.
3. **Quoting normalization:
    do the one-time pass on landing,
    or skip?
   ** If
   skipped,
    the mixed quoting persists forever (splice mode preserves it).
    If
   done,
    all 92 files get one structural rewrite commit.
4. **First kind to implement?
   ** Smallest blast radius is probably `ts-library`
   (modules with no build,
    just lint + test).
    Rolling out one kind at a time
   is safer than 7-at-once.
5. **Watch-mode semantics:
    re-probe on every file-enforcer run,
    or cache?
   **
   Probing is `glob('packages/*/*/<signal-file>')` calls -- cheap.
    Probably
   re-probe every run;
    the cost is sub-second.

## Cross-references

- `AUDIT.dry.md` -- per-package `mise.toml` files (81 total) section;
   this plan
  partially supersedes that finding by addressing the missing-task failure mode
  AUDIT.
  dry did not weigh.
- `AUDIT.consistency.md` -- "mise.
  toml task naming" section listing the quoting
  drift and four empty mise.
  toml files.
- `packages/dev-script/file-enforcer/README.md` -- API reference;
   the TOML
  section is the load-bearing change.
- `packages/module/toml-edit/README.md` -- splice vs canonical mode semantics,
  v1 limitation on canonical-from-parsed-source.
- `file-enforcer.config.ts` -- existing root config;
   D adds a fourth top-level
  function alongside `generateMiseToml`,
   `generateForbiddenStringsRules`,
  `mirrorSkills`.
- `mise.no-env.toml` -- the source the root mise.
  toml is generated from;
   lists
  every root `task_templates.*` that per-package kinds would extend.

## Status notes

- The validator framing (Option A) was rejected by the user with the explicit
  reason "file-enforcer is not a validator.
  " Do not re-propose it.
- TOML support in file-enforcer is a recent addition;
   any future investigator
  should re-read `src/pipeline/toml.ts` and `src/io/write-toml.ts` before
  designing,
   since the API surface may have grown.
- This document captures investigation state;
   decisions on the five open
  questions above are required before implementation begins.
