# Slint under-the-hood libraries

This audit lists notable libraries Slint uses internally beyond `taffy` for layout and `winit` for
window creation.
It reflects the `slint-ui/slint` repository snapshot cloned on 2026-06-29,
 whose workspace version was
`1.17.1`.
Most entries are conditional on Cargo features,
 target platform,
 or selected backend.

All Slint source paths below are relative to the upstream `slint-ui/slint` repository.

## Default Rust crate shape

The Rust `slint` crate default features include `backend-default`,
 `renderer-femtovg`,
`renderer-software`,
 `accessibility`,
 and `system-tray`.
The crate documentation says the default backend is Winit with FemtoVG.

Evidence:

- `api/rs/slint/Cargo.toml:23`
- `api/rs/slint/Cargo.toml:138`
- `api/rs/slint/Cargo.toml:139`

## Layout and geometry

- `taffy`:
   flexbox layout and layout tree support.
- `euclid`:
   geometry types and coordinate math.

Evidence:

- `internal/core/Cargo.toml:153`
- `internal/core/Cargo.toml:109`

## Paths and vector geometry

- `lyon_path`,
   `lyon_geom`,
   `lyon_algorithms`,
   `lyon_extra`:
   path representation,
  geometry,
   and algorithms used by core path support,
   the compiler,
   and renderers.

Evidence:

- `internal/core/Cargo.toml:94`
- `internal/core/Cargo.toml:110`
- `internal/compiler/Cargo.toml:70`
- `internal/renderers/femtovg/Cargo.toml:36`
- `internal/renderers/skia/Cargo.toml:46`

## Windowing, event loop, and platform integration

- `winit`:
   default desktop window and event-loop backend.
- `raw-window-handle`:
   raw window/display handles.
- `glutin`,
   `glutin-winit`:
   OpenGL context setup for Winit renderer paths.
- `windows`:
   direct Windows API bindings.
- `objc2` and related Objective-C framework crates:
   macOS and iOS integration.
- `wasm-bindgen`,
   `web-sys`:
   browser and WebAssembly integration.

Evidence:

- `internal/backends/winit/Cargo.toml:78`
- `internal/backends/winit/Cargo.toml:79`
- `internal/backends/winit/Cargo.toml:105`
- `internal/backends/winit/Cargo.toml:106`
- `internal/backends/winit/Cargo.toml:119`
- `internal/backends/winit/Cargo.toml:139`
- `internal/backends/winit/Cargo.toml:100`
- `internal/backends/winit/Cargo.toml:101`

## Rendering

### FemtoVG renderer

The default GPU renderer uses:

- `femtovg`:
   2D vector graphics renderer.
- `glow`:
   OpenGL bindings.
- Optional `wgpu`:
   WGPU-backed FemtoVG renderer path.

Evidence:

- `api/rs/slint/Cargo.toml:192`
- `internal/renderers/femtovg/Cargo.toml:38`
- `internal/renderers/femtovg/Cargo.toml:42`
- `internal/renderers/femtovg/Cargo.toml:23`
- `internal/renderers/femtovg/Cargo.toml:44`

### Skia renderer

The optional Skia renderer uses:

- `skia-safe`:
   Rust bindings for Skia.
- `glow` and `glutin`:
   OpenGL paths.
- `ash`,
   `vulkano`:
   Vulkan paths.
- `raw-window-metal`,
   `objc2-metal`,
   and related `objc2` crates:
   Apple Metal paths.
- `windows`,
   `windows-core`:
   Direct3D and DXGI paths on Windows.
- Optional `wgpu` version tracks exposed through unstable Slint features.
- `softbuffer`:
   software fallback in the Skia renderer where enabled.

Evidence:

- `api/rs/slint/Cargo.toml:196`
- `internal/renderers/skia/Cargo.toml:52`
- `internal/renderers/skia/Cargo.toml:53`
- `internal/renderers/skia/Cargo.toml:55`
- `internal/renderers/skia/Cargo.toml:56`
- `internal/renderers/skia/Cargo.toml:72`
- `internal/renderers/skia/Cargo.toml:74`
- `internal/renderers/skia/Cargo.toml:80`
- `internal/renderers/skia/Cargo.toml:86`
- `internal/renderers/skia/Cargo.toml:30`
- `internal/renderers/skia/Cargo.toml:32`
- `internal/renderers/skia/Cargo.toml:68`

### Software renderer

Slint's software renderer uses:

- `bytemuck`:
   pixel and byte conversions.
- `swash`,
   `skrifa`:
   font scaling and font data access.
- `zeno`:
   path evaluation.
- `integer-sqrt`,
   `num-traits`,
   `euclid`:
   numeric and geometry helpers.
- `softbuffer`:
   window-surface presentation through the Winit backend.

Evidence:

- `internal/renderers/software/Cargo.toml:42`
- `internal/renderers/software/Cargo.toml:47`
- `internal/renderers/software/Cargo.toml:48`
- `internal/renderers/software/Cargo.toml:49`
- `internal/renderers/software/Cargo.toml:44`
- `internal/renderers/software/Cargo.toml:45`
- `internal/backends/winit/Cargo.toml:50`
- `internal/backends/winit/Cargo.toml:90`

### Qt backend

The optional Qt backend renders and integrates through Qt,
 with Rust/C++ bridge helpers:

- `cpp`,
   `cpp_build`:
   C++ bridge and build integration.
- `qttypes`:
   Qt type bindings.
- `lyon_path`,
   `pin-project`,
   `pin-weak`:
   supporting Rust-side helpers.

Evidence:

- `api/rs/slint/Cargo.toml:161`
- `internal/backends/qt/Cargo.toml:32`
- `internal/backends/qt/Cargo.toml:36`
- `internal/backends/qt/Cargo.toml:39`

## Text, fonts, and Unicode

- `fontique`:
   shared font loading and font selection.
- `parley`:
   shared text layout.
- `skrifa`:
   font data access.
- `swash`:
   font scaling and rasterization paths.
- `unicode-segmentation`,
   `unicode-linebreak`,
   `unicode-script`:
   Unicode text behavior.
- `icu_normalizer`:
   Unicode normalization.
- `sys-locale`,
   `chrono`:
   locale and date/time support.

Evidence:

- `internal/common/Cargo.toml:32`
- `internal/core/Cargo.toml:133`
- `internal/core/Cargo.toml:139`
- `internal/core/Cargo.toml:140`
- `internal/core/Cargo.toml:128`
- `internal/core/Cargo.toml:129`
- `internal/core/Cargo.toml:130`
- `internal/core/Cargo.toml:131`
- `internal/core/Cargo.toml:132`
- `internal/core/Cargo.toml:144`

## Images, SVG, and Markdown

- `image`:
   PNG and JPEG by default,
   with optional default image formats.
- `resvg`:
   SVG rendering and raster images.
- `pulldown-cmark`,
   `htmlparser`:
   Markdown support in common code.

Evidence:

- `Cargo.toml:167`
- `internal/core/Cargo.toml:135`
- `internal/compiler/Cargo.toml:79`
- `Cargo.toml:174`
- `internal/core/Cargo.toml:138`
- `internal/compiler/Cargo.toml:80`
- `internal/common/Cargo.toml:36`
- `internal/common/Cargo.toml:37`

## Accessibility

- `accesskit`,
   `accesskit_winit`:
   accessibility tree integration for Winit backends.

Evidence:

- `api/rs/slint/Cargo.toml:78`
- `internal/backends/winit/Cargo.toml:57`
- `internal/backends/winit/Cargo.toml:108`
- `internal/backends/winit/Cargo.toml:109`

## Clipboard, menus, and system tray

- `copypasta`:
   clipboard integration.
- `muda`:
   native menu support on macOS and Windows through the Winit backend selector.
- `ksni`:
   Linux/BSD system tray integration.
- `async-channel`:
   async channel support used with the Linux/BSD system tray path.

Evidence:

- `internal/backends/winit/Cargo.toml:110`
- `internal/backends/winit/Cargo.toml:97`
- `internal/backends/selector/Cargo.toml:99`
- `api/rs/slint/Cargo.toml:86`
- `api/rs/slint/Cargo.toml:87`
- `internal/core/Cargo.toml:88`
- `internal/core/Cargo.toml:168`
- `internal/core/Cargo.toml:169`

## Linux KMS backend

The Linux KMS backend,
 used without a windowing system,
 includes:

- `input`:
   libinput bindings.
- `xkbcommon`:
   keyboard handling.
- `calloop`:
   event loop support.
- `libseat`:
   optional seat/session management.
- `drm`,
   `gbm`:
   direct rendering manager and generic buffer manager support.
- `glutin`:
   EGL context integration.
- `nix`,
   `memmap2`:
   Linux system-call and memory-map helpers.

Evidence:

- `api/rs/slint/Cargo.toml:211`
- `api/rs/slint/Cargo.toml:212`
- `internal/backends/linuxkms/Cargo.toml:42`
- `internal/backends/linuxkms/Cargo.toml:43`
- `internal/backends/linuxkms/Cargo.toml:44`
- `internal/backends/linuxkms/Cargo.toml:45`
- `internal/backends/linuxkms/Cargo.toml:48`
- `internal/backends/linuxkms/Cargo.toml:49`
- `internal/backends/linuxkms/Cargo.toml:50`
- `internal/backends/linuxkms/Cargo.toml:46`
- `internal/backends/linuxkms/Cargo.toml:53`

## Android backend

The Android backend includes:

- `android-activity`:
   native or game activity integration.
- `jni`:
   Java Native Interface support.
- `ndk`:
   Android NDK and raw-window-handle integration.

Evidence:

- `api/rs/slint/Cargo.toml:217`
- `internal/backends/android-activity/Cargo.toml:20`
- `internal/backends/android-activity/Cargo.toml:21`
- `internal/backends/android-activity/Cargo.toml:32`
- `internal/backends/android-activity/Cargo.toml:33`
- `internal/backends/android-activity/Cargo.toml:34`
- `internal/backends/android-activity/Cargo.toml:37`
- `internal/backends/android-activity/Cargo.toml:38`

## Compiler and code generation

The `.slint` compiler and code generators use:

- `rowan`:
   syntax tree infrastructure.
- `smol_str`:
   compact string storage.
- `icu_normalizer`,
   `unicode-segmentation`:
   Unicode processing.
- `quote`,
   `proc-macro2`:
   Rust code generation.
- `annotate-snippets`:
   diagnostic rendering.
- `image`,
   `resvg`,
   `swash`,
   `skrifa`,
   `rayon`:
   image and font processing for embedded assets.
- `serde`,
   `serde_json`,
   `flate2`,
   `base64`:
   Python and generated-data support paths.
- `data-url`,
   `url`:
   URL and data URL handling.

Evidence:

- `internal/compiler/Cargo.toml:61`
- `internal/compiler/Cargo.toml:62`
- `internal/compiler/Cargo.toml:64`
- `internal/compiler/Cargo.toml:65`
- `internal/compiler/Cargo.toml:67`
- `internal/compiler/Cargo.toml:68`
- `internal/compiler/Cargo.toml:69`
- `internal/compiler/Cargo.toml:79`
- `internal/compiler/Cargo.toml:80`
- `internal/compiler/Cargo.toml:82`
- `internal/compiler/Cargo.toml:83`
- `internal/compiler/Cargo.toml:87`
- `internal/compiler/Cargo.toml:94`
- `internal/compiler/Cargo.toml:95`
- `internal/compiler/Cargo.toml:96`
- `internal/compiler/Cargo.toml:97`
- `internal/compiler/Cargo.toml:98`

## Translations and localization

- `gettext-rs`:
   optional gettext support.
- `tr`:
   optional translation runtime support.
- `rspolib`:
   translation bundling in the compiler.
- ICU locale crates:
   decimal separator and locale data support.

Evidence:

- `api/rs/slint/Cargo.toml:50`
- `internal/core/Cargo.toml:156`
- `internal/core/Cargo.toml:149`
- `internal/compiler/Cargo.toml:42`
- `internal/compiler/Cargo.toml:89`
- `internal/common/Cargo.toml:38`
- `internal/common/Cargo.toml:39`
- `internal/common/Cargo.toml:40`

## Live preview and development tooling

The optional live preview stack uses:

- `notify`:
   file watching.
- `lsp-types`:
   protocol types.
- `tokio`,
   `tokio-tungstenite`,
   `futures-util`:
   async remote preview transport.
- `postcard`,
   `base64`,
   `serde`,
   `serde_json`:
   protocol serialization.
- `mdns-sd`,
   `getifs`,
   `hostname`:
   discovery and host/network identification.
- `dashmap`,
   `anyhow`,
   `tracing`:
   runtime support.

Evidence:

- `internal/live-preview/Cargo.toml:18`
- `internal/live-preview/Cargo.toml:19`
- `internal/live-preview/Cargo.toml:24`
- `internal/live-preview/Cargo.toml:30`
- `internal/live-preview/Cargo.toml:31`
- `internal/live-preview/Cargo.toml:32`
- `internal/live-preview/Cargo.toml:33`
- `internal/live-preview/Cargo.toml:34`
- `internal/live-preview/Cargo.toml:35`
- `internal/live-preview/Cargo.toml:36`
- `internal/live-preview/Cargo.toml:37`
- `internal/live-preview/Cargo.toml:39`
- `internal/live-preview/Cargo.toml:42`

## Caveats

- This is not a complete Cargo dependency tree.
  It is a subsystem-oriented list of notable direct dependencies visible in Slint's manifests.
- Many libraries are feature-gated.
  A small embedded build,
   a default desktop build,
   a Skia build,
   and a Qt build link different sets.
- Several target-specific crates appear only on Windows,
   Apple platforms,
   Linux,
   Android,
   or Wasm.
- Direct dev-only dependencies were not counted as core under-the-hood libraries.
