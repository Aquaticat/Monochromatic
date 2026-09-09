# Promise review corrections

## Authorization and scope

The user delegated implementation with “Address whatever you want to address.”
The assessment is in [the review disposition](../planning/promises-teaching-review-assessment.md).
The review's `Concerns that require real learner observation` section remains vetoed as fine.
No learner-study gate or final teaching-skill approval is being added.

Repair the controller-ownership teaching bridge, timed Stop interactions,
capstone comparison workflow, supplied-source boundaries, fixture metadata explanation,
and `wait`'s Promise-returning contract.
Fold the isolated identity-guard observation into the overlapping-send exercise.
Leave the optional observations alone.

## Preservation and authoring

The pre-change artifact is preserved as
`doc/planning/promises-teaching-fable-reviewed.local.html`.
Its SHA-256 is `aef8e02094efce04096989c4e102c7416edf342e2ff0affd81b8f72c2f478e3b`.
It and the delivered artifact remain ignored local files; do not force-add them.
The original preserved versions remain untouched.

Authoring directory: `/var/home/user/temp/agent/promises-revision`.
Build through its `mise run build` task.
The output remains `doc/planning/promises-teaching.local.html`.
Do not reload the user's existing presentation tabs or discard their drafts.
Use disposable verification sessions, then open a new presentation tab.

## Work log

### Promise-returning wait

`build.mjs` now changes the supplied `wait` declaration to `async`.
Its early abort check therefore rejects its returned Promise rather than throwing out of the call.
Timer startup and cooperating abort cleanup remain in the function body.

`verify-reviewed-helpers.mjs` separates the call and await boundaries,
checks identity of the supplied rejection reason,
checks fulfillment listener removal, and checks that pending abort clears the actual timer handle.
`review-browser.mjs` owns disposable sessions and closes them through a resource disposer.

The preserved before-state failed in `proc_2c5c` with:

```text
AssertionError [ERR_ASSERTION]: Already-aborted wait must return a rejected Promise instead of throwing at call time
actual: { phase: 'call', sameReason: true }
expected: { phase: 'await', sameReason: true }
```

`proc_b4cd` rebuilt and passed the return-boundary checks.
`proc_ac07` passed the additional timer-handle check and the retained policy/workshop regression in 74 seconds.
This covers the existing advanced verifier, whose capstone execution omission is still being repaired separately.
No full-lesson completion claim is made by this helper check.

### Ordered Stop without changing clocks

The isolated cancellation/deadline previews now have a labelled lesson control that activates Send then Stop
within one callback, using the learner's actual listeners.
An unwired Stop still does nothing; ordinary Send still reaches the real reply or native deadline.
The control records the state after Send rather than requiring the learner to catch an intermediate paint.
It is included in standalone practice downloads.

The reference has `Reset and stop A during backoff`.
Its policy creates the real backoff wait before notifying the UI.
The prearranged example then activates A's ordinary Stop button from that notification.
A has overlapping sends; B continues independently.
This is a scripted action order, not a manual clock or a longer click window.
The example's fixed scenarios are disclosed separately from subsequent manually sent messages.

`proc_bdb5` passed starter/solution behavior, the deadline path, exported controls,
a directly observed pending backoff timer at Stop, and existing reference ownership regressions in 32 seconds.
`proc_4997` rejected the reversed-notification-order mutant:
Stop observed zero pending backoff timers instead of one.

### Overlapping-send ownership bridge

`ownership.html` teaches identity, named `filter` predicates, returned arrays, and `for…of` iteration.
It also explains the reference's equivalent arrow-function spelling.
`ownership-solution.mjs` supplies the worked controller-list implementation;
the build derives an intentionally broken clear-the-whole-list starter from it.
The isolated identity guard is now described as defensive where Send is disabled,
not presented as proof of an interleaving that cannot occur through those controls.

`ownership-fixture.mjs` supplies explicitly manual reply completion, rejection, and abort.
Its held-reply list is distinguished from the learner's controller list and browser queues.
Lesson controls can send a pair or request Stop and immediately send again in one callback.
They and the helper are included in the practice download.

`proc_027d` passed in 15 seconds:

- Broken starter exposes loss after partial completion and after Stop followed by a fresh send.
- Worked solution keeps the remaining controller and preserves drafts.
- Newest-first completion, rejection, and blank input behave as documented.
- Already-aborted calls return rejected Promises; the fixture's 20-call bound is enforced.
- The print appendix includes the new task and source.
- The actual downloaded exercise retains the interactive controls and ownership behavior.

Full PDF and cross-feature validation remain separate final steps.

## Remaining work

- Make the capstone comparison runnable with the promised controls and full dependencies.
- Explain supplied source machinery and fixture-only outcome selection.
- Integrate and run browser, export, print, neutral-surface, and negative-control checks.
- Document independent review results, inspect changed visible states, and present a fresh tab.
