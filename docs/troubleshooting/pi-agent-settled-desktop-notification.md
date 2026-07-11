# Pi 0.80.6 leaves a completed agent run without a KDE desktop notification

A Pi agent can become fully idle while its terminal is unfocused,
without emitting a host-system notification.
The missing alert is not a Pi core defect:
the installed version exposes the required lifecycle hook for a consumer-side extension.

## Symptom

After Pi finishes a response,
including retries,
compaction recovery,
and queued follow-up work,
the terminal returns to its idle prompt.
The existing `pi-terminal-title` package changes the terminal title,
but does not create a desktop notification.
A user working outside the terminal receives no completion alert.

The desired meaning of “stops” is the agent becoming idle,
not the Pi process exiting.
Pi's `session_shutdown` also occurs for `/reload`,
`/new`,
`/resume`,
and `/fork`,
so treating every shutdown as a completion would create unrelated alerts.

## Root cause

Pi 0.80.6 deliberately exposes settlement to extensions.
`packages/coding-agent/src/core/agent-session.ts:534-542` clears the active-run state,
emits `agent_settled` to extensions,
then resolves idle waiters:

```ts
private async _emitAgentSettled(): Promise<void> {
	this._isAgentRunActive = false;
	try {
		await this._extensionRunner.emit({ type: "agent_settled" });
		this._emit({ type: "agent_settled" });
	} finally {
		this._resolveIdleWaitIfIdle();
	}
}
```

The public hook contract in
`packages/coding-agent/src/core/extensions/types.ts:708-711`
explicitly says this event runs only after retries,
compaction,
and queued continuations are exhausted:

```ts
/** Fired after an agent run has fully settled and no automatic retry, compaction, or queued continuation will run. */
export interface AgentSettledEvent {
	type: "agent_settled";
}
```

The same file exposes the extension subscription overload at
`packages/coding-agent/src/core/extensions/types.ts:1193-1201`:

```ts
on(event: "agent_end", handler: ExtensionHandler<AgentEndEvent>): void;
on(event: "agent_settled", handler: ExtensionHandler<AgentSettledEvent>): void;
on(event: "turn_start", handler: ExtensionHandler<TurnStartEvent>): void;
```

A desktop alert therefore belongs in a global Pi extension,
rather than in Pi core or in the unrelated terminal-title package.
Pi's upstream contribution guide also says features outside its minimal core should be extensions.

## Verification

### Versions and source

- Installed `@earendil-works/pi-coding-agent`:
   `0.80.6`.
- Source inspected:
   `earendil-works/pi` tag `v0.80.6`,
   commit
  `2b3fda9921b5590f285165287bd442a25817f17b`,
  cloned at `/var/home/user/temp/agent/pi-mono-stop-notification-2026-07-11`.
- Desktop environment:
   KDE Plasma on Wayland.
- Notification server:
   `plasmashell` owns `org.freedesktop.Notifications` on the user D-Bus.
- Notification client:
   `notify-send 0.8.8`.

The host delivery primitive was exercised directly:

```sh
# /var/home/user/Monochromatic
notify-send --app-name=Pi 'Pi notification capability verified' \
  'Desktop notifications will be used when the agent becomes idle.'
```

It exited successfully.
`busctl --user list` also identified `plasmashell` as the owner of
`org.freedesktop.Notifications`.

### Settlement cases that satisfy the requirement

Pi's regression test at
`packages/coding-agent/test/suite/regressions/6363-agent-settled-event.test.ts:29-61`
proves one `agent_settled` event after an automatic retry,
while `agent_end` occurs twice:

```ts
expect(harness.eventsOfType("agent_end").map((event) => event.willRetry)).toEqual([true, false]);
expect(harness.eventsOfType("agent_settled")).toHaveLength(1);
expect(extensionEvents).toEqual(["agent_end", "agent_end", "agent_settled:true"]);
```

The follow-up test at
`packages/coding-agent/test/suite/regressions/6363-agent-settled-event.test.ts:64-89`
proves settlement waits for a follow-up queued from an `agent_end` handler:

```ts
expect(getUserTexts(harness)).toEqual(["hello", "status follow-up"]);
expect(harness.eventsOfType("agent_end")).toHaveLength(2);
expect(harness.eventsOfType("agent_settled")).toHaveLength(1);
expect(settledIdleStates).toEqual([true]);
```

The error and abort cases in
`packages/coding-agent/test/suite/agent-session-retry-events.test.ts:326-361`
also end with `agent_settled`.
The completion notification should therefore fire after ordinary completion,
provider errors,
and user aborts,
which is the literal meaning of notifying whenever the agent stops.

### Cases that do not satisfy the requirement

- `agent_end` is too early:
  Pi can retry or process a queued continuation afterwards,
  producing premature or duplicate notifications.
- `session_shutdown` is the wrong signal:
  it covers session replacement and reload as well as quitting.
- `ctx.ui.notify()` only adds Pi UI output.
  It does not deliver a KDE system notification when the terminal is unfocused.

## Verified workaround

No installed extension currently sends a completion notification.
The verified consumer-side delivery primitive is `notify-send` with static argument-vector input,
as shown in "Verification".

The existing auto-mode extension uses the same executable for approval alerts in
`packages/pi-plugins/auto-mode/src/ask-user.ts:47-158`.
It invokes `notify-send` without shell interpolation,
limits the subprocess to one second,
and catches delivery failures so notification trouble cannot block Pi.
The completion extension should preserve those boundary properties.

## What does not work

- Adding desktop notification behavior to `pi-terminal-title` mixes an OS delivery concern with terminal-title rendering,
  and its current `agent_end` handler has the wrong lifecycle semantics for completion.
- Filing an upstream request for a built-in notification would conflict with Pi's extension-oriented core policy.
- Making notification delivery fatal would convert an unavailable D-Bus service,
  a missing executable,
  or a headless session into an agent failure.

## Upstream filing decision

`.out-of-scope/` was searched on 2026-07-11.
No exemption covers Pi desktop completion notifications.

The upstream issue and pull-request searches used
`agent_settled notification` and `notify-send`,
across open and closed state in `earendil-works/pi`.
No matching desktop-completion notification proposal or implementation was found.
The broad `notify-send` results concern unrelated provider,
TUI,
and extension issues.

The filing gate resolves as follows:

1. **Is this upstream's fault?
   ** No.
   Pi exposes the precise event needed by the consumer integration.
2. **Can upstream change core?
   ** Yes,
   but no core change is necessary.
3. **Is this use case supported?
   ** Yes.
   `agent_settled` is a typed extension event designed to report final agent idleness.
4. **Would upstream welcome this core contribution?
   ** No.
   `CONTRIBUTING.md` says features outside Pi's minimal core should be extensions,
   and it warns against agent-generated tracker submissions.
5. **Will upstream likely change it?
   ** No evidence supports a core change,
   because the supported extension seam already solves it.
6. **Has a compatible upstream prototype been made?
   ** Not applicable.
   The first gate fails and a core patch would be unnecessary scope expansion.

No upstream issue or comment should be filed.
The consumer-side extension is the durable resolution.
