# Restore OLED-black LibreWolf chrome after an update

LibreWolf renders its dark chrome (tab strip,
 nav bar,
 sidebar) as a dark gray,
 not pure `#000000`.
Pure black ("OLED black") on this machine comes from a small `userChrome.css` that forces the chrome
background variables to `#000000`.
A LibreWolf major update periodically renames those private theme variables,
at which point the override silently stops applying and the chrome reverts to gray.
This runbook re-derives the current variable names from the installed build and restores the override.

What this proves:
 after the procedure,
 the tab strip,
 nav bar,
 and sidebar render `#000000`,
 while the active (selected) tab stays a visibly lighter shade so it remains distinguishable.

Bridges tried,
 so this is not an unconsidered handoff:
 the file edit itself is scriptable and an agent can perform it,
 but three things are inherently manual.
 First,
 the correct variable names change per LibreWolf release and must be read back from the
 installed `omni.ja` each time the override breaks.
 Second,
 `userChrome.css` is read only at startup,
 so a full quit and relaunch of the running browser
 is required,
 and that is the operator's own live session to restart.
 Third,
 the result lives in Firefox chrome,
 which `agent-browser` cannot introspect (it drives web
 content only),
 so the final visual confirmation is done by eye.

Verified on LibreWolf 152.0 (rpm install on an atomic Fedora image).
The pre-152 variable was `--toolbox-bgcolor`;
 152 renamed it to `--toolbox-background-color`.

## Setup

Status:
TODO

Prerequisites for a fresh machine:

- LibreWolf installed (any packaging).
  This runbook's paths assume the native rpm,
   whose program files live under `/usr/share/librewolf`
  and whose profiles live under `~/.config/librewolf`.
  A flatpak install keeps profiles under `~/.var/app/io.gitlab.librewolf-community/.librewolf`
  and `omni.ja` inside the flatpak tree;
   adjust the two paths below accordingly.
- `unzip` and `grep` available in the shell (`omni.ja` is a zip archive).
- The profile already has custom stylesheets enabled.
  Confirm by typing **about:
  config** in the address bar,
   accepting the warning,
   and searching for
  `toolkit.legacyUserProfileCustomizations.stylesheets`.
  Expected:
   the value is `true`.
   If it is `false`,
   double-click it to flip it to `true`.

Locate the active profile and its chrome stylesheet:

```sh
# the file the override lives in (pick the *.default-default match if several print)
find ~/.config/librewolf ~/.librewolf -name userChrome.css 2>/dev/null
```

Expected:
 a path such as `~/.config/librewolf/librewolf/44i2kpg4.default-default/chrome/userChrome.css`.
If nothing prints,
 the `chrome` directory does not exist yet;
 create it under the profile root
(the directory holding `prefs.js`) and treat the file as new.

## Steps

Status:
TODO

1.  Quit LibreWolf completely.
    Use the **☰** menu then **Quit**,
     or press **Ctrl+Q**,
     then confirm the process is gone.

    ```sh
    pgrep -af librewolf
    ```

    Expected:
     no output (the process has exited).
     `userChrome.css` is read only at startup,
     so editing it while the browser runs has no effect.

2.  Read back the current background variable names from the installed build.
    This is the step that survives future renames.

    ```sh
    # rpm path shown; for other installs: find / -name omni.ja -path '*browser*' 2>/dev/null
    mkdir -p /tmp/lw-skin && cd /tmp/lw-skin
    unzip -o -q /usr/share/librewolf/browser/omni.ja 'chrome/browser/skin/*'
    grep -rhoE -- '--toolbox-[a-z-]*background[a-z-]*' chrome/browser/skin | sort -u
    grep -rhoE -- '--sidebar-background-color' chrome/browser/skin | sort -u
    ```

    Expected on 152:
     the first grep prints `--toolbox-background-color` and `--toolbox-background-color-inactive`;
     the second prints `--sidebar-background-color`.
    If a future build prints different names,
     use those names in step 4.

3.  Confirm the active-tab trap before editing:
     the selected tab derives its color from the nav-bar
    variable,
     so blacking that variable would flatten the active tab.

    ```sh
    grep -n 'tab-background-color-selected' \
      /tmp/lw-skin/chrome/browser/skin/classic/browser/tabbrowser/tab.tokens.css
    ```

    Expected:
     a line reading `--tab-background-color-selected: var(--toolbar-background-color);`.
    This is why step 4 sets the toolbox and sidebar variables but never `--toolbar-background-color`.
    With vertical tabs the nav bar is transparent and already shows the black toolbox behind it,
    so the toolbar variable is unnecessary as well as harmful.

4.  Write the override.
    Open the `userChrome.css` from Setup in any text editor and set its entire contents to exactly
    this,
     substituting the names from step 2 if they differed:

    ```css
    /* <profile>/chrome/userChrome.css */
    :root {
        --toolbox-background-color: #000000 !important;
        --toolbox-background-color-inactive: #000000 !important;
        --sidebar-background-color: #000000 !important;
    }
    ```

    Expected:
     the file saves.
     Do not add `--toolbar-background-color`;
     see step 3.

5.  Relaunch LibreWolf.

    Expected:
     the window opens with the override applied.

## What to check

Status:
TODO

1.  Confirm the override file holds the three declarations and no `--toolbar-background-color`.

    ```sh
    grep -nE -- '--(toolbox|toolbar|sidebar)[^:]*background[^:]*color' \
      ~/.config/librewolf/librewolf/*/chrome/userChrome.css
    ```

    Expected:
     three lines printing the toolbox,
     toolbox-inactive,
     and sidebar declarations,
     each ending
     `#000000 !important;`,
     and no `--toolbar-background-color` line.

2.  Inspect the running window by eye (chrome cannot be read programmatically):

    - The tab strip,
       the nav bar (address-bar row),
       and the sidebar are pure black `#000000`.
    - The active (selected) tab is a visibly lighter shade than the black background,
       so the current
      tab is distinguishable.
       Inactive tabs sit on black.

    If the active tab is also black,
     `--toolbar-background-color` has been set somewhere;
     remove it
    and relaunch.

## Restore

Status:
TODO

1.  To return to the stock (gray) chrome,
     remove the override and relaunch.
    Either restore a backup if one exists,

    ```sh
    cd ~/.config/librewolf/librewolf/*/chrome 2>/dev/null && ls userChrome.css.bak* 2>/dev/null
    ```

    or empty `userChrome.css` of the `:root` block.
    To disable all custom stylesheets at once instead,
     type **about:
    config** in the address bar and
    set `toolkit.legacyUserProfileCustomizations.stylesheets` to `false`.

    Expected:
     after a quit (**Ctrl+Q**) and relaunch,
     the chrome renders in LibreWolf's default dark gray.

2.  Remove the scratch extraction.

    ```sh
    rm -rf /tmp/lw-skin
    ```

    Expected:
     the directory is gone (`ls /tmp/lw-skin` reports it does not exist).
