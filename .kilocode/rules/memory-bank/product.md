# Product overview

## Why monochromatic exists

Monochromatic is a comprehensive TypeScript monorepo ecosystem designed to provide:
- Reusable configuration packages for modern web development tools
- A functional programming utility library (`@monochromatic-dev/module-es`)
- CSS styling framework with monochromatic design principles
- Shared development infrastructure for consistent project setup

## Problems it solves

1. **Configuration fragmentation**: Provides centralized, reusable configurations for ESLint, TypeScript, Vite, Stylelint, and other tools
2. **Code reusability**: Offers a functional programming utility library with common patterns
3. **Consistent styling**: Delivers a monochromatic CSS framework with design system principles
4. **Monorepo complexity**: Streamlines multi-package development with pnpm workspaces and Moon task orchestration

## How it works

The project operates as a monorepo with specialized packages:
- **Config packages** export shareable configurations for development tools
- **Module packages** provide functional utilities with both Node.js and browser support
- **Style packages** offer CSS frameworks and mixins
- **Build tools** handle TypeScript compilation, bundling with Vite, and testing with Vitest

## User experience goals

- **Developer-first**: Straightforward integration of configurations and utilities into new projects
- **Type safety**: Full TypeScript support with explicit types and comprehensive TSDoc
- **Performance**: Tree-shakeable modules with separate Node/browser builds
- **Quality**: Enforced linting, formatting, and testing standards
- **Portability**: Interoperable modules that work across different environments
