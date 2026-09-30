# Search filename-presentation frontier

## Purpose and scope

The user accepted D75 to D80's accessibility design direction and asked
for the next design-only work.
This investigation checks filename presentation before manufacturing
another visual questionnaire.
Search A,
E2's information clearance,
the inner folder browser and complete deck stay selected.
No production Search,
matcher selection,
new IME study or original-AVD change is authorized.

File-extension presentation remains open.
Neither the extensionless Search fixture nor existing player code is a
new user preference.

## Source audit

### Ordinary-player source retains filename suffixes

Android's
`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/core/Pagination.kt`
function `rowDisplay` constructs the active folder's slash-terminated
prefix and removes only that prefix.
It does not strip a filename extension.
`MainActivity.kt`'s track row passes `item.name` to `rowDisplay` and paints
the returned text with single-line ellipsis.

Desktop's
`package/music-player/desktop-app/src/pagination.rs`
function `row_display` also removes only the folder label followed by a
slash.
Its documented example changes `Ado/B/C.opus` to `B/C.opus`.
That preserves `.opus`.

These are source observations,
not a new installed-player test or proof that the selected designs have
been implemented.
They establish a filename-preserving incumbent to test,
not authority to select Search's appearance.

### D11 is a distinct Settings design

D11 shows `Another Xronixle` instead of
`かめりあ(Camellia) - Another Xronixle.flac`
when the common-prefix setting is on.
The subject is the Settings control;
the example illustrates a shortened filename label.
It does not separately define Search extension visibility,
an extension parser or the match field.
Directory-prefix removal,
artist-prefix shortening and extension presentation are distinct
operations.
Preserve D11 rather than treating current code as its implementation or
silently adding a global extension switch.

### Search evidence uses illustrative names

The debug linked worktree's `SearchRankingFixture.kt` supplies literal
`Cam` and `Camellia Waltz` titles without source filenames.
Its same-title example distinguishes parents,
`Camellia` and `Cult of Luna`.
It does not exercise `Cam.flac` and `Cam.mp3` in one parent.

The selected Search row renderers allow enlarged titles and supporting
context to wrap.
They are not equivalent to the ordinary player's single-line ellipsis.
The source audit alone therefore cannot establish the appearance or
cost of retaining suffixes in Search.

`search-matching-acceptance-ledger.md` already separates rendered
extensions from extension-only eligibility and exactness.
This round does not choose whether `flac` generates a hit or how `cam`
is scored against `Cam.flac`.

## Consequential cases

- Same-folder `Cam.flac` and `Cam.mp3` must be distinguishable before
  activation.
  Parent context alone cannot distinguish them.
- Long equal stems with different suffixes test whether wrapping or
  truncation hides the distinguishing information.
- Equal filenames under different parents need useful parent paths,
  not only the same leaf folder label.
- A folder named `Camellia.flac` keeps its literal folder name.
  Track presentation must not infer item kind from a dot.
- Extensionless,
  uppercase-suffix,
  multi-dot,
  dot-prefixed and Unicode filenames need explicit examples.
  A suffix is filename text,
  not proof of the encoded audio format.
- Any collision-sensitive design needs a known source/query scope.
  Currently visible rows cannot establish uniqueness;
  filtered,
  later-arriving or off-screen partners must not silently change identity.

## Verified fixture preparation

The debug linked worktree added synthetic complete-filename labels in
short,
long and edge scenes without changing the selected row renderers.
These strings are not actual media files or indexed results.
Prototype commits are `1cbbba772` and `1ff1d135a`.
The host-JVM `SearchFilenameFixtureTest` report records 5 tests,
zero failures,
zero errors and zero skips.
The unknown-scene test failed when the guard was replaced by a short-scene
fallback;
restoring the exact source restored the passing test run.
The rebuilt debug APK SHA-256 is
`9fade97bc256c4597d14833bb01d9058aa1f65cfec4502debddbd3cb51b11983`.

The successful build used the existing package's `prototype:build` task
through `mise run --skip-tools` in a 6 GiB/2 CPU container.
The initial container failed while trying to resolve/install unrelated
root tools;
read-only installed tools and plugins plus the explicit skip flag
reached the package task.
No dependency was selected or installed by the filename work.
Build and unit tests are preparation,
not native label evidence.

A later display positive control repaired the label study's container
bridge;
`doc/troubleshooting/fedora-44-xvfb-run-auto-display.md` records why a
successful `/usr/bin/true` did not prove Xvfb readiness.
The actual display control passed before the new disposable boot.
`podman inspect` reports `6442450944` memory bytes and `2000000000`
NanoCPUs for `fold-search-filename-avd`.
The first display control did not establish GLX readiness.
An explicit driver-directory override enabled GLX and the disposable
Android boot;
the troubleshooting document separates that recovery from a System UI
dialog that blocked the first capture.
Neither failed attempt supplied accepted filename evidence.

## Inspected native witnesses

Internal task 136 produced 24 keyboard-closed views:
short,
long and edge labels across both panels,
100% and 200% text,
light and dark.
The [witness manifest][filename-manifest] records every expected matrix
combination,
the installed APK digest,
selected scene,
measured panel dimensions and retained crop.
These are synthetic complete-filename strings,
not actual media files or indexed results.

The retained app-area crops are 2076 × 2016 pixels for inner and
1080 × 2273 pixels for cover.
Only the top system-status strips were removed;
bottom navigation remains.
Every crop was inspected,
its retained RGB bytes matched its native frame,
and native/published opacity and PNG chunk checks passed.
A separately changed PNG was rejected by the same retained-pixel
verifier.
Raw frames and hierarchies remain private.

### What the captured states show

- Both `Cam.flac` and `Cam.mp3` visibly retain their distinguishing
  suffixes with identical supporting parent context.
- Both long equal-stem titles retain `.flac` or `.mp3` visibly.
  At 200% text,
  each title takes four lines inner and three lines cover.
  All rows in these fixture lists fit without scrolling.
- The dotted folder remains `Camellia.flac`,
  with a folder glyph and `Folder` label.
  The uppercase,
  multi-dot,
  dot-prefixed,
  Unicode and extensionless examples remain literal.
- The inner views retain the folder region and complete deck;
  cover views remain full width without an added deck.

Inspect the [inner long-name witness][inner-long] and
[cover long-name witness][cover-long] at 200% text for the observed
wrapping and visible suffixes.
The manifest links the complete matrix.

This establishes the tested labels in their captured states,
not universal filename legibility,
unchanged result capacity,
comparative superiority,
activation,
spoken output or focus behavior.
No extension-visibility preference was adopted.

## Remaining comparison evidence

Internal task 137 assesses whether incumbent advice or a consequential
visual comparison is supported.
The native matrix alone does not isolate the suffix's contribution to
wrapping or compare presentation alternatives.
Matched ordinary-player and Search baselines remain unrendered,
as do equal complete filenames under ancestors sharing a leaf-folder
label.
Before recommending,
add a matched ordinary-player rendering and equal complete filenames
under different ancestor paths sharing a leaf-folder label.
Stable frames and hierarchy text are capture prerequisites,
not proof that distinguishing suffixes or parent paths are visible.
Inspect rendered labels and add scrolled witnesses where needed.
Unchanged row-renderer code does not imply unchanged wrapping,
row heights or visible-result capacity.
If needed,
extension visibility and placement remain separable choices.
No hide/show preference is selected by this source audit.
TalkBack,
activation,
focus transitions and keyboard-open behavior remain outside its proof.

[filename-manifest]: ../questions/evidence/search-filename-witnesses.json
[inner-long]: ../questions/evidence/search-filename-inner-long-dark-s200.png
[cover-long]: ../questions/evidence/search-filename-cover-long-dark-s200.png
