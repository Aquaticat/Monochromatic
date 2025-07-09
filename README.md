# Monochromatic

A TypeScript monorepo ecosystem for modern web development.

## Task Runner: Moon

This project uses [Moon](https://moonrepo.dev/) as the task runner.
Don't use npm scripts directly.

All tasks must be run through Moon commands:
- `moon run test` (correct)
- `moon run build` (correct)
- `npm run test` (incorrect)
- `pnpm test` (incorrect)

## What's Inside

- **Development Configurations**: Shareable ESLint, TypeScript, Vite configs
- **Functional Utilities**: Pure functions library with dual Node/browser builds
- **CSS Framework**: Monochromatic design system
- **Documentation**: Astro-powered documentation sites
- **Figma Plugin**: Design system integration tools

## Initial Setup

```bash
# 1. Install proto globally. See https://moonrepo.dev/docs/proto/install
bash <(curl -fsSL https://moonrepo.dev/install/proto.sh)

# 2. Run project setup and build. Note that proto auto installs moon.
moon run prepareAndBuild
```

## Essential Commands

### Building
```bash
# Build everything
moon run build

# Build and watch (development)
moon run buildWatch

# Build specific package
moon run es:js
moon run es:types
```

### Testing
```bash
# Run all tests (from workspace root only)
moon run test

# Unit tests with coverage
moon run testUnit

# Test specific file
moon run testUnit -- packages/module/es/src/boolean.equal.unit.test.ts

# Browser tests
moon run testBrowser -- packages/module/es/src/boolean.equal.browser.test.ts
```

### Development Workflow
```bash
# Build + test together
moon run buildAndTest

# Full dev mode (build + test watch)
moon run buildAndTestWatch
```

### Troubleshooting
```bash
# Clear Moon cache if needed
moon clean --lifetime '1 seconds'
```

## Project Structure

```txt
packages/
├── config/              # Tool configurations
├── module/es/           # Functional utilities
├── style/monochromatic/ # CSS framework
├── site/astro-test/     # Documentation
├── figma-plugin/        # Figma tools
└── build/               # Build utilities
```

## Technical Stack

- **Toolchain Manager**: Proto
- **Task Runner**: Moon (calls pnpm automatically)
- **Package Manager**: pnpm (with `catalog:` and non-native modules)
- **Bundler**: Vite (rolldown-vite)
- **Language**: TypeScript (non-native beta)
- **Testing**: Vitest (also uses rolldown-vite under the hood)

## Dropping Windows as a development platform

Some tools aren't available on Windows:

- Zellij

Use WSL2 when developing on Windows.
The recommended WSL distro is Arch Linux or Debian or Ubuntu.
