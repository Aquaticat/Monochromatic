# module/fs-id package plan

## Status

Planning only, not built.
The deliverable this session is this plan plus the matching correction to
`docs/decisions/cli-git-policies-platform.md`; no package code lands yet.
The plan was driven by a round of external review of the cli-git trust model that
challenged the filesystem-id stability claims, and by grilling that settled the
resolution strategy below.

## Why the package exists

`packages/cli/git`'s trust model keys its allowlist on a filesystem id so that a path
trusted on one volume is not trusted when a different volume is mounted at the same path.
That id mechanic exists today only inside a paused package,
`packages-paused/desktop-daemon/editord/src/server/operations/resolve-fs-id.ts`, and it is
both unshared and latently wrong, so it cannot be depended on in place.

The current editord implementation has three defects this package fixes:

- It claims the Linux value (`f_fsid` via `stat -f --format=%i`) is "stable across reboots".
  That is filesystem-specific: true for btrfs and ext4 where `f_fsid` derives from the
  on-disk UUID, false for XFS and others where `f_fsid` derives from the device
  `major:minor`, which moves when device enumeration changes across reboots.
- On macOS it reads `stat -f '%v'` and calls the result `f_fsid`.
  On BSD `stat`, `-f` is the format-string flag, not the statfs flag, and `%v` is the
  device number (`st_dev`), not `f_fsid` at all.
  So macOS today keys on a device number that is neither a filesystem identifier nor
  reboot-stable, and the TSDoc misdescribes both the value and the invocation.
- Its TSDoc claims Windows reads `fsutil` while the code reads `vol`.

So this is an extraction and a correctness fix, not a lift-and-shift.

The governing constraint, surfaced during grilling, is that usability is itself a security
property here.
A trust tool that hard-fails on an exotic filesystem, or that demands a re-trust ritual
after every reboot, trains people to reach for the global bypass, and a disabled trust
check protects nothing.
The design therefore optimizes for never giving a user a reason to skirt it.

## The model

Resolve a reboot-stable volume identifier wherever the platform can produce one, and warn
when stability cannot be guaranteed rather than failing.

- Prefer a reboot-stable id (a filesystem or volume UUID) per platform.
- When only a runtime id is available, degrade to it, mark the result not-stable, and warn.
- Never throw merely because a stable id is unavailable.
  Throwing is reserved for an unsupported platform or a total resolution failure.

The result reports which kind of id it found and whether it is reboot-stable, so a consumer
that ever wants fail-closed behavior can inspect the flag itself.
Neither current consumer wants that, so no throw-on-unstable mode is baked into the API.

The same model satisfies both consumers despite their opposite failure tolerances:
cli-git wants to stay usable everywhere (so it takes the degrade-and-warn path), and editord
wants graceful localStorage keying (so it also degrades rather than failing).

The mount-swap security property holds in every mode: a different volume mounted at the same
path yields a different id (a different UUID when stable, a different runtime id when
degraded), so the old trust entry stops matching either way.
Degrading only costs reboot-stability, which is annoyance, not insecurity.

## Resolution strategy per platform

Only the runtime id is changing kind across the degrade boundary, never silently within a
mode: a transient tooling hiccup on the preferred path is an error condition for that call,
not a quiet downgrade, so the resolved value does not flap and churn trust for no reason.

### Linux

- Preferred, reboot-stable: the filesystem UUID via
  `findmnt --target <path> --output=UUID --noheadings`.
  Verified on this host: it runs unprivileged and returns the on-disk UUID
  (`1bb3d23e-...` for the btrfs volume under `/var/home`).
  `lsblk --output=UUID` is an equivalent unprivileged fallback source.
  `blkid` is deliberately not the primary tool: bare `blkid` printed nothing without root on
  this host, and a root-only tool is exactly the "too hard, so people skirt it" failure mode.
  btrfs subvolumes share one filesystem UUID, which is correct: they are the same physical
  filesystem, so they should share a trust key.
- Degraded, not reboot-stable: `f_fsid` via `stat -f --format=%i` (the current editord value).
  Marked not-stable and warned, because its reboot-stability is filesystem-specific and
  cannot be guaranteed.

### macOS

These commands are recall, not verified on a real host; they must be tested on macOS before
the plan's macOS claims are trusted.

- Preferred, reboot-stable: the Volume UUID from `diskutil info <path>` (the `Volume UUID`
  field).
  `diskutil` is always present and needs no elevation.
- Degraded, not reboot-stable: the device number via BSD `stat -f %d`.
  This replaces the current `stat -f %v` value and is used only when `diskutil` cannot
  answer; it detects mount-swap but is not reboot-stable, so it is marked not-stable and
  warned.

### Windows

These commands are recall, not verified on a real host; they must be tested on Windows
before the plan's Windows claims are trusted.

- Preferred, reboot-stable: the volume serial via `vol` (or `fsutil volume`), reusing
  editord's already-tested `parseVolumeSerial`.
  A volume serial survives reboot, so it is marked stable.
  It changes on reformat, which is correct behavior: a reformatted volume is a different
  filesystem and should lose its old trust key.
- Future enhancement, not in the first cut: the volume GUID path via
  `GetVolumeNameForVolumeMountPoint` (`\\?\Volume{...}\`), a more canonical identity than the
  serial.
  The serial is adequate for reboot-stability and mount-swap, and reusing the tested parser
  keeps the first cut simple, so the GUID upgrade is deferred.

## API surface

The module is asynchronous, because the preferred paths spawn subprocesses
(`findmnt`, `diskutil`) and the repo's async conventions (PP1) prefer it.
editord's one synchronous module-level callsite becomes a top-level `await`, which ESM and
Bun support; editord is paused, so that migration is future-scoped.

```ts
// packages/module/fs-id/src/resolve-fs-id.ts (shape, not final)

/**
 * Colon-free volume identifier. Colon-free is a contract, not an accident: cli-git's
 * `CLI_GIT_PARANOID` key is `"<fsId>:<path>"`, recovered by splitting on the first colon,
 * which only round-trips (even for a Windows `C:\` path) when the id carries no colon.
 */
type FsId = string & { readonly __brand: 'FsId'; };

/**
 * Which underlying identity produced the value, and whether it is reboot-stable.
 */
type FsIdSource =
  | 'fs-uuid'
  | 'volume-uuid'
  | 'volume-serial'
  | 'f-fsid'
  | 'device-number';

type FsIdResolution = {
  readonly value: FsId;
  readonly stable: boolean;
  readonly source: FsIdSource;
  // present only when stable === false; explains why stability is not guaranteed
  readonly reason?: string;
};

async function resolveFsId(
  { path, }: { readonly path: string; },
): Promise<FsIdResolution>;
```

Design points:

- Named single-object parameter (ST9), explicit return type (TY1), union of string literals
  over an enum (TY3), branded `FsId` for the domain primitive (TY3).
- The module owns the stability warning.
  When `stable` is false it emits a tagged warning through `@monochromatic-dev/module-logger`
  (TLG), naming the path and the reason, so the warning is a property of the mechanism rather
  than something each consumer must remember to add.
  Making the warning opt-in per consumer would be the same skirting hazard one level up.
  Consumers may add their own context on top (cli-git phrases it as "trust for this path may
  need refreshing after a reboot").
- The module guarantees `value` is colon-free and a test asserts it, so the cli-git key
  contract cannot silently regress.
- Per-process memoization keyed by absolute path avoids re-spawning `findmnt`/`diskutil`.
  cli-git processes are short-lived (one git command) and editord resolves once at startup,
  so a simple `Map` memo is sufficient and mount changes mid-process are not a concern for
  either consumer.

## Failure handling

- Unsupported platform (not Linux, macOS, or Windows): throw, as editord does today.
- Preferred path errors transiently: that call fails over to the degraded path for that
  platform, marks the result not-stable, and warns.
  It does not retry the preferred path in a way that could flap.
- Degraded path also fails (no id obtainable at all): throw, because there is genuinely
  nothing to key on; this is distinct from "stable id unavailable", which degrades.

## Consumers and migration

### cli-git

First real consumer.
It takes the degrade-and-warn path (not fail-closed), per the grilling decision that
fail-closed on exotic filesystems would push users toward the global bypass.
It uses `resolution.value` as the filesystem-id component of its trust key and of
`CLI_GIT_PARANOID`.
The colon-free guarantee keeps `"<fsId>:<path>"` parseable by first-colon split.
cli-git surfaces the module's not-stable warning to the developer as a re-trust hint.

### editord (paused)

editord's `resolveFsId` is the seed implementation; the canonical version moves here and
editord becomes a consumer when it is unpaused.
Migrating it fixes its latent macOS `st_dev` bug and removes the false "stable across
reboots" claim.
The callsite (`packages-paused/desktop-daemon/editord/src/server/index.ts`, the module-level
`const FS_ID = resolveFsId(...)`) becomes `await resolveFsId(...)`.
editord may keep the degraded value silently or as a one-time note; its localStorage keying
tolerates churn.
Do not touch the paused editord code as part of building this package; record the migration
as a precondition for unpausing editord instead.

## Package scaffolding

Mirror `packages/module/fs-path` (the closest sibling, also filesystem-domain and
logger-dependent), with one deviation: no browser build.
fs-id spawns OS commands through `node:child_process`, so it is Node and Bun only and has no
browser or OPFS target.

- `packages/module/fs-id/package.json`: name `@monochromatic-dev/module-fs-id`, `private`,
  `type: module`, exports `.` (built `dist/final/node`) and `./ts` plus `./ts/*` (source per
  ST3), dependency `@monochromatic-dev/module-logger`, devDependencies
  `@monochromatic-dev/config-tsdown`, `@monochromatic-dev/config-typescript`,
  `@monochromatic-dev/module-test`, `@types/node`, `tsdown`, `typescript` (AP3, DM1, DM2).
- `packages/module/fs-id/mise.toml`: extend the shared `build`, `build:js`, `lint`,
  `lint:oxlint`, `lint:types` tasks like siblings do, but omit every `:browser` task (AP2).
  The tsdown config targets node, not neutral or browser.
- `tsconfig.json` extending `@monochromatic-dev/config-typescript`.
- `README.md` (PKG requires it before the package is complete).

## Testing

Per-file `*.unit.test.ts` co-located with each source file, run through the
`@monochromatic-dev/module-test` harness, following `packages/module/or-throw`.
Do not add a `self.unit.test.ts` aggregator; that single-file self-test pattern (as in
fs-path) is an anti-pattern and is not repeated here.
The `mise` `test` task runs the harness, or individual files via `bun <file>` (CM4); never
`bun test` directly (CM4) and never `node src/self.unit.test.ts`.

Coverage must enumerate every branch (TCV), not just the happy path:

- `parseVolumeSerial`: migrate editord's existing adversarial cases (empty, no-label,
  label-without-value, leading whitespace, internal-whitespace termination, case-insensitive
  label) into this package.
- Platform dispatch: each of the Linux, macOS, Windows branches, plus the unsupported-platform
  throw.
- Degrade boundary: preferred-path success returns `stable: true`; preferred-path failure
  returns the degraded value with `stable: false`, a `reason`, and an emitted warning;
  total failure throws.
- The colon-free `value` contract: assert no resolved value contains a colon, including the
  Windows serial and GUID forms, so the cli-git key cannot regress (STB, since the value
  crosses into cli-git's key grammar).

## Verification status

- Linux preferred and degraded paths are verified on this host (`findmnt --output=UUID`
  unprivileged, `stat -f --format=%i`, both colon-free).
- macOS (`diskutil info` Volume UUID, `stat -f %d`) and Windows (`vol`/`fsutil` serial,
  volume GUID) commands are recall, not verified on a real host.
  They must be run on real macOS and Windows machines and their output shapes confirmed
  before implementation relies on them (TAE).

## Open questions for implementation

- Exact tsdown node-target config and whether a `dist/final/node` or a different dist layout
  is the right convention for a Node-only module package.
- Whether the per-process memo should key on the absolute path or on the resolved mount
  point (mount point is more correct but needs an extra resolution step).
- The precise warning copy and log level for the not-stable case, coordinated with cli-git's
  re-trust hint so the two do not double up.

## References

- `packages-paused/desktop-daemon/editord/src/server/operations/resolve-fs-id.ts`: the seed
  implementation and its `parseVolumeSerial`, with the defects this package fixes.
- `packages-paused/desktop-daemon/editord/src/server/operations/resolve-fs-id.unit.test.ts`:
  the `parseVolumeSerial` tests to migrate.
- `packages-paused/desktop-daemon/editord/src/server/index.ts`: the synchronous callsite that
  becomes a top-level `await` on migration.
- `docs/decisions/cli-git-policies-platform.md`: the trust model that consumes this id and
  the corrected description of it.
- `packages/module/fs-path`: the sibling scaffolding mirrored here (minus the browser build).
- `packages/module/or-throw`: the per-file unit-test layout followed here.
