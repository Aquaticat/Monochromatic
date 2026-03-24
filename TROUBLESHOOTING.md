# Troubleshooting Guide

This troubleshooting guide has been organized into focused categories for easier navigation and maintenance.

## Categories

### [TypeScript & Configuration](TROUBLESHOOTING.typescript.md)
Issues related to TypeScript configuration, ESLint, dprint, and other development tools:
- TypeScript path warnings with dprint
- ESLint configuration best practices
- Stylelint and postcss-html resolution
- Type predicate assignment errors with complex conditional types

### [Testing](TROUBLESHOOTING.testing.md)
Problems with test execution and test suite organization:
- Duplicate describe blocks causing missing or misattributed test output
- Test suite organization best practices

### [Editor Setup](TROUBLESHOOTING.editors.md)
Editor installation and configuration issues:
- VS Code development container setup
- Helix editor installation on Debian/Ubuntu
- Editor-specific configuration problems

### [Vite Configuration](TROUBLESHOOTING.vite.md)
Vite build system and configuration problems:
- Build order issues with config packages
- HTML output directory structure
- Vite config circular dependencies

### [Dependencies & Package Management](TROUBLESHOOTING.dependencies.md)
Package management and dependency resolution problems:
- pnpm workspace configuration issues
- Dependency resolution conflicts

### [Performance Optimization](TROUBLESHOOTING.performance.md)
Performance-related issues and optimizations:
- Build preparation optimization strategies
- WSL performance improvements
- File system vs binary execution trade-offs

### [Configuration Snippets](TROUBLESHOOTING.configuration.md)
Useful configuration examples and snippets:
- GitHub MCP server configuration
- Caddy build commands with extensions
- Other tool configurations

### [Configuration Format Issues](TROUBLESHOOTING.toml.md)
Problems with configuration file formats and why TOML can be problematic:
- TOML table repetition and silent overwrites
- Configuration debugging nightmares
- Better alternatives to TOML (JSON, YAML, JSON5)
- Real-world examples of TOML-caused production incidents

### [Figma and browser automation](TROUBLESHOOTING.figma-browser-automation.md)
The WebGL wall: why AI agents cannot meaningfully automate Figma through browser tools:
- Canvas content is invisible to DOM inspection and browser automation
- Figma MCP covers node structure but not comments, prototypes, or annotations
- No automated solution exists for prototype review or comment extraction
- Workarounds require human-in-the-loop screenshotting

### [C-Like Comment Syntax](TROUBLESHOOTING.cLikeComments.md)
Issues with C-style comment syntax that affect multiple programming languages:
- Block comment nesting limitations and why `/* */` comments cannot be nested
- Commenting out code that contains existing block comments
- IDE comment features and best practices
- Language-specific comment syntax differences

### [iOS Safari touch events](TROUBLESHOOTING.ios-safari-touch.md)
iOS Safari claims `touch-action: none` support but does not reliably honor it:
- `pointercancel` fires despite `touch-action: none` on the target element
- Long-press triggers system context menu instead of application gesture
- Three-part workaround: `touchstart`/`touchmove` preventDefault, `pointerdown` preventDefault, `-webkit-touch-callout: none`
- Twelve years of WebKit bug 133112 and counting

### [Bundling](TROUBLESHOOTING.bundling.md)
Client-side bundling issues where Node.js code leaks into browser bundles:
- `node:` protocol dynamic imports cause CORS errors in browser consoles
- Environment guards for dual-target modules

### [CLI bin entries](TROUBLESHOOTING.cli-bin.md)
Problems with CLI tools installed via `node_modules/.bin/`:
- Missing shebang causes Unix to fall back to `/bin/sh`, triggering ImageMagick `import` hangs
- Cross-platform shebang and `.cmd` wrapper interaction

### [VSCode-Specific](TROUBLESHOOTING.vscode.md)
VSCode-specific troubleshooting (already exists):
- Multiple workspace instances in WSL
- Remote development setup
- VSCode extension issues

## Quick Links

For common issues:
- **Slow builds?** → [Build performance](TROUBLESHOOTING.performance.build.md)
- **Test failures not showing?** → [Duplicate describe blocks](TROUBLESHOOTING.testing.md#duplicate-describe-blocks-causing-missing-or-misattributed-test-output)
- **Fresh clone fails?** → [Build order dependencies](TROUBLESHOOTING.vite.md#vite-config-build-order-in-mise)
- **TypeScript path warnings?** → [dprint configuration](TROUBLESHOOTING.typescript.md#typescript-path-warnings-with-dprint)
- **`Cannot find name` for DOM types in a non-browser package?** → [All packages must extend config-typescript/dom](TROUBLESHOOTING.typescript.md#all-packages-must-extend-config-typescriptdom)
- **Type errors from `node_modules` JSR packages?** → [JSR `.ts` files and `skipLibCheck`](TROUBLESHOOTING.typescript.md#jsr-packages-ship-ts-source-files-that-skiplibcheck-cannot-skip)
- **Configuration not working as expected?** → [TOML issues and alternatives](TROUBLESHOOTING.toml.md#silent-overwrites-the-configuration-killer)
- **Figma automation not working?** → [The WebGL wall](TROUBLESHOOTING.figma-browser-automation.md)
- **CORS errors for `node:` imports in browser?** → [node: protocol in bundles](TROUBLESHOOTING.bundling.md#node-protocol-imports-cause-cors-errors-in-browser-bundles)
- **CLI hangs with ImageMagick errors?** → [Missing shebang](TROUBLESHOOTING.cli-bin.md#cli-command-hangs-on-unix-with-imagemagick-errors)
- **Touch gestures broken on iPhone?** → [iOS Safari touch-action betrayal](TROUBLESHOOTING.ios-safari-touch.md)

## Contributing

When adding new troubleshooting content:
1. Choose the most appropriate category file
2. Follow the existing format with clear problem/solution structure
3. Include reproduction steps and root cause analysis when possible
4. Update this index file if adding new categories
