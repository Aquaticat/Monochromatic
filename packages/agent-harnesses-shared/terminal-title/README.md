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
} from '@monochromatic-dev/module-terminal-title';
```

Source imports are also available for workspace packages:

```ts
import { formatToolTitle } from '@monochromatic-dev/module-terminal-title/ts';
```
