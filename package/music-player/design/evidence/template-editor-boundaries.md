# Template editor design evidence

## Purpose and authorization

D81 asks for an editor for the template that produces a track row's supporting line.
The human named KWGT as the precedent,
chose which of its features to keep and omit (D89),
and left the remaining choices to the agent (D90).
This study builds that editor as authored native states,
so its layout can be looked at on the Fold instead of being described.

It changes no production code,
stores no template and changes no row of the player.
It is not a parser,
and it authorizes no production implementation.
The [planning note](../../../../doc/planning/music-player-template-editor.md)
holds the KWGT observations,
the proposal the study builds,
the first look at a first build,
and the layouts considered.

The review page is `questions/template-editor.html`.
It asks one question:
which layout keeps what in view while typing.
Everything else it shows is listed in it as an assumption open to objection.

## What the app has today

Read from production source on 2026-10-05 and recorded in the planning note under
`What the app has today`:
a track is a URI and a display path,
no tag is read,
a duration is known for the playing track only,
and a track row draws one text with no supporting line.
The study therefore previews a line the app cannot fill for every row yet.
That gap belongs to production,
not to the template language.

## Authored native fixture

The owned branch `prototype/music-player-first-run-access` holds the study at
`82d2692b7471fcde27c86c9bb321a4d35557bbca`.
Its production source is unchanged from `a5560abb223af9f700b9d9465eac1991a02aac07`,
which the build checks with a source comparison,
not a digest.
The debug host `TemplateEditorActivity` draws exactly one authored state per launch.
The merged debug manifest disables the production activity,
playback and sweep services.

The fixture holds copy,
not logic.
`template-reference.mjs` is a small reference for the language
(fields,
`tf`,
`tc`,
`if`,
error lines and typing help),
and `template-editor-scenes.mjs` computes from it every text each state must draw.
A capture whose page draws anything else is refused.
The fixture's own unit task passes with 24 cases.

Three launch options select what is drawn:

- `scene`:
  the authored state.
- `layout`:
  `flow`,
  `rows` or `lines`,
  described under `Captured cohort and visible boundaries`.
- `position`:
  `top`,
  or `end` for the page scrolled to its end.

While a state holds focus in the field,
the study scrolls the page once,
by its own rule:
just far enough that the lines under the field clear the keyboard by 8dp,
and never so far that the field's upper edge leaves the scrolling window.
The preparation of the captures checks that each typing view rests where that rule put it.
Typing,
moving the caret,
inserting a field and resetting are not connected;
the buttons emit a debug event and change nothing.

## Captured cohort and visible boundaries

The cohort is 128 views:
the scenes of `template-editor-scenes.mjs` on both Fold panels,
in light and dark,
at 100% and 200% text.
The baseline layout is shown in every state,
plus one view scrolled to the page's end.
Each pinned layout is shown in the typing states and in one state at rest.
States that hold focus are captured with the system keyboard open;
the others with it closed.

The layouts:

- `flow`:
  two preview rows at the top of one scrolling page.
- `rows`:
  the two preview rows fixed under the header,
  the rest scrolling beneath them.
- `lines`:
  only the two lines the template yields fixed under the header,
  without the rows' titles.

What a view keeps in view is read from the hierarchy,
not judged by eye.
A text that scrolls counts as in view only when its rectangle lies strictly inside the page's scrolling window,
whose lower edge is the keyboard when one is open.
A rectangle that touches an edge is reported as at the edge,
because the hierarchy cannot tell cut from flush.
What a layout fixes under the header must be in view in every one of its views,
and the builder refuses the cohort otherwise.
Hierarchy rectangles are not ink bounds.

Measured,
for the preview,
the field and the lines under it:

- At 100% text all of them are in view in every typing state,
  in every layout,
  on both panels.
- `flow` at 200% text:
  typing inside a call puts the preview out of view on both panels.
  On the inner panel the field and its help also reach the window's edges.
  In the two error states the preview stays,
  with its first title against the header on the inner panel.
- `rows` at 200% text:
  the preview stays in view everywhere.
  Typing inside a call leaves only the help's first line on the inner panel,
  cut at the keyboard,
  and cuts the help's sentence on the cover panel.
  The error states keep the field and its error line in view on both panels.
- `lines` at 200% text:
  the preview stays in view everywhere.
  Typing inside a call keeps the help's first line whole on the inner panel and the whole help on the cover panel.
  The error states keep everything in view on both panels.

In every layout the field list sits under the field and is mostly out of view while the keyboard is open.
That is a separate concern,
not built yet,
and it depends on which layout is taken.

Two capture problems were found with the first build and are handled now:
the keyboard's own notice after a change of text size,
which the capture avoids by opening the keyboard once per condition and by requiring one keyboard edge per panel;
and hierarchy attributes written in single quotes,
which the reader now accepts.

## Review and lifecycle

The published crops keep exact RGB,
opacity,
dimensions and only essential PNG chunks;
the status strip is removed and the keyboard and navigation area are kept.
Every view was read in full on a sheet of its panel,
text size and theme before publication:
no system dialog,
notification or keyboard notice is in any of them.
The keyboard's suggestion strip shows the emulator image's own dictionary guesses for the authored text.

`verify:template-editor` builds the page and validates it against the views and the reference.
`test:template-editor` proves the builder refuses changed evidence,
a broken layout claim and a page without its question.
Removing each of its four named guards makes that test fail.
An offline browser check in a container bounded to 2 GiB of memory and 2 CPUs opened every embedded view,
answered the question each way,
and ran in light and dark at desktop and phone width with no accessibility finding on the closed page.
`questions/evidence/template-editor-review-verification.json` records these results.

No digest of an image is recorded,
and neither the builder nor the review record compares anything with a digest (D88).
The witness manifest states the prototype commit and the APK's digest as provenance only.
The private capture scripts,
which are not in this repository,
compared the APK's digest while these views were captured:
to keep one cohort to one build,
and before replacing a package already installed in the guest.
Asked on 2026-10-06,
the human said D88 covers them too,
and the comparisons were removed from the scripts that run a visit.

The views were captured over several emulator visits on 2026-10-05,
each in a container bounded to 6 GiB of memory and 2 CPUs.
The emulator stopped abnormally during two of the visits that contributed views:
once with a segmentation fault,
and once killed,
with exit status 137 and no out-of-memory event reported by `podman`,
for a reason that was not established.
Finished views were kept,
and each view's record names its visit.
The last visit restored the guest's recorded settings and shut down with no container or emulator process left.
The crashes,
a refused start after a shutdown the emulator cut short,
and what recovered each are recorded in
`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md` and
`doc/troubleshooting/android-emulator-37-disposable-avd-lock-after-hard-stop.md`.

## Not exercised

- Real typing,
  caret movement by touch and scrolling by hand.
- Inserting a field and resetting to the default.
- TalkBack,
  focus order,
  speech and contrast.
- Templates longer than the authored ones,
  and a result line too long for its row.

## Remaining implementation gate

Nothing here is decided by being shown.
The layout waits for the human's answer to the review page.
After it:
the field list's reach while typing,
then the questions D81 leaves open,
such as which other rows get a template.
No production parser,
storage or row change is authorized.
