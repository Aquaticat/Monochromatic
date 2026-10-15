# Music player release build measurements (2026-10-15)

## Purpose and scope

`doc/planning/music-player-production-implementation.md` lists the release builds of the music player as unmeasured:
every earlier performance number came from debug or test builds.
This audit measures the published artifacts of release `music-player-v0.1.3`:
the Linux x64 tarball `music-player-0.1.3-linux-x64.tar.gz` for the desktop app,
and `music-player-0.1.3-android.apk` for Android.
Nothing was built, published or released for this audit.
Both artifacts were downloaded with `gh release download`, and `sha256sum --check` against `SHA256SUMS` passed for both.
The desktop binary prints `music-player 0.1.3`.
The APK reports package `dev.monochromatic.musicplayer`, version name `0.1.3`, version code 103, target SDK 36,
and ships native libraries for four ABIs (the emulator uses `x86_64`).
The release APK is not minified (`isMinifyEnabled = false` in `package/music-player/android-app/app/build.gradle.kts`),
so its `Log` calls are present, and it carries a baseline profile (`assets/dexopt/baseline.prof`).

Every library in this audit is invented: adjective and noun names, generated tones, no real artist, album or track.

## Measurement rules used

- A number is reported only with its repeat count and its spread (minimum, median, maximum).
  Every cell below was repeated five times on unchanged input.
- A difference smaller than the spread of the repeats is not reported as a difference.
- The host is shared with other work.
  The one-minute load average at the start of the 85 desktop runs ranged from 4.8 to 32.8, so the spread
  includes host noise, and the maximum of a cell is often a run that started under high load.
- Debug logging and the protocol log change timing, so the timing runs and the instrumented runs are separate sets.

## Desktop method

### Host and tools

- Host: AMD Ryzen 9 7950X, Linux 7.2.9, `nproc` prints 28, session on Wayland, 62 GB of memory.
- Compositor: the repository's `monochromatic-nested-wayland-session` 0.6.0, installed by mise,
  hosting the app fullscreen at 1000 by 800 logical pixels, scale 1, dark scheme, with the compositor's own
  60 Hz frame-callback timer pacing the app (the nested window is minimized in the host session).
  Neither sway nor weston was used.
- Binary: `bin/music-player` extracted from the release tarball into
  `/home/user/temp/agent/relmeasure/app/`, run from there; no interpreter or build tool ran inside the download
  directory.
- Audio: a private PipeWire null sink (`relmeasure_sink`, `PIPEWIRE_NODE`), so nothing reaches the speakers.
  No track was played in any run.
- Isolation: a scratch XDG tree per run (`XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME`),
  and `HOME` left as the real home so that fontconfig finds its existing cache.
  An extra set with an empty `HOME` is reported below because it changes startup.
- Bound: each session is a transient `systemd-run --user --collect --property=MemoryMax=8G` unit holding
  the compositor and the app; the driver itself ran as its own unit with `MemoryMax=10G`.

### Libraries

`/home/user/temp/agent/relmeasure/tools/make-library.ts` writes 0.5 second mono 16-bit 44.1 kHz sine tones with
distinct names.
The tracks are far shorter than real music, which makes analysis per track much cheaper than on a real library.
Claims below about analysis therefore name the per-track and the per-row part separately.
The desktop libraries have one folder `00 Anthology` with half of the tracks and folders of ten tracks for the rest:

- 100 tracks: 6 folders (the folder panel has no overflow, so it cannot scroll).
- 1,000 tracks: 51 folders, a track folder of 500 rows.
- 10,000 tracks: 501 folders, a track folder of 5,000 rows.

### Run kinds

All runs are driven by `/home/user/temp/agent/relmeasure/tools/desktop.ts`, started by `suite.ts`
(repetitions interleaved: for each repetition every size, for each size every kind).

- `cold`: fresh empty XDG tree, plain `RUST_LOG=info`, no protocol log.
  Reads the first-launch timeline, the peak resident memory and the CPU time to the end of analysis.
- `warm`: a copy of an XDG tree seeded by one earlier complete run (peak cache filled, session file removed),
  plain `info`.
  Reads the second-launch timeline, an idle minute and the CPU use during scripted scrolling.
- `debug`: as `warm` with `music_player::controller_refresh`, `ui_screen`, `watch` and `change_plan` at debug level.
  Reads the refresh cost with one file added and removed.
- `wl-cold` and `wl-warm`: as `cold` and `warm`, but the app runs under `WAYLAND_DEBUG=client` and
  `SLINT_DEBUG_PERFORMANCE=refresh_lazy,console`.
  They read the first frame and the commit cadence while scrolling.
  The protocol log was kept out of the timing runs because it prints every message.
- `wl-fd`: `wl-warm` limited to the folder panel scroll in the middle of the 10,000 library (see the folder scroll
  section).
- `cold-emptyhome`: as `cold` with an empty `HOME`, 1,000 tracks only.

### What each metric reads

- Process start is the time stamp of the compositor's log line `spawned hosted client`.
  It agrees with `/proc/<pid>/stat` start time to within 8 ms in every run (range minus 8.3 to plus 6.5 ms).
- Queue projected is the time stamp of the app's own info line `queue projected` (`src/ui_screen.rs`),
  minus process start.
- First frame is the first `wl_surface.commit` of the toplevel surface that follows an `attach` of a buffer
  in the `WAYLAND_DEBUG` log (the log is time stamped in UTC with microseconds, the same clock as the tracing lines).
- Peak resident memory is `VmHWM` from `/proc/<pid>/status`, read once the app had been quiet for 3 seconds
  (CPU ticks unchanged), and again before quitting.
- CPU time is `utime` plus `stime` of `/proc/<pid>/stat`, whose resolution is 10 ms.
  It includes every thread of the process, and none of the compositor.
- Idle minute: 60.0 seconds after the app was quiet, CPU ticks and the sum of voluntary context switches of all threads.
- Scroll cadence: the compositor command `scroll X Y 0 DY steps=60 step-ms=16` is a touchpad two-finger scroll.
  A window is 5 flicks down and 5 flicks back up, about 9.5 seconds.
  The `wl_surface.commit` intervals inside a window come from the protocol log.
  Because the compositor's timer sends frame callbacks every 16.7 ms, a commit interval is
  16.7 ms when the app keeps up and a multiple of it when the app misses a frame.
- Callback to commit: the time from the `wl_callback.done` of the app's own frame callback
  (the one requested on the default queue, not Mesa's) to the next toplevel commit, if that commit follows within
  100 ms.
  It is the app's work for one frame (event handling, layout, drawing calls, buffer swap on the CPU side),
  and excludes GPU execution time and the compositor's own work.
  No GPU time was measured.
- Verification: each scroll window is preceded by one flick with screenshots before and after,
  compared with `magick compare -metric AE`; the number of changed pixels proves the list moved.
  Screenshots of the deep positions were viewed (invented names only).
- Refresh with one file added: the driver copies one tone into the library (`COPYFILE_FICLONE`),
  and later deletes it, four times per run (two in the shown folder, two in a hidden folder).
  The app's own debug line `the list was edited planned_us edited_us settled_us` gives the in-process cost.

### Exact commands

The session unit the driver starts (paths shortened to the scratch root `relmeasure/`):

```bash
# shell: one desktop session, as built by tools/lib.ts
systemd-run --user --unit=relmeasure-warm-1000-r1 --collect --property=MemoryMax=8G \
  --property=StandardOutput=append:relmeasure/runs/warm-1000-r1/app.log \
  --property=StandardError=append:relmeasure/runs/warm-1000-r1/app.log \
  --setenv=WAYLAND_DISPLAY=wayland-0 --setenv=XDG_RUNTIME_DIR=/run/user/1000 --setenv=PIPEWIRE_NODE=relmeasure_sink \
  --setenv=RUST_LOG=info --setenv=HOME=/home/user --setenv=XDG_CONFIG_HOME=relmeasure/runs/warm-1000-r1-xdg/config \
  --setenv=XDG_DATA_HOME=relmeasure/runs/warm-1000-r1-xdg/data \
  --setenv=XDG_CACHE_HOME=relmeasure/runs/warm-1000-r1-xdg/cache \
  --setenv=XDG_STATE_HOME=relmeasure/runs/warm-1000-r1-xdg/state --setenv=PATH=/usr/bin:/bin \
  ~/.local/share/mise/installs/cargo-monochromatic-nested-wayland-session/0.6.0/bin/\
  monochromatic-nested-wayland-session \
  --socket relmeasure/runs/warm-1000-r1/c.sock --size 1000x800 --color-scheme dark --accent-color 3584E4 -- \
  relmeasure/app/music-player-0.1.3-linux-x64/bin/music-player relmeasure/lib-1000
```

The instrumented kinds replace the hosted command with
`/usr/bin/env WAYLAND_DEBUG=client SLINT_DEBUG_PERFORMANCE=refresh_lazy,console <binary> <library>`,
so the protocol log is printed by the app only and never by the compositor.
The matrix:

```bash
# shell: libraries, seeds, then the matrix as its own unit
node tools/make-library.ts --tracks 10000 --out relmeasure/lib-10000
node tools/desktop.ts --seed --mode cold --size 10000 --rep 0
systemd-run --user --unit=relmeasure-suite --collect --property=MemoryMax=10G node tools/suite.ts --reps 5 --first-rep 1
```

Scroll commands sent through the compositor control socket:
`scroll 750 400 0 1200 steps=60 step-ms=16` (track list, flick down, then `-1200` up) and
`scroll 250 300 0 300 steps=60 step-ms=16` (folder panel).
The deep track position is reached with `scroll 750 400 0 DY steps=N step-ms=5` in chunks of 50 logical pixels per
event.

## Desktop results

Every cell: five repeats, minimum, median, maximum.
Times are milliseconds from process start unless stated.

### Start up: first queue and first frame

First launch (fresh XDG tree, real `HOME`), `queue projected`:

- 100 tracks: 150, 159, 297.
- 1,000 tracks: 141, 167, 529.
- 10,000 tracks: 149, 158, 320.

In each cell four of the five runs lie within 141 to 209 ms (the maxima are single runs at high host load),
so size does not change the time to the first projected queue between 100 and 10,000 tracks.
The folder walk itself takes 0.3 ms (100 tracks), 2 ms (1,000) and 15 to 37 ms (10,000, median 16 ms).

Second launch (peak cache present), `queue projected`:
100 tracks 100, 105, 185; 1,000 tracks 101, 114, 139; 10,000 tracks 113, 165, 191.
The same quantity in the instrumented `wl-warm` runs was 98, 108, 242 (100), 101, 114, 155 (1,000) and 123, 133, 292
(10,000):
the protocol log shows no difference larger than the spread.

First frame (the first buffer commit), instrumented runs:

- First launch: 100 tracks 166, 186, 373; 1,000 tracks 194, 198, 601; 10,000 tracks 244, 386, 553.
- Second launch: 100 tracks 127, 140, 290; 1,000 tracks 142, 162, 775; 10,000 tracks 215, 224, 379.

Medians of the first frame minus the queue in the same instrumented set: 31 to 48 ms at 100 and 1,000 tracks,
91 ms (second launch) and 146 ms (first launch) at 10,000 tracks.
The first frame of a first launch at 10,000 tracks (median 386 ms) is later than at 100 tracks (median 186 ms),
but the ranges overlap (244 to 553 against 166 to 373 ms), so the medians differ and the difference is not separated;
the instrumented first launches at 10,000 tracks also ran while the first analysis started.

With an empty `HOME` (1,000 tracks, five runs) `queue projected` took 736 to 1,179 ms (median 745 ms)
against 150 ms with the real home;
two earlier single runs gave 2.6 s and 1.3 s (the latter under `strace`).
A `strace` of the empty-home start shows fontconfig opening font files under `/usr/local/share/fonts`
(for example `monaspace`) because its per-user cache was empty.
This is an effect of the host's font set and cache, not of the library, and is listed under findings only as a method
warning.

### Memory

Peak resident memory (`VmHWM`) once the app was quiet, in MiB:

- First launch: 100 tracks 126, 126, 126; 1,000 tracks 131, 131, 133; 10,000 tracks 155, 156, 158.
- Second launch: 100 tracks 118, 119, 120; 1,000 tracks 121, 122, 123; 10,000 tracks 144, 145, 148.

The last line stays within 3 MiB of its own value at the end of the idle minute and the scrolling (145 MiB at 10,000
tracks),
so scrolling raised the peak by under 3 MiB in every cell.
From 1,000 to 10,000 tracks the second launch grows by 23 MiB (about 2.6 KiB per track).
Memory at 1,000,000 tracks was not measured.

### Cost of the first analysis

From the first queue to the moment the app's CPU stayed unchanged for 3 seconds, first launch:

- 100 tracks: 0.2 to 2.4 s wall (median 0.5 s), CPU 260, 280, 310 ms in total since process start.
- 1,000 tracks: 2.5 to 7.5 s wall (median 3.0 s), CPU 940, 1,040, 1,190 ms.
- 10,000 tracks: 27.1 to 98.8 s wall (27.1, 28.6, 39.7, 97.3, 98.8), CPU 8,090, 10,150, 15,530 ms (five values: 8.1,
  10.1, 10.2, 10.9, 15.5 s).

What the log shows at 10,000 tracks (five runs, the same shape in each):
the warming sweep that measures every track runs for 0.16 to 2.8 s (0.16, 0.80, 0.85, 1.0, 2.8 s);
all 10,000 `measured; upsert queued` lines (debug level, one extra run) are logged within the first 10 seconds;
then nothing is logged until a second sweep starts: 3.5, 20.7, 34.2, 71.4 and 90.1 s after the first sweep ended in the
five runs (79.7 and 114.3 s in two extra runs with more logging), and that second sweep finishes in 9 to 15 ms
because every track is already exact.
The wait is not CPU bound: the two slowest runs were the two with the lowest host load at their start (7.4 and 5.1).
During the wait two threads of the app used 4.6 ticks per second each (about 5 percent of a core each),
and the process I/O counters read 187 MB of `write_bytes` after 22 s for a library whose measured
results are 10,000 rows.
Taken together this is a database write queue draining at 2.7 to 9.9 ms per row,
with the measuring finished in under 2 s.
The tracks here are 0.5 s long, so the measuring was cheap; the per-row write cost does not depend on track length.
What the window does during the drain was not measured (scroll cadence was measured only on second launches).

### Idle minute

Second launch, after load, 60 seconds with no input, five repeats per size:

- CPU time: 10 to 30 ms in the minute (median 20 ms) at every size, which is under 0.05 percent of one core.
- Voluntary context switches, summed over all threads: 960 to 1,080 in the minute at every size.
- Resident size at the end: 118 to 120, 121 to 123 and 144 to 148 MiB for 100, 1,000 and 10,000 tracks.

CPU time since process start when the app went quiet on a second launch:
130, 130, 190 ms (100 tracks), 250, 280, 280 ms (1,000), 1,260, 1,280, 1,630 ms (10,000).

### Scrolling the track list

Instrumented runs, a window of 10 flicks, five repeats per cell.
Frames per second counts toplevel commits: 59.0 to 60.0 in every cell below, which is the compositor's 60 Hz timer.

Top of the list (rows 1 to about 20, after a reset to the top):

- 100 tracks (50 rows): commit interval median 16.7 ms, 99th percentile 17.9, 18.2, 24.4 ms;
  callback to commit median 1.5, 1.7, 3.2 ms and 99th percentile 2.6, 2.9, 8.9 ms;
  CPU 16.0, 18.0, 27.3 percent of one core.
- 1,000 tracks (500 rows): interval 99th percentile 18.0, 18.2, 18.6 ms;
  callback to commit median 1.8, 2.1, 2.2 ms, 99th percentile 3.1, 3.4, 3.8 ms; CPU 18.2, 20.9, 22.1 percent.
- 10,000 tracks (5,000 rows): interval 99th percentile 18.5, 18.7, 19.3 ms;
  callback to commit median 2.8, 3.2, 3.9 ms, 99th percentile 4.9, 5.0, 6.1 ms; CPU 26.1, 27.9, 35.0 percent.

Deep in the list (a jump with chunked scroll events; the 5,000-row list landed near row 1,555, viewed on a screenshot,
and the 500-row list was checked only by the changed-pixel count of 5,234 to 9,223 between flick screenshots):

- 1,000 tracks: interval 99th percentile 17.8, 17.9, 19.0 ms; callback to commit median 1.6, 1.9, 2.1 ms,
  99th percentile 2.8, 3.2, 4.8 ms; CPU 16.4, 19.0, 21.5 percent.
- 10,000 tracks: interval 99th percentile 18.6, 18.9, 19.5 ms; callback to commit median 2.8, 3.4, 3.6 ms,
  99th percentile 4.6, 5.6, 5.9 ms; CPU 26.1, 30.6, 32.9 percent.

Missed frames: intervals over 20 ms numbered 0 to 4 per window in every cell except one run at the top of the
100-track list, which had 52 of them (its longest interval was 28 ms and none exceeded 34 ms).
An interval over 34 ms appeared in at most one window per cell, in the 10,000-track cells only
(a longest interval of 160 ms at the top of that library in one run, and 68 ms deep in another).
The verification screenshots changed 5,200 to 10,600 pixels in every cell that scrolls.

Reading: the app commits at the compositor's 60 Hz pace with a 99th-percentile frame interval of 18 to 19 ms
at all three sizes, so the list never fell behind 60 Hz in the median or the 99th percentile run.
The app's work per frame grows with the list: the median callback to commit rose from 1.7 ms (50 rows) to
2.1 ms (500 rows) to 3.2 ms (5,000 rows), and the CPU use in the window rose from 18 to 21 to 28 percent of a core
(2.6, 3.5 and 4.6 ms of CPU per committed frame in the timing set, taken as CPU percent divided by 60 frames per
second).
All of it stays far under the 16.7 ms budget, so the growth costs power, not smoothness, in this setup.

### Scrolling the folder panel

- 100 tracks: 6 folders fit in the panel; the flick changed 0 pixels, so there is nothing to scroll.
  The window's CPU (1.0 to 2.0 percent) is the pointer hover only.
  Not measurable.
- 1,000 tracks (51 folders, top of the panel): interval 99th percentile 17.8, 17.9, 40.6 ms;
  callback to commit median 1.2, 1.4, 6.2 ms; CPU 9.7, 11.0, 18.6 percent.
  One run of five missed 130 intervals (over 20 ms) and 19 intervals over 34 ms, at 53.8 frames per second;
  the other four had 0 to 1 and 0.
- 10,000 tracks (501 folders), top: interval 99th percentile 18.3, 18.7, 19.0 ms;
  callback to commit median 2.6, 2.7, 3.1 ms; CPU 19.9, 20.7, 23.1 percent.
- 10,000 tracks, middle of the panel (reached with 10 down flicks, five `wl-fd` repeats; the verification flick changed 15,716 to 15,757 pixels, so the panel
  was scrolling and not at its end):
  interval 99th percentile 18.2, 19.0, 22.1 ms; callback to commit median 2.5, 2.7, 2.9 ms;
  CPU 19.0, 21.1, 22.3 percent; 0 to 9 intervals over 20 ms and 0 to 2 over 34 ms.

The folder panel costs the app 2.5 to 3 ms per frame at 10,000 tracks against 1.4 ms at 1,000, in the same way as the
track list.
In the timing set (`warm`) the same window read 15.2, 18.3, 23.2 percent at the top of the 10,000 panel;
the `warm` window "folder deep" for 10,000 tracks is not used: it landed on the end of the panel (347 changed pixels,
nothing scrolled) because a first attempt to jump by one large scroll step is scaled non-linearly by the client.

### Refresh with one file added

The app notices a changed file through its watcher, waits 500 ms for changes to settle, then edits the list in place.
Five runs of four cycles each (add and remove, shown folder and hidden folder), medians over the five runs:

- The settle wait from the file's creation to the app's `the named paths are planned` line: 500 to 502 ms at
  every size.
  It is a fixed design delay, not work.
- In-process cost from the app's own line (`planned_us`, `edited_us`, `settled_us`), shown folder, one file added:
  100 tracks 32, 37, 85 microseconds (medians of the three values);
  1,000 tracks 36, 46, 360 microseconds (range of `settled_us` 335 to 485);
  10,000 tracks 46, 97, 3,761 microseconds (range of `settled_us` 2,865 to 6,584).
  A removal reads 33, 35, 85 (100), 37, 43, 393 (1,000) and 41, 75, 2,927 (10,000) microseconds.
  A hidden folder reads the same within the spread.
- From the planned line to `warming sweep finished` for the new track: 2 to 4 ms at 100 and 1,000 tracks, 5 to 8 ms at
  10,000
  (millisecond resolution of the log lines).
- CPU of the whole process around one added file (10 ms ticks, including a 700 ms observation tail): 10 to 30 ms (100
  tracks),
  30 to 40 ms (1,000), 160 to 240 ms (10,000) for the shown folder,
  and 0 to 10, 10 to 20 and 60 to 100 ms for a hidden folder.

One added file therefore costs the process 180 ms of CPU at 10,000 tracks (median, shown folder), about five times the
cost at 1,000 tracks, although the in-process list edit is under 4 ms.
The remainder is outside the `controller_refresh` timers: the `search_feed` lines
(`library feed started ... installed from the side`) bracket it in the log, and nothing here separates them from the
projection.

### Projection cost

The app's debug line for the library screen reports `view_ms` and `total_ms`:
the largest value in a second-launch run was 0 to 1 ms at 100 and 1,000 tracks and 8 to 13 ms (view) and 8 to 14 ms
(total)
at 10,000 tracks (debug set, five repeats per size).

## Android method

### Device

- Emulator 37.2.12.0 with the system image `system-images;android-37.0;google_apis_playstore_ps16k;x86_64`
  (Android 17, API 37, 16 KiB pages, build `google/sdk_gphone16k_x86_64/emu64xa16k:17/CE2A.260420.050`).
  The guest has 4 GB of memory and 4 cores (`-memory 4096 -cores 4`).
  It is the Pixel 9 Pro Fold AVD, in the OPENED posture (`dumpsys device_state`): the app drew on the inner display
  (2076 by 2152 pixels, 60 Hz, display 0) in its two-pane layout for every run.
- Launch form from the section "Working agent launch: headful, host GPU, no container" of
  `doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`: headful, `-gpu host`,
  its own `systemd-run --user` unit with `MemoryMax=12G`, a private reflink copy of the owned AVD
  (`cp --archive --reflink=always`, ini path rewritten, stale locks removed), its own `HOME`,
  emulator ports 5842 and 5843 and adb server port 5857.
  No `-no-window`, no `xvfb-run`, no container.
  The owned AVD was only read: its files carry the modification times of 4 and 13 October after the audit.
- No `wm size` or `wm density` was run, and no setting was changed except `svc power stayon true`
  (to keep the screen on).
  Seven settings were recorded first (screen-off timeout, stay-on, three animation scales, font scale, IME hint)
  and restored in the last session.
  The restore step has a defect of this audit's driver: it wrote the recorded stay-on value (1) and then ran
  `svc power stayon false`, so the final value read 0.
  Only the private copy, which was then discarded, carried it.
- Graceful shutdown in the last session: `sync`, 8 seconds, `sync`, `adb emu kill`; the unit left the active states.

### Emulator crashes

The emulator process died twice with `SIGSEGV` in `qemu-system-x86_64` (`coredumpctl` entries 2569769 and 302782),
the first after 1 h 3 min 54 s and the second after 19 min 49 s of the unit's life, both during the 10,000-track
scroll runs,
with `glestranslator ... error null ctx` lines in the journal before each.
This is the known gfxstream crash recorded in the troubleshooting document.
Each was followed by a relaunch from a fresh copy (two relaunches, the allowed maximum), and the third emulator ran
to a graceful shutdown.
The driver was changed between sessions only to add counters (provider exceptions and garbage collections per scroll
window,
and a scroll-only mode); the third session ran 1,000-track scroll windows and the idle counts.
Data from before a crash is kept (every completed run is one record); a run in progress at a crash was lost,
and both crashes began with a `no scrollable node found` failure of the driver when the guest was gone.

### Libraries and the app

- `make-library.ts --shape flat` writes one folder `00 Anthology` with 1,000 or 10,000 tones of 0.5 s into
  `/sdcard/Music/` with `adb push` (11 s and 185 to 194 s), then
  `content call --uri content://media/ --method scan_volume --arg external_primary`.
  The media store held 1,000 and 10,000 audio rows before each run.
- The debug build on the owned AVD copy was removed with `pm uninstall`; the release APK was installed fresh
  (`adb install`, signed with the release key) and `READ_MEDIA_AUDIO` and `POST_NOTIFICATIONS` were granted with
  `pm grant`.
  The first-launch rows below follow a fresh install.

### Run kinds

All driven by `tools/android.ts` (phases `setup`, `size`, `teardown`).

- Cold sweep: `am force-stop`, `pm clear` and `pm grant`, `logcat -c`, `am start -W -n .../.MainActivity`,
  then the app's own logcat lines (`logcat -d -v epoch -s PeakSweep:I`) between
  `PeakSweepService indexing N tracks` and `PeakSweepService indexed N of N tracks`.
  Throughput is N divided by that interval.
  The release build is not minified, so these lines are present; no `Log` call is stripped.
  `dumpsys meminfo` was sampled about every 2.5 s during the sweep and for 8 s after it.
- Warm start: `am force-stop`, 4 s, `am start -W`; the sweep ledger and peak cache hold every track.
  `TotalTime` is the time to the first frame of the activity, not to a loaded library.
- Scroll: `am force-stop`, start, 10 s wait, `uiautomator dump` to find the largest scrollable node
  ([1038,253][2076,2152], the track list on the right), `dumpsys gfxinfo <package> reset`, then 8 times
  `input swipe X 1772 X 633 250`, 0.6 s, `input swipe X 633 X 1772 250`, 0.6 s (X is the node's centre), then
  `dumpsys gfxinfo`.
  "Top" starts at the list head; "deep" first runs 20 swipes down.
  The window is about 17 s and each repeat starts from a fresh process.
  Frame times from `gfxinfo` have a resolution of 1 ms, so a percentile reads as a whole number of milliseconds.
- Idle foreground: the app in the foreground with no input for 15 s, counting the media provider's
  `Invalid column last_modified` log lines (see the findings).

### Exact commands

```bash
# shell: private AVD copy, headful launch, install, library, one cold sweep, one scroll window
cp --archive --reflink=always pixel9-fold-fresh-5FXdOc/avd/Pixel9ProFold_Fresh_5FXdOc.avd relmeasure/emu-3/avd/
systemd-run --user --unit=relmeasure-emulator-3 --collect --property=MemoryMax=12G \
  --setenv=DISPLAY=:0 --setenv=WAYLAND_DISPLAY=wayland-0 --setenv=HOME=relmeasure/emu-3/home \
  --setenv=ANDROID_AVD_HOME=relmeasure/emu-3/avd --setenv=ANDROID_ADB_SERVER_PORT=5857 \
  ~/Android/Sdk/emulator/emulator -avd Pixel9ProFold_Fresh_5FXdOc -ports 5842,5843 -no-snapshot -no-audio \
  -no-boot-anim -gpu host -camera-back none -camera-front none -memory 4096 -cores 4 -no-metrics
adb -s emulator-5842 uninstall dev.monochromatic.musicplayer
adb -s emulator-5842 install relmeasure/download/music-player-0.1.3-android.apk
adb -s emulator-5842 push relmeasure/alib-10000/Music/. /sdcard/Music/
adb -s emulator-5842 shell pm clear dev.monochromatic.musicplayer
adb -s emulator-5842 shell am start -W -n dev.monochromatic.musicplayer/.MainActivity
adb -s emulator-5842 logcat -d -v epoch -s PeakSweep:I
adb -s emulator-5842 shell dumpsys gfxinfo dev.monochromatic.musicplayer reset
adb -s emulator-5842 shell dumpsys gfxinfo dev.monochromatic.musicplayer
node tools/android.ts --attempt 3 --phase size --size 1000 --reps 5 --parts scroll
```

## Android results

### Cold sweep and its throughput

Cold sweep after `pm clear` (the first-launch row is a fresh install):

- 1,000 tracks, 5 runs: 2.04, 2.16, 2.19 s (min, median, max; first launch after install: 2.19 s);
  456, 464, 490 tracks per second (min, median, max).
- 10,000 tracks, 10 runs over two emulator sessions: 17.7 to 19.2 s (median 18.4 s), 521, 545, 564 tracks per second
  (first launches after install: 18.6 s and 21.1 s, 539 and 474 tracks per second).

Analysis of 0.5 s tracks is about 17 percent faster per track at 10,000 tracks than at 1,000 (medians 545 and 464);
the spreads do not overlap.
Real-length tracks cost more, so this is a throughput for tiny files, not an estimate for a real library.

### Memory

- Sampled peak PSS (`TOTAL PSS` of `dumpsys meminfo`, maximum over the samples of a cold sweep, 6 to 11 samples per
  run):
  1,000 tracks 79.9, 80.6, 83.5 MiB (5 runs); 10,000 tracks 87.0, 93.8, 102.9 MiB (10 runs).
  This is a sampled maximum, not a true peak.
- Sampled peak RSS from the same dumps: 197.1, 197.7, 200.1 MiB (1,000) and 211.0, 217.6, 228.7 MiB (10,000).
- `VmHWM` from `/proc/<pid>/status` (a true peak) at the end of the cold window: 213.5, 216.2, 223.2 MiB (1,000) and
  227.5, 235.3, 240.8 MiB (10,000).
- `VmHWM` at the end of a scroll window (all work since process start): 229 to 254 MiB (1,000, 20 runs, median 241)
  and 264 to 291 MiB (10,000, 17 runs, medians 284 and 286 for top and deep).
- PSS read once after a scroll window: 74.0 to 80.6 MiB (1,000) and 85.4 to 102.0 MiB (10,000).

### Start time

`am start -W` `TotalTime` in milliseconds, minimum, median, maximum:

- Cold start after `pm clear` (sweep running): 1,000 tracks 208, 222, 237 (5 runs); 10,000 tracks 169, 202, 260 (10
  runs).
- First launch after a fresh install: 229 ms (1,000 tracks); 287 and 197 ms (10,000 tracks, two sessions).
- Start after a force stop with every cache filled: 1,000 tracks 185, 215, 264 (5 runs); 10,000 tracks 161, 188, 229
  (10 runs).

The spreads overlap between the two sizes in every row, so library size shows no effect on the time to the first frame.

### Scroll frames

`gfxinfo` since `reset`, one scripted scroll window per repeat.
Frames counts the frames rendered in the window; janky is the count `gfxinfo` reports as missing the frame deadline.

1,000 tracks, top, ten runs (five in the first session, five in the last): janky 7, 4, 15, 9, 7 and 128, 7, 11, 12, 16,
of 724 to 838 frames; 99th percentile 16 ms in nine runs and 44 ms in the run with 128 janky frames,
which was the first run on a fresh emulator at host load 23.
1,000 tracks, deep, ten runs: janky 1, 1, 1, 1, 12 and 1, 11, 1, 9, 118; 99th percentile 16 ms in nine runs and
31 ms in the run with 118 janky frames, the last run of the last session, whose 99th percentile of GPU time was 4,950
ms.
Eighteen of the 20 windows at 1,000 tracks have 1 to 16 janky frames (0.1 to 1.9 percent) among 817 to 838 frames.

10,000 tracks, top, 11 runs over two sessions: janky 115, 14, 116, 8, 13, 31, 9, 17, 6, 117, 115;
frames 731, 823, 735, 827, 825, 793, 827, 816, 827, 731, 741.
10,000 tracks, deep, 6 runs: janky 143, 139, 10, 143, 5, 139; frames 706, 707, 823, 706, 829, 708.
Eight of the 17 windows at 10,000 tracks have 115 to 143 janky frames and 706 to 741 frames,
the other nine have 5 to 31 janky frames and 793 to 829 frames.
The one-minute host load before every 10,000-track window was 4.9 to 8.2, so host load does not separate the two groups.
In the 8 slow windows the 99th percentile still reads 16 ms (20 ms in one), because most janky frames miss the deadline
by a small margin (`Number Slow issue draw commands` was 56 to 143 in those windows).
In those windows 16 to 20 percent of frames missed the deadline, against 0.1 to 1.9 percent in 18 of 20 windows at
1,000 tracks, which is a measured difference of behaviour at the larger size.
The reason was not established; the provider exceptions below do not separate the groups
(in six diagnostic windows with 48,000 to 117,000 provider log lines each, one window with 65,000 lines was in the
normal group).

### Idle foreground and the media provider

Over 15 seconds with the app in the foreground and no input, five runs per size:
1,000 tracks 0, 0, 0, 0, 0 provider exceptions;
10,000 tracks 1,005, 776, 773, 989 and 772 in run order (772 to 1,005).
During one 10,000-track scroll window of about 17 s the count was 1,232.
Each exception is logged by the media provider process with a stack of about forty lines
(`Writing exception to parcel`, `IllegalArgumentException: Invalid column last_modified`), which is how a 17-second
window
carries 48,000 to 117,000 `DatabaseUtils` log lines.
The only code in the app source that asks for the column `last_modified` is `queryLastModifiedMs` in
`package/music-player/android-app/app/src/main/kotlin/dev/monochromatic/musicplayer/TrackFingerprint.kt`
(`DocumentsContract.Document.COLUMN_LAST_MODIFIED`), whose own comment says the media store lacks that column
and that the query is expected to throw; `TrackFingerprint.of` is called from `TrackMeasures.kt` (line 169),
`RustEngine.kt` (line 812) and `PeakSweep.kt` (line 257).
With the app stopped the log carried none of these lines in 15 seconds.
What the app does that repeats the call 50 to 70 times a second at 10,000 tracks and never at 1,000 was not established.
App CPU time during this idle state was not measured.

### Comparison with the handover's debug numbers

The handover records frame percentiles of the Fold emulator with 10,000 invented tracks (99th percentile 400, 450 and
109 ms before
a fix and 69, 53 and 48 ms after) taken in windows with the sweep, refresh and playback work active, and a sweep wait
to the first supporting line
(3.5 to 4.5 s).
The release windows here are scripted scrolls on a finished library with no playback.
The setups do not match, so no comparison is made.
The same holds for the handover's main-thread CPU per track change, which was not repeated.

## Findings worth acting on

1. First analysis at 10,000 tracks on the desktop spends 27 to 99 s (median 40 s) of wall time, and 8.1 to 15.5 s of
   CPU,
   after the measuring sweep itself finished in 0.2 to 2.8 s.
   The log shows the 10,000 results queued within 10 s and the second sweep starting 3.5 to 90.1 s after the first
   ended,
   with two threads at about 5 percent of a core each and 187 MB of `write_bytes` after 22 s.
   The slowest runs were the quietest hosts.
   The per-row write cost does not depend on track length, so a real library of the same size pays it too.
   The write queue (the peak cache actor in `package/music-player/desktop-app/src/peakcache_service.rs`) is where to
   look first;
   the window's behaviour during the drain was not measured.
2. The Android app queries the media store for a column it lacks, over and over, at 10,000 tracks:
   772 to 1,005 provider exceptions per 15 s idle, and none at 1,000 tracks.
   The caller is `queryLastModifiedMs`; whatever drives it repeatedly at the larger size needs finding.
   Each failure costs a binder round trip and a forty-line log stack in another process.
3. At 10,000 tracks about half of the Android scroll windows (8 of 17) had 16 to 20 percent of frames over the deadline.
   At 1,000 tracks 18 of 20 windows had 0.1 to 1.9 percent; the other two (118 and 128 janky frames) came in the last
   session,
   one on a fresh emulator at host load 23 and one with a GPU stall of 4,950 ms, so they are not counted as app
   behaviour.
   Cause not established; the next step is a trace (`perfetto` or `simpleperf`) of a slow window against a normal one.
4. One added file costs the desktop process 180 ms of CPU at 10,000 tracks (median, shown folder) against 35 ms at
   1,000,
   while the app's own list edit is under 4 ms; the difference is outside the timed edit (search feed install,
   projection).
   It matters only with the handover's million-track target, and a direct measurement at that size is missing.
5. The desktop track list's work per frame grows with the number of rows (median callback to commit 1.7 ms at 50 rows,
   2.1 ms at 500, 3.2 ms at 5,000; 99th percentile 2.9, 3.4, 5.0 ms), which stays far under the frame budget.
   This is a trend to watch, not a defect.

No measured number showed a regression in idle cost (10 to 30 ms of CPU a minute at every size), in start up
(median first projected queue 158 to 167 ms at every size on the desktop, 161 to 287 ms to the first Android frame),
or in memory (145 MiB peak at 10,000 tracks on the desktop).

## What was not measured

- GPU execution time of a frame: no GPU counter was read.
- Any desktop number at 1,000,000 tracks, the handover's normal operating scale.
- Analysis of real-length tracks: the invented tracks last 0.5 s.
- The window and the scroll cadence during the 21 to 99 s analysis drain at 10,000 tracks.
- Sound output and playback: the null sink only, no track played (desktop), and no playback at all on Android.
- Android on a real device: the emulator's host GPU path is the only renderer measured, and its two crashes cost
  windows.
- Android app CPU at idle with 10,000 tracks (the repeated media store queries), and a trace of a slow scroll window.
- Android first-frame time of the library list (`TotalTime` ends at the activity's first frame), and the Android search,
  playback queue and notification costs.
- Android at 100,000 or 1,000,000 tracks.
- macOS, Windows, arm64, musl and X11 builds.
- A real touchpad or mouse: the compositor injects pixel scroll events.
