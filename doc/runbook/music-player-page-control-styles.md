# Configure music-player page-control styles in a build

## What this proves

Android and desktop each have one centralized catalog line per page-control style.
Changing only `includedInBuild` in Kotlin and `included` in Rust removes or restores that style in Settings,
resolves disabled persisted selections safely,
and preserves stable persisted values `0` through `5`.

No GUI bridge is involved.
The Android and Rust/Slint builds cannot share one compile-time source token,
so the configuration has one matching line per platform.

## Setup

Status:
TODO

Use a clean checkout of this repository with `mise` and package dependencies installed.
Run commands from repository root.
Keep at least one page-control style included on each platform.
Do not renumber enum variants or edit `to_int` and `from_int` mappings.

The Android catalog is the enum declaration in
`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PageControlStyle.kt`.
Each variant has `includedInBuild = true` or `includedInBuild = false`.

The desktop catalog is `BUILD_STYLES` in
`package/music-player/desktop-app/src/ui_page_style.rs`.
Each entry has `included: true` or `included: false`.

## Steps

Status:
TODO

1.  Change only `includedInBuild` on the chosen Android style line.
    `true` includes the style and `false` excludes it.
    The enum name,
    label,
    and declaration order remain unchanged.
2.  Change only `included` on the matching desktop `BUILD_STYLES` line.
    Use the same Boolean selected for Android.
    The `PageControlStyle` variant,
    label,
    and catalog order remain unchanged.
3.  Inspect both catalogs and confirm each still contains at least one `true` value.
    A build with no included style is invalid.
4.  Run `mise run //package/music-player/android-app:test:unit`.
    The command exits successfully after testing Settings filtering and disabled-style fallback.
5.  Run `mise run //package/music-player/android-app:lint:detekt`.
    The command exits successfully without a Detekt diagnostic.
6.  Run `mise run //package/music-player/desktop-app:test`.
    The summary includes `ui_page_style::tests` and reports no failed test.
7.  Run `mise run //package/music-player/desktop-app:lint:slint`.
    The command exits successfully without a Slint diagnostic.
8.  Run `mise run //package/music-player/desktop-app:lint:rust`.
    The command exits successfully without a Rust-linter diagnostic.

## What to check

Status:
TODO

Run:

```sh
rg --line-number 'includedInBuild = (true|false)' \
  package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PageControlStyle.kt
rg --line-number 'included: (true|false)' \
  package/music-player/desktop-app/src/ui_page_style.rs
```

Confirm both outputs list the same six choices in stable order:

- radio controls,
  persisted value `0`
- multi-row MD1 tabs,
  persisted value `1`
- rounded buttons,
  persisted value `2`
- segmented buttons,
  persisted value `3`
- Chromium-like tabs,
  persisted value `4`
- Super fun LED segmented buttons,
  persisted value `5`

Confirm excluded styles are absent from Settings.
A persisted excluded style resolves first to included Chromium-like tabs,
then included radio controls,
then the first included stable style.
An unknown persisted value still decodes to radio before build-availability resolution.

## Restore

Status:
TODO

1.  Run `git diff -- package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/PageControlStyle.kt`.
    Record the original Android Boolean values shown by the diff.
2.  Run `git diff -- package/music-player/desktop-app/src/ui_page_style.rs`.
    Record the original desktop Boolean values shown by the diff.
3.  Restore only the changed `includedInBuild` and `included` Boolean literals to their recorded values.
    Both catalogs again match their pre-runbook availability.
4.  Repeat the commands in **What to check**.
    The six stable entries remain in the same order and both platforms expose matching choices.
