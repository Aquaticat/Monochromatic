# CLI interface design

Status: locked
Date: 2026-05-11

External processes communicate with the running editord daemon through a CLI client (`editord-client`).
The client speaks HTTP to the existing h3 server, gated by the same `EDITORD_TOKEN` used on the WS endpoint.
Pure server-side operations (`format`, `diagnostics`, `status`) work whether or not a PWA is connected;
UI-routing operations (`open`) push messages to a connected PWA peer.

## Decisions

### Two bins (`editord` + `editord-client`)

The daemon stays at `editord` (existing entry, `src/server/index.ts`).
A new `editord-client` is added as a second `bin` entry in `package.json`,
implemented in `src/cli/index.ts` with the `#!/usr/bin/env bun` shebang.

Rationale: the daemon and the client have disjoint argv shapes.
The daemon reads `PORT` and `EDITORD_TOKEN` from env and takes no positional args;
the client takes verb plus positional plus flags.
Splitting at the binary boundary removes the argv-dispatch glue and gives each tool an independent `--help`.

Rejected alternatives:

- Single binary with subcommand (`editord open foo.ts`).
  Requires argv dispatch logic; "no args means start the daemon" is non-obvious to new users.
- Single binary with mode flag (`editord --client open foo.ts`).
  Same trade as subcommand; the flag is less greppable in shell history and docs.

### Transport: HTTP routes on the existing h3 server

`editord-client` POSTs JSON to `/cli/<op>` on the daemon's existing h3 server.
The token is read from `$TMPDIR/editord-<port>.token`
(existing port-keyed token file in `src/server/operations/token-file.ts`).
When `--port` is not specified, the client walks `$TMPDIR/editord-*.token` and picks the freshest by mtime
(within `FRESHNESS_THRESHOLD_MS = 3000`); ambiguity fails with a list of candidate ports.

Rationale: token discovery is already solved; h3 already routes;
the auth-check pattern is established on `/_ws`.
The dispatch layer (`src/server/ws-dispatch-*.ts`) can be reused
once the per-message action is split out of the WS-specific wrapper.

Rejected alternatives:

- Unix domain socket.
  More isolated (filesystem permissions instead of token-on-port),
  but doubles transport infrastructure and pulls in Windows divergence (named pipes).
- WS-only (CLI connects as a peer).
  Bidirectional stateful transport for a fire-and-forget op is awkward;
  handshake cost on every invocation; needs request-ID correlation.

### Op surface (six commands)

The CLI exposes operations that compose with editord's value-add (warm LSP/dprint, peer routing)
plus the conventional `open` for editor integrations.

- `editord-client open <path>[:line[:col]]`: push `showFile` to the targeted peer.
- `editord-client format <path>`: run dprint via the warm LSP pipeline, write the formatted bytes back.
- `editord-client diagnostics [<path>]`: print current diagnostics for a file or all open buffers.
- `editord-client status`: print port, root dir, uptime, peer count.
- `editord-client peers`: list peer IDs, connect time, last-active time, focused file (where known).
- `editord-client raw <type> '<json>'`: send any client-message type as JSON; generic escape hatch.

Rationale: `open`, `status`, `peers` are conventional CLI surface
(modeled on `emacsclient`, `nvim --remote-*`, `code`, `subl`, `zed`, all of which were checked).
`format` and `diagnostics` are differentiating ops:
the pitch is "LSP servers stay warm, no subprocess cold-start per invocation",
which is editord's actual value-add over standalone `dprint fmt` or `oxlint .`.
`raw` matches the `emacsclient --eval` / `nvim --remote-expr` escape-hatch pattern
and defers per-op subcommand design until real consumers ask.

Rejected alternatives:

- Dedicated subcommands for `goto-definition`, `find-references`, `rename`, `search`
  (initially proposed Tier 2).
  None of the surveyed editor CLIs expose these; consumers reach LSP queries through `raw` until demand appears.
- Dedicated subcommands for FS ops (`new`, `delete`, `move`, `copy`).
  Duplicates shell utilities; the editor tree refreshes via the existing watcher anyway.
- `--wait` flag.
  Conventional meaning is "block until the file is closed in the editor",
  which lacks a clear semantic in editord's single-PWA, no-tab-management architecture.
- `-` stdin to new buffer.
  No buffer-without-file in the current architecture.
- `--new-window` / `--reuse-window` / `-n` / `-r`.
  editord does not own window or tab management; Chrome does.

### Peer routing

Default: UI-routing operations target the last-active peer.
`--peer <glob>` overrides the default.

- `<glob>` matches case-insensitively against the 8-char peer ID
  using `*` (any sequence) and `?` (single char).
- Multiple matches: fan out to every matching peer.
- No matches with `--peer`: fail with non-zero exit and a clear message
  ("no peers match pattern <glob>").
- No peer connected (without `--peer`): fail with non-zero exit
  ("no PWA peers connected").

State-push messages (`diagnostics`, `fileChanged`) continue to broadcast to every peer;
peer routing applies only to UI commands (`showFile`, and `raw` targeting a UI command type).

Rejected alternatives:

- Separate `--broadcast` flag.
  Subsumed by `--peer '*'`; one mechanism, fewer flags, shell users already know glob.

### Last-active definition

On WS connect, `lastActiveMs` is initialized to `connectedAtMs`.
It is bumped when the server receives any of these inbound message types:
`open`, `save`, `format`, `didChange`, `hover`, `completion`, `gotoDefinition`, `findReferences`,
`inlayHint`, `selectionRange`, `prepareRename`, `rename`,
`deleteEntry`, `copyEntry`, `moveEntry`, `newEntry`,
`openInTerminal`, `openInDefaultApp`, `search`, `listDir`.

It is not bumped on housekeeping notifications: `watchDir` initial subscription, `didClose` alone.

Selection: max by `lastActiveMs` across peers.
Ties (equal millisecond) break by `peerId` lexicographically.
Because `lastActiveMs` starts at `connectedAtMs`, the most-recently-connected peer wins automatically
when no peer has had explicit user activity yet; no separate tiebreak rule is needed.

Rejected alternatives:

- Any inbound WS message counts.
  Background polling and `watchDir` setup are not user activity;
  this would mis-route to whichever peer happened to subscribe most recently.
- Explicit `didFocus` notification from the PWA on `document.visibilitychange` / `window.focus`.
  More accurate, but costs a PWA-side handler with debouncing.
  Deferred until accuracy of the heuristic is shown to be insufficient.

### Server state changes

- Replace `connectedPeers: Set<{ send }>` with `peers: Map<string, PeerEntry>` in `src/server/index.ts:109`.
- `PeerEntry = { send: (data: string) => void; lastActiveMs: number; connectedAtMs: number; focusedPath?: string }`.
- Peer ID: `crypto.randomUUID().slice(0, 8)` (32 bits of entropy; collision risk negligible for single-digit peer counts).
- Existing iterations (e.g. `for (const peer of connectedPeers)` in `handleDiagnostics` at `index.ts:134`
  and `handleFsChange` at `index.ts:163`) become `for (const entry of peers.values()) entry.send(...)`.
- Callers in `src/server/ws.ts` that receive `connectedPeers` via `createWsHandler` need the same Map migration.

### Protocol changes

Extend `protocol-server.ts:30` (existing `connected` message) with `peerId: string`
so the PWA learns its assigned ID on connect; no new `peerHello` message needed.

New server-to-client message types in `protocol-server.ts`:

- `showFile { path: string; position?: Position }`: UI-routing command emitted by the CLI's `open` op.
- `status { port: number; rootDir: string; uptimeMs: number; peerCount: number }`:
  response payload for `editord-client status`
  (the CLI receives this over the HTTP response body, not WS; it is declared here for shape reuse).
- `peers { entries: { id: string; connectedAtMs: number; lastActiveMs: number; focusedPath?: string }[] }`:
  response payload for `editord-client peers` (same HTTP-response shape note).

Tracking `focusedPath` per peer requires a new client-to-server notification (e.g. `didFocusFile { path }`).
Deferred until needed; the initial cut leaves `focusedPath` as `undefined`.

## Out of scope (deferred)

- Tier 2 dedicated subcommands (`goto-definition`, `find-references`, `rename`, `search`).
  Use `raw` until a consumer asks.
- Tier 3 FS ops (`new`, `delete`, `move`, `copy`) as dedicated subcommands.
  Use `raw` until a consumer asks.
- `--wait` flag.
  Revisit if a concrete use case appears.
- Explicit `didFocus` PWA notification.
  Layer on later if last-active accuracy degrades.
- Per-peer `focusedPath` tracking.
  Add when the first consumer needs it.

## References

- `src/server/index.ts:109`: `connectedPeers` Set, to be replaced.
- `src/server/index.ts:134`, `src/server/index.ts:163`: existing broadcast iterations.
- `src/server/operations/token-file.ts`: token file format and freshness threshold.
- `src/protocol-client.ts:22`: existing client-to-server `open` (request-content, not display-file).
- `src/protocol-server.ts:30`: existing `connected` message, to be extended with `peerId`.
- Editor CLI prior art (fetched 2026-05-11): emacsclient (GNU Emacs manual),
  nvim `--remote-*` (`runtime/doc/remote.txt`), VS Code `code` CLI docs, Sublime `subl` docs,
  Zed CLI source (`crates/cli/src/main.rs`).
- AGENTS.md: "Tool-fit before first-principles", "Vet vendor recommendations",
  "Maintain a decision document".
