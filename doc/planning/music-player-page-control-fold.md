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
