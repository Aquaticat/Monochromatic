# Audit: unused oxlint-disable directives across the workspace

## Summary

oxlint reports 301 unused oxlint-disable directives spread across 38 packages,
out of 1442 directive occurrences total (about 21 percent unused).
They are genuinely unused, not false positives: each one suppresses a rule that
reports nothing at that location.

Roughly three-quarters target type-aware (tsgolint) rules that the adjacent code
does not actually trigger, mostly `typescript/no-unsafe-type-assertion`,
`typescript/prefer-readonly-parameter-types`, and the `typescript/no-unsafe-*` family.
The non-type-aware remainder is about 75 to 80 occurrences across rules like
`no-bitwise`, `import/no-namespace`, `no-await-in-loop`, and `no-magic-numbers`.
The directives are not careless: most carry thoughtful justification comments.
They are unnecessary because the rules are more lenient than the author assumed,
the rule is turned off in config, or the directive sits on a callback parameter the
rule exempts.

This is a workspace-debt finding, not an oxlint bug.
oxlint's unused-directive reporting behaves correctly, including across the type-aware pass.

## How they surface

`packages/config/oxlint/src/index.ts:40` sets `reportUnusedDisableDirectives: 'warn'`,
and `index.ts:39` sets `denyWarnings: true`.
Together, every unused directive is a warning that `denyWarnings` promotes to a failure.

The real per-package task confirms this.
Running `mise run //packages/module/es:lint:oxlint` reports 19 unused directives and ends with
`ERROR task failed` (253 warnings, 0 errors, denied).
So `mise run lint` is currently red on each package that owns unused directives.

The schema at `node_modules/oxlint/configuration_schema.json:2925` notes that
`reportUnusedDisableDirectives` is "Only supported in the root configuration file."
In practice it is active in normal per-package runs as well: the workspace has a single
`oxlint.config.ts` at the root, so oxlint treats it as the root config regardless of the
directory the lint runs from.
This differs from `typeAware` (same options group, `index.ts:62` comment), which the mise
task template still passes explicitly as `--type-aware` (`mise.toml:222`).
No CLI flag is needed for unused-directive reporting; the config value already takes effect.

## Evidence the 301 are genuinely unused

Three independent lines of evidence rule out the false-positive hypothesis, that
type-aware suppressions are flagged because the unused-check cannot see tsgolint diagnostics.

1.  oxlint's own diagnostic text is `Unused oxlint-disable directive (no problems were reported).`
    The check ran the rule at that scope and the rule reported nothing.
2.  A controlled fixture proves the check accounts for tsgolint.
    Two identical `value as string` assertions on an `unknown`, one with a
    `typescript/no-unsafe-type-assertion` directive and one without: the bare one produced
    `typescript(no-unsafe-type-assertion): Unsafe type assertion`, the suppressed one produced
    nothing, and its directive was not flagged unused.
    A used type-aware directive is correctly recognized as used.
3.  The flagged set is type-independent.
    Running the whole tree with `--type-aware` and without it both flag exactly the same 301
    locations (byte-for-byte identical file:line sets), even though the type-aware run emits
    1133 real `! typescript(...)` diagnostics elsewhere.
    The 301 do not depend on type information; the rules simply do not fire there.

## Root-cause categories

Canonical rule breakdown (type-aware rules marked TA, prefix variants merged).
Counts are approximate; a single directive line can list several rules, and
block disables span an `oxlint-disable` and an `oxlint-enable` line.

```text
TA  no-unsafe-type-assertion          ~74   (typescript/, typescript-eslint/, bare, and enable markers)
TA  prefer-readonly-parameter-types   ~79
TA  no-unnecessary-condition           24   (also turned off in config; see below)
TA  no-unsafe-assignment               14
TA  no-unsafe-return                   13
TA  no-unsafe-member-access            18
TA  no-unsafe-call                     16
TA  strict-boolean-expressions          8
TA  require-await                      13
TA  no-unsafe-argument                  4
    no-await-in-loop                   15
    no-magic-numbers                   12
    no-bitwise                         11
    prefer-destructuring               10
    import/no-namespace                 8
    no-restricted-syntax (+/no-function-root-let)  13
    import/no-named-as-default          5
    no-var                              4
```

The categories that explain them:

1.  Defensive type-aware suppressions on safe code.
    The bulk. Authors disabled `prefer-readonly-parameter-types` or `no-unsafe-type-assertion`
    expecting a complaint that never comes. Example:
    `packages/module/es/src/types/t function/f/t function/memoize/r a/p n/index.ts:223`
    disables `no-unsafe-type-assertion` above `return memoized as MemoizedAsyncFunction<...>`,
    but tsgolint considers that assertion safe after the property assignments above it.
    Many sit on `Array.prototype.filter` and `.map` callbacks whose parameter the rule exempts
    (for example `packages/webapp-forge/server/src/worker/render.ts:234`).
2.  Disabling a rule that is turned off in config.
    `typescript/no-unnecessary-condition` is `'off'` at
    `packages/config/oxlint/src/rules/correctness.ts:44`, so all 24 directives targeting it are dead.
    Example: `packages/config/tofu/fetch_ips.ts:76` disables it above `while (true)`.
3.  Block `oxlint-enable` end markers whose block suppressed nothing.
    74 of the flagged occurrences are `/* oxlint-enable ... */` lines.
    Example: `packages/webapp-forge/server/src/storage/adapter.ts:78`.
    When the paired `oxlint-disable` block contains no firing of the rule, the enable marker
    is reported as unused.
4.  Non-canonical prefixes copied from ESLint configs.
    `typescript-eslint/...`, `typescript-eslint(...)`, and bare `no-unsafe-type-assertion`
    forms still match the rule (see `docs/troubleshooting/oxlint.md` on prefix stripping),
    so the prefix is not why they are unused; the underlying rule simply does not fire.

## The tofu exception

`packages/config/tofu` is an OpenTofu/Terraform package with `.tf` files plus a couple of
root-level TypeScript scripts and no `mise.toml` and no `src/`.
It has no per-package lint task, so `mise run //packages/config/tofu:lint:oxlint` does nothing
and its `fetch_ips.ts` directives surface only in a root-level whole-tree scan.
This is the one place where a per-package task and a root scan disagree on the count.

## Reproduce

```bash
# whole-tree count (301), from repo root
task-oxlint --report-unused-disable-directives 2>&1 | rg -c "Unused oxlint-disable directive"

# identical with type-aware on
task-oxlint --type-aware --report-unused-disable-directives 2>&1 | rg -c "Unused oxlint-disable directive"

# a real per-package task, already failing
mise run //packages/module/es:lint:oxlint
```

## Remediation options

Not yet applied; investigation only.

1.  Delete the dead directives.
    oxlint can do it: `oxlint --fix` removes unused directives.
    Risk: the `--fix`/`format:oxlint` task (`mise.toml:458`) runs without `--type-aware`, so a
    fix pass there would also strip directives that suppress real type-aware diagnostics.
    A safe sweep must run with `--type-aware` so used directives stay put.
    Verify the type-aware count is identical before and after to confirm no used directive was removed.
2.  Triage by category first.
    Category 2 (rule turned off) and category 3 (orphan enable markers) are unambiguously safe
    to remove by hand. Category 1 needs a glance per site to confirm the author's intent is moot.
3.  Leave them and lower the rule.
    Setting `reportUnusedDisableDirectives` to `'off'` hides the debt rather than clearing it,
    and removes a genuinely useful signal. Not recommended.
