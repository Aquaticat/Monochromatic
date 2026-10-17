# Operation preparation

## Purpose and interface

`native/contract/integration/native-batch/handler.mjs` connects the original complete assistant tool group
to prepared dispatch and review.
`native/contract/integration/native-batch/tools.mjs` wraps the actual session tool registry.
The group is prepared before review and executes through its original member identities.

This module exists to prevent reviewing one command or tool definition and executing another.
A model-provided tool name or an argument record is data;
the installed registry supplies the actual executable definition.

## Retained ownership

`native/contract/collector/program-rule-batch-sdk-copy-v2/input` owns original group preparation,
member identity,
and execution state.
`native/contract/lifecycle/native-program-groups` retains supported nested program execution.
`native/contract/lifecycle/execution-context-carrier` binds tool context and its dependencies.
Each responsibility is needed where callbacks can replace tools,
modify arguments,
or outlive their original session.
The versioned directory names are historical implementation names,
not separate product features.

Every prepared member remains unentered until the group decision permits execution.
Original ordering,
signals,
callbacks,
and completion states remain with the dispatcher.
Freshness failures cannot reuse an established answer for changed inputs.

## Model projection

`src/review-operation.ts` replaces `bash.command` and `process.start.command`
with locally parsed Bash structure for review.
It retains action,
working directory,
notification configuration,
and other original options.
Other process actions keep their original data shape.
The installed process extension launches its start command through a configured shell
or its existing Bash fallback;
the projection describes Bash syntax and does not establish runtime effects or evaluated expansion values.

Execution retains the original input object and source command.
A parser failure withholds automatic review while leaving the exact original operation available for scoped confirmation.
The shared shell analyzer owns parsing;
the package no longer carries a pass-through command-analysis wrapper.

## Alternatives and verification

Reviewing calls individually would lose complete-group effects and ordering.
Executing a rewritten model command would change the operation after review.
Treating the process tool name as automatic permission would bypass its command effects.
The retained implementation prepares the actual group and changes only its review representation.

`test:native:judgment-preparation`,
`test:native:prepared-lifecycle`,
`test:native:prepared-schedule`,
and `test:native:shell-projection` exercise these contracts.
The shell-projection regression checks provider-facing parent and prepared inputs,
preserved execution input,
malformed start commands,
and non-start process actions.

Task names use `mise run //package/pi-plugin/auto-mode:<task>`.
