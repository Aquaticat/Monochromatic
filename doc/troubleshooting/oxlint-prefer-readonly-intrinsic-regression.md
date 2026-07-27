# `prefer-readonly-parameter-types` reports every ECMAScript intrinsic call as unresolved, 136 errors in one package

Status: root cause not yet localized. The confirming test is named under "What would settle it".

Last verified: 2026-07-27, with `@oxlint/plugins` 1.75.0 and `typescript` 7.0.2 installed.

## Symptom

`mise run //package/module/toml-edit:lint:oxlint` reports 136 errors, every one from the project-owned rule
`prefer-readonly-parameter-type(prefer-readonly-parameter-types)`.
The flagged calls are ordinary ECMAScript intrinsics.

Verbatim, for `package/module/toml-edit/src/path-prefix.ts`:

```text
x prefer-readonly-parameter-type(prefer-readonly-parameter-types): The function input named "left" is used as the
object for these method calls: left.every [.../src/path-prefix.ts:101].

A method can change data stored inside its object or in the system that object controls, even when this code never
assigns a new value to the input.

This rule cannot inspect enough of those calls to know what they might change.
```

The same shape appears for `blocks.filter`, `path.slice`, `Object.entries`, `String`, and `Error.isError`.

This is not confined to `toml-edit`.
`package/module/caught-value` is 38 lines of source whose only calls are `Error.isError` and `String`,
and it reports two errors of the same class:

```text
x prefer-readonly-parameter-type(prefer-readonly-parameter-types): The function input named "value" is used by these
calls: Error.isError [.../caught-value/src/index.ts:55], String [.../caught-value/src/index.ts:57].
```

## Why this reads as a regression

`doc/planning/replace-prefer-readonly-parameter-types.md` records the migration acceptance gate, dated 2026-07-14:

> Final single-worker root process `proc_367` ran `OXLINT_THREADS=1 mise run lint:oxlint` over 2,548 files in
> 816.5 seconds. It reported 3,792 warnings and 665 errors from existing non-readonly workspace findings.
> Its captured output contains zero occurrences of the replacement rule ID, `SemanticBridgeError`,
> the omitted-owned-callable failure, or `context canceled`.

The documented steady state is therefore zero findings from this rule across the whole workspace.
The current state is at least 136 in one package and two in a 38-line package,
so something between that gate and now changed the rule's ability to resolve intrinsic effects.

## Version skew present in the working tree

The installed toolchain does not match the committed lockfile:

```text
installed:            @oxlint/plugins 1.75.0
committed lockfile:   @oxlint/plugins 1.74.0   (specifier '>=1.73.0')
uncommitted lockfile: @oxlint/plugins 1.75.0
```

The uncommitted `pnpm-lock.yaml` in the working tree carries a catalog bump from 1.74.0 to 1.75.0,
and `node_modules` already reflects it.
The acceptance gate predates that bump.

This makes the bump the leading hypothesis for the regression.
It is a hypothesis, not a finding:
no test in this investigation isolated the plugin version as the cause.

## What would settle it

Only `@oxlint/plugins` 1.75.0 is present in the pnpm store,
so the comparison needs the older version fetched first:

```bash
# In a disposable worktree, with the committed lockfile that pins 1.74.0.
git worktree add "${HOME}/temp/agent/oxlint-bisect" HEAD
cd "${HOME}/temp/agent/oxlint-bisect"
pnpm install --frozen-lockfile
cd package/module/caught-value
node ../../dev-script/task-util/src/oxlint-wrapper.ts --type-aware
```

Two findings under 1.74.0 means the bump is innocent and the cause is in our own plugin or its inputs.
Zero findings under 1.74.0 confirms the bump.

Run the comparison against `caught-value` rather than `toml-edit`:
two findings over 38 lines of source is the smallest reproduction available,
and its only calls are the two intrinsics.

## Related fix landed during this investigation

A separate defect in the same rule was found and fixed while reproducing the above,
and it is worth separating from the intrinsic question because it masked findings rather than creating them.

`nearestOwnedCallable` walked parent pointers to find a call's enclosing callable,
stopping only on a self-parented node.
A source file reports no parent at all rather than parenting itself,
despite the non-optional `parent` in TypeScript's node types,
so the walk assigned an absent parent to the cursor and the next predicate call read `.kind` off it:

```text
[prefer-readonly-parameter-types] [Program] semantic rule failed: TypeError: Cannot read properties of undefined
(reading 'kind')
    at isFunctionLikeDeclaration (.../typescript@7.0.2/.../ast/is.generated.js:730:23)
    at isEffectCallableDeclaration (.../plugin-prefer-readonly-parameter-type.mjs:3:10951)
    at nearestOwnedCallable (.../plugin-prefer-readonly-parameter-type.mjs:6:35262)
    at completeForeignBorrowedGraph (.../plugin-prefer-readonly-parameter-type.mjs:6:37637)
```

The trigger is a callable in the inbound closure that is itself invoked at module top level,
such as `await main();` at the end of `package/module/toml-edit/src/conformance/decode.ts`.
The walk from that call passes no callable before reaching the source file.

Two properties made this hard to see:

- It reproduces only on a cold or invalidated effect-summary cache
  (`node_modules/.cache/prefer-readonly-parameter-type`), and vanishes on a warm re-run.
- The rule logged `String(error)`, which reduces the thrown `TypeError` to its message and drops every frame,
  so the crash site could not be located from lint output.

Both are fixed: the walk stops on an absent parent (commits `01f85074a` and `a2a7e7f5a`,
the second reshaping the guard to avoid a nullish union), and the log now uses `caughtValueStack`
from `@monochromatic-dev/module-caught-value` so frames survive (commit `5c8a624a9`).
A regression test covers the top-level-invocation shape; reverting the guard fails it with the original `TypeError`.

Fixing the crash raised the reported count in `toml-edit` from 133 to 139,
because the crashed file previously reported a single `semanticBridgeUnavailable` diagnostic
in place of its real findings.
The count is now 136 after the duplicate-predicate refactors landed.

## What does not work

- Treating the 136 findings as `toml-edit` defects. They are not package-specific:
  the same class appears in `caught-value`, whose entire source is two intrinsic calls.
- Loosening or disabling the rule. `AGENTS.md` `LN7` forbids loosening lint rules without prior approval,
  and `MXL`-style suppression would hide a regression rather than resolve it.
- Following the rule's own remediation list for these findings.
  It offers four paths: include the implementation in the nearest `tsconfig.json`,
  pass only primitives or a verified isolated snapshot, remove the call,
  or mark the input as a foreign host capability and document effects with `@mutates`.
  None applies to `Array.prototype.every`: its implementation cannot be added to a `tsconfig.json`,
  and `AGENTS.md` `JCH` forbids using `@mutates` for absent effects.
  That mismatch is itself evidence the findings are spurious rather than actionable.

## Upstream filing decision

Not filed, and no draft is kept.

The 6-constraint check cannot be started, because constraint 1
(is it really upstream's fault?) is unanswered:
the regression has not been localized to `@oxlint/plugins` versus our own
`package/oxlint-plugin/prefer-readonly-parameter-type`.
Filing against oxc while the cause may sit in our plugin would be a publicity incident of exactly the kind
the constraint exists to prevent.

`.out-of-scope/` was checked and holds no oxlint or oxc exemption.
No upstream duplicate search was run, for the same reason:
there is not yet a claim about upstream behavior to search for.

Re-run "What would settle it" first.
If 1.74.0 is clean, the audit becomes an upstream question and this section should be redone in full.
If 1.74.0 is equally affected, the cause is ours and no upstream filing arises at all.
