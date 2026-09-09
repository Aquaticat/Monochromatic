# Music player design

Design source and decision record for the shared Android and desktop music player interface.
The work targets the Pixel 9 Pro Fold first while preserving one Material Design 3 identity across
Jetpack Compose and Slint.

This package contains exploratory Design Components,
rendered comparisons,
device metrics,
settled decisions,
and the active handover.
It does not describe shipped application behaviour unless a decision explicitly says it has been implemented.

## Start here

Read these files in order:

1. [`HANDOFF.md`](HANDOFF.md)
2. [`review-notes.md`](review-notes.md)
3. [`decisions.md`](decisions.md)
4. [`open-questions.md`](open-questions.md)
5. [`md3-tokens.md`](md3-tokens.md)
6. [`material-3-compliance.md`](material-3-compliance.md)
7. [`device-metrics.md`](device-metrics.md)
8. [`candidates.md`](candidates.md)

## Design questionnaire

The active design round applies the standing true-black dark requirement while following
Android dynamic color.
 It preserves accepted option 3B,
 transport 1B,
 strict adaptive
mode behavior,
 and the completed accessibility decisions.
 The native Compose matrix
compares meaningful dynamic-role strategies across representative wallpaper palettes at
the target's opaque 2076 × 2152px panel resolution.

The preceding accessibility review settled pane-by-pane TalkBack traversal (F1) and
structured current-track speech (S1).
 The prototype repairs the adaptive mode control as
one four-item radio list at one row,
 2×2,
 and four rows;
 reduced motion forbids
autonomous or decorative motion.

The preceding accepted scale review covers every font scale exposed by the target Android
Settings UI:
 0.85,
 1.0,
 1.15,
 1.30,
 1.50,
 1.80,
 and 2.0.
 The mode
group uses one content-sized row at 85%,
 2×2 from 100% through 130%,
 and four
rows from 150% through 200%.
 Every segment retains at least 12dp horizontal content
padding.
 The `Shuffle` cell caps longer subdirectory names at rendered `Camellia`
width with a middle ellipsis while retaining the full accessibility name.

Each round embeds its visual evidence,
 option assessments,
 recommendation,
 and answer
controls in one file.
 The file is rendered and interaction-checked before it is opened in
Helium.
 Android evidence comes from a non-functional Jetpack Compose prototype
installed on the target emulator,
 not from CSS redraws.
 The active prototype is
preserved on `prototype/music-player-theme-compose`.

After each correction,
answer,
decision,
candidate,
or verification result,
update [`HANDOFF.md`](HANDOFF.md) immediately.
Do not defer the handover update until the end of a session.

## Historical source

The imported archive remains represented by the original root documents,
`candidates/`,
`screenshots/`,
`uploads/`,
and the bound Material Design 3 files under `_ds/`.
Historical candidates remain evidence for prior decisions,
including rejected directions.

## License

Repository-authored work is licensed under the
[GNU Lesser General Public License, version 3 or later](../../../LICENSE).
The imported Material Design 3 recreation documents its source and attribution requirements in
[`_ds/material-design-3-design-system-503c3571-4db9-4b54-8695-7f53861f5059/readme.md`][].

[`_ds/material-design-3-design-system-503c3571-4db9-4b54-8695-7f53861f5059/readme.md`]:
  _ds/material-design-3-design-system-503c3571-4db9-4b54-8695-7f53861f5059/readme.md
