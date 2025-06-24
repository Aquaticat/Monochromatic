# Monochromatic

A TypeScript monorepo ecosystem for modern web development.

## Task Runner: Moon

**IMPORTANT: This project uses [Moon](https://moonrepo.dev/) as the task runner. DO NOT use npm scripts directly.**

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

### Claude Code Conversation Indexing

**⚠️ SECURITY WARNING**: These commands permanently delete conversation data after successful indexing!

```bash
# Index all Claude conversations for searchability (DELETES data after indexing)
moon run indexClaude

# Index only user messages (CLEARS ~/.claude.json history after indexing)
moon run indexClaudeMessages

# Index only MCP server logs (DELETES log files after indexing)
moon run indexClaudeMcpLogs
```

These tasks index Claude Code conversation data into Meilisearch for improved context awareness and searchability.

**How it works**:
1. Reads conversation data from Claude Code's storage locations
2. Indexes the data into Meilisearch for searchability
3. **Automatically deletes the original data for security** (only if indexing succeeds)
   - User messages: Clears the `history` field in `~/.claude.json`
   - MCP logs: Deletes log files from `~/.cache/claude-cli-nodejs/`

**Note**: If indexing fails, data is NOT deleted for safety. You can re-run the command after fixing any issues.

## Project Structure

```
packages/
├── config/              # Tool configurations
├── module/es/           # Functional utilities
├── style/monochromatic/ # CSS framework
├── site/astro-test/     # Documentation
├── figma-plugin/        # Figma tools
└── build/               # Build utilities
```

## Technical Stack

- **Package Manager**: pnpm with workspaces
- **Task Runner**: Moon CLI
- **Bundler**: Vite v7+
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest

## Documentation

Detailed project conventions and guidelines are in [CLAUDE.md](./CLAUDE.md)
