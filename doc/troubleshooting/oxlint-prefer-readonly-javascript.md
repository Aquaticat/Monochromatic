# Oxlint inserts TypeScript readonly syntax into JavaScript private fields

## Symptom and scope

Oxlint `1.88.0` with `oxlint-tsgolint` `7.0.2004`
applies `typescript(prefer-readonly)` to an auto-mode `.mjs` file during `--fix`.
The resulting source contains `readonly #state;`.
The same formatter's plain-lint oracle then reports:

```text
# package/pi-plugin/auto-mode/native/contract/integration/policy-source/system-slot.mjs
TS(8009): The 'readonly' modifier can only be used in TypeScript files.
typescript(TS8009): The 'readonly' modifier can only be used in TypeScript files.
```

The reproduction uses a private frozen package snapshot at `57b2baacd2`.
It does not modify the working tree or installed linter.
The retained receipt is
`${HOME}/temp/agent/pi-mimo-preparation-failure-20261018/native-format-fixture.json`.
The formatter's final oracle reports 10,086 warnings and 90 errors across 494 native files.
Those are post-format findings,
not the package's complete lint backlog.

## Source identity and cause

The installed helper's source tag is `v7.0.2004`,
commit `a61289117febcb1a60cf3bc75ef2b6bbccc4b665`
in `oxc-project/tsgolint`.
The read-only source checkout is
`${HOME}/temp/agent/tsgolint-readonly-js-20261018`.

At `internal/rules/prefer_readonly/prefer_readonly.go:389`,
`PreferReadonlyRule.Run` installs its class analysis without a JavaScript-file exclusion.
At line 422,
the report builder unconditionally inserts a TypeScript modifier:

```go
// tsgolint/internal/rules/prefer_readonly/prefer_readonly.go:422 at v7.0.2004
fixes := []rule.RuleFix{rule.RuleFixInsertBefore(ctx.SourceFile, nameNode, "readonly ")}
```

The actual input diff is:

```diff
# package/pi-plugin/auto-mode/native/contract/integration/policy-source/system-slot.mjs
 class SystemPolicyInput {
- #state;
+ readonly #state;
```

The qualified compiler already exposes the grammar predicate needed to distinguish these files.
Its `internal/ast/utilities.go:1271` defines `IsSourceFileJS` using JavaScript and JSX script kinds.
The matching shim exports that function at `shim/ast/shim.go:1368`.
This is an invalid formatter result exposed by JavaScript grammar;
it is separate from the owned environment-inheritance test defect.

## Verification catalogs and prototype

The maintained package task reproduces the change inside a disposable 2 GiB,
two-CPU container:

```shell
# doc/troubleshooting/oxlint-prefer-readonly-javascript.md: retained private reproduction
cd "${HOME}/temp/agent/pi-mimo-preparation-failure-20261018"
mise run prepare-native-format 57b2baacd2
mise run private-native-format
```

The private tree's diff and `native-private-safe-format.log` retain the modifier and diagnostic output.
The working catalog must retain TypeScript private-field findings and fixes.
The failing catalog adds JavaScript,
CommonJS,
ESM and JSX cases with read-only-in-practice private fields.
They must produce no TypeScript-only modifier.

A fresh disposable prototype is at `${HOME}/temp/agent/upstream-prototype.XlprBA91`.
Its origin and exact source commit are verified before editing;
its push URL is disabled.
The new filename-specific regression cases are committed locally as `ccec2d9`.
They use the upstream `tsconfig.checkJs.json`,
which explicitly enables JavaScript input checking.
The complete existing `prefer_readonly` rule catalog remains enabled.
The prototype verification is running with a private Go toolchain mount,
disposable module cache and home,
2 GiB memory and two CPUs.
Neither the workspace nor the real home or credentials is mounted.
The remedy and final result are pending;
this record does not claim a verified upstream fix.

## Current workaround and limits

Keep the malformed private output out of the maintained native tree.
Apply independently reviewed file clusters and run syntax,
type and real consumer checks after formatting.
This preserves the JavaScript consumer while the formatter issue is investigated.
It does not complete the remaining native lint backlog.
No rule is disabled or weakened.

## Upstream filing decision

- Fault: the actual safe fix inserts a modifier forbidden by the input file's grammar.
- Fixability: the compiler already supplies a JavaScript-file predicate.
- Supported use: the upstream rule harness accepts explicit JavaScript filenames and provides
  `tsconfig.checkJs.json` with `allowJs` and `checkJs` enabled.
- Contribution policy: `README.md`,
  `CONTRIBUTING.md` and `.github/SECURITY.md` are read.
  The contribution guide welcomes external work;
  searches of those files find no AI-filing prohibition.
- Maintainer disposition: implementation issue 193 and merged implementation pull request 654 are read in full.
  They establish implementation support,
  not a decision about this JavaScript case.
  Tracker searches for `readonly JavaScript` return no issue or pull request.
  Broader `prefer-readonly` searches find implementation and maintenance work,
  including merged pull request 1149.
- Prototype: regression cases and bounded verification are in progress.
  No upstream fix is claimed or filed yet.

The `.out-of-scope` inventory is checked.
Its `low-impact-typescript-formatting.md` exclusion concerns token polish,
not insertion of syntax that breaks a JavaScript consumer.
No matching exemption is found.
Nothing is filed or drafted for publication until the prototype and applicability checks finish.
