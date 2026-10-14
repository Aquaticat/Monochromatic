# @monochromatic-dev/dev-script-claude-cpu-cap

Caps the CPU use of Claude Code tool commands and records CPU temperature, power and fan samples on this host.
The operating notes (what the limits mean, how to tone the cap down or up) are in
`doc/runbook/claude-cpu-cap.md`; the evidence behind the settings is in
`doc/handover/claude-cpu-cap-and-thermal-watch.md`.

## What is in the package

- `src/cpu-watch.ts`: the watcher, run as the user unit `claude-cpu-watch.service`.
- `src/summarize-samples.ts`: Tctl per package-power bucket from the sample log.
- `src/analyze-episode.ts`: medians, minima and maxima of every sample column between two UTC times.
- `systemd/claude-cpu-watch.service`: the unit; `ExecStart` runs `src/cpu-watch.ts` from this checkout.

## Install

The unit file in `~/.config/systemd/user/` is a symlink to the file in `systemd/`, so edits here reach the host
after a daemon reload and a restart:

```bash
# systemd/claude-cpu-watch.service is the single source of the unit.
ln --symbolic --force "${HOME}/Monochromatic/package/dev-script/claude-cpu-cap/systemd/claude-cpu-watch.service" \
  "${HOME}/.config/systemd/user/claude-cpu-watch.service"
systemctl --user daemon-reload
systemctl --user restart claude-cpu-watch.service
```

## State that stays on the host

These files hold machine state, not source, so they are not in the repo:

- `~/.config/claude-cpu-cap/threads`: the current thread cap, one integer from 1 to 32.
- `~/.config/claude-cpu-cap/cc-token`: the CoolerControl access token (owner-only permissions).
- `~/.local/share/claude-cpu-cap/samples/`: the CSV sample log, 14 days kept.
