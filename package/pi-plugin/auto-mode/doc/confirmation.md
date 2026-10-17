# Confirmation and explicit bypass

## Purpose and callers

`native/contract/integration/native-batch/manual-group.mjs` retains the exact group for manual fallback.
`native/contract/integration/action-policy/approval.mjs` connects original confirmation evidence to review.
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

Task names use `mise run //package/pi-plugin/auto-mode:<task>`.
