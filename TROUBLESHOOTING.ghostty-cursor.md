# Ghostty cursor style troubleshooting

## Claude Code shows block cursor despite `cursor-style = bar`

Claude Code displays a block cursor in its input area even when
Ghostty is configured with `cursor-style = bar`.

### Minimal repro

1. Set `cursor-style = bar` in `~/.config/ghostty/config`
2. Confirm the shell prompt shows a bar cursor
3. Launch `claude`
4. Observe a block cursor at the `>` input prompt

### Root cause

Claude Code does not use the real terminal cursor for its input area.
On mount, Ink (the React-based terminal UI framework) hides the terminal cursor
with `\x1b[?25l` and never re-shows it during the session.
Instead, the text input component renders a **visual cursor** using Chalk's
`inverse` modifier — an inverse-video space character that always appears
as a solid block regardless of terminal cursor settings.

Source locations in the extracted bundle (`claude-code-2.1.75.js`):

- TextInput component uses `invert: f = f$.inverse` as default cursor style
- When `showCursor && focus && terminalFocus`, renders `f(" ")` (inverse space)
- When the component has focus, the cursor character uses `f$.inverse`

The real terminal cursor (governed by `cursor-style`) stays hidden
for the entire Claude Code session. On exit, Ink sends `\x1b[?25h`
to restore visibility, and the shell prompt's `\e[5 q` (from Ghostty
shell integration's `PS1` hook) restores the bar shape.

### What does not work

- **`cursor-style = bar` in Ghostty config** — correctly sets the terminal default,
  but Claude Code hides the real cursor and renders its own
- **`\e[0 q` from `PS0` preexec hook** — correctly resets shape to config default
  before Claude Code starts, but the shape is irrelevant because the cursor is hidden
- **`Se` / `Ss` terminfo capabilities** — Claude Code does not use terminfo for
  cursor style; it hardcodes inverse-video rendering

### Verified behavior

- Ghostty's `\e[0 q` handler (`stream_handler.zig:874-888`) correctly restores
  `default_cursor_style` from config via `self.default_cursor_style`
- The config value `cursor-style = bar` maps directly to `.bar` enum variant
  (`Config.zig:872`, `cursor.zig:4-15`) with no lossy conversion
- Claude Code's JS bundle contains zero DECSCUSR sequences (`\e[N q`)
- The only cursor operations are visibility toggles: `\x1b[?25l` (hide) and
  `\x1b[?25h` (show)

### Upstream tracking

This is a Claude Code rendering decision, not a Ghostty bug.
Feature requests to support cursor style in Claude Code:

- [Cursor style interference (issue 674)][674]
- [Cursor style support (issue 7002)][7002]
- [Customize cursor style (issue 10215)][10215]
- [Environment variable to disable cursor shape changes (issue 10534)][10534]

[674]: https://github.com/anthropics/claude-code/issues/674
[7002]: https://github.com/anthropics/claude-code/issues/7002
[10215]: https://github.com/anthropics/claude-code/issues/10215
[10534]: https://github.com/anthropics/claude-code/issues/10534

### Separate finding: Ghostty `Se` terminfo uses steady block

Ghostty's terminfo defines `Se=\E[2 q` (steady block) instead of `\E[0 q`
(reset to user default). Located at `ghostty.zig:116`.

Programs that use terminfo to reset cursor style (vim, neovim, tmux)
send `\e[2 q`, which triggers the `.steady_block` branch in Ghostty's
`setCursorStyle` handler rather than the `.default` branch that would
restore the configured `cursor-style`. This is unrelated to the Claude Code
issue but affects other terminal programs.
