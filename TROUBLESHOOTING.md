# Troubleshooting Guide

This troubleshooting guide has been organized into focused categories for easier navigation and maintenance.

## Categories

### [TypeScript & Configuration](TROUBLESHOOTING.typescript.md)
Issues related to TypeScript configuration, ESLint, dprint, and other development tools:
- TypeScript path warnings with dprint
- ESLint configuration best practices
- Stylelint and postcss-html resolution
- Proto and Rust installation issues
- Type predicate assignment errors with complex conditional types

### [Testing & Vitest](TROUBLESHOOTING.testing.md)
Problems with testing setup and Vitest configuration:
- Vitest UI port binding issues on Windows
- Duplicate describe blocks causing missing test output
- Vitest dependency resolution problems
- Test suite organization best practices

### [Moon Build System](TROUBLESHOOTING.moon.md)
Moon task runner and build system issues:
- Fresh clone setup and build order dependencies
- Moon performance optimization in WSL
- Task dependency resolution problems
- Caching and incremental build issues

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
- Proto tool version management
- pnpm workspace configuration issues
- Dependency resolution conflicts

### [Performance Optimization](TROUBLESHOOTING.performance.md)
Performance-related issues and optimizations:
- Moon prepare optimization strategies
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
- **Slow builds?** → [Moon performance](TROUBLESHOOTING.moon.md#moon-performance-in-wsl)
- **Test failures not showing?** → [Duplicate describe blocks](TROUBLESHOOTING.testing.md#vitest-missing-assertions-or-console-output-with-duplicate-describe-blocks)
- **Fresh clone fails?** → [Build order dependencies](TROUBLESHOOTING.moon.md#fresh-clone-setup-lessons-from-the-build-order-saga)
- **TypeScript path warnings?** → [dprint configuration](TROUBLESHOOTING.typescript.md#typescript-path-warnings-with-dprint)
- **Package management issues?** → [Proto version management](TROUBLESHOOTING.dependencies.md#proto-tool-version-management)
- **Configuration not working as expected?** → [TOML issues and alternatives](TROUBLESHOOTING.toml.md#silent-overwrites-the-configuration-killer)

## Contributing

When adding new troubleshooting content:
1. Choose the most appropriate category file
2. Follow the existing format with clear problem/solution structure
3. Include reproduction steps and root cause analysis when possible
4. Update this index file if adding new categories
