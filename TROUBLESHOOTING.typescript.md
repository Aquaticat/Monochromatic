# TypeScript & Configuration Troubleshooting

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

## Stylelint can't resolve postcss-html

```txt
Error: Cannot resolve custom syntax module "postcss-html". Check that module "postcss-html" is available and spelled correctly.  Caused by: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'postcss-html' imported from C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\utils\dynamicImport.cjs     at getCustomSyntax (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\getPostcssResult.cjs:87:11)     at async getPostcssResult (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\getPostcssResult.cjs:30:17)     at async lintSource (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\lintSource.cjs:87:4)     at async postcssPlugin.standalone [as lint] (C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\eeb6b75a982c201a8f1cb0d3610228ba6f7b7eefc757c56e6748a193c6779ee7\node_modules\stylelint\lib\standalone.cjs:150:26)     at async Nm.lintDocument (c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:6761)     at async fy.Rq (c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:66442)     at async Ef.iy (c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:55936)     at async c:\Users\user\.vscode-oss\extensions\stylelint.vscode-stylelint-1.5.3-universal\dist\start-server.js:73:54917
```

```yaml name=pnpm-workspace.yaml
packageExtensions:
  stylelint:
    dependencies:
      'postcss-html': '*'