# nested-wayland-session 0.6.0: a fixed-size parent changes desktop E2E geometry

## Symptom

The Depot desktop runtime harness used a 1920 by 1080 software parent display.
The authored wide session requested 1000 by 800 and used fixed pointer coordinates,
but its retained screenshot was 1920 by 1080.
Native run `xdlnfpwhzz` and desktop run `7x5lk9dx9q` each emitted 60 passing,
nine failing,
and one skipped assertions before the suite stopped with:

```text
CheckFailureError: timed out waiting for the folder of thirty tracks shown in the track pane
```

The remaining configured sessions did not execute.
This geometry defect is established independently of the cause of each pointer or text assertion failure.

## Root cause

At harness `9f4a01f699f09abb25f10258455ac0faed0ecae8`,
`package/dev-script/task-util/mise.toml:694` started an additional software parent with this argument fragment:

```typescript
// package/dev-script/task-util/mise.toml, historical trial harness
'--size', '1920x1080'
```

The authored child launcher passed its session's requested size to the selected compositor.
For the wide session,
`package/music-player/desktop-e2e/src/layout.ts:15` defines:

```typescript
// package/music-player/desktop-e2e/src/layout.ts
export const WIDE_WINDOW = {
  width: 1_000,
  height: 800,
} as const;
```

The parent is a fixture compositor that deliberately fills its screen with the hosted toplevel.
`package/cli/nested-wayland-session/src/handler/xdg_shell.rs:98` sets fullscreen state:

```rust
// package/cli/nested-wayland-session/src/handler/xdg_shell.rs
state.states.set(xdg_toplevel::State::Fullscreen);
```

The same helper at line 114 assigns the parent's logical screen size:

```rust
// package/cli/nested-wayland-session/src/handler/xdg_shell.rs
state.size = Some((geometry.logical_width, geometry.logical_height).into());
```

The module explicitly ignores client move and resize requests.
Consequently,
nesting the E2E compositor inside this fixed-size parent changes its output geometry.
The wide test's Search target remains `x: 911` in `layout.ts:75`,
while the retained screenshot places the Search button near the right edge of the 1920-pixel output.
Successful command injection does not establish that a pointer reached the intended widget.
The current evidence does not assign every text-input failure to this geometry mismatch.

## Verification

The immutable source revisions were
`cb95cf6d785c3073c192b95f0632cdae7b910894`
and `3434eaa455d569c18b52cf15100f77f9db251d21`.
The locked published compositor reports version `0.6.0` and has ELF SHA256
`3ced1113988238dc40b9826265aed4c7f620db3f610971b6e47d9e24953ba6e3`.

The evidence field `desktopRuntimePublishedCompositorControl` in
`../audit/depot-final-recovery-2026-10-17.evidence.json`
retains PNG header dimensions and hashes,
all assertion identities,
actual compositor selection lines,
resource counters,
cleanup results,
artifact hashes,
and provider metadata.
Both screenshots are 1920 by 1080.

The working catalog includes application startup,
keyboard checks,
and verified private-audio and process cleanup.
The failing catalog includes pointer and text assertions followed by the uncaught folder-setup assertion.
These runs produced no final E2E summary and provide no coverage credit for later sessions.

## Verified workarounds

The corrected trial wrapper adds `--headless --gpu software` to the locked published executable,
allowing each authored session to own its requested output size.
Local invocation controls verify version and help probes,
argument preservation with quotes and newlines,
an application argument named `--version`,
nonzero child exit propagation,
and missing-binary failure.
A disposable wrapper with the headless arguments removed fails the argument control.
These controls verify the wrapper contract only.
Actual E2E geometry and assertion outcomes remain pending the cloud consumer control.

The tradeoff is an intentional change from a parent-window backend to a headless software backend.
Source commands,
check bodies,
filters,
and safety guards remain unchanged.
This route does not establish the behavior of a nested compositor under an ordinary desktop parent.

## What does not work

- Raising the private service and slice task limits crossed the thread-creation failure boundary,
  but did not correct the display geometry.
- Replacing the source-built inner compositor with the locked published binary changed the actual consumer path,
  but preserved every one of the 70 assertion identity/status pairs.
- Treating the resulting assertion failures as source-product failures before verifying display geometry
  would omit a measured harness defect.

## Upstream filing artifact

Existing [issue #1007](https://github.com/Aquaticats/Monochromatic/issues/1007)
already tracks this nested-route pointer and text failure boundary.
Its prior direct-headless success is a route workaround,
not proof of a coordinate-transform or text-protocol root cause.
The new retained geometry evidence belongs in an additive comment on that issue.
No separate external upstream filing is needed for this repository-owned harness defect.
