# Monochromatic

A TypeScript monorepo ecosystem for modern web development.

## Task Runner: Mise

This project uses [Mise](https://mise.jdx.dev/) as the task runner.
Don't use npm scripts directly.

All tasks must be run through Mise commands:
- `mise run test` (correct)
- `mise run build` (correct)
- `npm run test` (incorrect)
- `pnpm test` (incorrect)

## What's Inside

- **Development Configurations**: Shareable ESLint, TypeScript, Vite configs
- **Functional Utilities**: Pure functions library with dual Node/browser builds
- **CSS Framework**: Monochromatic design system
- **Documentation**: Astro-powered documentation sites
- **Figma Plugin**: Design system integration tools

## Initial Setup

After cloning, you'll see this warning on first `cd`:

```txt
mise WARN  missing: bun@x.x.x pnpm@x.x.x ...
mise WARN  error executing hook: No such file or directory (os error 2)
```

**This is expected.**
The `enter` hook uses nushell, which mise needs to install first.

Run manually once:

```bash
mise install
```

After this, subsequent directory entries will work normally.

Then run project setup and build:

```bash
mise run prepareAndBuild
```

## Essential Commands

### Building
```bash
# Build everything
mise run build

# Build and watch (development)
mise run build--watch
```

### Testing
```bash
# Run all tests (from workspace root only)
mise run test

# Unit tests with coverage
mise run test:unit

# Test specific file
mise run test:unit -- packages/module/es/src/boolean.equal.unit.test.ts

# Browser tests
mise run test:browser -- packages/module/es/src/boolean.equal.browser.test.ts
```

### Development Workflow
```bash
# Build + test together
mise run buildAndTest

# Full dev mode (build + test watch)
mise run buildAndTest--watch
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

- **Task Runner**: Mise (calls pnpm automatically)
- **Package Manager**: pnpm (with `catalog:` and non-native modules)
- **Bundler**: Vite (rolldown-vite)
- **Language**: TypeScript (non-native beta)
- **Testing**: Vitest (also uses rolldown-vite under the hood)

## Dropping Windows as a development platform

Some tools aren't available on Windows:

- Zellij

Use WSL2 when developing on Windows.
The recommended WSL distro is Arch Linux or Debian or Ubuntu.
