# music-player-desktop-e2e

Keyboard end-to-end runner for the desktop music player.
It hosts the release binary of `package/music-player/desktop-app` in a nested Wayland compositor,
presses every shortcut as a real key event through the compositor's control socket,
and reads what happened from the app's own `ui_state` log lines,
 from screenshots,
 from files and from the nested clipboard.

## Run it

The desktop app's task builds the release binary and then calls this package's command:

```sh
# shell
mise run //package/music-player/desktop-app:test:e2e
```

The command can also run alone against an existing release build.
It looks for `target/release/music-player` in the current directory,
 or in the directory named by `--app-dir`:

```sh
# shell, from the repository root
node package/music-player/desktop-e2e/src/cli.ts --app-dir package/music-player/desktop-app
```

The output has one `PASS`,
 `FAIL` or `SKIP` line per check,
 then a table and a summary such as
`74 passed, 0 failed, 5 not injectable; 57.3 s`.
The command exits with a non-zero status when a check fails or a safety stop ends the run.
Run it alone:
 it refuses to start while another run of this suite is active.

## What the suite needs

- A graphical session (`WAYLAND_DISPLAY`) for the nested compositor to open its window in.
- PipeWire with `pw-dump` and `pactl`,
   a systemd user session with `systemd-run` and `systemctl`,
   `pgrep`,
   ImageMagick (`magick`),
   and `wl-paste`.
- The nested compositor `monochromatic-nested-wayland-session` at version 0.3.0,
   installed through mise.
  The version is pinned because the control API and the key names were probed on it.
  It answers `unknown key` for F5,
   F10 and Menu,
   which is why five checks are recorded as not injectable.

## Isolation

- Audio goes only into a private PipeWire null sink that the run creates and unloads.
  After playback starts,
   every output stream of the app is looked up by process id in the PipeWire graph;
  a link to any node other than the private sink ends the run at once with a safety stop.
- The compositor and the app run inside a transient systemd user unit per session,
   named `music-player-e2e-<pid>-<label>`.
  The app process is found by its control group,
   so another `music-player` process,
   such as your own player,
   is never matched.
  The runner signals no process by id or by name;
   sessions end through the compositor's `quit` and the unit.
- The run refuses to start while any `music-player-e2e-*` unit is active.
- Every session gets scratch XDG directories,
   a stub `xdg-open` and a scratch trash,
   under the scratch root.

## Environment

- `E2E_ONLY`:
   a check id or group prefix to run alone,
   such as `seek` or `row/delete`.
- `E2E_OUT`:
   where screenshots and `e2e-summary.json` go;
   default `target/e2e` in the app directory.
- `E2E_TMP`:
   scratch root;
   default `temp/agent/music-player-e2e` under the home directory,
   created with mode 0700.
- `E2E_LIBRARY_GENERATOR`:
   path of the library generator script that materializes the one-thousand-track library;
   default `temp/agent/agent-scale/make-scale-library.ts` under the home directory.
   That script is not part of this repository,
   and its name corpus is a private file;
   it is the one input of the suite that still lives outside the repository.
   When the file is absent,
   the run builds a fallback library of the same shape in `src/library.ts`:
   thirty loose files,
   one artist folder of thirty short tracks between the two tone folders,
   and the tone folders themselves.
   The full suite passes with the fallback (74 checks and 5 not injectable),
   so the suite needs no out-of-repository input.

## Layout

- `src/cli.ts` is the command:
   it reads `--app-dir` and the environment,
   runs the suite,
   and fails the command when checks fail.
- `src/run.ts` checks the preconditions,
   builds the scratch library,
   creates the sink,
   runs the sessions the filter selects,
   and writes the report.
- `src/session.ts`,
   `src/session-launch.ts` and `src/control.ts` start a session in its own unit and drive the compositor.
- `src/ui-state.ts`,
   `src/ui-state-log.ts` and `src/log-scan.ts` read the app's state from its log.
- `src/pipewire.ts` holds the null sink and the routing proof.
- `src/recorder.ts`,
   `src/report.ts` and `src/selection.ts` record outcomes,
   print the table and summary,
   and apply the filter.
- `src/wide-*.ts`,
   `src/narrow-session.ts`,
   `src/dialog-session.ts`,
   `src/quit-session.ts` and `src/visual-session.ts` are the scenarios.
  Each check is declared where it runs,
   with its id (`group/name`) and title.

## Tasks

```sh
# shell
mise run //package/music-player/desktop-e2e:test:unit
mise run //package/music-player/desktop-e2e:lint
mise run //package/music-player/desktop-e2e:lint:types
```

The unit tests cover everything that needs no display:
 the log parser,
 the filter,
 the scenario table (every check id belongs to a session the filter reaches,
 and the suite keeps 74 checks and 5 not-injectable ones),
 the command lines sent to the compositor,
 the routing proof with allowed and rejected graphs,
 the unit and process guards,
 the report and the summary file.
The scenarios and the session start-up run only in the real end-to-end run.
