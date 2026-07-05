# terminal-title

Shared terminal title formatting helpers for agent harness integrations.

## Purpose

This package contains the host-neutral pieces of terminal title rendering:
truncation,
path shortening,
field extraction,
tense-aware formatter entries,
shell command shortening,
prefix application,
UTF-8 byte caps at terminal output boundaries,
and registry lookup.

Host packages keep their own event adapters,
tool registries,
prefixes,
and side effects.
For example,
pi still calls `ctx.ui.setTitle()`,
while Claude Code still writes OSC 0 sequences through its hook CLI.

## Entry points

```ts
import {
  field,
  formatToolTitle,
  pathFormat,
  prefixedTitle,
  quotedFormat,
  shortCommand,
  truncateTerminalTitlePayload,
} from '@monochromatic-dev/module-terminal-title';
```

Source imports are also available for workspace packages:

```ts
import { formatToolTitle } from '@monochromatic-dev/module-terminal-title/ts';
```

## Terminal byte cap

Terminal output boundaries should call `truncateTerminalTitlePayload()` on the final title payload text
before handing it to a host API or wrapping it in an OSC title sequence.
The default cap is 255 UTF-8 bytes,
which stays below Ghostty's current 256-byte reject threshold for title payloads.
