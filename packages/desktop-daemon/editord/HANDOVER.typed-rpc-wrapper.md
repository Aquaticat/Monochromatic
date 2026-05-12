# Path A handover: typed wrapper over the existing WebSocket client

## Status (post commit-1, paused before commit-2 edits)

### Done

Commit 1 landed: `feat(desktop-daemon/editord): type EditorWsClient.request() return by request variant` (SHA `f3b7e04a`).

-   `RequestResponseMap` added to `src/protocol.ts` in a new `//region Request/response mapping` block. The 19-entry map matches the verified request-to-response pairings (see "Design sketch" below).
-   `EditorWsClient.request()` retyped at `src/client/ws/client.ts:164-204`. Signature is now `async request<TReq extends ClientRequest,>(message: TReq,): Promise<RequestResponseMap[TReq['type']]>`. The body is unchanged; one `as` cast at the return widens the type-erasure gap with an `oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion` suppression justified by wire-id correlation.
-   `mise run //packages/desktop-daemon/editord:lint:types` passes. `mise run //packages/desktop-daemon/editord:build` passes. Lint count is unchanged from baseline (5 errors / 42 warnings) — verified via a `git stash` round-trip before committing.

### Remaining

Commit 2: drop manual narrowing at the call sites. 18 awaited-`request()` calls across 11 files. Process each per the per-site sanity check in the plan ("Step-by-step execution plan" -> "Commit 2"). Use the field-required reference below to decide whether each guard is dead (delete it) or behavioral (keep it).

#### Files inspected but not edited

These were read while planning commit 2 in the previous session. The patterns are confirmed; the edits have not been applied.

-   `src/client/app/app.ts` — 2 calls: lines 121-125 (`'entries' in r ? r.entries : []`) and lines 148-153 (`'results' in r ? r.results : []`). Both guards are dead; `entries` is required on `dirListing` and `results` is required on `searchResults`. Drop the ternary, return the array directly.
-   `src/client/app/context-actions.ts` — 6 `fsActionDone` calls (lines 36-83). All discard the response; no narrowing or casts to remove. Inferred types narrow automatically; the file is structurally unchanged.
-   `src/client/app/file-loader.ts` — 1 call at line 72. Drop the `if (!('kind' in r)) return null;` at lines 76-77 and the `as FileKind` cast at line 79 (kind is required on `fileContent`). **Keep** the `if ('mediaInfo' in r && typeof r.mediaInfo === 'string')` guard at line 85 — `mediaInfo` is **optional** on `fileContent`, so the guard is behavioral, not type-narrowing. The `'content' in r` guards at lines 100 and 108 are also dead (content is required); drop them and use `r.content` directly. Remove the paired `oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion` suppression at line 78.

#### Files still to inspect

-   `src/client/app/lsp-actions.ts` (1 call)
-   `src/client/app/lsp-completions.ts` (1 call)
-   `src/client/app/lsp-goto-definition.ts` (1 call)
-   `src/client/app/lsp-references.ts` (1 call)
-   `src/client/app/lsp-rename.ts` (2 calls)
-   `src/client/hover/request.ts` (1 call — `'contents' in response` guard at line 66 is dead, contents is required on `hoverResult`; the `if (contents !== '')` check at line 69 is separate and stays)
-   `src/client/inlay/fetch.ts` (1 call)
-   `src/client/selection/fetch.ts` (1 call)

#### Reference: required vs optional fields on each response variant

Read from `src/protocol-server.ts`. Use to decide guard fate: required fields = dead guard, optional fields = behavioral guard (keep).

-   `fileContent`: kind required, content required, **mediaInfo optional**
-   `saved`: `{ id, path }`
-   `dirListing`: entries required
-   `searchResults`: results required
-   `hoverResult`: contents required, **range optional**
-   `completionResult`: items required
-   `formatResult`: edits required
-   `definitionResult`: FilePosition fields (path, line, character) required
-   `referencesResult`: locations required
-   `inlayHintResult`: hints required
-   `selectionRangeResult`: ranges required
-   `prepareRenameResult`: canRename required, **range optional, placeholder optional**
-   `renameResult`: edits required
-   `fsActionDone`: `{ id }`

#### Pre-existing lint debt (not from this work)

`mise run //packages/desktop-daemon/editord:lint` exits 1 with 5 errors / 42 warnings as of commit 1. All errors are `no-restricted-syntax(no-function-root-let)` in files unrelated to this task: `src/client/app/lsp.ts`, `src/client/app/lsp-hover.ts`, `src/client/app/lsp-completions.ts:54-55`, `src/server/index-routes.ts:90`, and `src/client/ws/client.ts:225` (the pre-existing `let data: ServerMessage;` in `#handleMessage`). My commit-1 edits do not add to this count — verified by stashing the change, running lint, popping the stash, and re-running.

This means acceptance criterion 3 ("`:lint` exits zero") in the plan below cannot be satisfied without separate cleanup. Options for the next session: (a) treat the pre-existing baseline as the post-condition for this task and document it, or (b) include a `chore(editord)` commit fixing the `no-function-root-let` violations before declaring commit-2 done. Either choice is reasonable; (a) keeps the scope tight to typed-RPC work, (b) leaves the package in a lint-clean state.

## What you are picking up

editord is a local-only editor daemon serving a contenteditable PWA over WebSocket. Package: `packages/desktop-daemon/editord/`. The wire protocol is JSON over WebSocket with a `{type, id, ...}` envelope. Request/response correlation, 30-second timeouts, exponential-backoff reconnect, and token auth are all working and shipped (see `src/client/ws/client.ts`).

The protocol layer is already RPC-shaped. The one ergonomic gap: `EditorWsClient.request()` at `src/client/ws/client.ts:164` returns `Promise<ServerMessage>` (the full server-message union), so every call site narrows manually:

```ts
const result = await client.request({ type: 'open', id, path });
if (result.type !== 'fileContent') throw new Error('unexpected response');
const { content, kind } = result;
```

Closing that narrowing gap is the entire task.

## The decision

Implement a typed wrapper over `EditorWsClient.request()` that returns the response variant matching the request type. No wire change. No new dependencies. No server refactor.

1.  Define `RequestResponseMap` next to the protocol unions: a mapped type from each `ClientRequest['type']` to its corresponding success-side `ServerMessage` variant.
2.  Make `EditorWsClient.request()` generic so the return type is `Promise<RequestResponseMap[TReq['type']]>` instead of `Promise<ServerMessage>`. Runtime behavior unchanged; only the type signature narrows.
3.  Update the call sites to drop their manual `if (result.type !== 'X')` blocks and read response fields directly.

Concrete call-site count, verified via `rg -c "(client|ws)\.(request|notify)\b" src/client/`: 22 calls across 13 files.

## Why this path and not a library migration

A deeper investigation produced a ranked alternative set. Summary of why path A wins:

-   oRPC migration (`@orpc/server/bun-ws` or `experimental_CrosswsHandler`): full typed-procedure framework with end-to-end inferred types and wire-level `ABORT_SIGNAL`. Costs: a new runtime validator dep (Zod, Valibot, or Arktype), losing the working reconnect logic at `src/client/ws/client.ts:288`, replacing the entire wire format, and either dropping h3 from the WS path or adopting `experimental_CrosswsHandler` whose own export name signals API instability. The realised benefit over path A is runtime input validation at the server boundary, which the current `ws-dispatch*.ts` does not currently lack a workaround for.
-   tRPC migration (community Bun adapter, 91 stars, single maintainer): same migration cost as oRPC, plus the official tRPC server-side WebSocket re-implementation was closed not planned at <https://github.com/trpc/trpc/issues/6598> and the project is steering toward SSE. Choosing tRPC for a WebSocket-only daemon picks the library moving away from WebSockets.
-   Do nothing: keep manual narrowing at every call site. No risk, no gain.

The realised gain of any library migration over path A is ecosystem tooling (codegen, devtools, schema-driven docs). A localhost-only single-consumer daemon (see `PHILOSOPHY.md`) has no consumer for that tooling.

Three triggers would later flip this decision: a second client appears (CLI, headless test harness, second frontend), runtime input validation at the server boundary becomes a requirement, or wire-level request cancellation becomes necessary. Until one of those, path A captures the realised value of any migration.

## Scope

In scope:

-   Define `RequestResponseMap` mapping each request `type` to its matching success-side response variant.
-   Update `EditorWsClient.request()` return type. Body is unchanged.
-   Remove manual `if (result.type !== 'X')` narrowing at the 22 call sites. Replace with direct destructuring.
-   Update TSDoc on `request()` to reflect the typed return.

Out of scope:

-   Any change to the wire format on the WebSocket. Bytes on the wire are identical before and after.
-   Any change to server-side dispatch in `src/server/ws-dispatch*.ts` or `src/server/ws.ts`.
-   Any change to reconnect (`src/client/ws/client.ts:274-313`), timeout (`:39`), or token auth.
-   Any introduction of a runtime validator (Zod, Valibot, Arktype).
-   Any introduction of a third-party RPC library.
-   Any change to `notify()`: it already returns `Promise<void>` and that is correct for notifications.
-   Any change to push notifications (`fileChanged`, `diagnostics`): they are already exposed via typed `onFileChanged` / `onDiagnostics` callbacks on `EditorWsClient`.

## Design sketch

The mapped type lives next to the message-type unions, ideally in `src/protocol.ts` (or a new sibling file `src/request-response-map.ts` to keep `protocol.ts` under max-lines). Suggested shape:

```ts
/**
 * Maps each ClientRequest discriminant to its success-side ServerMessage variant.
 * The wire's `error` variant is rejected through the pending-request reject path
 * in EditorWsClient, so this map covers only success responses.
 */
export type RequestResponseMap = {
  open: Extract<ServerMessage, { type: 'fileContent'; }>;
  save: Extract<ServerMessage, { type: 'saved'; }>;
  listDir: Extract<ServerMessage, { type: 'dirListing'; }>;
  search: Extract<ServerMessage, { type: 'searchResults'; }>;
  hover: Extract<ServerMessage, { type: 'hoverResult'; }>;
  completion: Extract<ServerMessage, { type: 'completionResult'; }>;
  format: Extract<ServerMessage, { type: 'formatResult'; }>;
  gotoDefinition: Extract<ServerMessage, { type: 'definitionResult'; }>;
  findReferences: Extract<ServerMessage, { type: 'referencesResult'; }>;
  inlayHint: Extract<ServerMessage, { type: 'inlayHintResult'; }>;
  selectionRange: Extract<ServerMessage, { type: 'selectionRangeResult'; }>;
  prepareRename: Extract<ServerMessage, { type: 'prepareRenameResult'; }>;
  rename: Extract<ServerMessage, { type: 'renameResult'; }>;
  deleteEntry: Extract<ServerMessage, { type: 'fsActionDone'; }>;
  copyEntry: Extract<ServerMessage, { type: 'fsActionDone'; }>;
  moveEntry: Extract<ServerMessage, { type: 'fsActionDone'; }>;
  newEntry: Extract<ServerMessage, { type: 'fsActionDone'; }>;
  openInTerminal: Extract<ServerMessage, { type: 'fsActionDone'; }>;
  openInDefaultApp: Extract<ServerMessage, { type: 'fsActionDone'; }>;
};
```

`EditorWsClient.request()` becomes generic on the request variant:

```ts
async request<TReq extends ClientRequest>(
  message: TReq,
): Promise<RequestResponseMap[TReq['type']]>
```

The body is unchanged. The wire still carries an `error` variant; it is rejected through the existing `pending.reject(new Error(data.message))` path at `client.ts:262-263`, so the resolved value at every call site is always a success variant. No additional union handling at call sites.

Trade-off note: `RequestResponseMap` is hand-maintained. When a new request/response pair is added to the protocol, both the discriminated unions and `RequestResponseMap` must be updated. A conditional type that derives the map from a naming convention is possible but the current 19 entries do not justify the type-level complexity. Keep it explicit and let TypeScript catch a missing entry the first time a new request type is added.

Edge case to handle: the `fsActionDone` response is shared by six request types (`deleteEntry`, `copyEntry`, `moveEntry`, `newEntry`, `openInTerminal`, `openInDefaultApp`). Each maps to the same target variant. This is correct; the `Extract` resolves the same response shape for all six and the call sites all destructure only `{ id }`.

## Files to touch

-   `src/protocol.ts` (or a new `src/request-response-map.ts` re-exported from `protocol.ts`): add `RequestResponseMap`. If adding to `protocol.ts` would push it past max-lines, create the sibling file.
-   `src/client/ws/client.ts`: change `request()` signature only. Do not modify any other method, field, or constant.
-   Roughly 13 files under `src/client/` containing the 22 call sites. Enumerate via `rg -l "(client|ws)\.(request|notify)\b" src/client/`. Each touched site loses its narrowing block but keeps the value destructuring.
-   The TSDoc on `request()` already describes typed correlation; update the `@returns` to name the per-request response.

## Files to leave alone

-   `src/protocol-client.ts`, `src/protocol-server.ts`: the wire schemas. Untouched.
-   `src/server/`: server-side dispatch and operations. Untouched.
-   `src/client/ws/handshake.ts`: the initial handshake is not part of `request()`.
-   The reconnect, timeout, and lifecycle methods in `src/client/ws/client.ts`: `#scheduleReconnect`, `#wireConnection`, `#performHandshake`, `#handleClose`, `ready`, `#reconnectDelay`. The signature of `request()` is the only thing that changes in this file.

## Acceptance criteria

1.  Every call site previously doing `if (result.type !== 'X') throw ...` is gone. Each call site reads the typed fields directly without narrowing.
2.  `mise run //packages/desktop-daemon/editord:lint:types` exits zero.
3.  `mise run //packages/desktop-daemon/editord:lint` exits zero (catches any new oxlint violations introduced by removing narrowing blocks).
4.  `mise run //packages/desktop-daemon/editord:build` exits zero.
5.  Start the dev server via `mise run //packages/desktop-daemon/editord:start:server`, open the printed URL in Chrome, and verify the full feature surface manually: open a file, save, list a directory, search, format, hover, complete, jump to definition, find references, rename, refresh inlay hints, delete and create file tree entries, open in terminal. Type checking does not verify wire behavior; manual smoke is required.
6.  No new entries in `package.json`. No version changes. `dependencies` and `devDependencies` are identical before and after.
7.  The wire is unchanged: a network capture of a single `open` round trip before and after the change shows identical JSON.

## Reference material

-   The wire protocol is documented in `README.md` of this package.
-   Current request/response correlation: `src/client/ws/client.ts:164-204`.
-   Current reconnect logic: `src/client/ws/client.ts:274-313`.
-   Server-side dispatch entry point: `src/server/ws-dispatch.ts`.
-   Request union: `src/protocol-client.ts`. Response union: `src/protocol-server.ts`.
-   PHILOSOPHY rationale anchoring the no-library choice: `PHILOSOPHY.md` (sections on browser-as-platform, raw contenteditable, no editor framework).
