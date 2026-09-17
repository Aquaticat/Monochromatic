# Issue #498 bash-poke promotion handover

## Authority and state

The user asked to resolve Aquaticat/Monochromatic#498 and invoked the grilling skill,
so design is being settled in rounds before any code is written.
Round 3 is pending.
No package files exist yet and the working tree is untouched,
apart from a pre-existing unrelated `mise.lock` modification that this task must not revert or stage.

The issue carries `ready-for-agent`,
which authorizes fix and commit under the issue-tracker skill,
but the grilling skill forbids acting before shared understanding,
so the commit waits for the user's confirmation.

## Cross-model caution

Rounds 1 and 2 ran on a different model,
and the user switched to a larger model mid-conversation while asking for care.
Every load-bearing pi fact recorded here was re-verified by reading the installed 0.85.1 distribution after that switch.
One round 2 claim was overstated and is corrected under "Message delivery".

## Verified pi 0.85.1 facts

Cited paths are relative to
`node_modules/.pnpm/@earendil-works+pi-coding-agent@0.85.1_supports-color@10.2.2/node_modules/@earendil-works/pi-coding-agent`.
The TUI and runtime facts come from the minified bundle `dist/bundle/chunks/chunk-JVUZSMYM.js`,
so they are cited by symbol name rather than line number.

### Execution takeover

- `dist/core/extensions/types.d.ts` declares `UserBashEvent` with `command`,
   `excludeFromContext`,
   and `cwd`,
  and `UserBashEventResult` with optional `operations` or `result`.
- TUI `handleBashCommand` renders a returned `result` once through `BashExecutionComponent`,
  records it with `recordBashResult`,
  and returns without awaiting anything,
  so an extension-owned child process keeps running detached.
- The same handler passes a returned `operations` into `await this.session.executeBash(...)`,
  which streams chunks and blocks until exit.
- Background semantics and pi-rendered streaming are therefore mutually exclusive through this event.

### Escape does not cancel an extension-owned job

- TUI `onEscape` branches in order:
   streaming restores queued messages and aborts;
  otherwise `session.isBashRunning` calls `session.abortBash()`;
  otherwise bash mode clears the editor;
  otherwise the double-escape action runs.
- `isBashRunning` is `_bashAbortControllers.size > 0`,
  and `executeBash` is the only place that adds a controller.
- Returning `result` never calls `executeBash`,
  so no controller exists and Escape cannot reach a job this extension spawned.
- This answers the user's round 2 Q15 question:
   Escape does not interrupt it for free.

### Message delivery

- Runtime `sendCustomMessage` behaves as follows.
  `deliverAs: "nextTurn"` queues for the next user prompt and never triggers.
  While streaming with `triggerTurn !== false`,
  `deliverAs: "followUp"` queues through `agent.followUp` and anything else steers.
  Otherwise,
   a truthy `triggerTurn` awaits `_runAgentPrompt`,
  and a falsy one appends or pends without a turn.
- So `{ triggerTurn: true, deliverAs: "followUp" }` fires immediately when idle
  and queues behind current work while streaming.
- Correction to the round 2 framing:
   converting a custom message to LLM context yields
  `{ role: "user", content }`,
  and `details` are excluded.
  The gain over `sendUserMessage` is transcript rendering,
  the `custom` session role,
  and structured renderer data,
  not model-side attribution.
  The model still receives a user-role message either way.

### Extension surface limits

- `ExtensionContext` in `dist/core/extensions/types.d.ts` exposes `ui`,
   `mode`,
   `hasUI`,
   `cwd`,
  `sessionManager`,
   `modelRegistry`,
   `model`,
   `scopedModels`,
   `thinkingLevel`,
  `isIdle()`,
   `isProjectTrusted()`,
   `signal`,
   `abort()`,
   `hasPendingMessages()`,
  `shutdown()`,
   `getContextUsage()`,
   `compact()`,
   and `getSystemPrompt()`.
- It exposes no settings accessor.
  A search for `Setting` in that declaration file returns nothing,
  so pi's `shellPath` and `shellCommandPrefix` settings are unreachable from an extension.
- `pi.events` is a generic extension-to-extension bus.
  Pi publishes no session events to it,
  so `auto_retry_start` and `auto_retry_end` are unobservable from an extension.
- `ctx.ui.setWidget(key, lines, options)` defaults to `placement: "aboveEditor"`.
- `ctx.ui.setStatus(key, text)` writes footer status text and clears on `undefined`.
- `ctx.ui.onTerminalInput(handler)` receives raw terminal input in interactive mode
  and may return `{ consume: true }`.
- `pi.registerShortcut(keyId, { description, handler })` exists,
  and `docs/keybindings.md` lists the defaults a new binding must avoid.
- `dist/core/tools/bash.d.ts` documents `createLocalBashOperations()`,
  and `dist/core/tools/truncate.d.ts` documents `truncateHead`,
   `truncateTail`,
   and `formatSize`.
  Both are rejected by decision,
   not by capability.
- `AssistantMessage` in `@earendil-works/pi-agent-core` `dist/types.d.ts`
  carries `stopReason`,
   whose values include `"error"`,
   plus `errorMessage`.
  Recorded for completeness only,
   because the retry ladder is out of scope.

### Host tooling for verification

- `tmux` 3.7c is installed at `/usr/bin/tmux`.
  `script` and `socat` exist;
   `expect` and `node-pty` do not.
- `pi --help` confirms `--extension`,
   `--no-extensions`,
   `--no-session`,
  `--no-context-files`,
   `--no-skills`,
   `--mode rpc`,
   and `--offline`.
- `docs/environment-variables.md` documents `PI_CODING_AGENT_DIR`
  as the config-directory override whose default is `~/.pi/agent`.
- `dist/modes/rpc/rpc-mode.js` emits `user_bash` for its `bash` command,
  which gives an integration path that needs no TUI.
- `nano-spawn` 2.1.0 is a catalog dependency in `pnpm-workspace.yaml`
  and is already used by `package/pi-plugin/agent-settled-notification`.
  Its `Subprocess` type exposes `nodeChildProcess`,
  so detached spawning and process-group termination are ours to implement.
- Sibling package shape,
   from `package/pi-plugin/agent-settled-notification`:
  `private: true`,
  `pi.extensions` pointing at `dist/final/node/index.mjs`,
  `exports["./ts"]` pointing at source,
  mise task stubs extending root tasks,
  and `verify:extension` plus `verify:pi-runtime` scripts under `src/`.
- `~/.pi/agent/settings.json` lists packages by absolute directory,
  and `~/.pi/agent/extensions/bash-poke.ts` is still auto-discovered there,
  so promotion deletes that file and adds the package directory.
- No `poke` or `bash-poke` match appears in `forbidden-strings.append.txt`,
  `forbidden-strings.append.local.txt`,
  or the `.cache/forbidden-strings*` rule files.

## Settled decisions

- `!` stays intercepted and background;
   `!!` stays native and hidden from context.
- Live progress is extension-owned,
   not pi-rendered streaming.
- No retry ladder and no usage-limit awareness.
  The extension may be used to wait for a limit reset,
  but it must not know the problem.
- Poke delivery uses `pi.sendMessage` with a registered renderer,
  `triggerTurn: true`,
  and `deliverAs: "followUp"`,
  subject to the attribution correction recorded above.
- This package owns as much as possible:
  its own spawn,
  output accumulation,
  truncation,
  overflow spooling,
  and process-group kill.
  `pi.exec`,
   `createLocalBashOperations()`,
   `truncateHead`,
   and `truncateTail` are out.
- All slash commands are cut,
   so `/poke` does not survive.
- Concurrency stays unrestricted,
   with one poke per finished command.
- Verification includes unit tests over every exported path,
  `verify:extension`,
  `verify:pi-runtime`,
  a committed provider-free fake-terminal check,
  and a documented manual real-provider step.
- Settings live in a global JSON file under `~/.pi/agent/extensions/`.
  The key set is still open.

## Rejected directions

- Returning `operations` to recover streaming,
  because it re-blocks the editor and removes the reason the extension exists.
- A new prefix intercepted through the `input` event to leave native `!` alone.
- Retry ladder variants,
   including error-kind gating and 429 observation.
- Pi's execution and truncation helpers.
- A slash-command list and cancel surface.

## Open questions for round 3

- Cancellation surface,
   now that Escape is proven inert:
  none plus shutdown kill,
  a `registerShortcut` binding,
  or raw Escape interception through `ctx.ui.onTerminalInput`.
- Which key,
   if a shortcut is chosen,
   given the defaults in `docs/keybindings.md`.
- Shell selection for this package's own spawn,
  because pi's `shellPath` setting is unreachable.
- Truncation direction,
   and whether overflow is spooled to a file this package owns.
- Settings key set and defaults.
- Job lifecycle on `session_shutdown`,
   session switch,
   and pi exit.
- Names to clear against the naming policy:
   `customType`,
   config file name,
   and logger tag.

## Next action

- Present round 3,
   including the Escape finding and the message-delivery correction.
- After shared understanding,
   create `package/pi-plugin/bash-poke`,
  then build,
   lint,
   type-check,
   test,
   and verify.
- Commit with `Closes #498`,
   then hand the user the `~/.pi/agent/settings.json` edit and the `/reload` step,
  because the agent cannot invoke `/reload` from inside a turn.
