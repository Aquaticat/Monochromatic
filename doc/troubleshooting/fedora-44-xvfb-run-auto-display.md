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
