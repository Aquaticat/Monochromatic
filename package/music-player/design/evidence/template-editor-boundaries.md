# Template editor design evidence

## Purpose and authorization

D81 asks for an editor for the template that produces a track row's supporting line.
The human named KWGT as the precedent,
chose which of its features to keep and omit (D89),
left the remaining choices to the agent (D90),
and on 2026-10-06 decided the rest:
the preview scrolls with the page (D91),
the language has no conditional (D92),
an empty field is plain substitution with the unit inside the peak field (D93),
and the page rests where Android puts a focused field (D94).
This study shows that editor as authored native states on the Fold.

It changes no production code,
stores no template and changes no row of the player.
It is not a parser,
and it authorizes no production implementation.
The [planning note](../../../../doc/planning/music-player-template-editor.md)
holds the KWGT observations,
the proposal,
the first look at a first build,
the pinned layouts that D91 rejected with what they measured,
and the decisions of 2026-10-06.

The review page is `questions/template-editor.html`.
It shows the decided editor and asks nothing;
its last field takes anything the human would change.

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
`4df8e785cc7f5dff97c4d463c8c9358f5787bbff`.
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
`+`,
error lines and typing help),
and `template-editor-scenes.mjs` computes from it every text each state must draw.
A capture whose page draws anything else is refused.
The fixture's own unit task passes with 22 cases.

Two launch options select what is drawn:

- `scene`:
  the authored state.
- `position`:
  `top`,
  or `end` for the page scrolled to its end.
  That scroll is the study's way to show the end of the page,
  not a behaviour of the editor.

While a state holds focus in the field,
the page rests where Android puts a focused field (D94);
the study does not scroll it.
Typing,
moving the caret,
inserting a field and resetting are not connected;
the buttons emit a debug event and change nothing.

The default template is `$tf(mi(len), m:ss)$ $mi(peak)$`.
For the file not analysed yet it yields `5:12` followed by a space,
because plain substitution keeps the text between the formulas (D93).
The hierarchy keeps that space,
and the capture checks it.
The changed template,
`$tc(up, mi(ext))$ · $tf(mi(len), m:ss)$ · $mi(peak)$`,
shows what plain substitution means for a separator:
the second row reads `FLAC · 5:12 ·`.

## Captured cohort and visible boundaries

The cohort is 64 views:
the eight scenes of `template-editor-scenes.mjs` on both Fold panels,
in light and dark,
at 100% and 200% text.
States that hold focus are captured with the system keyboard open;
the others with it closed.

What a view keeps in view is read from the hierarchy,
not judged by eye.
A text that scrolls counts as in view only when its rectangle lies strictly inside the page's scrolling window,
whose lower edge is the keyboard when one is open.
A rectangle that touches an edge is reported as at the edge,
because the hierarchy cannot tell cut from flush.
The page title sits in the header and must be in view in every view.
Hierarchy rectangles are not ink bounds.

Measured,
for the preview,
the field and the lines under it,
with the keyboard open:

- At 100% text everything is in view in all three typing states on both panels.
- At 200% text on the inner panel,
  typing inside a call scrolls the whole preview out of view.
  The help's signature stays in view;
  its sentence and the field's box reach the keyboard.
  With an unknown field the first preview title sits against the header,
  and with either mistake the error line ends flush against the keyboard.
- At 200% text on the cover panel,
  typing inside a call keeps the second preview row,
  with the first one cut at the header,
  and the help's sentence reaches the keyboard.
  Both mistakes keep everything in view.

Those are the costs D94 named when it chose the platform's scrolling.
The field list sits under the field and is mostly out of view while the keyboard is open;
reaching it is the round's next concern.

The view scrolled to the end shows the whole field list and `Reset to default` on the cover panel at 100% text,
and all but the top of the list on the inner panel at 200% text.

## Review and lifecycle

The published crops keep exact RGB,
opacity,
dimensions and only essential PNG chunks;
the status strip is removed and the keyboard and navigation area are kept.
Every view was read in full on a sheet of its panel,
text size and theme before publication:
no system dialog,
notification or keyboard notice is in any of them.
The keyboard shows the emulator image's own suggestions or its tool row;
neither is part of the study.

`verify:template-editor` builds the page and validates it against the views and the reference.
`test:template-editor` proves the builder refuses changed evidence,
a scroll of the study's own on a typing view,
a page that asks a question and a page that quotes a conditional.
Removing each of its four named guards makes that test fail.
An offline browser check in a container bounded to 2 GiB of memory and 2 CPUs opened every embedded view,
prepared replies,
and ran in light and dark at desktop and phone width with no accessibility finding on the closed page.
`questions/evidence/template-editor-review-verification.json` records these results.

No digest of an image is recorded,
and neither the builder nor the review record compares anything with a digest (D88).
The witness manifest states the prototype commit and the APK's digest as provenance only.
The private capture scripts no longer compare the APK's digest either:
the human said on 2026-10-06 that D88 covers them,
and this cohort is the first one captured without it.

The views were captured over three emulator visits on 2026-10-06,
each in a container bounded to 6 GiB of memory and 2 CPUs,
on a host also loaded by other work.
The first ended in a segmentation fault after 25 views,
and the second when a guest command timed out after 12 more;
finished views were kept,
and each view's record names its visit.
The last visit restored the guest's recorded settings and shut down with no container or emulator process left.
`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md` records the crash.

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

The editor's language,
default,
preview placement and scrolling are decided (D89 to D94).
Still open in this round:
reaching the field list while the keyboard is open,
then the questions D81 leaves open,
such as which other rows get a template.
No production parser,
storage or row change is authorized.
