# xdg-terminal-exec

TypeScript replacement for the [reference POSIX shell implementation](https://github.com/Vladimir-csp/xdg-terminal-exec) of the proposed Default Terminal Execution Specification.

## Motivation

The reference implementation ignores desktop environment settings.
On KDE Plasma, users configure their default terminal in System Settings,
which writes `TerminalService` to `~/.config/kdeglobals`.
The reference script does not read `kdeglobals`, falling back to scanning all `.desktop` entries
with `Categories=TerminalEmulator` -- often selecting the wrong one.

This implementation adds a **KDE `kdeglobals` fallback**: when no `xdg-terminals.list` config
explicitly lists a terminal, `TerminalService` from `kdeglobals` is consulted before the
category-based fallback scan.

## Resolution order

1. Explicit entries from `xdg-terminals.list` config files (desktop-specific variants checked first)
2. KDE `TerminalService` from `~/.config/kdeglobals` (when no explicit entries exist)
3. All `TerminalEmulator`-category desktop entries as fallback

## Usage

```sh
xdg-terminal-exec [options] [--] [command [args...]]
```

**Options:**

- `--app-id=VALUE` -- set the terminal window app ID / class
- `--title=VALUE` -- set the terminal window title
- `--dir=VALUE` -- set the working directory
- `--hold` -- keep the terminal open after the command finishes
- `--` or `-e` -- delimiter between options and the command

**Examples:**

```sh
# Open default terminal
xdg-terminal-exec

# Open terminal running a command
xdg-terminal-exec bash -l

# Open terminal with title and working directory
xdg-terminal-exec --title="Build logs" --dir=/tmp -- tail -f build.log
```

## Configuration

Create `~/.config/xdg-terminals.list` to explicitly set preferred terminals:

```
com.mitchellh.ghostty.desktop
org.kde.konsole.desktop
```

First valid entry wins. Entries listed here bypass `OnlyShowIn`/`NotShowIn` checks.

### Excluding entries from fallback

Prefix an entry ID with `-` to prevent it from appearing in the fallback scan:

```
-vscodium-pod-shell.desktop
```

## Desktop entry X-TerminalArg fields

Terminal `.desktop` files declare how to pass arguments via `X-TerminalArg*` keys:

- `X-TerminalArgExec` -- how to pass a command (`-e`, `--`, `execute`)
- `X-TerminalArgTitle` -- how to set window title (`--title=` or `--title`)
- `X-TerminalArgAppId` -- how to set app ID (`--class=` or `--class`)
- `X-TerminalArgDir` -- how to set working directory (`--working-directory=`)
- `X-TerminalArgHold` -- how to keep terminal open (`--wait-after-command`)

A trailing `=` means the value is concatenated as one argument (`--title=My Title`).
No trailing `=` means two separate arguments (`--title` `My Title`).
