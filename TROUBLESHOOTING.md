## TypeScript Path Warnings with dprint

### Problem
You see warnings when running dprint or other tools:
```txt
warn: Non-relative path "packages/config/eslint/src/index.ts" is not allowed when "baseUrl" is not set (did you forget a leading "./"?)
```

### Solution
Set `baseUrl` to `"./"` in your root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": "./"
  }
}
```

This tells TypeScript to resolve non-relative paths from the project root, which is necessary when using path mappings in a monorepo structure.

### Note
Setting `baseUrl` may or may not completely resolve the warnings, but it helps TypeScript understand that non-relative paths in the `paths` mapping should be resolved from the project root.

## Open workspace in development container fails

The download of VS Code Server may fail because you're not using the official Microsoft branded VS Code version.

[Download latest VS Code Server](https://update.code.visualstudio.com/latest/server-linux-x64/stable)

## Vitest UI port binding fails on Windows

When running `pnpm exec vitest --ui`, you may encounter permission denied errors:

```
Error: listen EACCES: permission denied 127.0.0.1:3000
Error: listen EACCES: permission denied ::1:51204
```

### Root cause
Windows restricts port binding to certain address ranges, particularly:
- IPv6 loopback (`::1`) binding is often blocked
- Localhost (`127.0.0.1`) binding may be restricted for certain port ranges
- Ports in the 49152-65535 range are commonly restricted

### Solution
Use `0.0.0.0` (all network interfaces) instead of localhost:

```bash
# Working command
pnpm exec vitest --ui --api.host 0.0.0.0 --api.port 3000

# Or with other common development ports
pnpm exec vitest --ui --api.host 0.0.0.0 --api.port 8080
pnpm exec vitest --ui --api.host 0.0.0.0 --api.port 5173
```

### Permanent configuration
Add to your [`vitest.config.ts`](vitest.config.ts:1):

```typescript
export default defineConfig({
  test: {
    // ... existing configuration
    api: {
      port: 3000,
      host: '0.0.0.0'
    }
  }
})
```

Then run: `vitest --ui`

## Moon performance in WSL

Moon runs significantly slower in WSL compared to native Windows execution due to file system translation overhead.

### Performance comparison
- **Build tasks**: ~52 seconds (WSL) vs ~22 seconds (Windows native) - 2.4x slower
- **Test runs**: ~60 seconds (WSL) vs ~18 seconds (Windows native) - 3.3x slower

### Root causes
1. WSL file system operations are slower due to translation layer between Linux and Windows
2. Process spawning has additional overhead in WSL
3. The `@moonrepo/cli` package adds another layer of indirection when installed in workspace

### Solutions

#### Option 1: Use Windows moon.exe from WSL (Recommended)
```bash
# Use the Windows moon executable directly
/mnt/c/Users/$USER/.proto/shims/moon.exe run build

# Or create an alias in your .bashrc
echo 'alias moon="/mnt/c/Users/$USER/.proto/shims/moon.exe"' >> ~/.bashrc
source ~/.bashrc
```

#### Option 2: Remove @moonrepo/cli from workspace
The `@moonrepo/cli` package was removed from this workspace to reduce overhead.
When moon detects this package in the workspace root, it delegates to it instead of running directly, adding extra latency.

```bash
# Remove if present in your workspace
pnpm remove @moonrepo/cli
```

### Trade-offs
- **Windows moon.exe**: Faster execution but may have issues with path translations for complex scenarios
- **WSL moon**: Slower but guaranteed compatibility with Linux-specific tools and scripts
- **No @moonrepo/cli**: Requires global moon installation via proto, but eliminates delegation overhead

### Security note
Binding to `0.0.0.0` makes the Vitest UI accessible from other devices on your network at `http://[your-ip]:3000`. This is typically fine for development but be aware of network accessibility.

### Command flags clarification
- Use `--api.host` and `--api.port` for Vitest UI server configuration
- **Not** `--host` and `--port` (those are for different Vite functionality)

## Vitest `Failed to resolve dependency: vitest > strip-literal, present in client 'optimizeDeps.include'`

`pnpm-workspace.yaml`

```yaml
packageExtensions:
  vitest:
    dependencies:
      'strip-literal': '>=3.0.0'
```

## Vitest and Vite type incompatible

Use one version of vite:
```yaml name=pnpm-workspace.yaml
catalog:
  "vite": "catalog:"
overrides:
  vite: 'catalog:'
```

## Stylelint can't resolve postcss-html

```txt
Error: Cannot resolve custom syntax module "postcss-html". Check that module "postcss-html" is available and spelled correctly.  Caused by: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'postcss-html' imported from C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\utils\dynamicImport.cjs     at getCustomSyntax (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\getPostcssResult.cjs:87:11)     at async getPostcssResult (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\getPostcssResult.cjs:30:17)     at async lintSource (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\lintSource.cjs:87:4)     at async postcssPlugin.standalone [as lint] (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\standalone.cjs:150:26)     at async Nm.lintDocument (c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:6761)     at async fy.Rq (c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:66442)     at async Ef.iy (c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:55936)     at async c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:54917
```

```yaml name=pnpm-workspace.yaml
packageExtensions:
  stylelint:
    dependencies:
      'postcss-html': '*'
```

## ESLint Configuration

### Custom Parsers and Processors

1. **Parser vs Processor**:
   - Use a custom **parser** when you need to parse a different file format entirely (like .astro, .vue)
   - Use a **processor** when you need to extract JavaScript/TypeScript from within another file format
   - Parsers give you full control over the AST and type checking

2. **Plugin Configuration with Type Safety**:
   - Don't use `Object.assign` to add configs to a plugin - TypeScript can't track the type changes
   - Instead, create a new const with the full type:
     ```ts
     const plugin: FlatConfig.Plugin = { meta: {...}, configs: {} };
     const pluginWithConfig: FlatConfig.Plugin & { configs: { recommended: FlatConfig.Config[] } } = {
       ...plugin,
       configs: { recommended: [...] }
     };
     export default pluginWithConfig;
     ```

3. **Parser Options Inheritance**:
   - Don't duplicate `languageOptions.parserOptions` in plugin configs if they're already defined in the main config
   - The main config's parser options will be merged automatically

4. **Type Definitions for ESLint**:
   - Use `@typescript-eslint/utils/ts-eslint` for proper TypeScript types (`FlatConfig.Plugin`, etc.)
   - The basic `eslint` package types are incomplete for advanced use cases

5. **Virtual Files and Project Service**:
   - When creating virtual files (like `file.astro/frontmatter.ts`), TypeScript's projectService won't recognize them
   - Solutions:
     - Use a custom parser instead of a processor
     - Or configure `allowDefaultProject` with specific patterns (but no `**` allowed)

## Helix Editor Installation on Debian

### The PPA Problem
Helix installation guides often mention using PPAs (Personal Package Archives):
```bash
# This WILL NOT work on Debian!
sudo add-apt-repository ppa:maveonair/helix-editor
```

This fails with:
```
AttributeError: 'NoneType' object has no attribute 'people'
```

**Root cause**: PPAs are Ubuntu-specific. They don't work on Debian or Debian-based systems (except Ubuntu derivatives).

### Installation Methods for Debian

#### Method 1: Homebrew (Recommended)
Homebrew works excellently on Linux/WSL despite its macOS origins:

1. **Install Homebrew**:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Add Homebrew to PATH**:
   ```bash
   echo 'export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"' >> ~/.profile
   source ~/.profile
   ```

3. **Install Helix**:
   ```bash
   brew install helix
   ```

#### Method 2: Pre-built Binary
Download the latest release directly from GitHub:
```bash
curl -LO https://github.com/helix-editor/helix/releases/download/25.01/helix-25.01-x86_64-linux.tar.xz
tar xf helix-25.01-x86_64-linux.tar.xz
sudo mv helix-25.01-x86_64-linux/hx /usr/local/bin/
```

#### Method 3: Build from Source
For the latest features:
```bash
git clone https://github.com/helix-editor/helix
cd helix
cargo install --path helix-term --locked
```

### Common Issues and Solutions

#### Issue: Homebrew PATH Override
**Symptom**: After adding Homebrew to PATH, commands like `ls`, `cd`, etc. stop working.

**Bad** (overwrites entire PATH):
```bash
export PATH="/home/linuxbrew/.linuxbrew/bin"
```

**Good** (appends to PATH):
```bash
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"
```

#### Issue: Homebrew gcc Post-install Warnings
**Symptom**: When installing Helix via Homebrew:
```
Warning: The post-install step did not complete successfully
```

**Solution**: This warning is harmless if you have system gcc installed:
```bash
# Install system gcc first
sudo apt install gcc

# Then install Helix
brew install helix
```

To avoid Homebrew installing its own gcc:
1. Ensure system gcc is installed first
2. If Homebrew already installed gcc, you can remove it:
   ```bash
   brew uninstall helix
   brew uninstall gcc  # This will auto-remove if nothing depends on it
   brew install helix  # Will use system gcc
   ```

#### Issue 4: Runtime Library Dependencies
Helix installed via Homebrew may link to Homebrew's libraries. Check with:
```bash
ldd $(which hx) | grep gcc
```

- If it shows `/home/linuxbrew/.linuxbrew/...`: Using Homebrew's gcc
- If it shows `/lib/x86_64-linux-gnu/...`: Using system gcc

### Verification
After installation, verify Helix is working:
```bash
hx --version  # Should show version
hx --health   # Shows language server status
```

### Notes
- Helix doesn't require a plugin system - language servers provide IDE features
- Configuration lives in `~/.config/helix/`
- The health check warnings about missing runtime directories are normal on fresh installs

## Performance Optimizations

### Moon Prepare Optimization - 2025-06-16

#### Problem
`moon run prepare` taking 50+ seconds due to slow command executions in WSL.

#### Root Causes
1. WSL file system overhead when executing binaries from `/mnt/c/`
2. `pnpm exec` commands taking ~27s each in WSL
3. Unnecessary command executions when simple file checks would suffice

#### Solutions Implemented

##### 1. Created TypeScript scripts to replace shell commands:
- `moon.preparePlaywright.ts`: Check browser dirs instead of running `playwright install --list`
- `moon.pnpmInstall.ts`: Auto-decline pnpm reinstall prompt
- `moon.valeSync.ts`: Check if packages exist before syncing
- `moon.installVale.ts`: Unified cross-platform vale installation

##### 2. Key optimizations:
- Use file system checks instead of executing binaries
- Use native OS commands (`which`, `where.exe`) for existence checks
- Add PATH updates to `~/.profile` for snap binaries

##### 3. Results:
- **Before**: 50+ seconds
- **After**: 1.54 seconds (97% improvement)
- All bun TypeScript scripts consistently take ~80-100ms
- Actual work (file checks) takes <10ms per script

##### 4. Moon tips:
- Clear cache: `moon clean --lifetime '1 seconds'`
- Run specific test: `moon run testUnit -- <file-path>`
- Shell commands need `shell: true` option for proper parsing

#### Key Takeaway
In WSL environments, avoid executing binaries when file system checks suffice. The overhead of process creation and file system translation can turn millisecond operations into 30-second waits.

## Package Management Warnings

### Don't run `pnpm up`

It will turn `>=` in `package.json` into exact versions.

## Configuration Snippets

### GitHub MCP Server Configuration (Half Working)

```json
"github.com/github/github-mcp-server": {
"autoApprove": [
"get_me"
],

"disabled": false,
"timeout": 60,
"type": "stdio",
"command": "podman",
"args": [
"--remote=true",
"--url",
"ssh://core@127.0.0.1:62090/run/user/1000/podman/podman.sock",
"--identity",
"C:\\Users\\user\\.local\\share\\containers\\podman\\machine\\machine",
"run",
"-i",
"--rm",
"-e",
"GITHUB_PERSONAL_ACCESS_TOKEN",
"ghcr.io/github/github-mcp-server"
],
"env": {
"GITHUB_PERSONAL_ACCESS_TOKEN": "REDACTED"
}
}
```

### Building Caddy with Extensions

```bash
./xcaddy build --with github.com/mholt/caddy-events-exec --with github.com/mholt/caddy-webdav --with github.com/mholt/caddy-l4 --with github.com/porech/caddy-maxmind-geolocation --with github.com/mholt/caddy-ratelimit --with github.com/caddyserver/cache-handler --with github.com/caddyserver/jsonc-adapter --with github.com/caddy-dns/porkbun --with github.com/caddy-dns/njalla
```

## Proto Tool Version Management

### Problem: Proto automatically creates version pins

Proto creates a global `.prototools` file at `~/.proto/.prototools` that pins specific versions of tools.
This causes issues when:
- Tools are updated but the old version is still used
- Moon shows "new version available" messages despite having the latest version installed
- You want to always use the latest versions

### Example Issue
```bash
# Moon says there's a new version despite having it installed
moon run prepare
# Output: There's a new version of moon available, 1.37.3 (currently on 1.37.2)!

# But the new version is already installed
proto install moon latest
# Output: moon 1.37.3 has already been installed!

# The issue: global .prototools is pinning the old version
cat ~/.proto/.prototools
# Output:
# moon = "1.37.2"
```

### Solutions

#### Option 1: Manual version update
Edit `~/.proto/.prototools` to update pinned versions:
```bash
# Update the version in the file
sed -i 's/moon = "1.37.2"/moon = "1.37.3"/' ~/.proto/.prototools
```

#### Option 2: Delete old versions to force updates
```bash
# Remove the old version
rm -rf ~/.proto/tools/moon/1.37.2

# Proto will now use the latest available version
moon --version
```

#### Option 3: Use proto's auto-install feature
Add to your shell configuration:
```bash
# ~/.bashrc or ~/.zshrc
export PROTO_AUTO_INSTALL=true
```

This will automatically install the version specified in `.prototools` files.

#### Option 4: Use "latest" in .prototools (Recommended)
The cleanest solution is to use "latest" as the version in `.prototools` files:

```bash
# First, configure proto to not pin specific versions
echo 'pin-latest = false' >> ~/.proto/config.toml

# Then create a .prototools file with "latest" versions
cat > ~/.proto/.prototools << EOF
bun = "latest"
moon = "latest"
node = "latest"
pnpm = "latest"
proto = "latest"
EOF
```

This approach:
- Always uses the latest installed version of each tool
- Doesn't pin to specific versions
- Avoids "Failed to detect version" errors
- No environment variables needed

**Important**: You must have `pin-latest = false` in your proto config, otherwise proto will replace "latest" with specific version numbers when you install tools.

### Notes
- Proto creates `.prototools` automatically when installing tools (unless `pin-latest = false`)
- The file serves as a global version constraint
- Project-specific `.prototools` files override the global one
- Proto contextually detects versions from the environment (e.g., package.json)
- Without pinned versions, proto will use the latest installed version available

### Related: pnpm url.parse() deprecation warning
When running pnpm commands, you may see:
```
(node:12345) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized...
```

This is from pnpm 10.12.1's internal dependencies (npm-package-arg).
It's harmless but cannot be fixed locally - wait for pnpm to update their dependencies.

## dprint VSCode Extension Cannot Find dprint in WSL

### Problem
When using VSCode on Windows connected to a WSL workspace, the dprint extension fails with:
```
[Error] dprint client: couldn't create connection to server.
Launching server using command dprint failed. Error: spawn dprint ENOENT
```

### Root Cause
The dprint VSCode extension looks for the `dprint` executable in the system PATH.
In pnpm workspaces, dprint is installed locally in `node_modules/.bin/` but not globally available.

### Solution
Configure the extension to use the local dprint installation by adding to your workspace settings:

1. **For `.code-workspace` files**:
   ```json
   {
     "settings": {
       "dprint.path": "./node_modules/.bin/dprint"
       // ... other settings
     }
   }
   ```

2. **For `.vscode/settings.json`**:
   ```json
   {
     "dprint.path": "./node_modules/.bin/dprint"
   }
   ```

After adding this setting, reload the VSCode window for changes to take effect.

### Alternative Solution
Install dprint globally in WSL:
```bash
npm install -g dprint
```

This makes dprint available system-wide but requires maintaining a separate global installation.

## Vite Config Build Order in Moon

### Problem
When running `moon run prepareAndBuild` on a fresh clone, packages that depend on `@monochromatic-dev/config-vite` fail with:
```
Failed to resolve entry for package "@monochromatic-dev/config-vite". The package may have incorrect main/module/exports specified in its package.json.
```

### Root Cause
Moon's automatic dependency installation works correctly with `language: 'typescript'` configuration, but the build order issue occurs because:
1. The `js_default` task (inherited by all packages) uses vite to build
2. Packages that import from `@monochromatic-dev/config-vite` try to use it before it's built
3. This creates a circular dependency: vite config needs to build itself using vite

### Solution
Import directly from the TypeScript source file using the `.ts` export path:

```typescript
// Before - imports from built output
import { getVitestUnitWorkspace } from '@monochromatic-dev/config-vite';

// After - imports from TypeScript source
import { getVitestUnitWorkspace } from '@monochromatic-dev/config-vite/.ts';
```

The `@monochromatic-dev/config-vite` package exports field supports this:
```json
"exports": {
  ".": {
    "types": "./dist/final/types/src/index.d.ts",
    "default": "./dist/final/js/index.js"
  },
  "./.ts": {
    "default": "./src/index.ts"
  }
}
```

### Performance Note
There's a minimal performance penalty as Vite needs to transpile the TypeScript config on-the-fly, but since parent configs are already `.ts` files and vite can't bundle itself into the config, the impact is negligible.

### Affected Files
All vite config files that import from `@monochromatic-dev/config-vite`:
- `vitest.unit.config.ts`
- `vitest.browser.config.ts`
- `packages/config/eslint/vite.config.ts`
- `packages/figma-plugin/css-variables/vite.config.*.ts`

## Fresh Clone Setup: Lessons from the Build Order Saga

### The Journey
Setting up a monorepo to work correctly from a fresh clone involves multiple layers of complexity that only surface when starting from scratch. This section documents the complete journey of debugging and fixing fresh clone build issues.

### Issue 1: Dependencies Not Installing

**Symptom**: Running `moon run prepare` on a fresh clone would fail with module resolution errors.

**Root Cause**: Moon's automatic dependency installation requires the `language` field in project configurations. Without `language: 'typescript'`, Moon doesn't recognize that projects need Node.js dependencies and won't run the `InstallWorkspaceDeps` action.

**Fix**: Add `language: 'typescript'` to all TypeScript project moon.yml files.

### Issue 2: Build Order Dependencies

**Symptom**: After fixing dependency installation, builds would fail with:
```
Failed to resolve entry for package "@monochromatic-dev/config-vite"
```

**Investigation Path**:
1. Initially thought it was a moon.yml configuration issue
2. Tried adding `dependsOn` to project configurations
3. Discovered that project dependencies affect the project graph but not task dependencies
4. Attempted to add task-level dependencies but hit a circular dependency

**Root Cause**: The vite config package itself uses vite to build, creating a circular dependency. Packages importing from `@monochromatic-dev/config-vite` were trying to use the built output before it existed.

**Fix**: Import from TypeScript source using the `.ts` export path instead of the built output. This bypasses the build requirement at a small performance cost.

### Key Learnings

1. **Moon's Behavior**:
   - `language` field is required for automatic dependency installation
   - Project dependencies (`dependsOn`) != task dependencies
   - Task dependencies can create circular dependency issues
   - The `InstallWorkspaceDeps` action is language-aware

2. **Build System Design**:
   - Circular dependencies in build tools are particularly problematic
   - Package.json `exports` field can provide escape hatches
   - Sometimes importing from source is the pragmatic solution
   - Performance penalties may be acceptable to solve correctness issues

3. **Testing Philosophy**:
   - Always test with fresh clones before considering a fix complete
   - Build issues often cascade - fix one to reveal the next
   - The development environment can mask problems (cached dependencies, built artifacts)

4. **Debugging Approach**:
   - Start with the simplest possible fix (configuration)
   - Understand the tool's mental model (project vs task dependencies)
   - Consider unconventional solutions when conventional ones create new problems
   - Document the journey for future reference

### Best Practices for Fresh Clone Setup

1. **Configuration**:
   - Always set `language` field in moon.yml for projects with dependencies
   - Be explicit about build dependencies even if they seem obvious
   - Test configuration changes with `moon clean` and fresh clones

2. **Build Architecture**:
   - Avoid circular dependencies in build tooling
   - Provide source-based exports for configuration packages
   - Consider the bootstrap problem: how does a build tool build itself?

3. **Documentation**:
   - Document non-obvious solutions with context
   - Explain why unconventional approaches were chosen
   - Include the problem-solving journey, not just the solution

### The Meta Lesson

Fresh clone setup issues reveal the hidden assumptions in our development workflow. What works in an established development environment may fail catastrophically in a clean environment. Regular fresh clone testing is essential for maintaining a truly reproducible build system.

## Moon Cache Performance with Large Input Sets

### Problem
Tasks like `moon run testUnit` take significantly longer than expected due to Moon's cache computation overhead, not the actual test execution.

### Root Cause
Moon's caching system experiences performance degradation with:
1. **Filesystem-intensive operations**: Tasks that need to check many files
2. **Large input sets from expanded globs**: When `@group()` directives expand to hundreds or thousands of files
3. **Complex dependency graphs**: Tasks with many transitive dependencies

### Symptoms
- `moon run testUnit` takes ~33 seconds when the actual vitest execution only takes ~7 seconds
- The overhead comes from Moon computing cache keys for all expanded input files
- Performance degrades as the codebase grows

### Solution
Disable caching for affected tasks by adding `cache: false` to the task options:

```yaml
testUnit:
  command: 'vitest run --config vitest.unit.config.ts'
  inputs:
    - '@group(allUnitTests)'
    - '@group(allDists)'
  options:
    cache: false  # Disable cache due to performance overhead
```

### Affected Tasks
Common tasks that benefit from disabled caching:
- Test runners (large number of test files)
- Linters (scan entire codebase)
- Formatters (process many files)
- Any task using `@group()` directives that expand to many files

### Trade-offs
- **With caching**: Slower execution due to cache computation, but skips execution if inputs haven't changed
- **Without caching**: Faster execution, but runs every time regardless of changes

For frequently-run tasks like tests and linters, the performance gain from disabling cache usually outweighs the benefit of skipping unchanged runs.

### Debugging Tips
To identify cache-related performance issues:
1. Time the actual command execution vs the moon task execution
2. Check if the task has large input sets (many files or glob patterns)
3. Test with `cache: false` to see if performance improves
4. Use `moon clean --lifetime '1 seconds'` to clear cache when testing

### The Lesson: Rust Doesn't Make Everything Fast

This issue highlights an important lesson about performance assumptions:

**Just because a tool is written in Rust doesn't mean it's automatically fast for every use case.**

Moon is indeed a high-performance build orchestrator written in Rust, but performance characteristics depend on:
- **Algorithm complexity**: Cache key computation with thousands of files is inherently expensive
- **I/O patterns**: Even Rust can't make filesystem operations magically fast
- **Design trade-offs**: Moon's caching is optimized for avoiding redundant work, not for computing cache keys quickly

In this case, Moon's cache computation takes ~26 seconds for tasks with large input sets, while the actual task execution only takes ~7 seconds. The overhead completely negates the benefit of caching.

**Key takeaways**:
1. **Measure, don't assume**: Even "fast" tools can have slow paths
2. **Understand your tools**: Know when features help vs hurt performance
3. **Question defaults**: Default configurations may not suit your use case
4. **Profile edge cases**: Tools optimized for common cases may struggle with large inputs

The irony is that Moon's sophisticated caching system, designed to improve performance, actually makes things slower for certain workloads. This is a classic example of how performance optimizations can backfire when applied to the wrong problem domain.

## Vite Single-File HTML Output Directory Structure

### Problem
When building a single-file HTML application with Vite, the output preserves the source directory structure, resulting in `dist/final/src/index.html` instead of `dist/final/index.html`.

### Root Cause
Vite maintains the input directory structure in the output by default. When the rollup input is configured as:
```javascript
input: {
  index: join('src', 'index.html')
}
```
Vite creates the same `src/` directory in the output.

### Investigation
Initial attempts to fix this included:
1. Setting `subDir` parameter to empty string (`''`) or `'./'`
2. Modifying the `join()` paths to avoid creating subdirectories
3. Trying different root configurations

None of these worked because Vite was enforcing the directory structure based on the input path.

### Solution
Split the frontend configuration into two separate functions:

1. **`createPrefixedFrontendLikeConfig`**: For builds that need subdirectories (e.g., Figma plugins)
   - Explicitly sets input and output paths with subdirectories
   - Used by `getFigmaFrontend` and `getFigmaIframe`

2. **`createUnprefixedFrontendLikeConfig`**: For root-level builds
   - Only sets the root directory and plugins
   - Lets Vite use its default behavior for input/output
   - Used by `getFrontend`

```typescript
// Prefixed version - creates subdirectories
const createPrefixedFrontendLikeConfig = (configDir: string, subDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    // ... other config
    root: resolve(configDir),
    build: {
      rollupOptions: {
        input: {
          index: join('src', subDir, 'index.html'),
        },
      },
      outDir: join('dist', 'final', subDir),
    },
  });

// Unprefixed version - uses defaults
const createUnprefixedFrontendLikeConfig = (configDir: string): UserConfig =>
  mergeConfig(createBaseConfig(configDir), {
    // ... other config
    root: resolve(configDir),
    // No build configuration - uses Vite defaults
  });
```

### Usage
For projects that want a clean output structure:
```typescript
import { getFrontend } from '@monochromatic-dev/config-vite/.ts';
export default getFrontend(import.meta.dirname);
```

This produces output at `dist/final/js/index.html` without the `src/` subdirectory.

## `dprint` and `oxlint` slow startup

Removed them from root `package.json` and now using `.prototools` to manage them.

This is also why peer dependency `dprint` isn't declared in `config-dprint`.

## `proto` warning `It looks like you have an existing installation of Rust`

```txt
warn: It looks like you have an existing installation of Rust at:
warn: /usr/sbin
warn: It is recommended that rustup be the primary Rust installation.
warn: Otherwise you may have confusion unless you are careful with your PATH.
warn: If you are sure that you want both rustup and your already installed Rust
warn: then please reply `y' or `yes' or set RUSTUP_INIT_SKIP_PATH_CHECK to yes
warn: or pass `-y' to ignore all ignorable checks.
error: cannot install while Rust is installed
warn: continuing (because the -y flag is set and the error is ignorable)
info: profile set to 'default'
info: default host triple is x86_64-unknown-linux-gnu
```

Solution: Set `RUSTUP_INIT_SKIP_PATH_CHECK=yes`.

Reasoning: It's okay to have a global install of Rust, but we want the toolchain of current project to have the Rust version set in `.prototools`.

## Workspace Cycles: config-vite and module-es

### Problem
After refactoring `@monochromatic-dev/config-vite` to import utility functions from `@monochromatic-dev/module-es`, pnpm warns about cyclic workspace dependencies:
```
WARN  There are cyclic workspace dependencies: /home/user/projects/Monochromatic/packages/config/vite, /home/user/projects/Monochromatic/packages/module/es
```

### Root Cause
The circular dependency exists because:
1. `config-vite` imports utility functions (`notFalsyOrThrow`, `wait`, `alwaysTrue`) from `module-es`
2. `module-es` uses `config-vite` for its build configuration (vite.config.ts)

This creates a dependency cycle in the workspace graph.

### Solution
Disable pnpm's cycle detection by setting `disallowWorkspaceCycles: false` in `pnpm-workspace.yaml`:
```yaml
disallowWorkspaceCycles: false
```

### Why This Is Acceptable

1. **Build-time vs Runtime**: The cycle only exists at the workspace level. At runtime:
   - `config-vite` imports from `module-es` source files (`.ts` export)
   - `module-es` only uses `config-vite` during build time (vite.config.ts)
   - There's no actual runtime circular dependency

2. **TypeScript Source Imports**: By importing from `@monochromatic-dev/module-es/.ts`, we bypass the need for built artifacts, avoiding the bootstrap problem where each package would need the other to be built first.

3. **Development Experience**: The cycle doesn't impact:
   - Development workflow (everything works with source files)
   - Build process (vite handles TypeScript transpilation on-the-fly)
   - Type checking (TypeScript resolves types from source)

4. **Code Quality**: The refactoring improved code quality by:
   - Eliminating code duplication
   - Following DRY principle
   - Centralizing utility functions where they belong

### Trade-offs

**Benefits**:
- Cleaner code with no duplication
- Utilities maintained in one place
- Better adherence to single responsibility principle

**Costs**:
- Workspace-level circular dependency warning
- Slightly more complex dependency graph
- Need to document why the cycle exists

### Alternative Considered
We could have kept the duplicated code to avoid the cycle, but this would:
- Violate DRY principle
- Create maintenance burden (updating utilities in multiple places)
- Increase risk of divergence between implementations

The workspace cycle is a reasonable trade-off for better code organization and maintainability.
