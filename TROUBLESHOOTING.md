# Troubleshooting Guide

This troubleshooting guide has been organized into focused categories for easier navigation and maintenance.

## Categories

### [TypeScript & Configuration](TROUBLESHOOTING.typescript.md)
Issues related to TypeScript configuration, ESLint, dprint, and other development tools:
- TypeScript path warnings with dprint
- ESLint configuration best practices
- Stylelint and postcss-html resolution
- Type predicate assignment errors with complex conditional types

### [Testing & Vitest](TROUBLESHOOTING.testing.md)
Problems with testing setup and Vitest configuration:
- Vitest UI port binding issues on Windows
- Duplicate describe blocks causing missing test output
- Vitest dependency resolution problems
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

### [VSCode-Specific](TROUBLESHOOTING.vscode.md)
VSCode-specific troubleshooting (already exists):
- Multiple workspace instances in WSL
- Remote development setup
- VSCode extension issues

## Quick Links

For common issues:
- **Slow builds?** → [Build performance](TROUBLESHOOTING.performance.build.md)
- **Test failures not showing?** → [Duplicate describe blocks](TROUBLESHOOTING.testing.md#vitest-missing-assertions-or-console-output-with-duplicate-describe-blocks)
- **Fresh clone fails?** → [Build order dependencies](TROUBLESHOOTING.vite.md#vite-config-build-order-in-mise)
- **TypeScript path warnings?** → [dprint configuration](TROUBLESHOOTING.typescript.md#typescript-path-warnings-with-dprint)
- **Configuration not working as expected?** → [TOML issues and alternatives](TROUBLESHOOTING.toml.md#silent-overwrites-the-configuration-killer)
- **Figma automation not working?** → [The WebGL wall](TROUBLESHOOTING.figma-browser-automation.md)

## Contributing

When adding new troubleshooting content:
1. Choose the most appropriate category file
2. Follow the existing format with clear problem/solution structure
3. Include reproduction steps and root cause analysis when possible
4. Update this index file if adding new categories
