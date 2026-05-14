# backup-path

Creates a timestamped backup copy of a file or directory at `bak/<timestamp>/`.

## What it does

Given a file or directory path, `backup-path` copies it to a new backup location under `bak/<ISO timestamp>/`, preserving timestamps and recursively copying directories.

## Usage

### Via mise (recommended)

```sh
mise run backup-path <path>
```

### Direct invocation

```sh
bun run src/index.ts <path>
# or
bunx backup-path <path>
```

## Arguments

- `path` (required): Path to the file or directory to back up.

## Output

Creates: `bak/<YYYYMMDDTHHMMSS>/<basename-of-path>`

The timestamp directory name uses ISO format with colons removed (e.g., `bak/20260514T103000/`).

## Environment

No environment variables are required.
