# Kilocode Rules

This directory contains custom rules for the Monochromatic TypeScript monorepo that are used by AI code assistants following the Kilocode format.

## Rule Files

- **communication_style.md** - Defines communication patterns, forbidden language, and direct response style
- **project_overview.md** - Repository structure, architecture, build system, and dependency management
- **development_commands.md** - Essential Moon commands, search tools, and script preferences
- **typescript_standards.md** - Comprehensive TypeScript coding conventions and best practices
- **documentation_standards.md** - Technical writing style, TSDoc comments, Markdown conventions, and Git commit guidelines
- **testing_requirements.md** - Vitest configuration, coverage requirements, and test structure patterns
- **third_party_libraries.md** - Guidelines for working with external libraries, documentation retrieval, and repository management
- **code_simplification.md** - Core philosophy of questioning complexity and preferring simple, functional approaches
- **linting_code_quality.md** - Common linting fixes and patterns for ESLint and Oxlint

## Migration Notes

These rules were migrated from the original CLAUDE.md file to follow the Kilocode custom rules format. The migration:
- Split the monolithic file into focused, categorized rule files
- Removed AI-specific references (Claude, etc.) to be tool-agnostic
- Maintained all essential project guidelines and standards
- Organized content for better maintainability and discoverability

## Usage

These rules are automatically loaded by Kilocode-compatible AI assistants when working with this repository. They provide context and guidelines for:
- Writing code that follows project conventions
- Understanding the monorepo architecture
- Using the correct development commands
- Maintaining consistent documentation
- Following testing best practices
- Handling third-party dependencies properly

For more information about Kilocode custom rules, see: https://kilocode.ai/docs/advanced-usage/custom-rules