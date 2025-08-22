# Troubleshooting Guide

This troubleshooting guide has been organized into focused categories for easier navigation and maintenance.

## Categories

### [TypeScript & Configuration](TROUBLESHOOTING.typescript.md)
Issues related to TypeScript configuration, ESLint, dprint, and other development tools:
- TypeScript path warnings with dprint
- ESLint configuration best practices
- Stylelint and postcss-html resolution
- Proto and Rust installation issues

### [Testing & Vitest](TROUBLESHOOTING.testing.md)
Problems with testing setup and Vitest configuration:
- Vitest UI port binding issues on Windows
- Duplicate describe blocks causing missing test output
- Vitest dependency resolution problems
- Test suite organization best practices

### [Moon Build System](TROUBLESHOOTING.moon.md)
Moon build orchestrator performance and configuration:
- Moon performance issues in WSL
- Cache performance with large input sets
- Fresh clone setup and dependency resolution
- Build order dependencies and circular references

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
Package management and dependency resolution:
- Proto tool version management
- Workspace cycle warnings
- pnpm configuration and best practices

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

### [VSCode-Specific](TROUBLESHOOTING.vscode.md)
VSCode-specific troubleshooting (already exists):
- Multiple workspace instances in WSL
- Remote development setup
- VSCode extension issues

## Quick Links

For common issues:
- **Slow builds?** → [Moon Performance](TROUBLESHOOTING.moon.md#moon-performance-in-wsl)
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
