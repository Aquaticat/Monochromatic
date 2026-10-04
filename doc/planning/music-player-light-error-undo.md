# Light error and Undo state-family continuation

## Purpose and existing decisions

This is the next independent design-only queue item after first-run evidence
and the proposed whole-map keyboard demonstration.
D82 closes custom Android notification design;
no notification variants are part of this work.
New keyboard assignments remain a proposal,
and this state-family work does not depend on their adoption.

D8 selects immediate trash with a compact,
content-width Undo toast rather than a confirmation dialog or full-width
snackbar.
D9 removes vanished rows and uses a dismissible error bar,
collapsing multiple failures to a count.
D29 places the left-aligned toast 16dp above the current bottom-edge owner,
lifting above the error bar without pushing layout.
The unresolved work is carrying those settled behaviors into the light
surface and verified Fold geometry,
not asking about pill colour or spacing below their hard floors.

## Independently verifiable queue

- [ ] Inspect the accepted dark error/toast candidates,
  current operation owners and token roles.
  Completion requires distinguishing known missing-file signals,
  failed trash operations and actual Undo capability from invented
  recovery actions.
- [ ] Build isolated native light/dark authored states for error only,
  Undo only and the combined state,
  preserving D8/D9/D29 and accepted player information clearance.
  Completion requires fit and overlap evidence at both panels and native
  font scales,
  not a live filesystem mutation.
- [ ] Publish inspected,
  sanitized state evidence and verify its consumer review.
  Record implementation limits and restore/stop any owned runtime.
  Ask only if a consequential unresolved requirement survives the audit.

## Safety and evidence boundary

No real file is trashed,
restored,
renamed or deleted.
No live playback,
source scan,
original-AVD change or new IME/TalkBack experiment is authorized.
An authored successful-trash state cannot prove that production Undo can
restore the original identity or location.
A failed trash request does not qualify for a successful-trash toast.
Unknown failure causes do not receive an invented generic Retry action.

Native work may use only the owned disposable Fold under 6GiB/2CPU bounds;
browser checks stay within 2GiB/2CPU.
The existing first-run debug host disables production entry points and
services and can supply the same isolation boundary for this study.
Raw status-bearing images,
hierarchies and logs remain private.

## Initial source anchors

`package/music-player/design/decisions.md` sections D8,
D9 and D29 are the authority for behavior and placement.
`package/music-player/design/candidates/err-b.dc.html` and
`package/music-player/design/candidates/toast-a.dc.html` are historical
accepted dark treatments to inspect,
not a current source-operation proof.
`package/music-player/design/open-questions.md` section 11d lists the light error bar and
Undo toast as undrawn.

The next action is the state/operation-owner audit before any new native
artifact is built.
