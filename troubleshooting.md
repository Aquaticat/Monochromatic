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
