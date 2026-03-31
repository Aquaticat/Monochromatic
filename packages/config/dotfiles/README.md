# config-dotfiles

Dotfile configs baked into the dev VM image at build time.
The Containerfile COPYs these into the user's `~/.config/` directory.

## Files

- `ghostty/config` -- Ghostty terminal configuration
- `mise/config.toml` -- global mise config (nushell tool for monorepo task runner)

## Adding a new dotfile

1. Create a subdirectory matching the `~/.config/` target (e.g. `foo/` for `~/.config/foo/`)
2. Add the config file(s) inside it
3. Add a corresponding `COPY` line in the vm-builder Containerfile
