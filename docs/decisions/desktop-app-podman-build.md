# Desktop app builds run in podman

## Decision

All cargo work for `packages/desktop-app/terminal` and `packages/desktop-app/music-player` runs inside a Fedora podman
container (see each package's `Containerfile` and `mise.toml`).
This covers build, check, clippy, test, and the `format:clippy` autofix task.
The host is an immutable-style Fedora without C development headers, so cargo cannot build these crates directly.

The two packages depend on native toolchain and system C libraries that the host lacks:

- terminal: Zig 0.15.x (`libghostty-vt-sys` compiles vendored Ghostty), plus `gcc`, `pkgconf`, `fontconfig-devel`,
  `freetype-devel`, and the Slint winit/femtovg runtime stack (`mesa`, `wayland`, `libxkbcommon`).
- music-player: `clang` and `clang-devel` (libclang for the bindgen step in `libspa-sys`), `pipewire-devel`, `opus-devel`,
  `pkgconf`, `fontconfig-devel`, and `freetype-devel`.

Clippy is not exempt from the container.
`cargo clippy` is a check-build: it compiles and executes each crate's `build.rs` and `-sys` bindings, so it needs the
same native dependencies as a full build.
Verified on 2026-06-02 that the host has no `zig`, no `clang`, and neither `libpipewire-0.3` nor `opus` (via
`pkg-config --exists`).

## Rejected alternatives

Manage the native dependencies with mise (including its conda backend) and build on the host.
Rejected.

mise versions tool and runtime binaries, not system C development libraries with headers and pkg-config `.pc` files.
It can supply the toolchain pieces (`core:zig` offers 0.15.2, `core:rust` covers the compiler), but not
`pipewire-devel`, `opus-devel`, or the `*-devel` header packages.

The conda backend was evaluated separately because it self-bootstraps:
it downloads packages directly from anaconda.org and needs no conda, mamba, or micromamba installed.
It can install some pieces (`conda:clang`, and `conda:libopus` at 1.6.1).
It is still rejected for two reasons:

- `pipewire` is not packaged on conda-forge at all.
  `mise ls-remote conda:pipewire` returns nothing, and `api.anaconda.org/package/conda-forge/pipewire` returns 404,
  so music-player's `pipewire` and `libspa-sys` dependencies cannot be satisfied this way.
- Even for the pieces conda can supply, wiring `-sys` crates to conda libraries means putting `PKG_CONFIG_PATH` and
  `LIBCLANG_PATH` into mise `[env]`.
  That is unofficial, unsupported usage and dirty, and conda-forge libraries (built against conda's own sysroot) risk a
  glibc and ABI mismatch against a rustup host toolchain.

## Consequence

Cargo tasks for both packages run via `mise run //packages/desktop-app/<app>:<task>`, which shell out to
`podman run ... cargo ...` against the package's prebuilt image and a named cargo-cache volume.
The `format:clippy` task adds `--allow-no-vcs` because only the package directory is bind-mounted at `/work`, so the
repo-root `.git` is not visible and `cargo fix` would otherwise refuse to run.
The binaries are built in the container but run on the host Wayland and PipeWire session;
the run task installs the host-facing binary and desktop metadata.
