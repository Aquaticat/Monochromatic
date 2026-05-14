# Claude Code (Ink terminal UI) hides the real terminal cursor and renders an inverse-video block, overriding Ghostty's `cursor-style = bar`

## Symptom

Ghostty is configured with `cursor-style = bar`. The shell prompt
shows a bar cursor. Launching `claude` (Claude Code CLI) replaces
the cursor in the input area with a solid block:

1. Set `cursor-style = bar` in `~/.config/ghostty/config`.
2. Confirm the shell prompt shows a bar cursor.
3. Launch `claude`.
4. Observe a solid block at the `>` input prompt, regardless of
   Ghostty's configured cursor style.

On exiting Claude Code, the bar cursor returns to the shell prompt.

## Root cause

Claude Code's input area does not use the real terminal cursor at
all. The Ink terminal-UI framework (React-style rendering for TTYs)
hides the cursor on mount and renders a **visual** cursor by
inverse-video-printing a space character via Chalk's `inverse`
modifier.

Source locations in the extracted Claude Code bundle
(`claude-code-2.1.75.js`):

- The TextInput component sets a default cursor styler:
  `invert: f = f$.inverse` (Chalk's inverse modifier).
- When `showCursor && focus && terminalFocus` is true, the
  component renders `f(" ")`: an inverse-video space character
  positioned where the cursor would appear.
- When the component has focus, the cursor character uses
  `f$.inverse` unconditionally; there is no branch that emits a
  DECSCUSR cursor-style sequence.

On mount, Ink sends `\x1b[?25l` to hide the real terminal cursor.
The cursor stays hidden for the entire session, so Ghostty's
configured shape is moot: the user is looking at an inverse-video
block painted by the application, not the terminal cursor.

On exit, Ink sends `\x1b[?25h` to restore visibility, and Ghostty's
shell-integration `PS1` hook re-issues `\e[5 q` to restore the bar.

A separate, related finding (covered below) is in Ghostty's
terminfo, but it is independent of the Claude Code rendering choice.

## Verification

Version under test:

- Claude Code 2.1.75
- Ghostty 1.0+ with `cursor-style = bar`
- Bash or zsh with Ghostty shell integration enabled

Reproduce: set `cursor-style = bar` in Ghostty's config; verify the
shell prompt's bar cursor; launch `claude`; observe the block.

Inspecting the bundle for cursor-related sequences confirms the
finding:

- `claude-code-2.1.75.js` contains zero DECSCUSR sequences (`\e[N q`
  with any N).
- The only cursor-related escape sequences are visibility toggles:
  `\x1b[?25l` (hide) and `\x1b[?25h` (show).

Ghostty's side is behaving correctly:

- `stream_handler.zig:874-888`: `\e[0 q` handler restores
  `default_cursor_style` from config via `self.default_cursor_style`.
- `Config.zig:872`: `cursor-style = bar` maps to the `.bar` enum
  variant.
- `cursor.zig:4-15`: `.bar` is the bar shape with no lossy
  conversion.

The combination of "Claude Code hides the cursor" and "Claude Code
never emits a DECSCUSR" means no Ghostty setting can affect the
appearance, because the rendered glyph is application-layer, not
terminal-layer.

## Verified workaround

There is no workaround that recovers Ghostty's bar shape while
Claude Code is running. The cursor the user sees is application
output; the terminal does not control it.

Tradeoff: accept the visual divergence between shell prompt
(bar) and Claude Code prompt (block). The alternative is to wait
for a Claude Code update that supports cursor-style customisation
(see upstream tracking below).

## What does not work

- **`cursor-style = bar` in `ghostty.config`**: correctly sets the
  terminal default. Claude Code hides the real cursor, so the
  setting is irrelevant once the app starts.
- **Issuing `\e[0 q` from a `PS0` preexec hook before Claude Code
  starts**: correctly resets the shape to the configured default,
  but the shape no longer applies because the cursor is hidden.
- **`Se` / `Ss` terminfo capabilities**: Claude Code does not use
  terminfo for cursor shape; the hardcoded `f$.inverse` rendering
  bypasses any terminfo entry.
- **`infocmp` / patching Ghostty's terminfo**: same as above; the
  application does not consult terminfo for cursor shape.

## Why we do not file this upstream (Claude Code)

This is a known limitation tracked in multiple Claude Code issues.
Walking the 5 constraints:

1. **Is it really upstream's fault?** Borderline. Ink's
   inverse-video cursor is a deliberate cross-terminal design that
   trades native cursor support for layout reliability. Claude
   Code inherits that design.
2. **Can upstream fix it?** Yes; emit DECSCUSR sequences in the
   TextInput component when the terminal advertises support, or
   expose a config flag that switches between visual and native
   cursor. Both are plausible but require Ink-level changes.
3. **Are they supporting this use case?** Several open issues
   request customisation; Anthropic has acknowledged the friction
   but not committed to a fix.
4. **Will they likely fix it?** Unknown; the multiple open issues
   suggest demand exists but has not been prioritised.
5. **Have we prototyped a minimal fix?** No.

Decision: no new upstream report. Subscribe to existing tickets if
needed.

### Existing upstream tickets

- [Cursor style interference (issue 674)][674]
- [Cursor style support (issue 7002)][7002]
- [Customise cursor style (issue 10215)][10215]
- [Environment variable to disable cursor shape changes (issue 10534)][10534]

[674]: https://github.com/anthropics/claude-code/issues/674
[7002]: https://github.com/anthropics/claude-code/issues/7002
[10215]: https://github.com/anthropics/claude-code/issues/10215
[10534]: https://github.com/anthropics/claude-code/issues/10534

## Separate finding: Ghostty's terminfo defines `Se=\E[2 q` (steady block) instead of `\E[0 q` (reset to user default)

Located at `ghostty.zig:116`.

When programs that consult terminfo (vim, neovim, tmux) need to
restore cursor style after switching modes, they emit the `Se`
capability. Ghostty's `Se` resolves to `\E[2 q` (steady block),
which triggers the `.steady_block` branch in `setCursorStyle`
instead of the `.default` branch that would restore the
configured `cursor-style`. The result is that programs which
faithfully use terminfo end up with a steady block rather than
the user's preferred bar.

This is **independent** of the Claude Code finding above (Claude
Code does not use terminfo at all). It affects different
applications, but the root cause is in Ghostty's terminfo
definition.

### Why we do not file this upstream (Ghostty)

1. **Is it really upstream's fault?** Yes; `Se` should encode
   "reset to default" (`\E[0 q`), not "steady block".
2. **Can upstream fix it?** Yes; one-line change in
   `ghostty.zig:116`.
3. **Are they supporting this use case?** Yes; Ghostty's mission
   includes accurate terminfo.
4. **Will they likely fix it?** Plausible; Ghostty is actively
   maintained and accepts terminfo corrections.
5. **Have we prototyped a minimal fix?** Not yet.

Decision: this finding is worth filing when someone has the
bandwidth to prototype the one-line patch and a minimal
reproduction in vim or tmux. Until then, kept here for
reference.
