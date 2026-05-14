# Oxlint type-aware mode silently skips type checks when run from monorepo root, plus disable-comment substring matching

This file groups two independent oxlint issues that surface across the
workspace. Each gets its own canonical section.

---

## Bug 1: `--type-aware` resolves the wrong `tsconfig.json` from monorepo root

### Symptom

Running `oxlint --type-aware .` from the monorepo root finishes with
no type-aware diagnostics for files that should clearly trigger them
(e.g. an obvious `no-floating-promises` violation). The same files
report the diagnostic when oxlint runs from inside the package
directory.

No error is printed; the type-aware check simply produces no findings.

### Root cause

Oxlint discovers the nearest `tsconfig.json` by walking upward from
the working directory. From the monorepo root the search resolves
`./tsconfig.json` (the root config), whose `include`/`references`
configuration does not enumerate every package's `src/` tree. Files
outside the root config's surface are not analysed by the type-aware
backend; oxlint treats them as untyped and skips the rules that
require type information.

This is a configuration-discovery choice in oxlint, not a defect: it
loads the config it finds and reports diagnostics for the files that
config covers. The trap is silence rather than error.

### Verification

Version under test: oxlint as pinned in `mise.toml` (commit `main` as
of 2026-03-13).

Reproduce:

```bash
# From the monorepo root: type-aware rules silently skip
mise run lint:oxlint

# Compare: run per-package; same files now flagged
mise run //packages/<some-pkg>:lint:oxlint
```

The diagnostic count differs between the two invocations even though
the source tree is identical.

### Verified workaround

Run oxlint from each package independently. The `lint:oxlint` task
template in `mise.toml` already does this: the root `lint:oxlint` task
fans out across packages via `mise '/packages/...:lint:oxlint'`, so
every package executes with its own `tsconfig.json` in scope.

Tradeoff: parallel fan-out across many packages spends more
wall-clock startup time than a single invocation would; in practice
the per-package runs parallelise well and the additional cost is
small. Type correctness wins over throughput.

### What does not work

- Adding every package to the root `tsconfig.json`'s
  `include`/`references`: the workspace prefers per-package configs to
  avoid coupling unrelated packages' type checks. The change would
  invalidate isolated package builds.
- Passing `--tsconfig` on the root invocation: oxlint accepts the
  flag but the resolved config still misses package-local
  `paths`/`baseUrl` overrides, so per-package type info is incomplete.

### Why we do not file this upstream

1. **Is it really upstream's fault?** Borderline. Oxlint resolves
   what it is told to resolve; the silent-skip behaviour is a UX
   wart, not an algorithmic defect.
2. **Can upstream fix it?** They could emit a warning when running
   `--type-aware` and the discovered `tsconfig.json` does not cover
   some of the files under analysis. That is a UX patch.
3. **Are they supporting this use case?** Monorepos are a documented
   target; the per-package run is the documented pattern.
4. **Will they likely fix it?** Unknown. A "no type info for X files"
   warning would be a small change.
5. **Have we prototyped a minimal fix?** No.

Decision: no upstream report at this time. The per-package run pattern
is the documented escape hatch.

---

## Bug 2: Disable-comment prefix matching is substring-based, so non-canonical prefixes silently work

### Symptom

A disable comment using a non-canonical prefix appears to function:

```ts
// oxlint-disable-next-line eslint/no-await-in-loop
await something();
```

The reviewer expects oxlint to ignore the comment (because oxlint
rules do not use the `eslint/` prefix). It does not: the rule is
suppressed. The same is true for arbitrary prefixes:

```ts
// oxlint-disable-next-line xyzzy/no-await-in-loop
```

This is misleading rather than broken; it masks copy-paste mistakes
from ESLint configs and produces inconsistent codebases.

### Root cause

Oxlint matches the comment text against the bare rule name using
substring containment, not exact prefix matching. Source citations
(oxc commit `main` as of 2026-03-13):

- `crates/oxc_linter/src/disable_directives.rs:184-216`: `contains()`
  method with substring match.
- `crates/oxc_linter/src/disable_directives.rs:578-595`:
  `get_rule_names()` parser (splits on `,`, trims whitespace, strips
  `--` suffixes).
- `crates/oxc_linter/src/tsgolint.rs:1057-1079`:
  `should_skip_diagnostic()` for tsgo rules makes three separate
  `contains()` calls with bare, `typescript-eslint/`, and
  `@typescript-eslint/` prefixes; the bare check already matches any
  comment containing the rule name, so the additional calls are
  belt-and-braces.

Any token in the comment that contains the bare rule name as a
substring satisfies the check.

### Verification

Version under test: oxc commit `main` as of 2026-03-13.

Reproduce:

```ts
// File A: canonical prefix
// oxlint-disable-next-line no-await-in-loop
await x();

// File B: ESLint-style prefix
// oxlint-disable-next-line eslint/no-await-in-loop
await x();

// File C: nonsense prefix
// oxlint-disable-next-line xyzzy/no-await-in-loop
await x();
```

Running oxlint over all three produces no diagnostics. The diagnostic
returns only when the comment is removed entirely or when the rule
name is mistyped (substring no longer matches).

Canonical prefixes (matching `parse_rule_key` in `config/rules.rs`):

- eslint core: bare name, no prefix (e.g. `no-await-in-loop`,
  `require-await`)
- TypeScript: `typescript/` (e.g.
  `typescript/no-unsafe-type-assertion`)
- Import: `import/` (e.g. `import/no-unassigned-import`)
- Promise: `promise/` (e.g. `promise/avoid-new`)
- Unicorn: `unicorn/` (e.g. `unicorn/prefer-top-level-await`)
- Node: `node/` (e.g. `node/no-sync`)

### Verified workaround

When authoring a new disable comment, use the canonical prefix list
above. When reviewing existing code, normalise non-canonical prefixes
to the canonical form during the next touch of the file.

Tradeoff: the existing tree contains many non-canonical prefixes
inherited from the pre-oxlint era (ESLint-style, parentheses-style
such as `eslint(rule-name)`). A sweep-replace is feasible but would
churn the history of every package; normalising opportunistically is
the lower-risk path.

### What does not work

- Configuring oxlint to enforce canonical prefixes: there is no such
  option (the substring match is the implementation, not a setting).
- Writing a project linter rule to flag non-canonical prefixes:
  possible, but adds yet another tool. Not justified for the current
  rate of new disable comments.

### Why we do not file this upstream

1. **Is it really upstream's fault?** Yes; the substring match is the
   source of the wart. Strict prefix matching would be the correct
   behaviour.
2. **Can upstream fix it?** Yes; replace `contains()` with an exact
   match against the parsed prefix table. The change is local to the
   files cited above.
3. **Are they supporting this use case?** Yes; canonical prefixes are
   documented in `parse_rule_key`.
4. **Will they likely fix it?** Probably worth filing as a UX/lint
   issue. Risk of breaking existing comments that rely on the
   permissive match.
5. **Have we prototyped a minimal fix?** No.

Decision: no upstream report yet. Worth filing if the codebase decides
to formalise the canonical-prefix sweep.

---

## Cross-reference

ESLint was fully replaced by oxlint on 2026-03-13. The project will not
re-adopt ESLint; the disable-comment prefix sweep applies only to the
non-canonical residue from the pre-oxlint era.
