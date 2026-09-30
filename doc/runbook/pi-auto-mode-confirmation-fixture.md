# Confirm a disposable auto-mode witness fixture

This is a private integration test,
not an auto-mode permission grant or production rollout.
The agent prepares and opens the editor;
the human supplies the response.
Automation already exercised the requester,
helper,
editor,
and scope-binding controls with scripted answers.
That verified the mechanics but did not produce a genuine human confirmation.
No synthetic keyboard input is used for this step.

## Current attempt status

The original one-shot controller stopped with Node exit `13`
after reaching its default terminal launch boundary.
No original-response capture or final-confirmation receipt was retained.
The original attempt must not be replayed.
Any remaining test window is inactive and cannot grant permission.
A new window requires a separately corrected,
frozen,
and authorized epoch.
The user has now authorized all tests within the existing qualification limits.
The agent is preparing a corrected epoch with fresh scope,
private receipts,
and a bounded response wait.
The human response steps apply only when the agent explicitly announces that new epoch.

If the inactive editor is still open,
press **Ctrl+X**.
If Nano asks whether to save changes,
press **N**.
The editor should close without a confirmation being recorded.
Do not type a new approval into that inactive document.

## Setup

Status:
TODO

This handoff requires the prepared private fixture on the current Linux desktop,
Ghostty resolved as `com.mitchellh.ghostty.desktop`,
and GNU Nano 8.7.1 at `/usr/bin/nano`.
The measured user configuration selects `nano`.
For this test only,
`--ignorercfiles` keeps default key bindings and avoids configuration-driven form changes.
Nano's documented `+LINE,COLUMN` argument places the cursor in the response area.
No user configuration is changed.

The agent owns setup and execution under
`~/temp/agent/auto-mode-consumer-contract.mDLkyNoP/contract/human-origin/live-clean-confirmation/`.
The execution deadline is five minutes,
with a bounded cleanup grace period.
Controller loss or cancellation stops the requester and cannot produce an accepted completion.
The initial device probes reported locked.
Later dispatch-readiness probes reported unlocked,
and the agent dispatched the new one-shot controller as `proc_7c5f`.
Original response and completion remain pending;
if its window is absent,
report that observation rather than entering a response elsewhere.
The private helper has a tested expected-cancellation guard;
production and the earlier frozen helper remain unchanged.
The earlier unreferenced attempt remains separate private evidence.
It verifies frozen source identities,
creates a disposable file,
and opens exactly one editor through the existing helper workflow.
No credentials,
account changes,
model calls,
or real repository data are required.

Do not run the one-shot preparation or execution tasks yourself.
On another machine or without the prepared fixture,
stop and have the agent prepare a fresh,
separately identified test.
Existing constructor and execution receipts must not be overwritten or replayed.

The new window title is **Pi answer:
 save and exit to submit (clean fixture)**.
Only this new window is active;
any older test window remains inactive.
The document is `ANSWER.md`,
with **Private confirmation test**,
**Scope**,
and **Response** sections.
If no window appears,
report that observation;
do not type a confirmation into an unrelated terminal or editor.

## Steps

Status:
TODO

1.  Inspect the **Scope** section in the opened `ANSWER.md`.
    It must identify a disposable `FIXTURE.txt`,
    `fixture-read-only`,
    and `productionPermission: false`.
2.  In the **Response** section,
    enter `APPROVE FIXTURE` to approve this test or `DENY` to reject it.
    The response text should appear without changing the question,
    confirmation identifier,
    or scope.
3.  Press **Ctrl+O**.
    Nano should offer to write the existing `ANSWER.md` file.
4.  Press **Enter** without changing the filename.
    Nano should report that the file was written.
5.  Press **Ctrl+X**.
    Nano should close,
    and the agent should receive a non-content completion summary.
    Report any remaining test window;
    detached terminal closure is not independently attested.

To cancel instead,
leave the **Response** section empty and press **Ctrl+X**.
The private observer treats the unchanged question form as cancellation,
even though the underlying answer file is not empty.
Do not enter passwords,
tokens,
or other secrets.

## What to check

Status:
TODO

The agent reports one of these fixture-only statuses:

- `approved-fixture`:
   the exact unchanged scope was bound to the original response.
- `denied-fixture`:
   no approval was recorded.
- `cancelled`:
   no approval was recorded.

Changing the question,
identifier,
or scope must not produce approval.
A failure keeps the original attempt and does not automatically reopen the editor.
The raw editor document and original response remain in ignored,
mode-0600 private files.
They are not committed or included in model-visible diagnostics.
No production grant is written.

This proves only the selected trusted-host workflow boundary.
It does not attest a physical person's identity,
prove that the question was read or understood,
or qualify other Pi input producers.

## Restore

Status:
TODO

The requester places its temporary answer workspace under the ignored private directory
and removes that workspace after completion.
An interrupted controller must not publish approval;
its detached editor closure remains unestablished.
No unrelated terminal process is terminated.
The private test receipt and disposable fixture remain as local evidence.
No production permission,
editor configuration,
or terminal preference needs reverting.
Do not delete the retained evidence or repeat the test without a new explicit test epoch.
If the editor remains open after an interrupted run,
report the window title to the agent so it can inspect the owned process and channel.
