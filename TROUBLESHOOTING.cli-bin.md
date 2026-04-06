# CLI bin entry troubleshooting

## CLI command hangs on Unix with ImageMagick errors

Running a CLI tool installed via `node_modules/.bin/` hangs indefinitely,
flooding stderr with messages like:

```text
import: unable to grab mouse '': Resource temporarily unavailable @ error/xwindow.c/XSelectWindow/9351
import: unable to read X window image '': Success @ error/xwindow.c/XImportImage/4961
import: missing an image filename `node:util' @ error/import.c/ImportImageCommand/1289
```

### Root cause

The TypeScript entry point referenced by `package.json` `bin` is missing a shebang line.
Without a shebang, Unix systems fall back to executing the file with `/bin/sh`.
Bash interprets each `import` statement as the ImageMagick `import` command,
which is a screenshot tool that tries to grab the X display.
On headless systems or when the display is unavailable, each invocation blocks or errors,
causing the script to hang or produce a wall of errors.

The `bun run <file>` invocation works fine because Bun handles the file directly
regardless of shebang — the problem only manifests when running through the
`node_modules/.bin/` symlink, which the OS executes directly.

### Solution

Add a shebang line as the first line of the CLI entry point:

```typescript
#!/usr/bin/env bun
import { parseArgs, } from 'node:util';
// ...
```

Then reinstall dependencies so the bin link is regenerated with the shebang:

```bash
bun install
```

### Cross-platform notes

The shebang is a Unix mechanism — Windows ignores it entirely.
On Windows, package managers (npm, bun, pnpm) generate `.cmd` and `.ps1` wrapper scripts
that invoke the runtime directly, so the shebang is never read.
Both mechanisms are needed for full cross-platform support:

- **Unix**: shebang tells the OS which runtime to use
- **Windows**: generated `.cmd` wrapper invokes the runtime, shebang is ignored

This means adding a shebang never breaks Windows — it is purely additive.
