# Confirmation and explicit bypass

## Purpose and callers

`native/contract/integration/native-batch/prepared-group.mjs` retains the exact group for every confirmation.
The policy compiler returns its outcome and currentness checks;
uncertainty and assessment failure reach the same group-owned selector.
`native/contract/integration/action-policy/approval.mjs` captures the current native presentation capabilities.
`native/contract/lifecycle/incumbent-tui-group/approval-presentation.mjs`
verifies the actual selection and recorded verdict.
`src/ask-user.ts` owns the displayed Allow and Stop choice,
headless withholding,
session audit entry,
and approval notification.

This module is necessary because missing automatic evidence does not create permission.
The human must see the original complete operation when deciding whether to allow that operation.
The notification is auxiliary;
its failure does not establish the cause of the automatic-review failure.

## Invariants

Allow applies to the retained exact group after its currentness checks.
Stop,
dismissal,
and absent UI withhold execution.
Historical verdict records remain visible audit data rather than current authorization.
Automatic approval and confirmation of an automatic Ask share the same original-source retention handoff.
The collector then permits append-only,
authenticated event receipts from execution while retaining its governing-source,
tool-input,
runner and cancellation checks.
Confirmation after automatic source capture fails has no captured source set to retain;
its original operation and exact approval checks remain separate.
Established denials cannot reach another generic Allow prompt.
An established review that becomes stale remains withheld.
Source checks used inside an existing compiler operation call its original dependency check directly,
preserving the operation's reentrancy guard.
`src/types.ts` preserves those stored verdict shapes without retaining the obsolete flagger's model and signal types.

The human summary retains original command text so it is reviewable even after parser failure.
It excludes model thinking and signatures.
The provider projection remains separate and contains parsed shell structure.

`src/native-bypass.ts` retains the existing explicit session bypass.
`src/bypass.ts` owns its audit format and visible control state.
The fixed caller-scoped virtual-input guard remains active during bypass.
Removing the obsolete extension entry does not remove native bypass or its fixed guard.

## Alternatives and verification

Reusing old approval by action description would bind permission to an ambiguous description.
Automatically allowing after a transport failure would authorize without evidence.
Blocking confirmation because parsing failed would prevent the human from reviewing the original operation.
The retained interface keeps original data,
scoped confirmation,
and native execution identity together.

`test:confirmation`,
`test:native:approval-context`,
`test:native:decision-fallback`,
and `test:native:bypass` exercise the UI outcome,
fresh context,
fallback routes,
and fixed protection during bypass.

The fallback fixture registers an original asynchronous `tool_execution_update` observer
and emits tracked progress from each proposed tool.
Its automatic and confirmed approvals must both execute every member.
The committed pre-repair `unknown` run executes one member and fails with `1 !== 2`,
while the automatic approval control executes both.
The `allow-stale` and `allow-abort` modes change governing policy or cancel inside the selector
before returning Allow;
neither may execute a member.
This distinguishes ordinary execution receipts from lost approval eligibility.

Task names use `mise run //package/pi-plugin/auto-mode:<task>`.
