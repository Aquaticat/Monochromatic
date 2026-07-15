# TODO

## E2E testing

End-to-end tests for the spawn-claude plugin,
running in GitHub Actions with a real Wayland compositor and terminal emulator.

### Why e2e and not unit tests

Unit tests for file coordination and hook handler branching did not catch the bugs
that appeared in practice.
 Every bug found so far was an integration issue between
components:
 stdout text not delivering from plugin hooks,
 stale env vars causing
cross-session contamination,
 `additionalContext` being silently dropped for certain
hook events.
 These only surface when the full pipeline runs end-to-end through
Claude Code's actual hook system.

### Architecture

```text
GitHub Actions runner (standard, no GPU)
  |
  podman run
    |
    Container (Fedora)
      |
      sway (headless, software-rendered)
        |
        foot (Wayland terminal)
          |
          claude (interactive TUI, with plugin loaded via marketplace)
            |
            spawn-claude -> terminal-exec -> foot -> claude (child)
```

### Display: headless sway with software rendering

sway + wlroots supports headless mode with CPU-based software rendering:

```bash
WLR_BACKENDS=headless WLR_RENDERER_ALLOW_SOFTWARE=1 WLR_LIBINPUT_NO_DEVICES=1 sway
```

No GPU required.
 Mesa's `llvmpipe` or `softpipe` provides the OpenGL implementation.
`wtype`,
 `foot`,
 and all Wayland clients work normally against this compositor.
Package dependency:
 `mesa-dri-drivers` (or equivalent) for software OpenGL.

### Terminal: foot

Lightweight Wayland-native terminal emulator.
Configure `~/.config/xdg-terminals.list` with `foot.desktop` so `terminal-exec`
resolves it without `.desktop` entry scanning.

### Input automation: wtype

Wayland keyboard input tool (equivalent of X11's `xdotool type`).
Sends keystrokes to the focused Wayland surface.
Requires inter-keystroke delay (`wtype -d <ms>`) to avoid dropped characters.
Claude Code TUI uses Enter to submit prompts.

### Plugin loading

The plugin must be installed via the actual marketplace flow,
 not `--plugin-dir`:

```bash
claude plugin marketplace add Aquaticat/Monochromatic
claude plugin install claude-spawn@Monochromatic --scope user
```

This requires the repo to be pushed to GitHub before the test runs.
GitHub Actions ensures the marketplace source (Aquaticat/Monochromatic) matches
the commit under test.

These commands run inside the container **before** launching the interactive session.
The marketplace add + install writes hook entries into `~/.claude/settings.json`,
which Claude Code reads on startup.

### Container image (`e2e.Containerfile`)

Base:
 `fedora:latest`

Packages:

- `sway`,
   `foot`,
   `wtype` (Wayland stack)
- `mesa-dri-drivers` (software OpenGL for `WLR_RENDERER_ALLOW_SOFTWARE`)
- `nodejs`,
   `npm` (Claude Code and plugin-hook runtime)
- `@anthropic-ai/claude-code` (global npm install)
- `git`,
   `procps-ng` (hook reads `/proc/{pid}/status`)

Config:

- Minimal sway config (no bar,
   no wallpaper,
   no idle)
- `echo "foot.desktop" > ~/.config/xdg-terminals.list`

### Test flow

1. Start sway (headless,
    software-rendered)
2. Wait for sway readiness:
    poll `swaymsg -t get_version`
3. Install plugin via marketplace:
   `claude plugin marketplace add Aquaticat/Monochromatic`
   `claude plugin install claude-spawn@Monochromatic --scope user`
4. Launch foot with claude:
    `swaymsg exec "foot -e claude"`
5. Wait for Claude readiness:
    poll terminal buffer content for the input prompt indicator
6. Type prompt via `wtype -d <ms>`:
    `spawn-claude "say exactly SPAWN_E2E_OK"`
7. Press Enter:
    `wtype -k Return`
8. Wait for child completion:
    poll `~/.claude/spawn-results/spawns/` for `.reported` files
   or use a generous fixed timeout
9. Refocus parent foot window:
    `swaymsg` (child foot window steals focus on spawn)
10. Type verification prompt:
     instruct Claude to write a marker file if it received
    the spawn result via system-reminder
11. Press Enter
12. Wait for marker file `/tmp/e2e-result.txt`
13. Verify marker file contains `SPAWN_E2E_PASS`

The session does not terminate on its own after Stop.
The test orchestrator kills the container after verification (or on timeout).

### Orchestrator (`test/e2e/run.ts`)

TypeScript file that uses `child_process` to sequence the steps above.
Runs inside the container as the entrypoint.

### Mise tasks

- `test:e2e:prepare`:
   builds container image,
   cached via `task-depends`
- `test:e2e`:
   `podman run` with `ANTHROPIC_API_KEY` forwarded from
  `CLAUDE_CODE_TEST_CLAUDE_API_KEY`;
   no volume mounts needed since the plugin
  is installed from the marketplace inside the container

### GitHub Actions workflow

Trigger:
 manual dispatch + on push to paths under `package/claude-code-plugin/claude-spawn/`

The plugin is installed from the marketplace (Aquaticat/Monochromatic),
so the workflow must run **after** the commit is pushed.
This means the test always runs against the pushed commit,
 not a local build.

Steps:

1. Checkout (for Containerfile and orchestrator script)
2. Build container image
3. Run e2e test container with secrets:
   - `CLAUDE_CODE_TEST_CLAUDE_API_KEY`:
      Anthropic API key for Claude sessions
   - `ANTHROPIC_API_KEY`:
      same key,
      forwarded as the env var Claude Code reads

### Known footguns

**Compositor and display:
**

- sway requires a config file or errors on startup;
   need a minimal `~/.config/sway/config`
- sway refuses to start as root;
   container needs a non-root user or `--unsupported-gpu` flag
- `WAYLAND_DISPLAY` and `XDG_RUNTIME_DIR` must be set correctly for foot and wtype
  to find the compositor socket
- `mesa-dri-drivers` or equivalent must be installed for `WLR_RENDERER_ALLOW_SOFTWARE`
  to find a software renderer

**Input automation:
**

- `wtype` sends to the **focused** window;
   when the child spawns a second foot window,
  focus shifts;
   need `swaymsg` to refocus the parent window before typing step 8
- `wtype` needs inter-keystroke delay (`-d` flag) to avoid dropped characters
- Special characters in prompts (quotes,
   backslashes) need escaping for `wtype`

**Marketplace plugin installation:
**

- `claude plugin marketplace add` and `claude plugin install` are CLI commands
  that run outside a session;
   unclear if they work non-interactively (no TTY)
- The marketplace fetches from GitHub;
   the test container needs network access
  to `github.com` and `raw.githubusercontent.com`
- If the marketplace caches plugin versions,
   a recently pushed commit
  might not be immediately available
- The marketplace install downloads and builds the plugin;
  `node` must be available in the container for the `#!/usr/bin/env node` shebang
  in the built hook handler

**Claude Code TUI:
**

- First-run flow:
   TOS acceptance,
   telemetry opt-in,
   onboarding wizard;
  need env vars or flags to skip these in a fresh container
- Bash tool permission prompts:
   Claude asks for sandbox bypass permission when
  `spawn-claude` tries to write files;
   need to pre-approve or auto-accept
- Detecting "ready for input":
   no simple signal;
   requires polling terminal buffer
  content (via compositor screen capture or a tmux intermediary)
- Stop hook does not terminate the session;
   Claude continues running after Stop fires;
  the test cannot rely on session exit as a completion signal

**Timing and coordination:
**

- Child session startup and API response time are variable;
  generous timeouts required (60-120 seconds for child completion)
- The parent must make at least one tool call after the child completes
  for PreToolUse injection to fire;
   the verification prompt must trigger a tool call
- If the child completes and the parent is already in a Stop hook,
  blocking delivers the result,
   but the parent continues (does not exit)

**Process lifecycle:
**

- Container `podman run --rm` destroys everything on exit;
  test must extract results before the container dies
- Multiple foot windows exist simultaneously (parent + child);
  child window closes on child session end;
   parent remains
- The orchestrator must handle the case where Claude decides not to follow
  the verification prompt (LLM non-compliance)

### Effort and cost estimate

**Implementation time**:
 realistically ~1 month of intermittent work.
The optimistic 3-5 day estimate assumes everything works on first try.
In practice,
 each layer (sway in container,
 CC first-run,
 buffer polling,
marketplace install,
 wtype focus management) is independently capable of
burning a full day.
 Debugging requires push-to-CI round-trips with no
screen to look at:
 need `grim` screenshot capture for remote debugging,
which is yet another component.

**Per-run cost**:
 $0.05-0.10 (parent:
 3-5 tool calls,
 child:
 1 response).
Inherently flaky due to LLM non-compliance with verification prompts.

### Open questions

1. What is Claude Code's exact first-run flow?
   Can it be skipped with env vars or CLI flags?
2. Does `claude plugin marketplace add` + `claude plugin install` work
   non-interactively (no TTY,
    no prompts)?
   If it prompts for confirmation,
    need to pipe `yes` or find a `--yes` flag.
3. Does sway's `--unsupported-gpu` flag allow running as root in a container,
   or is a non-root user required?
4. Can `wtype` target a specific sway window by `app_id` rather than the focused window?
5. What is the most reliable way to detect "Claude is ready for input"
   by polling terminal buffer content?
   Candidates:
    `swaymsg` IPC to read buffer,
    tmux `capture-pane` as intermediary,
   or screen capture + OCR (heavyweight)
6. Does the marketplace install pull the plugin source at the current HEAD
   of the default branch,
    or a tagged release?
   If HEAD,
    the test always matches the pushed commit.
   If tagged,
    the workflow needs to create/update a tag before installing.
