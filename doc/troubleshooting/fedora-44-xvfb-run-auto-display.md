# Fedora 44 xvfb-run 21.1.24 rejects its advertised auto-display option

## Symptom

The `xorg-x11-server-Xvfb` package `21.1.24-1.fc44` prints
`--auto-display` in `xvfb-run --help`,
 but running
`xvfb-run --auto-display /usr/bin/true` emits:

```text
xvfb-run: unrecognized option '--auto-display'
```

This blocked a disposable Android Fold emulator probe before Xvfb started.
It is separate from the emulator's later container memory exhaustion.

## Root cause

The installed shell source is `/usr/bin/xvfb-run` from the Fedora package.
A private copy at `/home/user/temp/agent/fold-no-hardware-avd/xvfb-run-fedora44`
has SHA-256 `aac25303a72f3c45ab01fcc37c2fda19abe24f5e3d17a6602a6f79cbc2b7f172`.
Its lines 66 to 69 advertise `--auto-display`:

```sh
-a        --auto-servernum          try to get a free server number, starting at
                                    --server-num (deprecated, use --auto-display
                                    instead)
-d        --auto-display            use the X server to find a display number
```

Lines 103 to 104 give `getopt` a short `d`,
 but omit `auto-display`
from its accepted long-option list:

```sh
ARGS=$(getopt --options +ade:f:hn:lp:s:w: \
       --long auto-servernum,error-file:,auth-file:,help,server-num:,listen-tcp,xauth-protocol:,server-args:,wait: \
       --name "$PROGNAME" -- "$@")
```

The later case arm on line 118 accepts both spellings only **after**
`getopt` succeeds:

```sh
-d|--auto-display) AUTO_DISPLAY=1 ;;
```

A shallow source clone of `RussianFedora/xorg-x11-server` at
`97d81e6799d589e3efa0eff37041718316bda286` was inspected.
Its `xvfb-run.sh` lacks the newer auto-display feature altogether,
so it is **not** the source revision of the installed Fedora 44 script.
The installed script,
 not that older clone,
 is the deciding evidence.

## Verification

In a disposable Fedora 44 container capped at 2 GiB and 2 CPUs,
install `xorg-x11-server-Xvfb` with the container package manager,
then run these commands:

```sh
xvfb-run --auto-display /usr/bin/true
xvfb-run -d /usr/bin/true
xvfb-run --auto-servernum --server-args='-screen 0 2076x2152x24' /usr/bin/true
```

The first command exited 1 with the quoted diagnostic.
The latter two exited 0,
 confirming that Xvfb itself can launch.
The test used no host package installation and no active Android AVD.

## Verified workaround

Use `-d` to request the advertised auto-display behavior on this packaged script.
It passed the direct `/usr/bin/true` control,
 but the short spelling is
required despite the normal long-flag convention.
Alternatively,
 `--auto-servernum` passed with a screen-size argument;
its own help marks that mode deprecated.
Neither option increases Android emulator memory or proves Gboard behavior.

## What does not work

- `--auto-display` is rejected before its matching case arm can run.
- Treating the `--help` text as proof that `getopt` accepts the long form
  misses the earlier parser gate.

## A later display control found a false positive

A later filename-label study mounted the host's `/usr` read-only into a
Fedora 44 container.
That host directory did not contain `/usr/bin/Xvfb`.
The private wrapper retained SHA-256
`aac25303a72f3c45ab01fcc37c2fda19abe24f5e3d17a6602a6f79cbc2b7f172`.
Running its `--auto-servernum` branch with `/usr/bin/true` returned zero
while stderr said:

```text
/opt/xvfb-run: line 163: Xvfb: command not found
```

The same missing executable made the `-d` startup exit before the
emulator command,
with its Xvfb diagnostic hidden by the default `/dev/null` error file.
No guest boot or AVD-lock failure was established by that exit.

The deciding private wrapper's lines `161` to `174` start Xvfb,
while lines `182` to `203` return the requested command's status:

```sh
# /home/user/temp/agent/fold-no-hardware-avd/xvfb-run-fedora44
XAUTHORITY=$AUTHFILE Xvfb ":$SERVERNUM" $XVFBARGS $LISTENTCP >>"$ERRORFILE" 2>&1 &
XVFBPID=$!
# The requested command can succeed without using a display.
DISPLAY=:$SERVERNUM XAUTHORITY=$AUTHFILE "$@" 2>&1
RETVAL=$?
exit $RETVAL
```

This is not proof that the document's original installed-Xvfb control
failed.
It proves that `/usr/bin/true` alone cannot establish a usable X display.
Do not promote a successful emulator help invocation to a boot or
renderer positive control either.

The later study copied the existing image's `Xvfb` executable into
private scratch and mounted it at `/opt/Xvfb`,
with `PATH=/opt:/usr/bin:/usr/sbin`.
The source image was `localhost/monochromatic-playwright:latest`,
image ID `4b8805002ee369c81b7826b941afc52c0c9678a0d0e427a0fefd1684b78b5f94`;
the copied executable's SHA-256 was
`2c7f5a9534410fed5092d782a69ca7ffd9fce80e98b81ffe4944d703dd11d3b1`.
Its `ldd` output resolved all listed dependencies against the host's
mounted runtime.
No host package or SDK file was edited.

Within the same 2 GiB/2 CPU bounds,
the wrapper then ran `xdpyinfo` against its actual display and returned
zero.
Output reported display `:99`,
X protocol `11.0` and `640x480` pixels.
This is a display positive control,
not Android rendering or label evidence.
The private binary bridge depends on the measured runtime dependencies;
it is not a portable installation recipe.

The added container case changes no upstream filing decision:
the container omitted the required executable,
and the original command-only probe did not exercise a display.
No upstream defect or source fix was established by this case.

## Upstream filing decision

No `.out-of-scope/` entry names Fedora Xvfb or this option mismatch.
`gh search issues` and `gh search prs` for
`xvfb-run auto-display getopt` found no GitHub match,
but that does not search Fedora's own issue tracker.
No upstream communication was sent.

1. **Upstream fault:**
    The installed Fedora script's help and parser disagree.
2. **Fixability:**
    Adding the missing long option to `getopt` appears sufficient;
   this has not been patched and rerun against the exact installed script.
3. **Supported use case:**
    Its own help advertises the option.
4. **Contribution policy:**
    The exact Fedora package source repository and
   its contribution requirements were not audited.
   The older GitHub mirror is not equivalent evidence.
5. **Expected response:**
    No maintainer signal was established.
6. **Tested upstream fix:**
    None.
   The project's script policy forbids authoring a shell-script patch for
   this unrelated package;
    the consumer-side `-d` workaround was tested.

### Draft, do not file as-is

~~~md
Fedora 44 xvfb-run advertises --auto-display but rejects it

With xorg-x11-server-Xvfb 21.1.24-1.fc44, `xvfb-run --auto-display
/usr/bin/true` prints `xvfb-run: unrecognized option '--auto-display'`.
The installed script lists the option in help and its case arm, but not in
`getopt`'s `--long` list. `xvfb-run -d /usr/bin/true` succeeds.
A patch against the exact Fedora package and Fedora tracker duplicate check
are still needed before filing.
~~~
