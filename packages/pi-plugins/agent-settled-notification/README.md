# pi-agent-settled-notification

Pi extension that sends a Freedesktop desktop notification when an agent becomes idle.

## Behavior

The extension subscribes only to Pi's `agent_settled` event.
This event fires after automatic retries,
compaction recovery,
and queued follow-up work are complete.
It also fires after provider errors and user aborts.

The extension calls `notify-send` with a static title and body.
Its notification subprocess is limited to one second,
so Pi can wait briefly for a delivery result without an unbounded stall.
A missing desktop session,
D-Bus server,
or executable is logged once per Pi runtime and never fails the agent run.

## Installation

Add the package to global Pi settings:

```json
{
  "packages": [
    "/var/home/user/Monochromatic/packages/pi-plugins/agent-settled-notification"
  ]
}
```

Restart Pi or run `/reload` after updating the setting.

## Development

Run package validation from the repository root:

```sh
mise run //packages/pi-plugins/agent-settled-notification:build
mise run //packages/pi-plugins/agent-settled-notification:lint
mise run //packages/pi-plugins/agent-settled-notification:test:unit
mise run //packages/pi-plugins/agent-settled-notification:verify:extension
```
