# Fold vertical music-player page controls

Issue [#457](https://github.com/Aquaticat/Monochromatic/issues/457) requests that page controls in vertical
layouts show one row by default and expand through a leading disclosure control.
The issue's first reference shows the narrow desktop player.
Its second reference fixes the disclosure placement and down-chevron treatment.

The user confirmed this contract on August 28, 2026.

## Scope

Apply folding to:

- the desktop layout while `AppWindow.width < 900px`;
- the Android app while the device is in portrait orientation;
- radio, MD1, rounded, segmented, Chromium, and LED page-control styles.

Keep the desktop wide layout and Android landscape layout unchanged.

## Collapsed behavior

- Show exactly one complete row of page controls.
- Keep page labels in source order.
- Let the row scroll horizontally.
- Automatically position the row so the selected page is visible.
- Show no partial second row.
- Show no disclosure control or leading gap when every page control fits.

When controls overflow,
show one neutral rounded disclosure control at the leading edge.
Use a down-chevron while collapsed and an up-chevron while expanded.
Android must reserve an explicit `48dp` by `48dp` target.
Expose the accessibility label `Show all pages` or `Show fewer pages` according to state.

## Expanded behavior

Pressing the disclosure control reveals every wrapped control row in place.
Page selection leaves the controls expanded.
Only another disclosure press collapses them.
The state change is instant.

Expansion is transient player-view state.
A new launch starts collapsed,
and no session field persists it.
During one running app,
retain expansion across desktop breakpoint changes,
Android orientation changes,
and page-control style changes.
On Android,
`rememberSaveable` treats configuration or process recreation inside the retained task as the same running app.
A new task starts from the declared collapsed default,
and no preference or session field stores expansion.

## Verification contract

Exercise these boundaries before closing the issue:

- desktop narrow overflow and no-overflow layouts;
- desktop wide layout after narrow expansion;
- Android portrait overflow and no-overflow layouts;
- Android landscape after portrait expansion;
- every included page-control style;
- a selected page outside the initial visible subset;
- horizontal scrolling in the collapsed strip;
- disclosure semantics and Android target bounds;
- the installed Android artifact on the connected Pixel 6.

Run the owning desktop and Android package checks through their `mise` tasks.
Keep unrelated working-tree changes in `mise.toml` and `pnpm-lock.yaml` untouched.

## Verification evidence

Desktop checks passed:

- `lint:slint` compiled `ui/app.slint`;
- `lint` completed `cargo check`;
- `lint:rust` completed the repository Rust linter;
- `test` passed all 95 tests, including every style, disclosure semantics,
  no overflow, selected-tab reveal, and narrow-to-wide state retention.

The headless Slint MCP boundary rendered a `480px` by `600px` window.
The collapsed screenshot showed one Chromium row with the leading down-chevron.
The expanded screenshot showed every row with the up-chevron.
Selecting the final `Zulu` page and collapsing positioned its complete tab body at the strip's trailing edge.
A horizontal drag changed the visible subset while preserving source order.

`lint:clippy` is not a change regression.
Both fixed baseline `310d9dea2` and the implementation reported the same 175 existing
`clippy::implicit_return` errors in unchanged production Rust files.
No changed desktop source emitted a Clippy diagnostic.

Android checks passed:

- `test:unit` compiled the Compose UI and passed host-JVM tests;
- `lint:detekt` passed Kotlin documentation and method-length checks;
- `lint` passed Android Lint;
- `run:release` rebuilt both native ABIs, installed the release APK,
  and launched it on Pixel 6 `1C171FDF600KWW`.

The production release showed one collapsed LED row in portrait and automatically brought selected page `A` into view.
The disclosure semantics were `Show all pages` and `Show fewer pages` in the matching states.
UI Automator measured its bounds as `107px` by `107px` at the device's `356dpi` override,
which is approximately `48.1dp` by `48.1dp`.
A horizontal swipe changed the visible collapsed subset.
Expansion showed every LED row in place.
Landscape showed the existing fully wrapped control without a disclosure.
Returning to portrait retained expansion,
and the final release was left collapsed with rotation restored to `lock 0`.

A disposable debug-only gallery rendered collapsed and expanded radio,
MD1,
rounded,
segmented,
Chromium,
and LED controls from production composables.
Every collapsed style brought selected `Hotel Mastering` into view.
UI Automator measured its text bounds within the `1080px` display for every style:
leading edges ranged from `610px` to `678px`,
and trailing edges ranged from `1000px` to `1035px`.
The screenshots confirmed the complete selected control was inside the visible strip rather than merely present in semantics.
A one-page Chromium fixture rendered `Only page` without a disclosure or leading gap.
The gallery neither read nor wrote the player's saved page-control preference,
and its throwaway worktree was removed after verification.

Android target provisioning hit a rustup client connection failure during this work.
The independently verified recovery is recorded in
`doc/troubleshooting/rustup-android-target-download-connect-abort.md`.
