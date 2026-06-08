# rclone v1.74.3 double-encodes a literal fullwidth colon into phantom S3 keys that Garage v2.3.0 lists but cannot HEAD, and bisync treats them as fatal

A filename containing a literal fullwidth colon `：` (U+FF1A, common in Chinese book titles)
can be written to an S3 bucket twice under two different keys when two sync passes apply
different rclone encoder masks.
The second, double-encoded key carries rclone's quote rune U+201B and becomes a phantom
duplicate: Garage lists it but returns `404` on `HeadObject`, so rclone bisync logs
`Failed to read metadata: object not found` and, on a normal run, aborts the whole sync.

This bites a single-node Garage (`dxflrs/garage:v2.3.0`) reached by rclone bisync on the
desktop and a new macOS client, and by FolderSync on Android, all against bucket `files`.

## Symptom

Two surface variants, same underlying phantom key.

Remote variant, seen during `rclone bisync garage:files/Plain ~/Plain --resync` on the new Mac:

```text
NOTICE: Text/Books/programming/01897_软件开发本质论‛‛：追求简约、体现价值、逐步构建.pdf: Failed to read metadata: object not found
NOTICE: Text/Books/self help/江泽民文选‛‛：第1卷.pdf: Failed to read metadata: object not found
NOTICE: Text/Books/self help/江泽民文选‛‛：第2卷.pdf: Failed to read metadata: object not found
NOTICE: Text/Books/self help/江泽民文选‛‛：第3卷.pdf: Failed to read metadata: object not found
```

Local variant, seen earlier on the desktop during a normal (non-resync) bisync, when the
double-encoded name had also been written to the local tree:

```text
ERROR : Text/Books/self help/江泽民文选‛‛：第1卷.pdf: Failed to copy: failed to open source object: lstat /home/user/Seafile/Plain/Text/Books/self help/江泽民文选‛‛：第1卷.pdf: no such file or directory
Bisync critical error: ...
Bisync aborted. Must run --resync to recover.
```

The trigger in both cases is the doubled quote rune `‛‛` (rendered by rclone; two literal
U+201B bytes) sitting immediately before a fullwidth colon `：` (U+FF1A) in the key.
The six affected keys on the live bucket, all with intact clean twins:

```text
Text/Books/programming/01897_软件开发本质论‛‛：追求简约、体现价值、逐步构建.pdf
Text/Books/self help/江泽民文选‛‛：第1卷.pdf
Text/Books/self help/江泽民文选‛‛：第2卷.pdf
Text/Books/self help/江泽民文选‛‛：第2卷.sdr/
Text/Books/self help/江泽民文选‛‛：第2卷.sdr/metadata.pdf.lua
Text/Books/self help/江泽民文选‛‛：第3卷.pdf
```

## Root cause

### The byte-level difference

Raw S3 keys with rclone's display encoding disabled
(`rclone lsf --s3-encoding None ...`), hexdumped:

```text
clean   : 江泽民文选 ： 第1卷.pdf
          e6 b1 9f e6 b3 bd e6 b0 91 e6 96 87 e9 80 89          ef bc 9a   e7 ac ac 31 e5 8d b7 2e 70 64 66
tainted : 江泽民文选 ‛ ‛ ： 第1卷.pdf
          e6 b1 9f e6 b3 bd e6 b0 91 e6 96 87 e9 80 89 e2 80 9b e2 80 9b ef bc 9a e7 ac ac 31 e5 8d b7 2e 70 64 66
```

The two keys are identical except for two `e2 80 9b` (U+201B) bytes inserted before the
fullwidth colon `ef bc 9a` (U+FF1A).
U+201B is rclone's encoder quote rune and nothing else in this stack (Garage, the S3
protocol, FolderSync, the OS filesystems) emits it, so the insertion is rclone's.

### Why rclone inserts it

rclone's encoder reserves U+201B as its quote rune:

```go
// lib/encoder/encoder.go:29-30
// QuoteRune is the rune used for quoting reserved characters
QuoteRune = '‛' // SINGLE HIGH-REVERSED-9 QUOTATION MARK
```

When the `EncodeColon` flag is set, the encoder maps ASCII `:` to the fullwidth `：`
(`r + fullOffset`, `fullOffset = 0xFEE0`), and to keep that reversible it quotes a
*literal* fullwidth `：` by prefixing the quote rune:

```go
// lib/encoder/encoder.go:537-545
if mask.Has(EncodeColon) { // :
    switch r {
    case ':':
        out.WriteRune(r + fullOffset)   // ':'  -> '：'
        continue
    case '：':
        out.WriteRune(QuoteRune)        // '：' -> '‛：'  (quoted so decode restores the fullwidth colon)
        out.WriteRune(r)
        continue
    }
}
```

A literal quote rune in the input is itself escaped by doubling, regardless of mask:

```go
// lib/encoder/encoder.go:452-454
case '␀', QuoteRune:
    out.WriteRune(QuoteRune)
    out.WriteRune(r)   // '‛' -> '‛‛'
```

So a single pass with `EncodeColon` turns the clean title `...文选：第1卷.pdf` into
`...文选‛：第1卷.pdf` (one quote rune).
A second pass with a mask that lacks `EncodeColon` (the S3 backend default, see below)
then sees that lone quote rune as a literal and doubles it, producing `...文选‛‛：第1卷.pdf`
(two quote runes) as a brand new, distinct S3 key alongside the original.

The S3 backend default mask has no `EncodeColon`:

```go
// backend/s3/s3.go:529-531
Default: encoder.EncodeInvalidUtf8 |
    encoder.EncodeSlash |
    encoder.EncodeDot,
```

The two passes with mismatched masks are the generator.
In this deployment the likely source of the colon-encoding pass is a second client writing
to the same bucket (Android FolderSync, whose target filesystems forbid `:`), while the
rclone desktop client writes with the S3 default; either order across the two clients
yields the doubled key.

### The proximate failure is Garage, not an rclone round-trip bug

A reasonable first hypothesis is that rclone's `encode`/`decode` is not idempotent for these
keys, so rclone asks Garage for the wrong key.
That hypothesis is wrong, and the evidence disproves it.

The S3 backend lists keys through `ToStandardName` and re-derives request keys through
`FromStandardName`:

```go
// lib/encoder/encoder.go:1234-1238 and 1263-1268
func FromStandardName(e Encoder, s string) string {
    if e == Standard { return s }
    return e.Encode(Standard.Decode(s))
}
func ToStandardName(e Encoder, s string) string {
    if e == Standard { return s }
    return Standard.Encode(e.Decode(s))
}
```

Running the real stored bytes through this exact chain (harness below) yields
`FromStandardName(ToStandardName(tainted)) == tainted`: the round trip is stable, and the
display form rclone shows (`lsf`) is `‛‛：` because `Standard.Encode` re-doubles the quote.
The wire confirms it: rclone issues a HEAD for the byte-exact stored key and Garage answers
`404`, while the clean twin answers `200`:

```text
HEAD /files/.../%E2%80%9B%E2%80%9B%EF%BC%9A...第1卷.pdf  ->  HTTP/1.1 404 Not Found   (tainted)
HEAD /files/.../%EF%BC%9A...第1卷.pdf                    ->  HTTP/1.1 200 OK          (clean twin)
```

`%E2%80%9B%E2%80%9B%EF%BC%9A` is U+201B U+201B U+FF1A, the exact stored key.
So rclone requests the right key; Garage v2.3.0 returns `404` on `HeadObject` for a key its
`ListObjectsV2` returns with a real size.
That list/HEAD inconsistency, on a key that rclone double-encoding created, is the proximate
cause of `Failed to read metadata: object not found`.

### Why one bad object is fatal

rclone bisync escalates a per-object failure during resync to a critical error that aborts
the run and forces a fresh `--resync`:

```go
// cmd/bisync/resync.go (b.critical set on copy/list failures, e.g. lines 67, 94, 116, 126, 150, 157, 166)
b.critical = true
```

With `b.critical` set, bisync prints `Bisync aborted. Must run --resync to recover` rather
than skipping the single un-HEADable source object and continuing.
`--resilient` and `--recover` do not downgrade this to a skip.

## Verification

Versions under test:

- rclone `v1.74.3` (Homebrew on the Mac and the desktop binary; both ends).
- rclone source read at commit `df9935d71ef553eff775e6e3394baaac06d45173`
  (`VERSION` = `v1.75.0`); the encoder constants and the `EncodeColon` path are long-standing
  and unchanged from `v1.74.3`.
- Garage `dxflrs/garage:v2.3.0`, single node, bucket `files`, behind self-managed Caddy.

### Harness 1: the encoder round trip (Go, offline)

A throwaway module that replaces `github.com/rclone/rclone` with the local clone and calls
`lib/encoder` directly. `go.mod`:

```go
// go.mod
module encharness

go 1.26

require github.com/rclone/rclone v0.0.0

replace github.com/rclone/rclone => /tmp/agent/rclone-enc-20260608
```

```go
// main.go
package main

import (
    "fmt"

    "github.com/rclone/rclone/lib/encoder"
)

func main() {
    const (
        quote = "‛" // U+201B rclone QuoteRune
        fwc   = "：" // U+FF1A fullwidth colon (legit char in the title)
    )
    s3 := encoder.EncodeInvalidUtf8 | encoder.EncodeSlash | encoder.EncodeDot
    win := s3 | encoder.EncodeColon

    clean := "江泽民文选" + fwc + "第1卷.pdf"
    tainted := "江泽民文选" + quote + quote + fwc + "第1卷.pdf"

    // Origin: a Colon-mask pass then an S3-default pass reproduces the stored bytes.
    fmt.Println("mixed double-encode == tainted?", s3.Encode(win.Encode(clean)) == tainted)
    // Round trip the S3 backend actually uses is stable (so HEAD asks for the right key):
    fmt.Println("backend round trip stable?    ",
        s3.FromStandardName(s3.ToStandardName(tainted)) == tainted)
    // The clean twin also round trips:
    fmt.Println("clean round trip stable?      ",
        s3.FromStandardName(s3.ToStandardName(clean)) == clean)
}
```

Run with `GOFLAGS=-mod=mod GOPROXY=off GOSUMDB=off go run .`. Output:

```text
mixed double-encode == tainted? true
backend round trip stable?     true
clean round trip stable?       true
```

The first `true` proves the origin; the second proves rclone requests the byte-exact stored
key, disproving the round-trip-bug hypothesis.

### Harness 2: list works, HEAD 404 (rclone against the live bucket, read only)

```bash
# the phantom key: LIST returns it with a real size, HEAD 404s it
rclone lsl "garage:files/Plain/Text/Books/self help/" | grep '江泽民'
#   4492720 ... 江泽民文选‛‛：第1卷.pdf      <- phantom, real size
#   4492720 ... 江泽民文选：第1卷.pdf        <- clean twin, identical size
name='江泽民文选‛‛：第1卷.pdf'
rclone --dump headers --low-level-retries 1 --retries 1 \
  lsjson --stat "garage:files/Plain/Text/Books/self help/$name" 2>&1 | grep -iE 'HEAD /|HTTP/1.1'
#   HEAD /files/.../%E2%80%9B%E2%80%9B%EF%BC%9A...第1卷.pdf HTTP/1.1
#   HTTP/1.1 404 Not Found
```

Patterns that work cleanly: any key whose name has no fullwidth colon; the clean twins
(`江泽民文选：第N卷.pdf`), which HEAD `200` with their true sizes (4492720, 5896878, 8159462).

Patterns that fail: the six doubled-quote keys listed in Symptom, every one of which lists
with a real size but HEADs `404`.

## Verified workarounds

### Align the encoder mask across every client (prevention, verified mechanism)

The double-encode cannot happen if no two passes disagree on `EncodeColon`.
Make every writer to the bucket use the same `--s3-encoding`.
The rclone desktop and Mac clients already use the S3 default
(`InvalidUtf8,Slash,Dot`, no colon); the remaining unknown is Android FolderSync's
S3 key handling.
Tradeoff: requires auditing and pinning every client's encoding, and if FolderSync cannot
express the identical mask the mismatch (and the phantom keys) can recur.
This prevents new phantoms; it does not remove the six that already exist.

### Delete the six phantom keys (permanent cleanup, partially verified)

Verified safe-to-delete: every phantom has a clean twin that HEADs `200` with a byte-identical
size, so the data is fully present under the correct name and the phantom is pure duplication.

```bash
# enumerate phantoms (read only)
rclone lsf -R garage:files/Plain | grep '‛'
# for each, confirm a clean twin exists and HEADs 200 BEFORE deleting, then:
rclone deletefile "garage:files/Plain/Text/Books/self help/江泽民文选‛‛：第1卷.pdf"
```

Tradeoffs and the unverified step: the bucket is shared state (desktop, Mac, Android), so this
needs coordination and explicit authorization.
`rclone deletefile` may itself HEAD-check the object first and inherit the same `404`; if it
refuses, fall back to a low-level S3 delete that issues `DeleteObject` without a precondition
HEAD.
Test the exact delete against one key on a throwaway bucket before running it on `files`.

### Exclude the phantoms so bisync ignores them (symptom mask, proposed)

```bash
rclone bisync garage:files/Plain ~/Plain --filter '- *‛*' ...
```

The `‛` in the filter must be the literal U+201B byte.
Tradeoffs: this only stops bisync from choking; the duplicates keep consuming storage, the
filter rides on every invocation, and nothing prevents recreation.

## What does not work

- Treating it as an rclone `encode`/`decode` asymmetry and patching the encoder: disproven.
  Harness 1 shows the backend round trip is stable and Harness 2 shows rclone HEADs the exact
  stored bytes; the `404` is Garage's.
- `--resilient` / `--recover`: do not downgrade the critical abort to a per-object skip; the
  desktop run still aborted with `Must run --resync to recover`.
- Re-running `--resync`: re-establishes the baseline but leaves the six phantom keys in place,
  so the next run trips on them again.
- Deleting only the local doubled-name files (the desktop's earlier patch): clears the local
  `lstat` variant but leaves the six remote phantom keys, which still break every client that
  lists the bucket.

## Upstream filing decision

Default policy is do not file. Two candidate targets, neither cleanly fileable as-is.

Duplicate search: `gh search issues --repo rclone/rclone` for `encoding double`,
`201b quote rune`, and `object not found encoding bisync` returned nothing, but `gh search`
is rate-limited in this environment (see [gh-search-rate-limit.md](gh-search-rate-limit.md)),
so the empty result is weak evidence.
Garage's tracker is self-hosted Gitea at `git.deuxfleurs.fr`, not reachable through `gh`, so
the Garage side was not searched.

Constraint walk:

1. Upstream's fault? Split. The double-encode needs a cross-client mask mismatch, which is a
   pipeline/config condition, not a single-pass rclone defect. The bisync-aborts-on-one-bad-
   object behavior is arguably an rclone robustness defect. The list/HEAD inconsistency is
   plausibly a genuine Garage bug, unconfirmed against Garage source.
2. Can upstream fix it? rclone could skip an un-HEADable source object with a warning instead
   of a critical abort; Garage could make HEAD consistent with LIST. Both fixable in principle.
3. Supporting the use case? Yes for both (S3 sync of arbitrary UTF-8 keys is core to each).
4. Would the repo welcome it? Not assessed; no prototype prepared.
5. Will they likely fix it? Unknown; trackers not adequately searched (rate limit; Gitea).
6. Minimal fix prototyped? No.

Prototype abandoned deliberately, not skipped silently: the rclone origin is a config
mismatch rather than a clear defect, confirming the Garage list/HEAD inconsistency as a bug
would need Garage-source tracing that is out of scope for the immediate goal (recovering the
user's bucket), and Garage is not filable through the tooling here.
The user's actionable fix is the cleanup plus encoder alignment above, not an upstream patch.

Kept draft, do not file as-is, for the more defensible rclone-side robustness gap:

~~~md
Title: bisync aborts the whole run on a single un-HEADable source object even with --resilient

Labels: bug, bisync

A remote S3 object that ListObjectsV2 returns but HeadObject 404s (here: a Garage key that an
earlier mismatched-encoding pass double-encoded) makes `rclone bisync` log
`Failed to read metadata: object not found` and then escalate to a critical abort
(`Bisync aborted. Must run --resync to recover`), rather than skipping that one object and
continuing. `--resilient` and `--recover` do not change this.

Repro: put one object whose key cannot be HEADed (or simulate a backend returning 404 on HEAD
for a listed key), then run bisync against a populated tree; the whole run aborts.

Source: cmd/bisync/resync.go sets b.critical on the copy/list failure path; with b.critical
set the run aborts. A skip-with-warning path for a single un-readable source object would let
the rest of the sync complete.

(Reproduction harness, byte-level evidence, and the encoder double-encode mechanism that
created the offending key are in our internal troubleshooting notes; this report covers only
the bisync abort behavior. Drafted with AI assistance; reproduction and source trace
verified by hand.)
~~~
