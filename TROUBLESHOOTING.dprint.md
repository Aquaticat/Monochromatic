# dprint Formatter Troubleshooting

## Slow Startup Performance

### Problem
dprint experiences slow startup times when installed as a package dependency.

### Solution
Removed dprint from root `package.json` and now managed through `.prototools`.

### Impact
- Faster project initialization
- Reduced dependency installation time
- Tool version managed independently from Node dependencies
- This is why peer dependency `dprint` isn't declared in `config-dprint` package

## VSCode Extension Cannot Find dprint in WSL

### Problem
When using VSCode on Windows connected to a WSL workspace, the dprint extension fails with:
```
[Error] dprint client: couldn't create connection to server.
Launching server using command dprint failed. Error: spawn dprint ENOENT
```

### Root Cause
The dprint VSCode extension looks for the `dprint` executable in the system PATH.
In pnpm workspaces, dprint is installed locally in `node_modules/.bin/` but not globally available.

### Solution 1: Configure Extension Path
Configure the extension to use the local dprint installation by adding to your workspace settings:

**For `.code-workspace` files**:
```json
{
  "settings": {
    "dprint.path": "./node_modules/.bin/dprint"
    // ... other settings
  }
}
```

**For `.vscode/settings.json`**:
```json
{
  "dprint.path": "./node_modules/.bin/dprint"
}
```

After adding this setting, reload the VSCode window for changes to take effect.

### Solution 2: Global Installation
Install dprint globally in WSL:
```bash
npm install -g dprint
```

This makes dprint available system-wide but requires maintaining a separate global installation.

## TypeScript Path Warnings

### Problem
You see warnings when running dprint:
```txt
warn: Non-relative path "packages/config/eslint/src/index.ts" is not allowed when "baseUrl" is not set (did you forget a leading "./"?)
```

### Solution
See [TypeScript Troubleshooting](./TROUBLESHOOTING.typescript.md#typescript-path-warnings-with-dprint) for baseUrl configuration.