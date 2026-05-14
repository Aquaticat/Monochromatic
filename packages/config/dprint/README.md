# config-dprint

Ready to publish.

Shared [dprint](https://dprint.dev/) configuration for Monochromatic repositories.

## What it configures

- **Line width**: 90 characters, LF line endings, 2-space indentation
- **TypeScript**: semicolons, single quotes, trailing commas, hanging parameters
- **CSS** (Malva): single quotes, short hex colors, trailing commas
- **Markup** (HTML/Astro/Vue): single quotes, 1 attribute per line
- **YAML**: single quotes, no indented block sequences
- **TOML**: default settings with optional leading spaces in comments
- **JSON**: trailing commas in tsconfig.json and editor settings
- **Post-format linting**: handled by mise `format` tasks, not a dprint Exec plugin

## Usage

Create a `dprint.json` in your project root:

```json
{
  "extends": ["./node_modules/@monochromatic-dev/config-dprint/index.json"]
}
```

See `example.dprint.json` for a working reference.
