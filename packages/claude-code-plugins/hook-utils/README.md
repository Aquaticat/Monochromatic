# hook-utils

Shared I/O utilities for Claude Code hook plugins.

## Exports

- `readStdin()` -- reads the full stdin stream as a string, for parsing the JSON event payload that Claude Code sends to command hooks
- `writeOutput(output)` -- serializes a `HookOutputBase` (or subtype) to JSON and writes it to stdout

## Usage

```ts
import { readStdin, writeOutput } from '@monochromatic-dev/claude-code-plugins-hook-utils'
import type { StopInput, StopOutput } from '@monochromatic-dev/claude-code-plugins-hook-types'

const event = JSON.parse(await readStdin()) as StopInput

const output: StopOutput = { decision: 'block', reason: 'Investigate first' }
writeOutput(output)
```

## Installation

Already included as a workspace dependency in hook plugin packages.
Add to a new plugin's `package.json`:

```json
{
  "dependencies": {
    "@monochromatic-dev/claude-code-plugins-hook-utils": "workspace:*"
  }
}
```
