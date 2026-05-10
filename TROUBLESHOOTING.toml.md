# TOML footguns that motivated the JSONC parser

This documents the actual TOML specification pitfalls we evaluated
when deciding to write a comment-preserving JSONC parser (`packages/module/es`)
instead of adopting TOML for configuration.

## Duplicate table headers are a parse error, not a silent overwrite

A common misconception is that repeating `[database]` twice in a TOML file
silently overwrites the first definition.
The TOML v1.0.0 spec explicitly prohibits this:

> "Like keys, you cannot define a table more than once. Doing so is invalid."

All compliant parsers (Python `tomllib`, Rust `toml`, JS `smol-toml`) reject
duplicate table headers with a parse error. This is **not** a footgun:
the spec and implementations handle it correctly.

The real footguns are subtler.

## Array-of-tables `[[thing]]` loses context silently

Each `[[thing]]` header creates a new element in an array.
References to sub-tables always bind to the **most recently defined** element,
with no warning when context shifts:

```toml
[[products]]
name = "Hammer"

[[products.variants]]
name = "small" # variant of Hammer

[[products]]
name = "Nail" # context silently shifts -- Hammer is closed

[[products.variants]]
name = "gold" # variant of Nail, not Hammer
```

The spec states:

> "Any reference to an array of tables points to the most recently defined
> table element of the array."

There is no syntax to append a variant to a **previous** array element
once a new `[[products]]` has been opened.
In a large file, accidentally placing `[[products]]` in the wrong position
silently reassigns all subsequent sub-tables to the wrong parent.

## Dotted keys and explicit tables conflict unpredictably

Dotted keys implicitly create intermediate tables.
Once created, the same table cannot be reopened with an explicit `[header]`:

```toml
fruit.apple.color = "red" # implicitly creates [fruit] and [fruit.apple]

[fruit.apple] # INVALID -- table already defined via dotted key
taste = "sweet"
```

But adding a **sub-table** under an implicitly created table is valid:

```toml
fruit.apple.color = "red"

[fruit.apple.texture] # valid -- new sub-table, not a redefinition
smooth = true
```

The asymmetry is hard to remember:
you can extend an implicit table downward but not sideways.
The spec says:

> "Since tables cannot be defined more than once, redefining such tables
> using a `[table]` header is not allowed. Likewise, using dotted keys to
> redefine tables already defined in `[table]` form is not allowed."

## Parser implementations disagree on edge cases

The spec's interaction rules between dotted keys and explicit sub-tables
are ambiguous enough that major parsers disagree:

```toml
[tool.hatch]
version.source = "vcs"

[tool.hatch.version.raw-options]
local_scheme = "no-local-version"
```

- Python `tomllib`: parses successfully (merges into `version`)
- Rust `toml` / `toml_edit`: rejects with "duplicate key: `version`"

See [toml-rs/toml#439](https://github.com/toml-rs/toml/issues/439).
A file that works in one ecosystem silently breaks in another.

## No value reuse or interpolation

TOML has no mechanism for referencing previously defined values.
Repeated settings across environments must be duplicated:

```toml
[dev.deploy.parameters]
region = "us-east-1"
capabilities = "CAPABILITY_IAM"

[prod.deploy.parameters]
region = "us-east-1" # must repeat
capabilities = "CAPABILITY_IAM" # must repeat
```

YAML solves this with anchors (`&default` / `*default`).
JSONC can solve it by switching to TypeScript when config needs logic
(per our architecture decision in CLAUDE.md).
TOML has no equivalent: every value is a standalone literal.

## Why we chose JSONC

These footguns, combined with TOML's inability to represent
the configuration patterns we need, led us to write a comment-preserving
JSONC parser in `packages/module/es` instead:

- **No ambiguous table semantics** -- JSON objects have one definition site
- **Comments preserved** -- `//` and `/* */` survive round-trip parsing
- **Trailing commas** -- easier to edit and diff
- **Ecosystem alignment** -- VSCode, TypeScript, ESLint, oxlint all use JSONC
- **Escape hatch to TypeScript** -- when config needs logic (`if`, `map`, `await`),
  switch from config-as-data to a `.ts` file that imports the same schema

The comment nesting limitation (`/* */` cannot nest) is a known constraint
we accepted; see `TROUBLESHOOTING.cLikeComments.md` for how it affected
the parser implementation.
