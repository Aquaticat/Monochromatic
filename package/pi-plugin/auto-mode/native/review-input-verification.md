# Review input verification

## Lesson from the thinking and Bash projection incident

The 2026-10-16 review boundary still transported assistant thinking and raw Bash,
despite the intended parser-first design.
Coverage of individual helpers did not establish what the actual provider received.
The package's verification surface therefore includes captured native provider requests,
covering proposed operations, prepared members, selected conversation, and per-clause operation data.

The user chose on 2026-10-17 to keep the repository's `TCV` rule unchanged and document this lesson locally.
A proposed global requirement to inspect provider payloads was rejected in favor of this package-local record.

## Required and excluded data in the implemented contract

The model receives Bash command and argument roles, quoting, control flow,
redirections, assignments, and parsed nested execution.
Literal data remains distinguishable from active shell expansion.
Assistant thinking, provider signatures, and complete Bash source fields stay outside the request.
Original operations remain local for execution and freshness checks.
Human confirmation retains the original command even when parsing fails.

`test:native:shell-projection` exercises the built wire projection,
including literal and active substitutions, here-documents, redirects, pipelines,
logical operators, malformed commands, absent command inputs, and non-Bash operations.
`test:visible-context` covers historical tool calls and direct Bash entries.
`test:native:startup-relevance` covers selected policy inputs and thinking exclusion.
`test:native:decision-fallback` captures actual native assessment requests and checks retained operation arguments.

## Complete-session replay

The consumer replay includes the reported interaction's preceding turns and configured resources.
Its shell environment needs the tools used by the saved commands,
including `rg`; a missing executable changes tool results and later model context.
Expected tool errors come from the saved transcript rather than an assumption that every command succeeds.
The saved interaction includes a search returning exit status `1`.
An exit status `127` caused by missing `rg` is a different result.

Verification of automatic admission includes execution of both reported tool-call identifiers,
absence of confirmation requests, and inspection of complete outgoing payloads.
The prohibited-operation control independently checks that actual restrictions still block execution.
Timing tests admit late answers while separately rejecting cancellation, invalid clocks, and stale inputs.

## Mixed process and Bash groups

The 2026-10-17 report exposes a separate projection branch:
`process.start.command` contains shell syntax even though its tool name is not `bash`.
The unchanged captured operation scores approval `0.48` in three live trials.
Changing only proposed process command copies to the existing parser's structure scores `0.69`
in three live trials.
The operating cutoff remains `0.60`.

The built projection now covers Bash and process starts,
including parent,
prepared,
historical,
and per-question copies.
Non-start process actions retain their original shape.
Tests separately check preserved working directory and notification options,
malformed or missing start commands,
original execution input identity,
and nested shell syntax.

Replay resource IDs require original-result correlation.
The original session's `process.output` names `proc_3121`;
a disposable replay must use the ID returned by its own actual `process.start`.
Keeping the original ID tests an unbound resource and can correctly trigger uncertainty.
The replay changes only that runtime reference,
retains the original tool-call IDs,
and records the old-to-new process mapping.

Directly invoking `Agent.continue` bypasses Pi's primary prompt observer and fails before assessment.
The accepted replay enters through the normal prompt and reproduces all preceding tool groups.
Neither fixture failure establishes a product regression.

The transport regression separately distinguishes failed HTTP invocation,
credentials,
cancellation,
response-stream failure,
and HTTP rejection.
Only the invocation category permits the existing single retry.
An intentionally changed copy of the built classifier makes the negative cases fail;
the production build remains unchanged.
The native fallback regression proves approved recovery executes the group,
while denied recovery executes no member.
